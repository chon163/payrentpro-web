-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : บัญชีเดโม่ — กดปุ่มเดียวเข้าดูระบบพร้อมข้อมูลครบทุกหน้า
--
-- เทียบกับต้นทาง: PropertyHub มี demo001/12345678 ให้กดดูได้เลย
-- ของเรายังไม่มี ใครเข้ามาใหม่จะเจอหน้าว่างเปล่าทั้งหมด
--
-- ทำไมต้องมีข้อมูลชุดแยก (ไม่ใช้ของเจ้าของ):
-- RLS แยกข้อมูลตาม landlord — ยืนยันแล้วว่าบัญชีใหม่เห็น rentals 0 แถว
-- ข้อมูลที่ seed ไปก่อนหน้าผูกกับอีเมลเจ้าของ บัญชีอื่นจึงมองไม่เห็น
--
-- ผูกด้วย **email** ไม่ใช่ user_id เพราะ RLS เช็ค
--   (auth.uid() = a.user_id) OR (auth.email() = a.email)
-- ใช้ email อย่างเดียวจึงไม่ต้องพึ่ง auth.users และรันซ้ำได้แม้ลบ/สร้าง user ใหม่
--
-- ⚠️ บัญชีนี้เป็นบัญชีสาธารณะโดยเจตนา (รหัสอยู่ในโค้ดฝั่งหน้าเว็บ)
--    ใครก็เข้าได้ ห้ามใส่ข้อมูลจริงของลูกค้าลงในบัญชีนี้
--    ถ้าจะปิดโหมดเดโม่: ลบแถว admins ที่ email = 'demo@payrentpro.app'
--    แล้วเอาปุ่มออกจาก src/AuthPage.jsx
-- ⚠️ คอลัมน์แพ็กเกจบน DB จริงชื่อ `plan_type` ไม่ใช่ `plan`
--    (ไฟล์ 20260906150000_membership_gate.sql เขียน `plan` แต่ DB จริงถูกแก้
--     ตรงผ่าน SQL Editor ภายหลัง — ไฟล์ migration จึงตามไม่ทัน)
--    ไฟล์นี้อ่านชื่อคอลัมน์จาก information_schema แล้วประกอบ SQL ตอนรัน
--    จึงทำงานได้ทั้งกรณี `plan` และ `plan_type`
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_demo_email text := 'demo@payrentpro.app';
  v_admin uuid;
  v_uid uuid;
  v_plan_col text;
  v_cat_elec uuid;
  v_cat_water uuid;
  v_cat_repair uuid;
  v_cat_clean uuid;
  v_cat_net uuid;
  v_cat_salary uuid;
  v_cat_tax uuid;
  v_n int;
begin
  -- หาชื่อคอลัมน์แพ็กเกจที่มีจริง
  select column_name into v_plan_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'admins'
     and column_name in ('plan_type', 'plan')
   order by case column_name when 'plan_type' then 1 else 2 end
   limit 1;

  if v_plan_col is null then
    raise exception 'ไม่พบคอลัมน์ plan/plan_type ในตาราง admins';
  end if;
  raise notice 'ใช้คอลัมน์แพ็กเกจ: %', v_plan_col;

  -- ── 1) แถว admins ของเดโม่ ────────────────────────────────────
  -- ถ้ามี auth user อยู่แล้วก็ผูก user_id ให้ด้วย (ไม่มีก็ไม่เป็นไร
  -- เพราะ RLS ยอมให้ match ด้วย email)
  select id into v_uid from auth.users where email = v_demo_email limit 1;

  select id into v_admin from public.admins where email = v_demo_email limit 1;

  if v_admin is null then
    execute format(
      'insert into public.admins (email, user_id, %I, expire_date, room_limit,
         business_name, owner_name, address, payment_type, promptpay, promptpay_name)
       values ($1, $2, ''pro'', current_date + 3650, 100,
         ''สุขใจ อพาร์ทเม้นท์ (เดโม่)'', ''คุณสมชาย ใจดี (เดโม่)'',
         ''99/9 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000'',
         ''promptpay'', ''0812345678'', ''สมชาย ใจดี'')
       returning id', v_plan_col)
    using v_demo_email, v_uid
    into v_admin;
    raise notice 'สร้าง admins ของเดโม่: %', v_admin;
  else
    -- รันซ้ำ: ต่ออายุให้ไม่หมด + ผูก user_id ถ้าเพิ่งมี
    execute format(
      'update public.admins
          set %I = ''pro'',
              expire_date = greatest(coalesce(expire_date, current_date), current_date + 3650),
              room_limit = greatest(coalesce(room_limit, 0), 100),
              user_id = coalesce(user_id, $2)
        where id = $1', v_plan_col)
    using v_admin, v_uid;
    raise notice 'มี admins ของเดโม่แล้ว: %', v_admin;
  end if;

  -- ── 2) ห้องเช่า 12 ห้อง (เต็ม 8 / ว่าง 3 / ปรับปรุง 1) ────────
  select count(*) into v_n from public.rentals where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.rentals (
      landlord_id, biz_type, cust_name, tenant_phone, tenant_id_card,
      item_details, sub_label, room_status, amount, cycle, due_date,
      penalty_per_day, penalty_enabled, chase_frequency, stop_chase,
      credit_balance, deposit_amount, move_in_date, lease_end_date,
      last_water_meter, water_rate, last_elec_meter, elec_rate,
      utility_enabled, binding_code
    )
    select
      v_admin,
      'property',
      s.cust,
      s.phone,
      case when s.cust <> 'ว่าง' then '1' || lpad((s.i * 7654321)::text, 12, '0') end,
      s.room,
      'อาคาร A',
      s.status,
      s.amount,
      'monthly',
      5,
      50, true, 3, 0, 0,
      case when s.cust <> 'ว่าง' then s.amount else 0 end,
      case when s.cust <> 'ว่าง' then current_date - 300 - (s.i * 9) end,
      case when s.cust <> 'ว่าง' then current_date + s.lease_left end,
      420 + s.i * 11, 18, 980 + s.i * 123, 5,
      true,
      (910000000 + s.i)::text
    from (values
      (1,  'ห้อง 101', 'สมหญิง รักเรียน',   '0810000101', 'occupied',    4200,  8),
      (2,  'ห้อง 102', 'วีระ ขยันงาน',       '0810000102', 'occupied',    4200, 25),
      (3,  'ห้อง 103', 'ดวงใจ แสนสุข',       '0810000103', 'occupied',    4500, 120),
      (4,  'ห้อง 104', 'อนันต์ พากเพียร',    '0810000104', 'occupied',    4500, 200),
      (5,  'ห้อง 105', 'ว่าง',                null,         'vacant',      4500, 0),
      (6,  'ห้อง 106', 'มาลี ตั้งใจดี',       '0810000106', 'occupied',    5200, 18),
      (7,  'ห้อง 201', 'ธนกร มุ่งมั่น',       '0810000201', 'occupied',    5200, 260),
      (8,  'ห้อง 202', 'ว่าง',                null,         'vacant',      5200, 0),
      (9,  'ห้อง 203', 'กิตติ รุ่งโรจน์',     '0810000203', 'occupied',    5500, 90),
      (10, 'ห้อง 204', 'ศิริพร ใจเย็น',       '0810000204', 'occupied',    5500, 330),
      (11, 'ห้อง 205', 'ว่าง',                null,         'vacant',      5500, 0),
      (12, 'ห้อง 206', 'ปรับปรุงห้อง',        null,         'maintenance', 5800, 0)
    ) as s(i, room, cust, phone, status, amount, lease_left);

    raise notice 'เพิ่มห้องเดโม่ 12 ห้อง';
  else
    raise notice 'เดโม่มีห้องอยู่แล้ว % ห้อง — ข้าม', v_n;
  end if;

  -- ── 3) บิล 6 เดือนย้อนหลัง (สถานะคละ) ────────────────────────
  select count(*) into v_n
    from public.transactions t
    join public.rentals r on r.id = t.rental_id
   where r.landlord_id = v_admin;

  if v_n = 0 then
    insert into public.transactions (
      rental_id, period, base_amount, water_units, water_cost,
      elec_units, elec_cost, total_amount, status, secure_token,
      paid_amount, created_at
    )
    select
      o.id,
      to_char(mo.month_start, 'YYYY-MM'),
      o.amount,
      u.wu,
      (u.wu * o.water_rate)::numeric,
      u.eu,
      (u.eu * o.elec_rate)::numeric,
      (o.amount + u.wu * o.water_rate + u.eu * o.elec_rate)::numeric,
      case
        when gs.offs >= 3 then 'paid'                        -- เดือนเก่าจ่ายครบ
        when gs.offs = 2 and o.seq % 4 = 0 then 'unpaid'     -- ค้างนาน → ทวงด่วน
        when gs.offs = 1 and o.seq % 4 = 0 then 'unpaid'
        when gs.offs <= 1 and o.seq % 5 = 3 then 'pending_review'  -- รอตรวจสลิป
        when gs.offs = 0 and o.seq % 3 = 0 then 'unpaid'     -- ค้างเดือนนี้
        else 'paid'
      end,
      md5(o.id::text || gs.offs::text || 'demoseed')::uuid,
      case when gs.offs <= 1 and o.seq % 5 = 3
           then (o.amount + u.wu * o.water_rate + u.eu * o.elec_rate)::numeric end,
      case
        when gs.offs = 0 then now() - interval '3 days'
        else mo.month_start + ((o.seq % 20) * interval '1 day')
      end
    from (
      select id, amount, water_rate, elec_rate,
             row_number() over (order by item_details) as seq
        from public.rentals
       where landlord_id = v_admin
         and lower(coalesce(room_status,'')) = 'occupied'
    ) o
    cross join generate_series(0, 5) as gs(offs)
    cross join lateral (
      select (date_trunc('month', current_date) - ((5 - gs.offs) * interval '1 month')) as month_start
    ) mo
    cross join lateral (
      select (4 + (o.seq % 11)) as wu, (32 + (o.seq % 85)) as eu
    ) u
    on conflict do nothing;

    raise notice 'เพิ่มบิลเดโม่ 6 เดือน';
  else
    raise notice 'เดโม่มีบิลอยู่แล้ว % ใบ — ข้าม', v_n;
  end if;

  -- ── 4) หมวดรายจ่าย ───────────────────────────────────────────
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

  -- ── 5) รายจ่าย 6 เดือน ───────────────────────────────────────
  select count(*) into v_n from public.expenses where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_elec,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
           'ค่าไฟฟ้าส่วนกลาง + มิเตอร์รวม',
           7800 + (m * 310) + ((m % 3) * 560),
           'การไฟฟ้าส่วนภูมิภาค',
           'PEA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'),
           'transfer', null
      from generate_series(0, 5) as m;

    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_water,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
           'ค่าน้ำประปาส่วนกลาง + มิเตอร์รวม',
           2200 + (m * 88),
           'การประปาส่วนภูมิภาค',
           'PWA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'),
           'transfer', null
      from generate_series(0, 5) as m;

    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method)
    select v_admin, v_cat_net,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
           'อินเทอร์เน็ตไฟเบอร์ 1Gbps (Wi-Fi ทุกชั้น)', 1590, '3BB', 'credit_card'
      from generate_series(0, 5) as m;

    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method, notes)
    select v_admin, v_cat_salary,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '27 days')::date,
           'ค่าแรงแม่บ้านทำความสะอาดส่วนกลาง', 8000, 'คุณสมพร (แม่บ้าน)', 'cash', 'จ่ายสิ้นเดือน'
      from generate_series(0, 5) as m;

    -- ค่าซ่อมผูกห้องจริง
    insert into public.expenses (landlord_id, category_id, rental_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin, v_cat_repair,
           (select id from public.rentals where landlord_id = v_admin and item_details = s.room limit 1),
           s.d, s.descr, s.amt, s.vendor, s.ref, s.pm, s.note
      from (values
        ('ห้อง 104', (current_date - 4),  'ล้างแอร์ + เติมน้ำยา ห้อง 104', 1200, 'ช่างเอ (แอร์)', null, 'cash', 'ผู้เช่าแจ้งแอร์ไม่เย็น'),
        ('ห้อง 101', (current_date - 12), 'เปลี่ยนก๊อกน้ำอ่างล้างหน้า ห้อง 101', 850, 'ช่างบี (ประปา)', null, 'cash', null),
        ('ห้อง 102', (current_date - 26), 'เปลี่ยนลูกบิดประตู ห้อง 102', 450, 'ช่างบี (ประปา)', null, 'cash', null),
        ('ห้อง 206', (current_date - 15), 'ปรับปรุงห้อง 206 — ปูพื้นใหม่ + ทาสี', 18500, 'ร้านช่างรวมมิตร', 'INV-3021', 'transfer', 'ห้องว่างนาน ปรับปรุงก่อนปล่อยเช่า')
      ) as s(room, d, descr, amt, vendor, ref, pm, note);

    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    values
      (v_admin, v_cat_repair, (current_date - 40), 'ซ่อมปั๊มน้ำอาคาร (มอเตอร์ไหม้)', 6800, 'ร้านไทยพัฒนาการช่าง', 'INV-2291', 'transfer', 'เปลี่ยนมอเตอร์ใหม่ ประกัน 1 ปี'),
      (v_admin, v_cat_clean,  (current_date - 8),  'ล้างถังเก็บน้ำ + ฆ่าเชื้อ', 3500, 'บ.คลีนโปร', 'CP-882', 'transfer', 'ทำปีละ 2 ครั้ง'),
      (v_admin, v_cat_clean,  (current_date - 55), 'กำจัดปลวก/แมลง ทั้งอาคาร', 4800, 'บ.เพสท์การ์ด', 'PG-441', 'transfer', 'รับประกัน 6 เดือน'),
      (v_admin, v_cat_tax,    (current_date - 20), 'ภาษีที่ดินและสิ่งปลูกสร้าง', 8600, 'เทศบาล', 'TAX-2569', 'transfer', null),
      (v_admin, v_cat_tax,    (current_date - 33), 'ค่าธรรมเนียมเก็บขยะ (รายปี)', 2400, 'เทศบาล', null, 'cash', null);

    raise notice 'เพิ่มรายจ่ายเดโม่';
  end if;

  -- ── 6) รายรับอื่น ────────────────────────────────────────────
  select count(*) into v_n from public.other_income where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.other_income (landlord_id, income_date, description, amount, source)
    select v_admin,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '25 days')::date,
           'เครื่องซักผ้า/อบผ้าหยอดเหรียญ', 2400 + ((m % 4) * 280), 'เครื่องซักผ้า'
      from generate_series(0, 5) as m;

    insert into public.other_income (landlord_id, income_date, description, amount, source)
    select v_admin,
           (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
           'ค่าที่จอดรถเพิ่ม 3 คัน (คันละ 500)', 1500, 'ที่จอดรถ'
      from generate_series(0, 5) as m;

    insert into public.other_income (landlord_id, rental_id, income_date, description, amount, source, notes)
    select v_admin,
           (select id from public.rentals where landlord_id = v_admin and item_details = s.room limit 1),
           s.d, s.descr, s.amt, s.src, s.note
      from (values
        ('ห้อง 102', (current_date - 6),  'ค่าปรับชำระล่าช้า 12 วัน', 600, 'ค่าปรับ', 'คิด 50 บาท/วัน'),
        ('ห้อง 103', (current_date - 18), 'ค่าปรับชำระล่าช้า 5 วัน',  250, 'ค่าปรับ', null),
        ('ห้อง 204', (current_date - 45), 'ริบมัดจำ (ย้ายออกก่อนครบสัญญา)', 4500, 'ริบมัดจำ', 'ผู้เช่าเก่า')
      ) as s(room, d, descr, amt, src, note);

    insert into public.other_income (landlord_id, income_date, description, amount, source, notes)
    values
      (v_admin, (current_date - 30), 'ค่าเช่าพื้นที่ติดตั้งตู้กดน้ำ', 1000, 'ค่าเช่าพื้นที่', 'สัญญารายปี'),
      (v_admin, (current_date - 52), 'ค่าเช่าป้ายโฆษณาหน้าอาคาร', 2500, 'ค่าเช่าพื้นที่', null);

    raise notice 'เพิ่มรายรับอื่นเดโม่';
  end if;

  -- ── 7) ประกาศ ────────────────────────────────────────────────
  select count(*) into v_n from public.announcements where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.announcements (landlord_id, title, content, publish_date, status, sent_to_line_at)
    values
      (v_admin, 'แจ้งหยุดน้ำชั่วคราว วันเสาร์นี้ 09:00-15:00',
       'เรียนผู้เช่าทุกท่าน' || chr(10) || chr(10) ||
       'ทางอาคารจะล้างถังเก็บน้ำและฆ่าเชื้อ วันเสาร์ที่จะถึงนี้' || chr(10) ||
       'เวลา 09:00 - 15:00 น. ช่วงเวลาดังกล่าวจะไม่มีน้ำใช้' || chr(10) || chr(10) ||
       'ขอให้ทุกท่านสำรองน้ำไว้ล่วงหน้า ขออภัยในความไม่สะดวกครับ',
       current_date, 'published', now() - interval '2 days'),
      (v_admin, 'ปรับปรุงระบบ Wi-Fi ส่วนกลาง — เพิ่มเป็น 1Gbps',
       'อัปเกรดอินเทอร์เน็ตเป็นไฟเบอร์ 1Gbps แล้ว' || chr(10) ||
       'ติดตั้ง Access Point ใหม่ทุกชั้น สัญญาณครอบคลุมทั้งอาคาร',
       current_date - 8, 'published', now() - interval '8 days'),
      (v_admin, 'เตือนกำหนดชำระค่าเช่า — ทุกวันที่ 5 ของเดือน',
       'ขอความร่วมมือชำระภายในวันที่ 5 ของทุกเดือน' || chr(10) ||
       'หากเกินกำหนดมีค่าปรับวันละ 50 บาท ตามสัญญาข้อ 7',
       current_date - 15, 'published', now() - interval '15 days'),
      (v_admin, 'ประกาศขึ้นค่าเช่าปี 2570 (ฉบับร่าง)',
       'ร่าง: ปรับค่าเช่าขึ้น 5% มีผล 1 ม.ค. 2570' || chr(10) ||
       'ยังไม่ส่งให้ผู้เช่า — รอหารือกับหุ้นส่วนก่อน',
       current_date + 20, 'draft', null),
      (v_admin, 'กิจกรรมทำความสะอาดใหญ่ประจำปี (จบแล้ว)',
       'ขอบคุณผู้เช่าทุกท่านที่ให้ความร่วมมือ',
       current_date - 95, 'archived', now() - interval '95 days');
    raise notice 'เพิ่มประกาศเดโม่';
  end if;

  -- ── 8) บันทึกช่วยจำ ──────────────────────────────────────────
  select count(*) into v_n from public.notes where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.notes (landlord_id, title, content, color, pinned, updated_at)
    values
      (v_admin, 'ห้อง 101 สัญญาหมด 8 วัน — ต้องคุยต่อสัญญา',
       'ผู้เช่าอยากต่ออีก 1 ปี แต่ขอลดค่าเช่า 200' || chr(10) ||
       'ตัดสินใจ: ยอมลด 100 ถ้าจ่ายล่วงหน้า 3 เดือน',
       '#fee2e2', true, now() - interval '1 hour'),
      (v_admin, 'รหัสตู้ไฟหลัก + เบอร์ช่างฉุกเฉิน',
       'ตู้ไฟชั้น 1: 4729' || chr(10) ||
       'ช่างไฟ (คุณเอ): 081-234-5678' || chr(10) ||
       'ช่างประปา (คุณบี): 089-876-5432' || chr(10) ||
       'ช่างแอร์: 062-111-2233',
       '#dbeafe', true, now() - interval '3 hours'),
      (v_admin, 'ปั๊มน้ำเปลี่ยนมอเตอร์แล้ว — ประกันถึง ก.ย. 2570',
       'ใบประกันเก็บในแฟ้มเอกสารอาคาร ช่องที่ 3',
       '#dcfce7', false, now() - interval '2 days'),
      (v_admin, 'ไอเดีย: ติดกล้องวงจรปิดเพิ่มโถงชั้น 2',
       'ผู้เช่า 3 ห้องขอมา งบราว 15,000 (4 ตัว + ติดตั้ง)' || chr(10) || 'รอดูงบสิ้นปี',
       '#fef3c7', false, now() - interval '5 days'),
      (v_admin, 'ห้อง 205 ว่างนาน 2 เดือน — ลองลดราคา?',
       'ห้องมุม แดดบ่ายแรง คนดูแล้วไม่เอา 4 ราย' || chr(10) ||
       'ลองติดม่านกันแดด + ลดค่าเช่า 300',
       '#f3e8ff', false, now() - interval '9 days'),
      (v_admin, 'นัดตรวจถังดับเพลิงประจำปี — เดือนหน้า',
       'บริษัทจะติดต่อมาเอง เตรียมกุญแจห้องเก็บของไว้',
       '#e0e7ff', false, now() - interval '14 days');
    raise notice 'เพิ่มบันทึกเดโม่';
  end if;

  -- ── 9) เอกสาร (ไม่มีไฟล์จริงใน storage — กดเปิดจะ error) ─────
  select count(*) into v_n from public.documents where landlord_id = v_admin;
  if v_n = 0 then
    insert into public.documents (landlord_id, title, file_path, file_name, file_size, mime_type, notes)
    values
      (v_admin, 'สัญญาเช่ามาตรฐาน (แบบฟอร์มเปล่า)',
       v_admin || '/demo-lease-template.pdf', 'สัญญาเช่ามาตรฐาน.pdf', 248000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, 'ใบประกันมอเตอร์ปั๊มน้ำ (ถึง ก.ย. 2570)',
       v_admin || '/demo-pump-warranty.pdf', 'ใบประกันปั๊มน้ำ.pdf', 96000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, 'ใบเสร็จภาษีที่ดิน ปี 2569',
       v_admin || '/demo-tax-2569.pdf', 'ภาษีที่ดิน-2569.pdf', 154000, 'application/pdf',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
      (v_admin, 'แปลนอาคาร (ผังไฟ + ผังประปา)',
       v_admin || '/demo-floorplan.jpg', 'แปลนอาคาร.jpg', 1840000, 'image/jpeg',
       'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage');
    raise notice 'เพิ่มเอกสารเดโม่';
  end if;

  -- ── 10) แจ้งซ่อม (ครบ 3 สถานะ) ───────────────────────────────
  select count(*) into v_n
    from public.repair_tickets rt
    join public.rentals r on r.id = rt.rental_id
   where r.landlord_id = v_admin;

  if v_n = 0 then
    insert into public.repair_tickets (rental_id, description, status, created_at, done_at)
    select (select id from public.rentals where landlord_id = v_admin and item_details = s.room limit 1),
           s.descr, s.st, s.created, s.done
      from (values
        ('ห้อง 104', 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว', 'open',        now() - interval '5 hours', null::timestamptz),
        ('ห้อง 102', 'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ',                                  'open',        now() - interval '1 day',   null),
        ('ห้อง 101', 'น้ำรั่วใต้อ่างล้างหน้า มีน้ำขังพื้นตอนเช้า',                          'open',        now() - interval '2 days',  null),
        ('ห้อง 103', 'ประตูห้องปิดไม่สนิท ต้องออกแรงดันแรงๆ',                              'in_progress', now() - interval '4 days',  null),
        ('ห้อง 106', 'ก๊อกน้ำในครัวหยดตลอด ปิดสุดแล้วก็ยังหยด',                            'in_progress', now() - interval '6 days',  null),
        ('ห้อง 101', 'หลอดไฟหน้าห้องไม่ติด',                                                'done',        now() - interval '12 days', now() - interval '10 days'),
        ('ห้อง 204', 'ชักโครกกดไม่ลง น้ำไม่ไหลเข้าถัง',                                     'done',        now() - interval '20 days', now() - interval '19 days'),
        ('ห้อง 203', 'มุ้งลวดหน้าต่างขาด แมลงเข้าห้อง',                                     'done',        now() - interval '35 days', now() - interval '31 days')
      ) as s(room, descr, st, created, done);
    raise notice 'เพิ่มแจ้งซ่อมเดโม่';
  end if;

  raise notice '── เดโม่พร้อมใช้ ── admin=% email=%', v_admin, v_demo_email;
end;
$$;

-- ── ตรวจว่าเดโม่มีข้อมูลครบ — ว่างแม้ตารางเดียวให้ push ล้ม ──────
do $$
declare
  v_admin uuid;
  v_missing text := '';
  v_rentals int; v_tx int; v_exp int; v_inc int;
  v_ann int; v_notes int; v_docs int; v_rep int;
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;
  if v_admin is null then
    raise exception 'ไม่พบ admins ของเดโม่';
  end if;

  select count(*) into v_rentals from public.rentals where landlord_id = v_admin;
  select count(*) into v_tx from public.transactions t join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin;
  select count(*) into v_exp from public.expenses where landlord_id = v_admin;
  select count(*) into v_inc from public.other_income where landlord_id = v_admin;
  select count(*) into v_ann from public.announcements where landlord_id = v_admin;
  select count(*) into v_notes from public.notes where landlord_id = v_admin;
  select count(*) into v_docs from public.documents where landlord_id = v_admin;
  select count(*) into v_rep from public.repair_tickets rt join public.rentals r on r.id = rt.rental_id where r.landlord_id = v_admin;

  if v_rentals = 0 then v_missing := v_missing || 'rentals '; end if;
  if v_tx = 0      then v_missing := v_missing || 'transactions '; end if;
  if v_exp = 0     then v_missing := v_missing || 'expenses '; end if;
  if v_inc = 0     then v_missing := v_missing || 'other_income '; end if;
  if v_ann = 0     then v_missing := v_missing || 'announcements '; end if;
  if v_notes = 0   then v_missing := v_missing || 'notes '; end if;
  if v_docs = 0    then v_missing := v_missing || 'documents '; end if;
  if v_rep = 0     then v_missing := v_missing || 'repair_tickets '; end if;

  if v_missing <> '' then
    raise exception 'ข้อมูลเดโม่ไม่ครบ — ตารางที่ว่าง: %', v_missing;
  end if;

  raise notice 'เดโม่ครบ: ห้อง=% บิล=% รายจ่าย=% รายรับอื่น=% ประกาศ=% บันทึก=% เอกสาร=% ซ่อม=%',
    v_rentals, v_tx, v_exp, v_inc, v_ann, v_notes, v_docs, v_rep;
end;
$$;
