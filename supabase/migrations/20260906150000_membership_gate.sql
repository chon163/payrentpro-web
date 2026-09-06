-- ============================================================
-- PayRentPro : ระบบสมาชิก (membership gate)
--
-- - admins เพิ่มคอลัมน์ plan / expire_date / room_limit
--   (plan เป็น null = แถวสมัยก่อนมีระบบสมาชิก ยังไม่เคยเริ่มใช้)
-- - RPC get_membership_status() : สถานะสมาชิกของผู้ login ปัจจุบัน
--     {ok:false}                        = ยังไม่มีแถวสมาชิก → เว็บแสดงหน้าเริ่มทดลองใช้ฟรี
--     {ok:true, plan, expire_date,
--      days_left, room_limit, rooms_used}
-- - RPC start_trial() : เริ่มทดลองใช้ฟรี 30 วัน (ครั้งเดียวต่ออีเมล/user)
--     {ok:false, error:'already_registered'} = เคยสมัครแล้ว
--
-- แพ็กเกจ (room_limit): trial = 10 ห้อง / อายุ 30 วัน,
--   starter = 50 ห้อง, founder = 500 ห้อง (ใช้ตอนอัปเกรด — ก้อนถัดไป)
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

alter table public.admins
  add column if not exists plan text,
  add column if not exists expire_date date,
  add column if not exists room_limit integer;

-- สถานะสมาชิกของฉัน (match ด้วย user_id หรือ email ของ auth ปัจจุบัน)
create or replace function public.get_membership_status()
returns jsonb language sql security definer stable
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
        'ok', true,
        'plan', a.plan,
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

-- เริ่มทดลองใช้ฟรี 30 วัน (ครั้งเดียวต่ออีเมล/user)
create or replace function public.start_trial()
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := auth.email();
  v_expire date := current_date + 30;
  v_room_limit int := 10;
begin
  if v_uid is null and v_email is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if exists (
    select 1 from public.admins a
     where a.plan is not null
       and ((v_uid is not null and a.user_id = v_uid)
         or (v_email is not null and a.email = v_email))
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_registered');
  end if;

  -- มีแถวเดิม (สร้างก่อนมีระบบสมาชิก ยังไม่มี plan) → อัปเดตแถวนั้น ไม่ insert ซ้ำ
  update public.admins a
     set plan = 'trial',
         expire_date = v_expire,
         room_limit = v_room_limit,
         user_id = coalesce(a.user_id, v_uid),
         email = coalesce(nullif(a.email, ''), v_email)
   where a.plan is null
     and ((v_uid is not null and a.user_id = v_uid)
       or (v_email is not null and a.email = v_email));

  if not found then
    insert into public.admins (email, user_id, plan, expire_date, room_limit)
    values (coalesce(v_email, ''), v_uid, 'trial', v_expire, v_room_limit);
  end if;

  return jsonb_build_object(
    'ok', true,
    'plan', 'trial',
    'expire_date', v_expire,
    'days_left', 30,
    'room_limit', v_room_limit
  );
end;
$$;

grant execute on function public.start_trial() to authenticated;
