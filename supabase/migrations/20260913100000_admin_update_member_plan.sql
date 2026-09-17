-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : founder แก้แพ็กเกจ + วันหมดอายุสมาชิกจากหน้า /admin
--
-- RPC admin_update_member_plan(p_member_email, p_plan_type, p_expire_date)
--   - founder เท่านั้น (guard แบบเดียวกับ get_all_members)
--   - เปลี่ยน plan_type / expire_date / status / room_limit พร้อมกัน
--   - room_limit อัตโนมัติตามแพ็กเกจ (เท่า mapping ที่ใช้ทุกจุดในระบบ):
--       trial → 10, starter → 20, pro → 50, founder → 0 (ไม่จำกัด)
--     หรือส่ง p_room_limit ทับเองได้ (null = ใช้ค่าตามแพ็กเกจ)
--   - p_expire_date = null และแพ็กไม่ใช่ founder → คงวันเดิมไว้
--     ส่วน founder จะตั้งให้ 100 ปีอัตโนมัติ (สอดคล้อง 20260910170000)
--   - status คำนวณใหม่จากวันหมดอายุ: เลยวันนี้ → 'expired' ไม่งั้น 'active'
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.admin_update_member_plan(
  p_member_email text,
  p_plan_type text,
  p_expire_date date default null,
  p_room_limit integer default null
) returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_plan text := lower(coalesce(p_plan_type, ''));
  v_expire date := p_expire_date;
  v_limit integer := p_room_limit;
begin
  -- guard: founder เท่านั้น (เช็คทั้ง user_id และ email แบบเดียวกับ get_all_members)
  if not exists (
    select 1 from public.admins a
     where a.plan_type = 'founder'
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ) then
    raise exception 'forbidden';
  end if;

  if v_plan not in ('trial', 'starter', 'pro', 'founder') then
    raise exception 'invalid_plan';
  end if;

  -- room_limit ตามแพ็กเกจ ถ้าผู้เรียกไม่ได้ส่งมาเอง
  if v_limit is null then
    v_limit := case v_plan
                 when 'trial' then 10
                 when 'starter' then 20
                 when 'pro' then 50
                 when 'founder' then 0
               end;
  end if;

  -- founder ไม่มีวันหมดอายุใกล้ ๆ มากวน — ตั้ง 100 ปีถ้าไม่ได้ระบุมาเอง
  if v_plan = 'founder' and v_expire is null then
    v_expire := current_date + 36500;
  end if;

  update public.admins
     set plan_type = v_plan,
         room_limit = v_limit,
         expire_date = coalesce(v_expire, expire_date),
         status = case
                    when v_expire is not null and v_expire < current_date then 'expired'
                    else 'active'
                  end
   where lower(email) = lower(p_member_email)
     and plan_type is not null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'member_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'plan_type', v_plan,
    'room_limit', v_limit,
    'expire_date', coalesce(v_expire, expire_date)
  );
end;
$$;

grant execute on function public.admin_update_member_plan(text, text, date, integer) to authenticated;
