-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : Seed ข้อมูลจำลอง "มีคนใช้ทุกฟังก์ชัน"
--
-- เติมข้อมูลให้ทุกหน้าของระบบมีของให้ดู ไม่เจอการ์ดเลข 0 เรียงกัน
-- ครอบ: รายจ่าย · รายรับอื่น · กำไรสุทธิ์ · ประกาศ · บันทึก · เอกสาร ·
--        แจ้งซ่อม (ทุกสถานะ + มี/ไม่มีรูป) · portal ผู้เช่า
--
-- กติกา
--   - **additive เท่านั้น** ไม่ลบ ไม่แก้ข้อมูลเดิม
--   - **รันซ้ำได้** (idempotent) — ทุก insert มี guard กันข้อมูลซ้ำ
--   - ผูกกับ landlord แถวแรกของ admins (ระบบนี้มีเจ้าของคนเดียวต่อ DB)
--   - ต้องมี rentals อยู่ก่อน (รัน 20260906130000_seed_demo_20rooms.sql มาแล้ว)
--
-- ต้องมีอยู่ก่อน: expenses, expense_categories, other_income, announcements,
--                 notes, documents, repair_tickets, rentals, admins
--
-- ⚠️ ไฟล์นี้เป็นข้อมูลตัวอย่างสำหรับ demo/ทดสอบ — ถ้าจะขึ้นใช้งานจริง
--    กับลูกค้า ให้ลบข้อมูลชุดนี้ก่อน (ทุกแถวมี marker ให้ลบง่าย ดูท้ายไฟล์)
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_admin uuid;
  v_cat_elec uuid;
  v_cat_water uuid;
  v_cat_repair uuid;
  v_cat_clean uuid;
  v_cat_net uuid;
  v_cat_salary uuid;
  v_cat_tax uuid;
  v_r1 uuid;  -- ห้อง 101 (สัญญาใกล้หมด)
  v_r2 uuid;  -- ห้อง 102
  v_r3 uuid;  -- ห้อง 103
  v_r4 uuid;  -- ห้อง 204
  v_rooms uuid[];
  v_n int;
begin
  -- ── หา landlord ────────────────────────────────────────────────
  select id into v_admin from public.admins order by created_at limit 1;
  if v_admin is null then
    raise notice 'ไม่พบแถวใน admins — ตั้งค่าโปรไฟล์ธุรกิจในหน้า /settings ก่อนแล้วรันซ้ำ';
    return;
  end if;

  -- ── หาห้องตัวอย่างไว้ผูกข้อมูล ──────────────────────────────────
  select id into v_r1 from public.rentals where item_details = 'ห้อง 101' limit 1;
  select id into v_r2 from public.rentals where item_details = 'ห้อง 102' limit 1;
  select id into v_r3 from public.rentals where item_details = 'ห้อง 103' limit 1;
  select id into v_r4 from public.rentals where item_details = 'ห้อง 204' limit 1;

  select array_agg(id) into v_rooms
    from public.rentals
   where lower(coalesce(room_status, '')) <> 'vacant';

  if v_rooms is null or array_length(v_rooms, 1) = 0 then
    raise notice 'ไม่พบห้องที่มีผู้เช่า — รัน seed 20 ห้องก่อน (20260906130000)';
    return;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 1) หมวดรายจ่าย — ใช้ของที่ seed_expense_categories สร้างไว้ ถ้ายังไม่มีก็สร้าง
  -- ═════════════════════════════════════════════════════════════
  insert into public.expense_categories (landlord_id, name, color, sort_order)
  values
    (v_admin, 'ค่าไฟ (บิลกรม)',    '#f59e0b', 1),
    (v_admin, 'ค่าน้ำ (บิลกรม)',   '#0ea5e9', 2),
    (v_admin, 'ค่าซ่อมแซม',         '#ef4444', 3),
    (v_admin, 'ค่าทำความสะอาด',     '#22c55e', 4),
    (v_admin, 'ค่าอินเทอร์เน็ต',    '#8b5cf6', 5),
    (v_admin, 'เงินเดือน/ค่าแรง',   '#ec4899', 6),
    (v_admin, 'ภาษี/ค่าธรรมเนียม',  '#64748b', 7),
    (v_admin, 'อื่น ๆ',              '#94a3b8', 99)
  on conflict (landlord_id, lower(trim(name))) do nothing;

  select id into v_cat_elec   from public.expense_categories where landlord_id = v_admin and name like 'ค่าไฟ%' limit 1;
  select id into v_cat_water  from public.expense_categories where landlord_id = v_admin and name like 'ค่าน้ำ%' limit 1;
  select id into v_cat_repair from public.expense_categories where landlord_id = v_admin and name = 'ค่าซ่อมแซม' limit 1;
  select id into v_cat_clean  from public.expense_categories where landlord_id = v_admin and name = 'ค่าทำความสะอาด' limit 1;
  select id into v_cat_net    from public.expense_categories where landlord_id = v_admin and name = 'ค่าอินเทอร์เน็ต' limit 1;
  select id into v_cat_salary from public.expense_categories where landlord_id = v_admin and name = 'เงินเดือน/ค่าแรง' limit 1;
  select id into v_cat_tax    from public.expense_categories where landlord_id = v_admin and name like 'ภาษี%' limit 1;

  -- ═════════════════════════════════════════════════════════════
  -- 2) รายจ่าย 6 เดือนย้อนหลัง — ให้กราฟกำไรมีข้อมูลทุกเดือน
  --    ค่าไฟ/น้ำกรมทุกเดือน + ค่าอื่นสลับกันไป
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.expenses where landlord_id = v_admin;
  if v_n = 0 then
    -- ค่าไฟกรม + ค่าน้ำกรม ทุกเดือน (ยอดขึ้นลงตามฤดู)
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_elec,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
           'ค่าไฟฟ้าส่วนกลาง + มิเตอร์รวม',
           8200 + (m * 340) + ((m % 3) * 620),
           'การไฟฟ้าส่วนภูมิภาค', 'PEA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'),
           'transfer', null
      from generate_series(0, 5) as m;

    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_water,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
           'ค่าน้ำประปาส่วนกลาง + มิเตอร์รวม',
           2450 + (m * 95),
           'การประปาส่วนภูมิภาค', 'PWA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'),
           'transfer', null
      from generate_series(0, 5) as m;

    -- อินเทอร์เน็ต — จ่ายทุกเดือนเท่ากัน (บัตรเครดิต)
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_net,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
           'อินเทอร์เน็ตไฟเบอร์ 1Gbps (ส่วนกลาง + Wi-Fi ทุกชั้น)',
           1590, '3BB', null, 'credit_card', null
      from generate_series(0, 5) as m;

    -- เงินเดือนแม่บ้าน — เงินสดทุกเดือน
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_salary,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '27 days')::date,
           'ค่าแรงแม่บ้านทำความสะอาดส่วนกลาง',
           9000, 'คุณสมพร (แม่บ้าน)', null, 'cash', 'จ่ายสิ้นเดือน'
      from generate_series(0, 5) as m;

    -- ค่าซ่อมเฉพาะกิจ — ผูกกับห้องจริง เพื่อให้เห็นว่ารายจ่ายผูกสินทรัพย์ได้
    insert into public.expenses (landlord_id, category_id, rental_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    values
      (v_admin, v_cat_repair, v_r4, (current_date - 4),  'ล้างแอร์ + เติมน้ำยา ห้อง 204', 1200, 'ช่างเอ (แอร์)', null, 'cash', 'ผู้เช่าแจ้งแอร์ไม่เย็น'),
      (v_admin, v_cat_repair, v_r1, (current_date - 12), 'เปลี่ยนก๊อกน้ำอ่างล้างหน้า ห้อง 101', 850, 'ช่างบี (ประปา)', null, 'cash', null),
      (v_admin, v_cat_repair, v_r2, (current_date - 26), 'เปลี่ยนลูกบิดประตู ห้อง 102', 450, 'ช่างบี (ประปา)', null, 'cash', null),
      (v_admin, v_cat_repair, null, (current_date - 40), 'ซ่อมปั๊มน้ำอาคาร (มอเตอร์ไหม้)', 6800, 'ร้านไทยพัฒนาการช่าง', 'INV-2291', 'transfer', 'เปลี่ยนมอเตอร์ใหม่ ประกัน 1 ปี'),
      (v_admin, v_cat_repair, null, (current_date - 68), 'ทาสีโถงทางเดินชั้น 2', 12500, 'ร้านสีพี่หนุ่ม', 'QT-1183', 'transfer', null);

    -- ค่าทำความสะอาด + ภาษี — รายการที่ไม่ได้เกิดทุกเดือน
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    values
      (v_admin, v_cat_clean, (current_date - 8),  'ล้างถังเก็บน้ำ + ฆ่าเชื้อ (ทำปีละ 2 ครั้ง)', 3500, 'บ.คลีนโปร', 'CP-882', 'transfer', null),
      (v_admin, v_cat_clean, (current_date - 55), 'กำจัดปลวก/แมลง ทั้งอาคาร', 4800, 'บ.เพสท์การ์ด', 'PG-441', 'transfer', 'รับประกัน 6 เดือน'),
      (v_admin, v_cat_tax,   (current_date - 20), 'ภาษีที่ดินและสิ่งปลูกสร้าง (งวดปี)', 8600, 'เทศบาล', 'TAX-2569', 'transfer', null),
      (v_admin, v_cat_tax,   (current_date - 33), 'ค่าธรรมเนียมเก็บขยะ (รายปี)', 2400, 'เทศบาล', null, 'cash', null);

    raise notice 'เพิ่มรายจ่ายแล้ว';
  else
    raise notice 'มีรายจ่ายอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 3) รายรับอื่น — ค่าปรับ ค่าที่จอดรถ เครื่องซักผ้า ริบมัดจำ
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.other_income where landlord_id = v_admin;
  if v_n = 0 then
    -- เครื่องซักผ้าหยอดเหรียญ — เก็บทุกเดือน
    insert into public.other_income (landlord_id, income_date, description, amount, source, notes)
    select v_admin,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '25 days')::date,
           'เครื่องซักผ้า/อบผ้าหยอดเหรียญ',
           2800 + ((m % 4) * 320),
           'เครื่องซักผ้า', null
      from generate_series(0, 5) as m;

    -- ค่าที่จอดรถเพิ่ม — 3 ห้องจ่ายทุกเดือน
    insert into public.other_income (landlord_id, income_date, description, amount, source, notes)
    select v_admin,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
           'ค่าที่จอดรถเพิ่ม 3 คัน (คันละ 500)',
           1500, 'ที่จอดรถ', null
      from generate_series(0, 5) as m;

    -- รายการเฉพาะกิจ
    insert into public.other_income (landlord_id, rental_id, income_date, description, amount, source, notes)
    values
      (v_admin, v_r2,  (current_date - 6),  'ค่าปรับชำระล่าช้า 12 วัน', 600,  'ค่าปรับ', 'คิด 50 บาท/วัน'),
      (v_admin, v_r3,  (current_date - 18), 'ค่าปรับชำระล่าช้า 5 วัน',  250,  'ค่าปรับ', null),
      (v_admin, null,  (current_date - 30), 'ค่าเช่าพื้นที่ติดตั้งตู้กดน้ำ', 1000, 'ค่าเช่าพื้นที่', 'สัญญารายปี'),
      (v_admin, v_r4,  (current_date - 45), 'ริบมัดจำ (ย้ายออกก่อนครบสัญญา)', 4500, 'ริบมัดจำ', 'ห้อง 204 ผู้เช่าเก่า'),
      (v_admin, null,  (current_date - 52), 'ค่าเช่าป้ายโฆษณาหน้าอาคาร', 2500, 'ค่าเช่าพื้นที่', null),
      (v_admin, v_r1,  (current_date - 70), 'ค่าทำความสะอาดพิเศษ (ผู้เช่าขอ)', 800, 'บริการเสริม', null);

    raise notice 'เพิ่มรายรับอื่นแล้ว';
  else
    raise notice 'มีรายรับอื่นอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 4) ประกาศ — ครบทุกสถานะ (draft / published / archived)
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.announcements where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.announcements (landlord_id, title, content, publish_date, status, sent_to_line_at)
    values
      (v_admin,
       'แจ้งหยุดน้ำชั่วคราว วันเสาร์นี้ 09:00-15:00',
       'เรียนผู้เช่าทุกท่าน' || chr(10) || chr(10) ||
       'ทางอาคารจะทำการล้างถังเก็บน้ำและฆ่าเชื้อ ในวันเสาร์ที่จะถึงนี้' || chr(10) ||
       'เวลา 09:00 - 15:00 น. ช่วงเวลาดังกล่าวจะไม่มีน้ำใช้' || chr(10) || chr(10) ||
       'ขอให้ทุกท่านสำรองน้ำไว้ล่วงหน้า ขออภัยในความไม่สะดวกครับ',
       current_date, 'published', now() - interval '2 days'),

      (v_admin,
       'ปรับปรุงระบบ Wi-Fi ส่วนกลาง — ความเร็วเพิ่มเป็น 1Gbps',
       'ทางอาคารได้อัปเกรดอินเทอร์เน็ตเป็นไฟเบอร์ 1Gbps แล้ว' || chr(10) ||
       'ติดตั้ง Access Point ใหม่ทุกชั้น สัญญาณครอบคลุมทั้งอาคาร' || chr(10) || chr(10) ||
       'รหัส Wi-Fi ใหม่: แจ้งที่ห้องนิติบุคคล พร้อมแสดงบัตรผู้เช่า',
       current_date - 8, 'published', now() - interval '8 days'),

      (v_admin,
       'เตือนกำหนดชำระค่าเช่า — ทุกวันที่ 5 ของเดือน',
       'ขอความร่วมมือชำระค่าเช่าภายในวันที่ 5 ของทุกเดือน' || chr(10) ||
       'หากเกินกำหนดจะมีค่าปรับวันละ 50 บาท ตามสัญญาเช่าข้อ 7' || chr(10) || chr(10) ||
       'ชำระได้ผ่าน QR พร้อมเพย์ในลิงก์บิลที่ส่งให้ทาง LINE',
       current_date - 15, 'published', now() - interval '15 days'),

      (v_admin,
       'ประกาศขึ้นค่าเช่าปี 2570 (ฉบับร่าง — ยังไม่เผยแพร่)',
       'ร่างประกาศ: ปรับค่าเช่าขึ้น 5% มีผล 1 ม.ค. 2570' || chr(10) ||
       'ยังไม่ส่งให้ผู้เช่า — รอหารือกับหุ้นส่วนก่อน',
       current_date + 20, 'draft', null),

      (v_admin,
       'กิจกรรมทำความสะอาดใหญ่ประจำปี (จบแล้ว)',
       'ขอบคุณผู้เช่าทุกท่านที่ให้ความร่วมมือในกิจกรรมทำความสะอาดใหญ่',
       current_date - 95, 'archived', now() - interval '95 days');

    raise notice 'เพิ่มประกาศแล้ว';
  else
    raise notice 'มีประกาศอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 5) บันทึกช่วยจำ — ครบ 6 สี + มีปักหมุด
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.notes where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.notes (landlord_id, title, content, color, pinned, updated_at)
    values
      (v_admin, 'ห้อง 101 สัญญาหมด 10 วัน — ต้องคุยต่อสัญญา',
       'ผู้เช่าแจ้งว่าอยากต่ออีก 1 ปี แต่ขอลดค่าเช่า 200' || chr(10) ||
       'ตัดสินใจ: ยอมลด 100 ถ้าจ่ายล่วงหน้า 3 เดือน',
       '#fee2e2', true, now() - interval '1 hour'),

      (v_admin, 'รหัสตู้ไฟหลัก + เบอร์ช่างฉุกเฉิน',
       'ตู้ไฟชั้น 1: 4729' || chr(10) ||
       'ช่างไฟ (คุณเอ): 081-234-5678' || chr(10) ||
       'ช่างประปา (คุณบี): 089-876-5432' || chr(10) ||
       'ช่างแอร์: 062-111-2233',
       '#dbeafe', true, now() - interval '3 hours'),

      (v_admin, 'ปั๊มน้ำเปลี่ยนมอเตอร์แล้ว — ประกันถึง ก.ย. 2570',
       'ใบประกันเก็บในแฟ้มเอกสารอาคาร ช่องที่ 3' || chr(10) ||
       'ถ้าเสียอีกภายในประกัน โทรร้านไทยพัฒนาการช่าง',
       '#dcfce7', false, now() - interval '2 days'),

      (v_admin, 'ไอเดีย: ติดกล้องวงจรปิดเพิ่มโถงชั้น 2',
       'ผู้เช่า 3 ห้องขอมา งบประมาณราว 15,000 (4 ตัว + ติดตั้ง)' || chr(10) ||
       'รอดูงบสิ้นปีก่อน',
       '#fef3c7', false, now() - interval '5 days'),

      (v_admin, 'ห้อง 208 ว่างนาน 2 เดือน — ลองลดราคา?',
       'ห้องมุม แดดบ่ายแรง คนดูแล้วไม่เอา 4 ราย' || chr(10) ||
       'ลองติดม่านกันแดด + ลดค่าเช่า 300 ดูก่อน',
       '#f3e8ff', false, now() - interval '9 days'),

      (v_admin, 'นัดตรวจถังดับเพลิงประจำปี — เดือนหน้า',
       'บริษัทจะติดต่อมาเอง เตรียมกุญแจห้องเก็บของไว้',
       '#e0e7ff', false, now() - interval '14 days');

    raise notice 'เพิ่มบันทึกแล้ว';
  else
    raise notice 'มีบันทึกอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 6) เอกสาร — แถวใน DB ชี้ไป path ที่ยังไม่มีไฟล์จริง
  --
  -- ⚠️ ตั้งใจไม่อัปโหลดไฟล์จริง (SQL อัปโหลดเข้า storage ไม่ได้)
  --    กดเปิดจะได้ error — เป็นเรื่องปกติของข้อมูลจำลองชุดนี้
  --    ถ้าอยากทดสอบการเปิดไฟล์จริง ให้อัปโหลดผ่านหน้า /comms
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.documents where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.documents (landlord_id, rental_id, title, file_path, file_name, file_size, mime_type, notes)
    values
      (v_admin, null, 'สัญญาเช่ามาตรฐาน (แบบฟอร์มเปล่า)',
       v_admin || '/demo-lease-template.pdf', 'สัญญาเช่ามาตรฐาน.pdf', 248000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, v_r1, 'สำเนาสัญญาเช่า ห้อง 101',
       v_admin || '/demo-lease-101.pdf', 'สัญญาเช่า-101.pdf', 312000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, null, 'ใบประกันมอเตอร์ปั๊มน้ำ (ถึง ก.ย. 2570)',
       v_admin || '/demo-pump-warranty.pdf', 'ใบประกันปั๊มน้ำ.pdf', 96000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, null, 'ใบเสร็จภาษีที่ดิน ปี 2569',
       v_admin || '/demo-tax-2569.pdf', 'ภาษีที่ดิน-2569.pdf', 154000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, null, 'แปลนอาคาร (ผังไฟ + ผังประปา)',
       v_admin || '/demo-floorplan.jpg', 'แปลนอาคาร.jpg', 1840000, 'image/jpeg',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage');

    raise notice 'เพิ่มเอกสารแล้ว (ไม่มีไฟล์จริง — กดเปิดจะ error ตามคาด)';
  else
    raise notice 'มีเอกสารอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ═════════════════════════════════════════════════════════════
  -- 7) แจ้งซ่อม — ครบทุกสถานะ ทั้งที่มาจาก LINE และจาก portal
  -- ═════════════════════════════════════════════════════════════
  select count(*) into v_n from public.repair_tickets;
  if v_n = 0 then
    insert into public.repair_tickets (rental_id, description, status, photo_url, created_at, done_at)
    values
      -- รอดำเนินการ (เจ้าของยังไม่แตะ)
      (v_r4, 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว',
       'open', null, now() - interval '5 hours', null),
      (v_r2, 'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ',
       'open', null, now() - interval '1 day', null),
      (v_r1, 'น้ำรั่วใต้อ่างล้างหน้า มีน้ำขังพื้นตอนเช้า',
       'open', null, now() - interval '2 days', null),

      -- กำลังซ่อม (นัดช่างแล้ว)
      (v_r3, 'ประตูห้องปิดไม่สนิท ต้องออกแรงดันแรงๆ',
       'in_progress', null, now() - interval '4 days', null),
      (v_r2, 'ก๊อกน้ำในครัวหยดตลอด ปิดสุดแล้วก็ยังหยด',
       'in_progress', null, now() - interval '6 days', null),

      -- เสร็จแล้ว (มีประวัติให้ดู)
      (v_r1, 'หลอดไฟหน้าห้องไม่ติด',
       'done', null, now() - interval '12 days', now() - interval '10 days'),
      (v_r4, 'ชักโครกกดไม่ลง น้ำไม่ไหลเข้าถัง',
       'done', null, now() - interval '20 days', now() - interval '19 days'),
      (v_r3, 'มุ้งลวดหน้าต่างขาด แมลงเข้าห้อง',
       'done', null, now() - interval '35 days', now() - interval '31 days');

    raise notice 'เพิ่มรายการแจ้งซ่อมแล้ว';
  else
    raise notice 'มีรายการแจ้งซ่อมอยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  raise notice '── seed เสร็จ ── landlord=%', v_admin;
end;
$$;

-- ── สรุปผล ──────────────────────────────────────────────────────
select 'expense_categories' as ตาราง, count(*) as จำนวน from public.expense_categories
union all select 'expenses',      count(*) from public.expenses
union all select 'other_income',  count(*) from public.other_income
union all select 'announcements', count(*) from public.announcements
union all select 'notes',         count(*) from public.notes
union all select 'documents',     count(*) from public.documents
union all select 'repair_tickets', count(*) from public.repair_tickets
union all select 'rentals',       count(*) from public.rentals
union all select 'transactions',  count(*) from public.transactions;

-- ═══════════════════════════════════════════════════════════════════
-- ลบข้อมูลจำลองชุดนี้ (ตอนจะขึ้นใช้งานจริงกับลูกค้า)
-- ═══════════════════════════════════════════════════════════════════
-- delete from public.repair_tickets;
-- delete from public.documents where notes like 'ตัวอย่าง%';
-- delete from public.notes;
-- delete from public.announcements;
-- delete from public.other_income;
-- delete from public.expenses;
-- delete from public.expense_categories;
