-- ═══════════════════════════════════════════════════════════════════
-- แก้บั๊ก: บิลของเดโม่ถูก RLS ซ่อนทั้งหมด (มีจริง 48 ใบ แต่หน้าเว็บเห็น 0)
--
-- สาเหตุ: ตาราง transactions มีคอลัมน์ landlord_id ของตัวเอง และ policy
--   txs_owner กรองด้วย (landlord_id = current_landlord_id()) โดยตรง
--   ไม่ได้ join กลับไปหา rentals — seed ก่อนหน้าไม่ได้ใส่ค่านี้
--   จึงเป็น NULL แล้วถูกซ่อนหมด
--
-- บทเรียน: ตาราง transactions/rentals ใช้ current_landlord_id() ไม่ใช่
--   แพทเทิร์น is_my_landlord() แบบตารางที่เพิ่มใหม่ — insert ตรงต้องใส่
--   landlord_id เองทุกครั้ง
-- ═══════════════════════════════════════════════════════════════════

-- เติม landlord_id ให้บิลที่ยังว่าง โดยดึงจากห้องที่บิลนั้นผูกอยู่
-- (additive — ไม่แตะแถวที่มีค่าอยู่แล้ว)
update public.transactions t
   set landlord_id = r.landlord_id
  from public.rentals r
 where r.id = t.rental_id
   and t.landlord_id is null
   and r.landlord_id is not null;

-- ตรวจว่าบิลของเดโม่มองเห็นได้แล้ว
do $$
declare
  v_admin uuid;
  v_total int;
  v_visible int;
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;
  if v_admin is null then
    raise exception 'ไม่พบ admins ของเดโม่';
  end if;

  select count(*) into v_total
    from public.transactions tx
    join public.rentals rt on rt.id = tx.rental_id
   where rt.landlord_id = v_admin;

  -- นับแบบที่ RLS จะเห็น (กรองจาก transactions.landlord_id ตรง ๆ)
  select count(*) into v_visible
    from public.transactions
   where landlord_id = v_admin;

  if v_visible = 0 then
    raise exception 'บิลเดโม่ยังมองไม่เห็น (total=% visible=%)', v_total, v_visible;
  end if;

  if v_visible <> v_total then
    raise warning 'บิลเดโม่บางใบยังไม่ได้ landlord_id (total=% visible=%)', v_total, v_visible;
  end if;

  raise notice 'บิลเดโม่มองเห็นได้ % ใบ', v_visible;
end;
$$;
