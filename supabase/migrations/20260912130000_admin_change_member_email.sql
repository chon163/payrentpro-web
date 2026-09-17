-- ============================================================
-- PayRentPro : เปลี่ยนอีเมลสมาชิก (หน้า /admin — founder เท่านั้น)
--
-- กรณีใช้งาน: ลูกค้าลืมรหัส Gmail / เข้าอีเมลเดิมไม่ได้
--   founder ย้ายบัญชีไปอีเมลใหม่ให้ แล้วลูกค้ากดขอลิงก์เข้าสู่ระบบ
--   (magic link) ด้วยอีเมลใหม่ได้ทันที — ข้อมูลทั้งห้อง/บิล/สัญญาอยู่ครบ
--   เพราะ user_id เดิมไม่เปลี่ยน
--
-- RPC ทำ 3 อย่าง (security definer + ตรวจ founder ก่อน):
--   1) update auth.users.email ของสมาชิก (คงสถานะยืนยันอีเมลไว้
--      เพื่อให้ขอ magic link ที่อีเมลใหม่ใช้ได้ทันที)
--   2) update public.admins.email ให้ตรงกัน (RLS หลายตัวเทียบ
--      admins.email = auth.email())
--   3) บันทึก activity_logs action='email_changed'
--
-- การ์ดกันความเสียหาย: รูปแบบอีเมลต้องถูก, ห้ามซ้ำกับบัญชีอื่น
-- (ทั้ง auth.users และ admins), ต้องมีแถว admins + user_id จริง
--
-- หมายเหตุ: ถ้าลูกค้ากลับมา OAuth ด้วย Google เดิมภายหลัง Supabase
-- จับคู่ด้วย Google identity เดิม และอีเมลอาจถูกดึงกลับเป็นของ Google
-- กรณีนั้นให้ founder เปลี่ยนอีเมลใหม่อีกครั้งได้
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

create or replace function public.admin_change_member_email(
  p_member_email text,
  p_new_email text
) returns jsonb language plpgsql volatile security definer
set search_path = public, auth
as $$
declare
  v_founder boolean;
  v_admin_id uuid;
  v_user_id uuid;
  v_new text;
  v_old text;
begin
  -- founder เท่านั้น (คนเรียกต้องมีแถว admins plan_type=founder ผูกกับ auth.uid())
  select exists (
    select 1 from public.admins fa
     where fa.user_id = auth.uid() and fa.plan_type = 'founder'
  ) into v_founder;
  if not v_founder then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_new := lower(btrim(coalesce(p_new_email, '')));
  if v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  select a.id, a.email, a.user_id into v_admin_id, v_old, v_user_id
    from public.admins a
   where lower(a.email) = lower(btrim(coalesce(p_member_email, '')))
   limit 1;
  if v_admin_id is null then
    return jsonb_build_object('ok', false, 'error', 'member_not_found');
  end if;
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_auth_account');
  end if;
  if v_new = lower(v_old) then
    return jsonb_build_object('ok', false, 'error', 'same_email');
  end if;

  -- อีเมลใหม่ต้องไม่ถูกใช้โดยบัญชีอื่น (ทั้งฝั่ง login และตาราง admins)
  if exists (select 1 from auth.users u where lower(u.email) = v_new and u.id <> v_user_id)
     or exists (select 1 from public.admins a2 where lower(a2.email) = v_new and a2.id <> v_admin_id) then
    return jsonb_build_object('ok', false, 'error', 'email_taken');
  end if;

  -- 1) ย้ายอีเมลฝั่งระบบ login (คง confirmed ไว้ = ขอ magic link ใหม่ได้ทันที)
  update auth.users
     set email = v_new,
         email_change = v_new,
         email_change_confirm_status = 'confirmed',
         updated_at = now()
   where id = v_user_id;

  -- 2) อัปเดตตาราง admins ให้ตรง (RLS/การเทียบอีเมลหลายจุดอ้างคอลัมน์นี้)
  update public.admins
     set email = v_new
   where id = v_admin_id;

  -- 3) audit trail
  insert into public.activity_logs (admin_id, user_email, action, detail)
  values (
    v_admin_id,
    v_new,
    'email_changed',
    'เปลี่ยนอีเมลจาก ' || v_old || ' เป็น ' || v_new
  );

  return jsonb_build_object('ok', true, 'old_email', v_old, 'new_email', v_new);
end;
$$;

revoke all on function public.admin_change_member_email(text, text) from public;
grant execute on function public.admin_change_member_email(text, text) to authenticated;
