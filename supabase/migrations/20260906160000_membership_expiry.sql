-- ============================================================
-- PayRentPro : membership expiry (สถานะหมดอายุ)
--
-- - RPC get_membership_status() เพิ่ม field 'status':
--     'active'  = ใช้งานได้ปกติ
--     'expired' = หมดอายุ → เว็บล็อค dashboard แสดงหน้า "หมดอายุการใช้งาน"
--
--   แหล่งของสถานะ (เรียงตามลำดับ):
--     1) คอลัมน์ admins.status ที่ cron check_membership_expiry
--        (รันทุกวัน 09:00 — มีอยู่แล้วฝั่ง DB) เป็นผู้อัปเดต
--     2) fallback: คำนวณสดจาก expire_date < current_date
--        (กันเคส cron ยังไม่เคยรันในวันแรก)
--
--   ฝั่งเว็บแค่อ่าน status — ไม่เรียก/ไม่แตะ cron เพิ่มเอง
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- คอลัมน์สถานะที่ cron ใช้ mark (idempotent — ถ้า cron สร้างไว้แล้วจะไม่ทำอะไร)
alter table public.admins
  add column if not exists status text not null default 'active';

create or replace function public.get_membership_status()
returns jsonb language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
        'ok', true,
        'plan', a.plan,
        'status', case
                    when coalesce(a.status, 'active') = 'expired' then 'expired'
                    when a.expire_date is not null and a.expire_date < current_date then 'expired'
                    else 'active'
                  end,
        'expire_date', a.expire_date,
        'days_left', case when a.expire_date is null then null
                          else (a.expire_date - current_date) end,
        'room_limit', a.room_limit,
        'rooms_used', (select count(*) from public.rentals))
     from public.admins a
     where a.plan is not null
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
     limit 1),
    jsonb_build_object('ok', false)
  );
$$;

grant execute on function public.get_membership_status() to authenticated;
