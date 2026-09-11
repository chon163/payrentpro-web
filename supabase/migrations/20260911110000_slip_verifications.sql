-- ============================================================
-- PayRentPro : ตรวจสลิปค่าสมาชิกอัตโนมัติด้วย EasySlip
--
-- ใช้เฉพาะ flow "สมัคร/ต่ออายุสมาชิก" (membership_payments) เท่านั้น
-- flow ผู้เช่า (transactions / line-webhook) ไม่ถูกแตะในไฟล์นี้
--
-- ของใหม่ในไฟล์นี้
--   1) ตาราง slip_verifications — กันสลิปซ้ำด้วย unique(txn_ref)
--   2) membership_payments.note — เหตุผลที่ต้องให้ founder ตัดสิน
--      (เช่น "ยอดสลิป 399 ≠ ยอดแพ็ก 699")
--   3) สถานะใหม่ 'auto_verified' = EasySlip อ่านสลิปผ่านและยอดตรง
--      (สถานะชั่วคราว → auto_approve_membership_payment เปลี่ยนเป็น
--       'approved' ทันทีในทรานแซกชันเดียว)
--   4) RPC auto_approve_membership_payment(p_id) — ต่ออายุให้อัตโนมัติ
--      **grant ให้ service_role เท่านั้น** (Edge Function เรียก)
--      ห้าม grant ให้ authenticated เด็ดขาด ไม่งั้นผู้ใช้เรียกเองต่ออายุฟรีได้
--   5) get_pending_membership_payments() คืนคอลัมน์ note เพิ่ม
--      เพื่อให้หน้า /admin เห็นเหตุผลที่สลิปตกมารอตรวจมือ
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- ── 1) ตารางบันทึกสลิปที่ตรวจผ่านแล้ว (กันสลิปเดิมยิงซ้ำ) ─────────────
create table if not exists public.slip_verifications (
  id uuid primary key default gen_random_uuid(),
  -- รหัสอ้างอิงรายการโอนจากธนาคาร (rawSlip.transRef ของ EasySlip)
  -- unique = สลิปใบเดิมใช้ได้ครั้งเดียวในระบบ
  txn_ref text not null unique,
  kind text not null default 'membership',
  ref_id uuid,
  amount numeric not null default 0,
  bank text,
  verified_at timestamptz not null default now()
);

create index if not exists slip_verifications_ref_idx
  on public.slip_verifications (kind, ref_id);

alter table public.slip_verifications enable row level security;

-- เจ้าของแถว membership_payments นั้นอ่านผลตรวจของตัวเองได้
-- (ไม่เปิด insert/update/delete ให้ authenticated เลย — Edge Function
--  ใช้ service_role ซึ่งข้าม RLS อยู่แล้ว)
drop policy if exists "slip_verifications_own_read" on public.slip_verifications;
create policy "slip_verifications_own_read" on public.slip_verifications
  for select to authenticated
  using (
    kind = 'membership'
    and exists (
      select 1
        from public.membership_payments mp
        join public.admins a on a.id = mp.admin_id
       where mp.id = slip_verifications.ref_id
         and ((auth.uid() is not null and a.user_id = auth.uid())
           or (auth.email() is not null and a.email = auth.email()))
    )
  );

-- ── 2) หมายเหตุของรายการ (ให้ founder อ่านตอนตัดสินสลิปที่ยอดไม่ตรง) ──
alter table public.membership_payments
  add column if not exists note text;

-- ── 3) สถานะ 'auto_verified' ────────────────────────────────────────
-- membership_payments.status เป็น text เปล่า ๆ (ไม่มี check constraint)
-- ตั้งแต่ 20260906180000 → ค่าใหม่ใช้ได้ทันทีโดยไม่ต้อง ALTER
-- แต่ถ้ามีใครเพิ่ม constraint ตรงผ่าน SQL Editor ภายหลัง ให้ขยายให้ครบ
-- แทนที่จะปล่อย insert พังเงียบ ๆ
do $$
declare
  v_con text;
begin
  select con.conname into v_con
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
   where ns.nspname = 'public'
     and cls.relname = 'membership_payments'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%status%'
   limit 1;

  if v_con is null then
    raise notice 'membership_payments.status ไม่มี check constraint — ใช้ auto_verified ได้ทันที';
  else
    execute format('alter table public.membership_payments drop constraint %I', v_con);
    alter table public.membership_payments
      add constraint membership_payments_status_check
      check (status in ('pending_review', 'auto_verified', 'approved', 'rejected'));
    raise notice 'ขยาย check constraint % ให้รวม auto_verified แล้ว', v_con;
  end if;
end $$;

-- ── 4) ต่ออายุอัตโนมัติหลัง EasySlip ยืนยันว่ายอดตรง ─────────────────
-- เรียกได้จาก Edge Function (service_role) เท่านั้น
--
-- guard สำคัญ: แถวต้องอยู่สถานะ 'auto_verified' เท่านั้น จึงจะต่ออายุ
-- → ใช้ฟังก์ชันนี้ไปอนุมัติแถว pending_review ที่รอ founder ตรวจไม่ได้
--
-- กติกาต่ออายุ (อ้างจาก MEMBERSHIP_PACKAGES ฝั่งเว็บ):
--   starter = 20 ห้อง / pro = 50 ห้อง / แพ็กอื่นคงค่าเดิมไว้
--   วันหมดอายุใหม่ = วันหมดอายุเดิม (ถ้ายังไม่หมด) + จำนวนเดือนที่ซื้อ
--   ถ้าหมดอายุไปแล้ว/ยังไม่มี → นับจากวันนี้
create or replace function public.auto_approve_membership_payment(p_id uuid)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_row public.membership_payments;
  v_admin public.admins;
  v_base date;
  v_expire date;
  v_limit integer;
begin
  select * into v_row
    from public.membership_payments
   where id = p_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- อนุมัติได้เฉพาะแถวที่ผ่าน EasySlip มาแล้ว (กันเอาไปอนุมัติแถวรอตรวจมือ)
  if v_row.status <> 'auto_verified' then
    return jsonb_build_object('ok', false, 'error', 'not_auto_verified', 'status', v_row.status);
  end if;

  select * into v_admin from public.admins where id = v_row.admin_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'admin_not_found');
  end if;

  -- ต่อจากวันหมดอายุเดิมถ้ายังไม่หมด ไม่งั้นนับจากวันนี้ (ไม่ให้เสียวันฟรี)
  v_base := greatest(coalesce(v_admin.expire_date, current_date), current_date);
  v_expire := (v_base + (v_row.duration_months * interval '1 month'))::date;

  v_limit := case lower(coalesce(v_row.plan_type, ''))
               when 'starter' then 20
               when 'pro' then 50
               else v_admin.room_limit
             end;

  update public.admins
     set plan_type = v_row.plan_type,
         expire_date = v_expire,
         room_limit = v_limit,
         status = 'active'
   where id = v_admin.id;

  update public.membership_payments
     set status = 'approved',
         reviewed_at = now()
   where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'expire_date', v_expire,
    'plan_type', v_row.plan_type,
    'room_limit', v_limit
  );
end;
$$;

-- service_role เท่านั้น — ผู้ใช้เว็บห้ามเรียกเองเด็ดขาด
revoke all on function public.auto_approve_membership_payment(uuid) from public;
revoke all on function public.auto_approve_membership_payment(uuid) from anon;
revoke all on function public.auto_approve_membership_payment(uuid) from authenticated;
grant execute on function public.auto_approve_membership_payment(uuid) to service_role;

-- ── 5) หน้า /admin เห็นหมายเหตุด้วย (เช่น ยอดสลิปไม่ตรงกับแพ็ก) ───────
-- create or replace เปลี่ยน return type ไม่ได้ → drop ก่อน
drop function if exists public.get_pending_membership_payments();

create function public.get_pending_membership_payments()
returns table (
  id uuid,
  email text,
  plan_type text,
  duration_months integer,
  amount numeric,
  slip_image_url text,
  note text,
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
         mp.note,
         mp.created_at
    from public.membership_payments mp
    join public.admins a on a.id = mp.admin_id
   where mp.status = 'pending_review'
   order by mp.created_at asc;
end;
$$;

grant execute on function public.get_pending_membership_payments() to authenticated;
