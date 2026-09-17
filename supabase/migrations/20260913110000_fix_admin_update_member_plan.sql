-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : แก้ RPC admin_update_member_plan — error 42703
-- "column expire_date does not exist"
--
-- สาเหตุ: ตัวเดิม (20260913100000) ปิดท้ายด้วย
--   return jsonb_build_object('expire_date', coalesce(v_expire, expire_date));
-- expression ใน RETURN ถูกประเมินแบบ SELECT ที่ไม่มี FROM ดังนั้น
-- `expire_date` เปล่า ๆ ไม่ใช่คอลัมน์ของ admins ในบริบทนั้น → 42703
-- (คอลัมน์อ้างได้เฉพาะใน UPDATE ... SET/RETURNING เท่านั้น)
--
-- แก้: จับค่าวันหมดอายุใหม่จาก RETURNING ของ UPDATE เก็บลงตัวแปร
-- แล้วค่อยใช้ตัวแปรใน jsonb_build_object
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
  v_effective_expire date;
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
     and plan_type is not null
  returning expire_date into v_effective_expire;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'member_not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'plan_type', v_plan,
    'room_limit', v_limit,
    'expire_date', v_effective_expire
  );
end;
$$;

grant execute on function public.admin_update_member_plan(text, text, date, integer) to authenticated;
