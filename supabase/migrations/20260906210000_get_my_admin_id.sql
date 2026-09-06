-- ═══════════════════════════════════════════════════════════════════
-- RPC get_my_admin_id: คืน id ของแถว admins ที่ user_id = auth.uid()
-- ใช้ก่อน insert rentals เพื่อใส่ landlord_id ให้ถูกต้องตั้งแต่ต้น
-- (แทนการพึ่ง trigger set_landlord — ตอนนี้ฝั่งเว็บดึงเองแล้วส่งมาด้วย)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.get_my_admin_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select id from public.admins where user_id = auth.uid() limit 1;
$function$;

revoke all on function public.get_my_admin_id() from public;
grant execute on function public.get_my_admin_id() to authenticated;
grant execute on function public.get_my_admin_id() to service_role;
