-- ============================================================
-- PayRentPro : หลังบ้านผู้ดูแลระบบ (หน้า /admin — founder เท่านั้น)
--
-- - RPC get_all_members() : รายชื่อสมาชิกทั้งหมด + จำนวนห้องที่ใช้ต่อคน
-- - RPC get_pending_membership_payments() : ค่าสมาชิกรอตรวจทั้งหมด
--   (+ อีเมลของ admin เจ้าของสลิป)
-- - policy เพิ่ม: founder แก้แถว membership_payments ได้ทุกแถว
--   (สำหรับปุ่ม "ปฏิเสธ" — update status='rejected' จากหน้าเว็บ)
--   ส่วน "อนุมัติ" ใช้ RPC approve_membership_payment ที่มีอยู่แล้วฝั่ง DB
--   (ต่ออายุ + ตั้ง plan/room_limit อัตโนมัติ)
--
-- ทั้งสอง RPC เป็น security definer + ตรวจ founder ก่อนทุกครั้ง
-- (ไม่ใช่ founder → raise exception 'forbidden')
--
-- หมายเหตุ rooms_used: นับ rentals ที่ landlord_id ชี้กลับมาที่ user_id
-- ของสมาชิกแต่ละคน (คอลัมน์เชื่อมคน-ห้องของ schema นี้)
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- 1) รายชื่อสมาชิกทั้งหมด (founder เท่านั้น)
create or replace function public.get_all_members()
returns table (
  email text,
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
  if not exists (
    select 1 from public.admins a
     where a.user_id = auth.uid() and a.plan = 'founder'
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select a.email,
         a.plan,
         a.status,
         a.expire_date,
         a.room_limit,
         a.created_at,
         (select count(*) from public.rentals r where r.landlord_id = a.user_id)
    from public.admins a
   where a.plan is not null
   order by a.expire_date asc nulls last, a.email asc;
end;
$$;

grant execute on function public.get_all_members() to authenticated;

-- 2) ค่าสมาชิกรอตรวจทั้งหมด + อีเมลเจ้าของสลิป (founder เท่านั้น)
create or replace function public.get_pending_membership_payments()
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
     where a.user_id = auth.uid() and a.plan = 'founder'
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

-- 3) founder ปฏิเสธสลิปได้ทุกแถว (update status จากหน้าเว็บ)
--    (policy นี้ OR รวมกับ policy แก้แถวของตัวเองที่มีอยู่แล้ว)
drop policy if exists "membership_payments_founder_update" on public.membership_payments;
create policy "membership_payments_founder_update" on public.membership_payments
  for update to authenticated
  using (exists (
    select 1 from public.admins fa
     where fa.user_id = auth.uid() and fa.plan = 'founder'
  ))
  with check (exists (
    select 1 from public.admins fa
     where fa.user_id = auth.uid() and fa.plan = 'founder'
  ));
