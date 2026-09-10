-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : แก้ seed ที่ข้ามตาราง repair_tickets + ลบข้อมูลทดสอบ
--
-- ปัญหา: seed ก่อนหน้า (20260909130000) ใช้ guard `count(*) = 0` ต่อตาราง
-- แต่ตอนตรวจ RPC ของ portal ผู้เช่า มี ticket ทดสอบ ('TEST ...') ค้างอยู่ 1 แถว
-- ทำให้ guard คิดว่า "มีข้อมูลแล้ว" แล้วข้ามการ seed แจ้งซ่อมทั้งชุด
--
-- ไฟล์นี้:
--   1) ลบข้อมูลทดสอบที่เกิดจากการตรวจ RPC (TEST ticket + attempts + sessions)
--   2) seed แจ้งซ่อมด้วย guard แบบเจาะจง (นับเฉพาะแถวที่ไม่ใช่ของทดสอบ)
--   3) ตรวจทุกตารางว่ามีข้อมูลจริง — ถ้าตารางไหนว่าง จะ raise exception
--      ให้ push ล้มทันที ไม่ปล่อยผ่านแบบเงียบ ๆ
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) ลบข้อมูลทดสอบ ────────────────────────────────────────────────
delete from public.repair_tickets where description like 'TEST %';
delete from public.tenant_portal_attempts;
delete from public.tenant_portal_sessions;

-- ── 2) seed แจ้งซ่อม (guard เจาะจง ไม่พึ่ง count รวม) ────────────────
do $$
declare
  v_r1 uuid;
  v_r2 uuid;
  v_r3 uuid;
  v_r4 uuid;
  v_n int;
begin
  select id into v_r1 from public.rentals where item_details = 'ห้อง 101' limit 1;
  select id into v_r2 from public.rentals where item_details = 'ห้อง 102' limit 1;
  select id into v_r3 from public.rentals where item_details = 'ห้อง 103' limit 1;
  select id into v_r4 from public.rentals where item_details = 'ห้อง 204' limit 1;

  if v_r1 is null then
    raise notice 'ไม่พบห้อง 101 — ข้าม seed แจ้งซ่อม';
    return;
  end if;

  -- นับเฉพาะ ticket ที่ตรงกับชุด seed นี้ (ไม่ใช่ count รวมทั้งตาราง)
  -- ถ้าเจ้าของมี ticket จริงอยู่แล้ว จะไม่ถูกนับ และ seed ยังเติมได้
  select count(*) into v_n
    from public.repair_tickets
   where description in (
     'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว',
     'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ',
     'น้ำรั่วใต้อ่างล้างหน้า มีน้ำขังพื้นตอนเช้า'
   );

  if v_n > 0 then
    raise notice 'seed แจ้งซ่อมมีอยู่แล้ว — ข้าม';
    return;
  end if;

  insert into public.repair_tickets (rental_id, description, status, photo_url, created_at, done_at)
  values
    -- รอดำเนินการ
    (v_r4, 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว',
     'open', null, now() - interval '5 hours', null),
    (v_r2, 'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ',
     'open', null, now() - interval '1 day', null),
    (v_r1, 'น้ำรั่วใต้อ่างล้างหน้า มีน้ำขังพื้นตอนเช้า',
     'open', null, now() - interval '2 days', null),

    -- กำลังซ่อม
    (v_r3, 'ประตูห้องปิดไม่สนิท ต้องออกแรงดันแรงๆ',
     'in_progress', null, now() - interval '4 days', null),
    (v_r2, 'ก๊อกน้ำในครัวหยดตลอด ปิดสุดแล้วก็ยังหยด',
     'in_progress', null, now() - interval '6 days', null),

    -- เสร็จแล้ว
    (v_r1, 'หลอดไฟหน้าห้องไม่ติด',
     'done', null, now() - interval '12 days', now() - interval '10 days'),
    (v_r4, 'ชักโครกกดไม่ลง น้ำไม่ไหลเข้าถัง',
     'done', null, now() - interval '20 days', now() - interval '19 days'),
    (v_r3, 'มุ้งลวดหน้าต่างขาด แมลงเข้าห้อง',
     'done', null, now() - interval '35 days', now() - interval '31 days');

  raise notice 'seed แจ้งซ่อม 8 รายการแล้ว';
end;
$$;

-- ── 3) ตรวจว่าทุกตารางมีข้อมูลจริง ──────────────────────────────────
-- ถ้าตารางไหนว่าง = seed ก่อนหน้าไม่ทำงาน → ให้ push ล้มเลย
-- ดีกว่าปล่อยผ่านแล้วเจ้าของไปเจอหน้าว่างเองทีหลัง
do $$
declare
  v_expenses int;
  v_income int;
  v_ann int;
  v_notes int;
  v_docs int;
  v_repairs int;
  v_cats int;
  v_missing text := '';
begin
  select count(*) into v_cats     from public.expense_categories;
  select count(*) into v_expenses from public.expenses;
  select count(*) into v_income   from public.other_income;
  select count(*) into v_ann      from public.announcements;
  select count(*) into v_notes    from public.notes;
  select count(*) into v_docs     from public.documents;
  select count(*) into v_repairs  from public.repair_tickets;

  if v_cats     = 0 then v_missing := v_missing || 'expense_categories '; end if;
  if v_expenses = 0 then v_missing := v_missing || 'expenses '; end if;
  if v_income   = 0 then v_missing := v_missing || 'other_income '; end if;
  if v_ann      = 0 then v_missing := v_missing || 'announcements '; end if;
  if v_notes    = 0 then v_missing := v_missing || 'notes '; end if;
  if v_docs     = 0 then v_missing := v_missing || 'documents '; end if;
  if v_repairs  = 0 then v_missing := v_missing || 'repair_tickets '; end if;

  if v_missing <> '' then
    raise exception 'seed ไม่สมบูรณ์ — ตารางที่ยังว่าง: %', v_missing;
  end if;

  raise notice 'ตรวจครบ: หมวด=% รายจ่าย=% รายรับอื่น=% ประกาศ=% บันทึก=% เอกสาร=% แจ้งซ่อม=%',
    v_cats, v_expenses, v_income, v_ann, v_notes, v_docs, v_repairs;
end;
$$;
