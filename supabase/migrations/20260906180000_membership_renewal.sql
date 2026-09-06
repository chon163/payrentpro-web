-- ============================================================
-- PayRentPro : ระบบต่ออายุสมาชิก (หน้า "สมาชิกของฉัน")
--
-- - ตาราง membership_payments : คำสั่งซื้อ/ต่ออายุของแอดมินแต่ละราย
--     status = 'pending_review' → ผู้ก่อตั้งตรวจสลิปแล้วเปลี่ยนเป็น
--     'approved' / 'rejected' (อัปเดต plan/expire_date ฝั่ง DB ตาม manual)
-- - RPC get_system_promptpay() : เบอร์พร้อมเพย์ "เจ้าของระบบ"
--     (แถว admins ที่ plan = 'founder') สำหรับสร้าง QR รับเงินต่ออายุ
-- - RLS : เห็น/แทรกได้เฉพาะแถวของตัวเอง (match admin ด้วย user_id หรือ email)
-- - policy เพิ่ม: authenticated อัปโหลดรูปสลิปต่ออายุ (membership/*.jpg)
--   ลง bucket "receipts" ที่มีอยู่แล้ว (สลิปใช้ bucket เดียวกับใบเสร็จ)
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- 1) ตารางคำสั่งซื้อ/ต่ออายุสมาชิก
create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admins(id) on delete cascade,
  plan_type text not null,
  duration_months integer not null,
  amount numeric not null default 0,
  status text not null default 'pending_review',
  slip_image_url text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.membership_payments enable row level security;

-- ดูได้เฉพาะแถวของตัวเอง (admin ที่ match user_id หรือ email ของผู้ login)
drop policy if exists "membership_payments_own_read" on public.membership_payments;
create policy "membership_payments_own_read" on public.membership_payments
  for select to authenticated
  using (exists (
    select 1 from public.admins a
     where a.id = membership_payments.admin_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ));

-- แทรกได้เฉพาะในชื่อแอดมินของตัวเอง
drop policy if exists "membership_payments_own_insert" on public.membership_payments;
create policy "membership_payments_own_insert" on public.membership_payments
  for insert to authenticated
  with check (exists (
    select 1 from public.admins a
     where a.id = membership_payments.admin_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ));

-- แก้ได้เฉพาะแถวของตัวเอง (เว็บ update slip_image_url หลังอัปโหลดรูปสลิป)
drop policy if exists "membership_payments_own_update" on public.membership_payments;
create policy "membership_payments_own_update" on public.membership_payments
  for update to authenticated
  using (exists (
    select 1 from public.admins a
     where a.id = membership_payments.admin_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ))
  with check (exists (
    select 1 from public.admins a
     where a.id = membership_payments.admin_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ));

-- 2) เบอร์พร้อมเพย์ของเจ้าของระบบ (แถว founder) — ใช้สร้าง QR รับค่าต่ออายุ
--    คืน null ถ้าไม่มีแถว founder หรือยังไม่กรอกเบอร์
create or replace function public.get_system_promptpay()
returns text language sql security definer stable
set search_path = public
as $$
  select a.promptpay
    from public.admins a
   where a.plan = 'founder'
   limit 1;
$$;

grant execute on function public.get_system_promptpay() to authenticated;

-- 3) อัปโหลดสลิปต่ออายุ (membership/*.jpg) ลง bucket "receipts" ที่มีอยู่แล้ว
--    (idempotent — เพิ่ม policy คู่ข้าง policy อ่านสาธารณะที่มีอยู่ ไม่แต๊ะตัวเดิม)
drop policy if exists "receipts_authenticated_insert" on storage.objects;
create policy "receipts_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts');

-- เว็บอัปโหลดแบบ upsert (ส่งซ้ำ path เดิมได้) — เพิ่มสิทธิ์ update ด้วย
drop policy if exists "receipts_authenticated_update" on storage.objects;
create policy "receipts_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts');
