-- ============================================================
-- PayRentPro : โปรไฟล์ธุรกิจของเจ้าของบนตาราง admins
--
-- - เพิ่ม 3 คอลัมน์: business_name / owner_name / address
-- - RPC get_business_profile() สำหรับหน้าบิล public (BillPage)
--   ที่ผู้เช่าเปิดแบบไม่ login (RLS ของ admins กรอง anon ออก)
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

alter table public.admins
  add column if not exists business_name text,
  add column if not exists owner_name text,
  add column if not exists address text;

create or replace function public.get_business_profile()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('business_name', business_name, 'owner_name', owner_name, 'address', address)
       from public.admins limit 1),
    jsonb_build_object('business_name', null, 'owner_name', null, 'address', null)
  );
$$;

grant execute on function public.get_business_profile() to anon, authenticated;
