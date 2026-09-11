-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : ตั้งบัญชีเจ้าของระบบเป็น founder (เปิดหน้า /admin)
--
-- ปัญหาที่แก้ (พบ 2026-09-10): หน้า /admin เข้าไม่ได้ — เมนู "ผู้ดูแล" ไม่ขึ้น
-- และ RPC หลังบ้านตีกลับ forbidden ทุกครั้ง
--
-- สาเหตุ: **ไม่มีแถวไหนใน admins ที่เป็น founder เลย**
-- ยืนยันด้วย get_system_promptpay() (security definer อ่านแถว founder ข้าม RLS)
-- → คืน null โดยไม่ error
--
-- ฟังก์ชันหลังบ้านไม่ได้พัง: ถ้าอ้างคอลัมน์ผิดจะได้ error 42703
-- (column does not exist) แต่ที่ได้จริงคือ P0001 forbidden = ฟังก์ชันอ่าน
-- คอลัมน์ที่มีจริงอยู่แล้ว แค่ไม่เจอใครเป็น founder
--
-- ⚠️ คอลัมน์แพ็กเกจบน DB จริงชื่อ `plan_type` ไม่ใช่ `plan`
--    (ไฟล์ 20260906150000 / 20260906160000 / 20260906190000 ยังเขียน `plan`
--     เพราะ DB ถูกแก้ตรงผ่าน SQL Editor ภายหลัง — migration ตามไม่ทัน)
--    ไฟล์นี้อ่านชื่อคอลัมน์จาก information_schema ตอนรัน จึงทำงานได้ทั้งสองแบบ
--
-- ⚠️ guard ของ RPC หลังบ้านเช็ค `user_id = auth.uid()` เท่านั้น (ไม่เช็ค email
--    ต่างจาก get_membership_status ที่เช็คทั้งสอง) ดังนั้นแถว founder
--    **ต้องมี user_id ผูกกับ auth.users** ไม่ใช่แค่ plan_type = 'founder'
--    ไฟล์นี้ผูก user_id ให้อัตโนมัติจาก auth.users ตามอีเมล
--
-- ▶ วิธีรัน: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
--   (หรือ supabase db push)
--
-- ❗ ต้องเคย login ด้วยอีเมลนี้อย่างน้อยหนึ่งครั้งก่อน เพื่อให้มีแถวใน
--   auth.users ให้ผูก — ถ้ายังไม่มี สคริปต์จะเตือนและไม่ผูก user_id
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  -- ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
  -- ┃  ใส่อีเมลที่คุณใช้ล็อกอินตรงนี้ (บรรทัดเดียวที่ต้องแก้)      ┃
  -- ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  v_email text := 'v.chonnohc@gmail.com';

  v_plan_col text;
  v_uid uuid;
  v_admin uuid;
  v_current text;
begin
  if v_email is null or v_email = '' or v_email like 'เปลี่ยนเป็น%' then
    raise exception 'ยังไม่ได้ใส่อีเมล — แก้ค่า v_email ที่บรรทัดบนก่อนรัน';
  end if;

  -- หาชื่อคอลัมน์แพ็กเกจที่มีจริง (plan_type บน DB จริง / plan ในไฟล์เก่า)
  select column_name into v_plan_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'admins'
     and column_name in ('plan_type', 'plan')
   order by case column_name when 'plan_type' then 1 else 2 end
   limit 1;

  if v_plan_col is null then
    raise exception 'ไม่พบคอลัมน์ plan/plan_type ในตาราง admins';
  end if;
  raise notice 'ใช้คอลัมน์แพ็กเกจ: %', v_plan_col;

  -- auth user ของอีเมลนี้ (ต้องมี ไม่งั้น guard ที่เช็ค user_id จะไม่ผ่าน)
  select id into v_uid from auth.users where lower(email) = lower(v_email) limit 1;
  if v_uid is null then
    raise warning 'ไม่พบ auth user ของ % — ให้ล็อกอินด้วยอีเมลนี้หนึ่งครั้งแล้วรันไฟล์นี้ซ้ำ (ตอนนี้ยังผูก user_id ไม่ได้ /admin จะยังเข้าไม่ได้)', v_email;
  else
    raise notice 'เจอ auth user: %', v_uid;
  end if;

  select id into v_admin from public.admins where lower(email) = lower(v_email) limit 1;

  if v_admin is null then
    -- ยังไม่มีแถว admins → สร้างใหม่เป็น founder
    execute format(
      'insert into public.admins (email, user_id, %I, status, expire_date, room_limit)
       values ($1, $2, ''founder'', ''active'', current_date + 36500, 0)
       returning id', v_plan_col)
    using v_email, v_uid
    into v_admin;
    raise notice 'สร้างแถว admins เป็น founder: %', v_admin;
  else
    -- มีแถวอยู่แล้ว → เลื่อนเป็น founder + ผูก user_id ถ้ายังว่าง
    execute format('select %I::text from public.admins where id = $1', v_plan_col)
      using v_admin into v_current;
    raise notice 'มีแถว admins อยู่แล้ว (% ) แพ็กเกจเดิม: %', v_admin, coalesce(v_current, '(null)');

    execute format(
      'update public.admins
          set %I = ''founder'',
              status = ''active'',
              -- founder ไม่ต้องมีวันหมดอายุใกล้ ๆ มากวน (100 ปี)
              expire_date = greatest(coalesce(expire_date, current_date), current_date + 36500),
              -- room_limit = 0 คือไม่จำกัด ตามที่ fixtures/หน้าสมาชิกใช้
              room_limit = 0,
              user_id = coalesce(user_id, $2)
        where id = $1', v_plan_col)
    using v_admin, v_uid;
    raise notice 'เลื่อนเป็น founder แล้ว';
  end if;

  -- ตรวจผลจริงหลังแก้ (กันกรณี update ไม่โดนแถว)
  execute format(
    'select %I::text from public.admins where id = $1', v_plan_col)
    using v_admin into v_current;
  if v_current is distinct from 'founder' then
    raise exception 'ตั้ง founder ไม่สำเร็จ — ค่าที่ได้: %', coalesce(v_current, '(null)');
  end if;

  if (select user_id from public.admins where id = v_admin) is null then
    raise warning 'ตั้ง founder แล้วแต่ user_id ยังเป็น null — RPC หลังบ้าน (get_all_members / get_pending_membership_payments) จะยังตีกลับ forbidden เพราะ guard เช็ค user_id = auth.uid()';
  else
    raise notice '✓ เรียบร้อย: % เป็น founder และผูก user_id แล้ว — เปิด /admin ได้เลย', v_email;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════
-- กัน migration เก่าย้อนมาทับ: ไฟล์ 20260906150000 / 20260906160000 /
-- 20260906190000 ยังเขียน `a.plan` ถ้าใครรัน supabase db push แล้วไฟล์
-- เหล่านั้นถูกเล่นซ้ำ ฟังก์ชันจะพังทันที (คอลัมน์ plan ไม่มีบน DB จริง)
--
-- ไฟล์นี้มี timestamp ใหม่กว่า จึงรันท้ายสุดและทับค่าที่ถูกต้องไว้
-- get_membership_status คืน **ทั้ง** plan_type และ plan เพื่อให้โค้ดเว็บ
-- เวอร์ชันไหนก็อ่านได้ (ฝั่งเว็บมี helper membershipPlan() รับสองคีย์แล้ว)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.get_membership_status()
returns jsonb language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
        'ok', true,
        'plan_type', a.plan_type,
        'plan', a.plan_type,          -- alias เผื่อโค้ดเก่าอ่าน key นี้
        'status', case
                    when coalesce(a.status, 'active') = 'expired' then 'expired'
                    when a.plan_type = 'founder' then 'active'   -- founder ไม่หมดอายุ
                    when a.expire_date is not null and a.expire_date < current_date then 'expired'
                    else 'active'
                  end,
        'expire_date', a.expire_date,
        'days_left', case when a.expire_date is null then null
                          else (a.expire_date - current_date) end,
        'room_limit', a.room_limit,
        'rooms_used', (select count(*) from public.rentals))
     from public.admins a
     where a.plan_type is not null
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
     limit 1),
    jsonb_build_object('ok', false)
  );
$$;

grant execute on function public.get_membership_status() to authenticated;

-- เบอร์พร้อมเพย์ของเจ้าของระบบ (แถว founder) — ใช้สร้าง QR รับค่าต่ออายุ
create or replace function public.get_system_promptpay()
returns text language sql security definer stable
set search_path = public
as $$
  select a.promptpay
    from public.admins a
   where a.plan_type = 'founder'
   limit 1;
$$;

grant execute on function public.get_system_promptpay() to authenticated;

-- รายชื่อสมาชิกทั้งหมด (founder เท่านั้น)
-- คืนทั้ง plan_type และ plan เพื่อความเข้ากันได้ → ต้อง drop ก่อนเพราะ
-- create or replace เปลี่ยน return type ไม่ได้
drop function if exists public.get_all_members();

create function public.get_all_members()
returns table (
  email text,
  plan_type text,
  plan text,
  status text,
  expire_date date,
  room_limit integer,
  created_at timestamptz,
  rooms_used bigint
) language plpgsql security definer stable
set search_path = public
as $$
begin
  -- guard: เช็คทั้ง user_id และ email (เดิมเช็คแค่ user_id — ถ้าแถว founder
  -- ยังไม่ผูก user_id จะตีกลับ forbidden ทั้งที่เป็น founder จริง)
  if not exists (
    select 1 from public.admins a
     where a.plan_type = 'founder'
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select a.email,
         a.plan_type,
         a.plan_type,
         a.status,
         a.expire_date,
         a.room_limit,
         a.created_at,
         (select count(*) from public.rentals r where r.landlord_id = a.id)
    from public.admins a
   where a.plan_type is not null
   order by a.expire_date asc nulls last, a.email asc;
end;
$$;

grant execute on function public.get_all_members() to authenticated;

-- ค่าสมาชิกรอตรวจทั้งหมด + อีเมลเจ้าของสลิป (founder เท่านั้น)
drop function if exists public.get_pending_membership_payments();

create function public.get_pending_membership_payments()
returns table (
  id uuid,
  email text,
  plan_type text,
  duration_months integer,
  amount numeric,
  slip_image_url text,
  created_at timestamptz
) language plpgsql security definer stable
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.admins a
     where a.plan_type = 'founder'
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select mp.id,
         a.email,
         mp.plan_type,
         mp.duration_months,
         mp.amount,
         mp.slip_image_url,
         mp.created_at
    from public.membership_payments mp
    join public.admins a on a.id = mp.admin_id
   where mp.status = 'pending_review'
   order by mp.created_at asc;
end;
$$;

grant execute on function public.get_pending_membership_payments() to authenticated;

-- founder ปฏิเสธสลิปได้ทุกแถว (ปุ่ม "ปฏิเสธ" — update status จากหน้าเว็บ)
drop policy if exists "membership_payments_founder_update" on public.membership_payments;
create policy "membership_payments_founder_update" on public.membership_payments
  for update to authenticated
  using (exists (
    select 1 from public.admins fa
     where fa.plan_type = 'founder'
       and ((auth.uid() is not null and fa.user_id = auth.uid())
         or (auth.email() is not null and fa.email = auth.email()))
  ))
  with check (exists (
    select 1 from public.admins fa
     where fa.plan_type = 'founder'
       and ((auth.uid() is not null and fa.user_id = auth.uid())
         or (auth.email() is not null and fa.email = auth.email()))
  ));
