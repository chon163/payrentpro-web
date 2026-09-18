-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : รีเซ็ต + seed เดโมครบทุกฟังก์ชัน (demo@payrentpro.app)
--
-- ล้างข้อมูลเดิมของบัญชีเดโม่ทั้งหมด แล้ว seed ชุดใหม่ที่ทำให้ทุกหน้ามีของให้ดู:
--   · 3 ประเภทธุรกิจ: ห้องเช่า (property) / รถเช่า (vehicle) / อุปกรณ์ (other)
--   · สถานะห้องครบ: occupied / vacant / maintenance · cycle monthly/weekly/daily
--   · บิลครบสถานะ: paid (สลิป/เงินสด/พร้อมเพย์) · unpaid ค้าง 1/2/4/6 วัน
--     (การ์ดแดง 3+ วัน) · pending_review รอตรวจสลิป · draft ร่างเดือนหน้า
--     · บิลค่าน้ำไฟอย่างเดียว (is_utility_only) · บิลค้างเดือนก่อน (ทวงด่วน)
--     · penalty_days/penalty_amount/escalated_at จากระบบทวงหนี้
--   · ค้างป้อนมิเตอร์น้ำไฟ 2 ห้อง (หน้ากรอกค่าน้ำไฟบนมือถือ)
--   · สัญญาใกล้หมดอายุ (201) + หมดอายุแล้ว (202) · ผูก LINE group แล้ว 4 ห้อง
--   · ค่าใช้จ่าย/หมวด · รายรับอื่น 6 เดือน · ประกาศ 3 สถานะ · บันทึก 6 สี
--   · เอกสาร · แจ้งซ่อมครบทุกสถานะ+outcome · ค่าสมาชิก (อนุมัติแล้ว/รอตรวจ)
--   · slip_verifications · activity_logs · audit_logs · rental_audit_log
--   · reminders (ใบเสร็จ/ใกล้ครบกำหนด)
--
-- ⚠️ ตาราง transactions ของ DB นี้ไม่มีคอลัมน์ paid_at — ห้ามใช้
-- ⚠️ บัญชีนี้เป็นบัญชีสาธารณะ (demo12345678) ห้ามใส่ข้อมูลลูกค้าจริง
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_demo_email text := 'demo@payrentpro.app';
  v_admin uuid;
  v_uid uuid;
  v_plan_col text;
  v_d int := extract(day from current_date)::int;   -- วันที่วันนี้ (คำนวณ bill_day ให้ค้างจริงตามชื่อห้อง)
  v_r101 uuid; v_r102 uuid; v_r103 uuid; v_r104 uuid; v_r105 uuid;
  v_r106 uuid; v_r201 uuid; v_r202 uuid; v_r203 uuid; v_r204 uuid;
  v_r205 uuid; v_r206 uuid; v_car1 uuid; v_car2 uuid; v_cam uuid; v_drone uuid;
  v_cat_elec uuid; v_cat_water uuid; v_cat_repair uuid; v_cat_clean uuid;
  v_cat_net uuid; v_cat_salary uuid; v_cat_tax uuid;
  v_tx103cur uuid; v_tx206cur uuid; v_tx104cur uuid;
  v_mpay uuid; v_mpay2 uuid;
begin
  select id into v_admin from public.admins where email = v_demo_email limit 1;
  if v_admin is null then
    raise exception 'ไม่พบบัญชีเดโม่ demo@payrentpro.app — รัน 20260909150000_demo_account.sql ก่อน';
  end if;
  select id into v_uid from auth.users where email = v_demo_email limit 1;

  -- ชื่อคอลัมน์แพ็กเกจ (DB จริงใช้ plan_type)
  select column_name into v_plan_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'admins'
     and column_name in ('plan_type', 'plan')
   order by case column_name when 'plan_type' then 1 else 2 end limit 1;
  if v_plan_col is null then
    raise exception 'ไม่พบคอลัมน์ plan/plan_type ในตาราง admins';
  end if;

  -- ══ 0) รีเซ็ต — ล้างข้อมูลเดโม่ทั้งหมด เรียงตาม FK ══════════════
  delete from public.reminders         where landlord_id = v_admin;
  delete from public.audit_logs        where landlord_id = v_admin;
  delete from public.rental_audit_log  where rental_id in (select id from public.rentals where landlord_id = v_admin);
  delete from public.slip_verifications
    where (kind = 'tenant' and ref_id in (
            select t.id from public.transactions t
            join public.rentals r on r.id = t.rental_id
           where r.landlord_id = v_admin))
       or (kind = 'membership' and ref_id in (
            select id from public.membership_payments where admin_id = v_admin));
  delete from public.membership_payments where admin_id = v_admin;
  delete from public.repair_tickets where rental_id in (select id from public.rentals where landlord_id = v_admin);
  delete from public.documents   where landlord_id = v_admin;
  delete from public.notes       where landlord_id = v_admin;
  delete from public.announcements where landlord_id = v_admin;
  delete from public.other_income where landlord_id = v_admin;
  delete from public.expenses    where landlord_id = v_admin;
  delete from public.expense_categories where landlord_id = v_admin;
  delete from public.transactions where rental_id in (select id from public.rentals where landlord_id = v_admin);
  delete from public.rentals     where landlord_id = v_admin;
  delete from public.activity_logs where admin_id = v_admin;

  -- โปรไฟล์ธุรกิจเดโม่: pro ไม่หมดอายุ
  execute format(
    'update public.admins set %I = ''pro'',
        expire_date = current_date + 3650,
        room_limit = greatest(coalesce(room_limit, 0), 100),
        status = ''active'',
        user_id = coalesce(user_id, $2),
        business_name = ''สุขใจ อพาร์ทเม้นท์ (เดโม่)'',
        owner_name = ''คุณสมชาย ใจดี (เดโม่)'',
        address = ''99/9 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000'',
        payment_type = ''promptpay'',
        promptpay = ''0812345678'',
        promptpay_name = ''สมชาย ใจดี''
      where id = $1', v_plan_col)
  using v_admin, v_uid;

  -- ══ 1) ห้องเช่า 12 ห้อง (ครบทุกสถานะ/สถานการณ์) ═════════════════
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, emergency_contact, room_status, amount, deposit_amount, cycle,
    due_date, bill_day, penalty_day, penalty_per_day, penalty_enabled,
    chase_frequency, stop_chase, credit_balance, move_in_date, lease_end_date,
    last_water_meter, water_rate, last_elec_meter, elec_rate, utility_enabled,
    binding_code, group_id
  ) values (
    v_admin, 'property', '101', 'ห้อง 101', 'สมหญิง รักเรียน', '0810000101',
    '1010000000001', '0891111101', 'occupied', 4200, 4200, 'monthly',
    5, 5, 10, 50, true, 3, 0, 0, current_date - 400, current_date + 240,
    480, 18, 1150, 5, true, '910000101', 'C' || md5('grp101')
  ) returning id into v_r101;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, chase_frequency, stop_chase, credit_balance,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter,
    elec_rate, utility_enabled, binding_code
  ) values (
    v_admin, 'property', '102', 'ห้อง 102', 'วีระ ขยันงาน', '0810000102',
    '1020000000002', 'occupied', 4500, 4500, 'monthly',
    greatest(1, v_d - 1), least(31, greatest(1, v_d - 1) + 5),   -- ค้าง 1 วัน
    50, true, 3, 0, 0, current_date - 380, current_date + 300,
    510, 18, 1240, 5, true, '910000102'
  ) returning id into v_r102;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, chase_frequency, stop_chase, credit_balance,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter,
    elec_rate, utility_enabled, binding_code, group_id, last_chase_at
  ) values (
    v_admin, 'property', '103', 'ห้อง 103', 'ดวงใจ แสนสุข', '0810000103',
    '1030000000003', 'occupied', 4800, 4800, 'monthly',
    greatest(1, v_d - 4), greatest(1, v_d - 4),                 -- ค้าง 4 วัน → การ์ดแดง
    50, true, 3, 0, 0, current_date - 500, current_date + 60,
    555, 18, 1330, 5, true, '910000103', 'C' || md5('grp103'),
    now() - interval '1 day'
  ) returning id into v_r103;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, utility_enabled, binding_code,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '104', 'ห้อง 104', 'อนันต์ พากเพียร', '0810000104',
    '1040000000004', 'occupied', 4500, 4500, 'monthly', 5, 10,
    50, true, true, '910000104',
    current_date - 200, current_date + 160, 470, 18, 1180, 5
  ) returning id into v_r104;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, room_status,
    amount, deposit_amount, cycle, utility_enabled, binding_code,
    last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '105', 'ห้อง 105', 'ว่าง', 'vacant',
    4500, 0, 'monthly', true, '910000105',
    520, 18, 1290, 5
  ) returning id into v_r105;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, utility_enabled, binding_code,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '106', 'ห้อง 106', 'มาลี ตั้งใจดี', '0810000106',
    '1060000000006', 'occupied', 5200, 5200, 'monthly', 5, 10,
    50, true, true, '910000106',
    current_date - 350, current_date + 90, 495, 18, 1090, 5
  ) returning id into v_r106;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, utility_enabled, binding_code,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '201', 'ห้อง 201', 'ธนกร มุ่งมั่น', '0810000201',
    '2010000000021', 'occupied', 5200, 5200, 'monthly', 5, 10,
    50, true, true, '910000201',
    current_date - 640, current_date + 18,                          -- ใกล้หมดอายุ 18 วัน
    530, 18, 1410, 5
  ) returning id into v_r201;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, utility_enabled, binding_code,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '202', 'ห้อง 202', 'ศิริพร ใจเย็น', '0810000202',
    '2020000000022', 'occupied', 5500, 5500, 'monthly',
    greatest(1, v_d - 2), least(31, greatest(1, v_d - 2) + 5),   -- ค้าง 2 วัน + สัญญาหมดแล้ว 5 วัน
    50, true, true, '910000202',
    current_date - 730, current_date - 5,
    610, 18, 1520, 5
  ) returning id into v_r202;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, room_status,
    amount, deposit_amount, cycle, binding_code
  ) values (
    v_admin, 'property', '203', 'ห้อง 203', 'ปรับปรุงห้อง', 'maintenance',
    5500, 0, 'monthly', '910000203'
  ) returning id into v_r203;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, utility_enabled, binding_code,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '204', 'ห้อง 204', 'กิตติ รุ่งโรจน์', '0810000204',
    '2040000000023', 'occupied', 5500, 5500, 'weekly', 5, 10,     -- cycle รายสัปดาห์
    50, true, true, '910000204',
    current_date - 120, current_date + 580, 505, 18, 1265, 5
  ) returning id into v_r204;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, room_status,
    amount, deposit_amount, cycle, binding_code
  ) values (
    v_admin, 'property', '205', 'ห้อง 205', 'ว่าง', 'vacant',
    5500, 0, 'monthly', '910000205'
  ) returning id into v_r205;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, emergency_contact, room_status, amount, deposit_amount, cycle,
    bill_day, penalty_day, penalty_per_day, penalty_enabled, utility_enabled,
    binding_code, group_id, credit_balance,
    move_in_date, lease_end_date, last_water_meter, water_rate, last_elec_meter, elec_rate
  ) values (
    v_admin, 'property', '206', 'ห้อง 206', 'สมศักดิ์ มั่นคง', '0810000206',
    '2060000000024', '0891112206', 'occupied', 5800, 5800, 'monthly', 5, 10,
    50, true, true, '910000206', 'C' || md5('grp206'), 500,        -- มีเครดิตค้าง 500
    current_date - 300, current_date + 400, 580, 18, 1370, 5
  ) returning id into v_r206;

  -- ══ 2) รถเช่า 2 คัน ═══════════════════════════════════════════
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, binding_code, group_id,
    move_in_date, lease_end_date
  ) values (
    v_admin, 'vehicle', 'กข 1234', 'Toyota Vios สีขาว (2566)', 'สมปอง ขับดี', '0810000301',
    '3010000000031', 'occupied', 15000, 20000, 'monthly', 5, 10,
    100, true, '920000301', 'C' || md5('grpcar1'),
    current_date - 90, current_date + 270
  ) returning id into v_car1;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, chase_frequency, stop_chase,
    binding_code, last_chase_at,
    move_in_date, lease_end_date
  ) values (
    v_admin, 'vehicle', 'ฮจ 5678', 'Honda City สีเทา (2567)', 'สมศรี วิ่งเร็ว', '0810000302',
    '3020000000032', 'occupied', 13500, 18000, 'monthly',
    greatest(1, v_d - 6), greatest(1, v_d - 6),                   -- ค้าง 6 วัน → การ์ดแดง
    100, true, 3, 0,
    '920000302', now() - interval '1 day',
    current_date - 150, current_date + 210
  ) returning id into v_car2;

  -- ══ 3) อุปกรณ์เช่า 2 ชิ้น (มีว่าง 1) ═══════════════════════════
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, binding_code,
    move_in_date, lease_end_date
  ) values (
    v_admin, 'other', 'CAM-001', 'กล้อง Canon EOS R6 + เลนส์ 24-70', 'สมบูรณ์ ถ่ายสวย', '0810000401',
    '4010000000041', 'occupied', 800, 5000, 'daily', '930000401',   -- cycle รายวัน
    current_date - 10, current_date + 20
  ) returning id into v_cam;

  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, room_status,
    amount, deposit_amount, cycle, binding_code
  ) values (
    v_admin, 'other', 'DRONE-01', 'โดรน DJI Mavic 3 (พร้อมแบต 3 ก้อน)', 'ว่าง', 'vacant',
    1200, 8000, 'daily', '930000402'
  ) returning id into v_drone;

  -- ══ 4) บิลย้อนหลัง 5 เดือน (paid ทั้งหมด ให้กราฟ/สรุปมีข้อมูลทุกเดือน) ══
  -- ห้องเช่ามีค่าน้ำไฟ · รถ/อุปกรณ์ค่าเช่าล้วน
  -- (ห้อง 103 แยกทำด้านล่าง เพราะเดือน -1 ต้องเป็นบิลค้าง)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select
    r.id, v_admin,
    to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYY-MM'),
    r.amount,
    case when r.biz_type = 'property' then 4 + ((r.seq + m) % 9) end,
    case when r.biz_type = 'property' then (4 + ((r.seq + m) % 9)) * 18 end,
    case when r.biz_type = 'property' then 45 + ((r.seq * 7 + m * 11) % 80) end,
    case when r.biz_type = 'property' then (45 + ((r.seq * 7 + m * 11) % 80)) * 5 end,
    r.amount
      + coalesce((case when r.biz_type = 'property' then (4 + ((r.seq + m) % 9)) * 18 end), 0)
      + coalesce((case when r.biz_type = 'property' then (45 + ((r.seq * 7 + m * 11) % 80)) * 5 end), 0),
    r.amount
      + coalesce((case when r.biz_type = 'property' then (4 + ((r.seq + m) % 9)) * 18 end), 0)
      + coalesce((case when r.biz_type = 'property' then (45 + ((r.seq * 7 + m * 11) % 80)) * 5 end), 0),
    0, 'paid',
    md5(r.id::text || m::text || 'demoseed')::uuid,
    ((r.seq + m) % 3) <> 2,                                      -- จ่ายสดไม่มีสลิป
    case when ((r.seq + m) % 3) <> 2
         then date_trunc('month', current_date) - (m || ' month')::interval + interval '6 days' end,
    case when (r.seq + m) % 3 = 0 then 'bank_transfer'
         when (r.seq + m) % 3 = 1 then 'promptpay'
         else 'cash' end,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days'
  from (
    select id, amount, biz_type, row_number() over (order by sub_label) as seq
      from public.rentals
     where landlord_id = v_admin
       and lower(coalesce(room_status, '')) = 'occupied'
       and sub_label <> '103'
  ) r
  cross join generate_series(1, 5) as m;

  -- ประวัติของห้อง 103 (เดือน -5..-2 เท่านั้น)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select v_r103, v_admin,
    to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYY-MM'),
    4800, 4 + m, (4 + m) * 18, 60 + m * 7, (60 + m * 7) * 5,
    4800 + (4 + m) * 18 + (60 + m * 7) * 5,
    4800 + (4 + m) * 18 + (60 + m * 7) * 5,
    0, 'paid', md5('103-' || m::text || 'demoseed')::uuid,
    true,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '6 days',
    case when m % 2 = 0 then 'bank_transfer' else 'promptpay' end,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days'
  from generate_series(2, 5) as m;

  -- บิลเดือนก่อนของห้อง 103 → ค้าง 2 เดือน (หน้า "ต้องทวงด่วน" created_at > 15 วัน)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, remaining_balance, status,
    secure_token, created_at
  ) values (
    v_r103, v_admin, to_char(current_date - interval '1 month', 'YYYY-MM'),
    4800, 6, 108, 70, 350, 5258, 5258,
    'unpaid', md5('103-old-unpaid' || 'demoseed')::uuid,
    now() - interval '20 days'
  );

  -- ══ 5) บิลเดือนปัจจุบัน — ครบทุกสถานการณ์ ═══════════════════════
  -- 5.1 ชำระแล้ว (โอน มีสลิปยืนยัน) : 101, 106, 201, 204, กข1234, CAM-001
  --     (106/201 บิลล่าสุดไม่มีมิเตอร์น้ำไฟ → ขึ้นหน้า "ค้างป้อนมิเตอร์")
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select r.id, v_admin, to_char(current_date, 'YYYY-MM'),
    r.amount,
    case when r.biz_type = 'property' and r.sub_label not in ('106', '201') then 5 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106', '201') then 90 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106', '201') then 88 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106', '201') then 440 end,
    r.amount + coalesce(case when r.biz_type = 'property' and r.sub_label not in ('106', '201')
                    then 530 end, 0),
    r.amount + coalesce(case when r.biz_type = 'property' and r.sub_label not in ('106', '201')
                    then 530 end, 0),
    0, 'paid', md5(r.id::text || 'cur-paid' || 'demoseed')::uuid,
    r.biz_type = 'property',                                      -- รถ/อุปกรณ์ จ่ายสด-พร้อมเพย์ไม่มีสลิป
    case when r.biz_type = 'property' then now() - interval '2 days' end,
    case when r.biz_type = 'property' then 'bank_transfer' else 'promptpay' end,
    now() - interval '8 days'
  from public.rentals r
  where landlord_id = v_admin
    and r.sub_label in ('101', '106', '201', '204', 'กข 1234', 'CAM-001');

  -- 5.2 ค้างชำระ : 102 (1 วัน) · 202 (2 วัน)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, remaining_balance, status, secure_token, created_at
  )
  values
    (v_r102, v_admin, to_char(current_date, 'YYYY-MM'), 4500, 6, 108, 92, 460, 5068, 5068,
     'unpaid', md5('102-cur' || 'demoseed')::uuid, now() - interval '1 day'),
    (v_r202, v_admin, to_char(current_date, 'YYYY-MM'), 5500, 7, 126, 101, 505, 6131, 6131,
     'unpaid', md5('202-cur' || 'demoseed')::uuid, now() - interval '2 days');

  -- 5.3 ค้าง 4 วัน + ค่าปรับจากระบบทวง (การ์ดแดง) : 103
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, penalty_days, penalty_amount,
    total_amount, remaining_balance, status, secure_token, created_at
  ) values (
    v_r103, v_admin, to_char(current_date, 'YYYY-MM'), 4800, 5, 90, 85, 425,
    4, 200, 5515, 5515, 'unpaid', md5('103-cur' || 'demoseed')::uuid,
    now() - interval '4 days'
  ) returning id into v_tx103cur;

  -- 5.4 ค้าง 6 วัน + ค่าปรับ + ทวงถึงขั้นเร่ง (การ์ดแดง) : ฮจ 5678
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, penalty_days, penalty_amount,
    total_amount, remaining_balance, status, secure_token, escalated_at, created_at
  ) values (
    v_car2, v_admin, to_char(current_date, 'YYYY-MM'), 13500, 6, 600,
    14100, 14100, 'unpaid', md5('car2-cur' || 'demoseed')::uuid,
    now() - interval '2 days', now() - interval '6 days'
  );

  -- 5.5 รอตรวจสลิป : 104 (ผู้เช่าแนบสลิปแล้ว ยังไม่ตรวจ)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, status, secure_token,
    slip_image_url, created_at
  ) values (
    v_r104, v_admin, to_char(current_date, 'YYYY-MM'), 4500, 4, 72, 66, 330,
    4902, 4902, 'pending_review', md5('104-cur' || 'demoseed')::uuid,
    'slips/demo-104.jpg', now() - interval '5 hours'
  ) returning id into v_tx104cur;

  -- 5.6 บิลค่าน้ำไฟอย่างเดียว (ค้างหลังย้ายออก) : 105 — รอตรวจสลิป
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, status, secure_token,
    is_utility_only, slip_image_url, created_at
  ) values (
    v_r105, v_admin, to_char(current_date, 'YYYY-MM'), 0, 3, 54, 40, 200,
    254, 254, 'pending_review', md5('105-utility' || 'demoseed')::uuid,
    true, 'slips/demo-105-utility.jpg', now() - interval '9 hours'
  );

  -- 5.7 จ่ายสด : 206 (ไม่มีสลิป)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, payment_method, created_at
  ) values (
    v_r206, v_admin, to_char(current_date, 'YYYY-MM'), 5800, 6, 108, 95, 475,
    6383, 6383, 0, 'paid', md5('206-cur' || 'demoseed')::uuid,
    false, 'cash', now() - interval '3 days'
  ) returning id into v_tx206cur;

  -- 5.8 ร่างบิลเดือนหน้า : 101, 104
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, total_amount, status, secure_token, created_at
  )
  select r.id, v_admin, to_char(current_date + interval '1 month', 'YYYY-MM'),
         r.amount, r.amount, 'draft',
         md5(r.id::text || 'next-draft' || 'demoseed')::uuid, now() - interval '1 day'
  from public.rentals r
  where landlord_id = v_admin and r.sub_label in ('101', '104');

  -- ══ 6) หมวดรายจ่าย + รายจ่าย 6 เดือน ══════════════════════════
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
  select id into v_cat_water  from public.expense_categories where landlord_id = v_admin and name like 'ค่าน้ำ (บิลกรม)%' limit 1;
  select id into v_cat_repair from public.expense_categories where landlord_id = v_admin and name = 'ค่าซ่อมแซม' limit 1;
  select id into v_cat_clean  from public.expense_categories where landlord_id = v_admin and name = 'ค่าทำความสะอาด' limit 1;
  select id into v_cat_net    from public.expense_categories where landlord_id = v_admin and name = 'ค่าอินเทอร์เน็ต' limit 1;
  select id into v_cat_salary from public.expense_categories where landlord_id = v_admin and name = 'เงินเดือน/ค่าแรง' limit 1;
  select id into v_cat_tax    from public.expense_categories where landlord_id = v_admin and name like 'ภาษี%' limit 1;

  -- ค่าไฟ/น้ำ/เน็ต/แม่บ้าน ทุกเดือน
  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method)
  select v_admin, v_cat_elec,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
         'ค่าไฟฟ้าส่วนกลาง + มิเตอร์รวม', 8200 + (m * 340) + ((m % 3) * 620),
         'การไฟฟ้าส่วนภูมิภาค', 'PEA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'), 'transfer'
  from generate_series(0, 5) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method)
  select v_admin, v_cat_water,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
         'ค่าน้ำประปาส่วนกลาง + มิเตอร์รวม', 2450 + (m * 95),
         'การประปาส่วนภูมิภาค', 'PWA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'), 'transfer'
  from generate_series(0, 5) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method)
  select v_admin, v_cat_net,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
         'อินเทอร์เน็ตไฟเบอร์ 1Gbps (Wi-Fi ทุกชั้น)', 1590, '3BB', 'credit_card'
  from generate_series(0, 5) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method, notes)
  select v_admin, v_cat_salary,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '27 days')::date,
         'ค่าแรงแม่บ้านทำความสะอาดส่วนกลาง', 9000, 'คุณสมพร (แม่บ้าน)', 'cash', 'จ่ายสิ้นเดือน'
  from generate_series(0, 5) as m;

  -- ซ่อมเฉพาะกิจ (ผูกห้อง/รถจริง) + ปรับปรุงห้อง 203
  insert into public.expenses (landlord_id, category_id, rental_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
  values
    (v_admin, v_cat_repair, v_r103, (current_date - 4),  'ล้างแอร์ + เติมน้ำยา ห้อง 103', 1200, 'ช่างเอ (แอร์)', null, 'cash', 'ผู้เช่าแจ้งแอร์ไม่เย็น'),
    (v_admin, v_cat_repair, v_r101, (current_date - 12), 'เปลี่ยนก๊อกน้ำอ่างล้างหน้า ห้อง 101', 850, 'ช่างบี (ประปา)', null, 'cash', null),
    (v_admin, v_cat_repair, v_car1, (current_date - 9),  'เปลี่ยนยาง + ปรับสมดุลล้อ Toyota Vios', 4800, 'อู่พี่ต้อม', 'INV-7712', 'transfer', 'ตรวจสภาพรถตามรอบ'),
    (v_admin, v_cat_repair, v_r203, (current_date - 15), 'ปรับปรุงห้อง 203 — ปูพื้นใหม่ + ทาสี', 18500, 'ร้านช่างรวมมิตร', 'INV-3021', 'transfer', 'ห้องว่างนาน ปรับปรุงก่อนปล่อยเช่า'),
    (v_admin, v_cat_repair, null,   (current_date - 40), 'ซ่อมปั๊มน้ำอาคาร (มอเตอร์ไหม้)', 6800, 'ร้านไทยพัฒนาการช่าง', 'INV-2291', 'transfer', 'เปลี่ยนมอเตอร์ใหม่ ประกัน 1 ปี');

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
  values
    (v_admin, v_cat_clean, (current_date - 8),  'ล้างถังเก็บน้ำ + ฆ่าเชื้อ (ปีละ 2 ครั้ง)', 3500, 'บ.คลีนโปร', 'CP-882', 'transfer', null),
    (v_admin, v_cat_clean, (current_date - 55), 'กำจัดปลวก/แมลง ทั้งอาคาร', 4800, 'บ.เพสท์การ์ด', 'PG-441', 'transfer', 'รับประกัน 6 เดือน'),
    (v_admin, v_cat_tax,   (current_date - 20), 'ภาษีที่ดินและสิ่งปลูกสร้าง (งวดปี)', 8600, 'เทศบาล', 'TAX-2569', 'transfer', null),
    (v_admin, v_cat_tax,   (current_date - 33), 'ค่าธรรมเนียมเก็บขยะ (รายปี)', 2400, 'เทศบาล', null, 'cash', null);

  -- ══ 7) รายรับอื่น 6 เดือน ═════════════════════════════════════
  insert into public.other_income (landlord_id, income_date, description, amount, source)
  select v_admin,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '25 days')::date,
         'เครื่องซักผ้า/อบผ้าหยอดเหรียญ', 2800 + ((m % 4) * 320), 'เครื่องซักผ้า'
  from generate_series(0, 5) as m;

  insert into public.other_income (landlord_id, income_date, description, amount, source)
  select v_admin,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
         'ค่าที่จอดรถเพิ่ม 3 คัน (คันละ 500)', 1500, 'ที่จอดรถ'
  from generate_series(0, 5) as m;

  insert into public.other_income (landlord_id, rental_id, income_date, description, amount, source, notes)
  values
    (v_admin, v_r102, (current_date - 6),  'ค่าปรับชำระล่าช้า 12 วัน', 600, 'ค่าปรับ', 'คิด 50 บาท/วัน'),
    (v_admin, v_r202, (current_date - 18), 'ค่าปรับชำระล่าช้า 5 วัน', 250, 'ค่าปรับ', null),
    (v_admin, v_r206, (current_date - 45), 'ริบมัดจำ (ย้ายออกก่อนครบสัญญา ผู้เช่าเก่า)', 4500, 'ริบมัดจำ', null),
    (v_admin, null,   (current_date - 30), 'ค่าเช่าพื้นที่ติดตั้งตู้กดน้ำ', 1000, 'ค่าเช่าพื้นที่', 'สัญญารายปี'),
    (v_admin, null,   (current_date - 52), 'ค่าเช่าป้ายโฆษณาหน้าอาคาร', 2500, 'ค่าเช่าพื้นที่', null);

  -- ══ 8) ประกาศ (published / draft / archived) ══════════════════
  insert into public.announcements (landlord_id, title, content, publish_date, status, sent_to_line_at)
  values
    (v_admin, 'แจ้งหยุดน้ำชั่วคราว วันเสาร์นี้ 09:00-15:00',
     'เรียนผู้เช่าทุกท่าน' || chr(10) || chr(10) ||
     'ทางอาคารจะล้างถังเก็บน้ำและฆ่าเชื้อ ในวันเสาร์ที่จะถึงนี้ เวลา 09:00-15:00 น.' || chr(10) ||
     'ช่วงเวลาดังกล่าวจะไม่มีน้ำใช้ ขอให้สำรองน้ำไว้ล่วงหน้า' || chr(10) || chr(10) ||
     'ขออภัยในความไม่สะดวกครับ',
     current_date, 'published', now() - interval '2 days'),
    (v_admin, 'ปรับปรุงระบบ Wi-Fi ส่วนกลาง — เพิ่มเป็น 1Gbps',
     'อัปเกรดอินเทอร์เน็ตเป็นไฟเบอร์ 1Gbps แล้ว' || chr(10) ||
     'ติดตั้ง Access Point ใหม่ทุกชั้น สัญญาณครอบคลุมทั้งอาคาร',
     current_date - 8, 'published', now() - interval '8 days'),
    (v_admin, 'เตือนกำหนดชำระค่าเช่า — ทุกวันที่ 5 ของเดือน',
     'ขอความร่วมมือชำระภายในวันที่ 5 ของทุกเดือน' || chr(10) ||
     'หากเกินกำหนดจะมีค่าปรับวันละ 50 บาท ตามสัญญาเช่าข้อ 7' || chr(10) || chr(10) ||
     'ชำระได้ผ่าน QR พร้อมเพย์ในลิงก์บิลที่ส่งให้ทาง LINE',
     current_date - 15, 'published', now() - interval '15 days'),
    (v_admin, 'ประกาศขึ้นค่าเช่าปี 2570 (ฉบับร่าง — ยังไม่เผยแพร่)',
     'ร่างประกาศ: ปรับค่าเช่าขึ้น 5% มีผล 1 ม.ค. 2570' || chr(10) ||
     'ยังไม่ส่งให้ผู้เช่า — รอหารือกับหุ้นส่วนก่อน',
     current_date + 20, 'draft', null),
    (v_admin, 'กิจกรรมทำความสะอาดใหญ่ประจำปี (จบแล้ว)',
     'ขอบคุณผู้เช่าทุกท่านที่ให้ความร่วมมือในกิจกรรมทำความสะอาดใหญ่ประจำปี',
     current_date - 95, 'archived', now() - interval '95 days');

  -- ══ 9) บันทึกช่วยจำ (ครบ 6 สี + ปักหมุด 2) ════════════════════
  insert into public.notes (landlord_id, title, content, color, pinned, updated_at)
  values
    (v_admin, 'ห้อง 201 สัญญาหมด 18 วัน — ต้องคุยต่อสัญญา',
     'ผู้เช่าแจ้งว่าอยากต่ออีก 1 ปี แต่ขอลดค่าเช่า 200' || chr(10) ||
     'ตัดสินใจ: ยอมลด 100 ถ้าจ่ายล่วงหน้า 3 เดือน',
     '#fee2e2', true, now() - interval '1 hour'),
    (v_admin, 'รหัสตู้ไฟหลัก + เบอร์ช่างฉุกเฉิน',
     'ตู้ไฟชั้น 1: 4729' || chr(10) ||
     'ช่างไฟ (คุณเอ): 081-234-5678' || chr(10) ||
     'ช่างประปา (คุณบี): 089-876-5432' || chr(10) ||
     'ช่างแอร์: 062-111-2233' || chr(10) ||
     'อู่รถเช่า (พี่ต้อม): 085-222-3333',
     '#dbeafe', true, now() - interval '3 hours'),
    (v_admin, 'รถ Honda City ฮจ 5678 ค้าง 6 วันแล้ว',
     'โทรไม่รับ 2 ครั้ง — ถ้าค้างถึงสิ้นเดือนให้ทำหนังสือทวงถึงบ้าน',
     '#dcfce7', false, now() - interval '2 days'),
    (v_admin, 'ไอเดีย: ติดกล้องวงจรปิดเพิ่มโถงชั้น 2',
     'ผู้เช่า 3 ห้องขอมา งบประมาณราว 15,000 (4 ตัว + ติดตั้ง)' || chr(10) || 'รอดูงบสิ้นปีก่อน',
     '#fef3c7', false, now() - interval '5 days'),
    (v_admin, 'ห้อง 205 ว่างนาน 2 เดือน — ลองลดราคา?',
     'ห้องมุม แดดบ่ายแรง คนดูแล้วไม่เอา 4 ราย' || chr(10) ||
     'ลองติดม่านกันแดด + ลดค่าเช่า 300 ดูก่อน',
     '#f3e8ff', false, now() - interval '9 days'),
    (v_admin, 'นัดตรวจถังดับเพลิงประจำปี — เดือนหน้า',
     'บริษัทจะติดต่อมาเอง เตรียมกุญแจห้องเก็บของไว้',
     '#e0e7ff', false, now() - interval '14 days');

  -- ══ 10) เอกสาร (path จำลอง ไม่มีไฟล์จริงใน storage) ══════════
  insert into public.documents (landlord_id, rental_id, title, file_path, file_name, file_size, mime_type, notes)
  values
    (v_admin, null,   'สัญญาเช่ามาตรฐาน (แบบฟอร์มเปล่า)',
     v_admin || '/demo-lease-template.pdf', 'สัญญาเช่ามาตรฐาน.pdf', 248000, 'application/pdf',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, v_r101, 'สำเนาสัญญาเช่า ห้อง 101',
     v_admin || '/demo-lease-101.pdf', 'สัญญาเช่า-101.pdf', 312000, 'application/pdf',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, v_car1, 'สัญญาเช่ารถ Toyota Vios กข 1234',
     v_admin || '/demo-lease-vios.pdf', 'สัญญาเช่ารถ-กข1234.pdf', 289000, 'application/pdf',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, null,   'ใบประกันมอเตอร์ปั๊มน้ำ (ถึง ก.ย. 2570)',
     v_admin || '/demo-pump-warranty.pdf', 'ใบประกันปั๊มน้ำ.pdf', 96000, 'application/pdf',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, null,   'ใบเสร็จภาษีที่ดิน ปี 2569',
     v_admin || '/demo-tax-2569.pdf', 'ภาษีที่ดิน-2569.pdf', 154000, 'application/pdf',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, null,   'แปลนอาคาร (ผังไฟ + ผังประปา)',
     v_admin || '/demo-floorplan.jpg', 'แปลนอาคาร.jpg', 1840000, 'image/jpeg',
     'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage');

  -- ══ 11) แจ้งซ่อม — ครบทุกสถานะ + outcome + รูป ═════════════════
  insert into public.repair_tickets (rental_id, description, status, photo_url, created_at, started_at, done_at, outcome, done_note)
  values
    (v_r103, 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว (มีรูป)',
     'open', 'repair-photos/demo-ac.jpg', now() - interval '5 hours', null, null, null, null),
    (v_r102, 'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ',
     'open', null, now() - interval '1 day', null, null, null, null),
    (v_car1, 'เข็มน้ำมันขึ้นช้า สตาร์ทเช้ามีเสียงแปลก',
     'open', null, now() - interval '2 days', null, null, null, null),
    (v_r201, 'ประตูห้องปิดไม่สนิท ต้องออกแรงดันแรงๆ (นัดช่างพรุ่งนี้ 10:00)',
     'in_progress', null, now() - interval '4 days', now() - interval '1 day', null, null, null),
    (v_r106, 'ก๊อกน้ำในครัวหยดตลอด ปิดสุดแล้วก็ยังหยด',
     'in_progress', null, now() - interval '6 days', now() - interval '3 days', null, null, null),
    (v_r101, 'หลอดไฟหน้าห้องไม่ติด',
     'done', null, now() - interval '12 days', now() - interval '11 days', now() - interval '10 days', 'success', 'เปลี่ยนหลอดใหม่ 1 ดวง เสร็จเรียบร้อย'),
    (v_r104, 'ชักโครกกดไม่ลง น้ำไม่ไหลเข้าถัง',
     'done', null, now() - interval '20 days', now() - interval '20 days', now() - interval '19 days', 'success', 'เปลี่ยนชุดกด + ล้างท่อ'),
    (v_r202, 'มุ้งลวดหน้าต่างขาด แมลงเข้าห้อง (รออะไหล่ ยังไม่สำเร็จ)',
     'done', null, now() - interval '35 days', now() - interval '34 days', now() - interval '31 days', 'failed', 'สั่งมุ้งไซซ์พิเศษ อะไหล่มาไม่ทัน — นัดใหม่อีกครั้ง');

  -- ══ 12) ค่าสมาชิก — อนุมัติแล้ว 2 + รอตรวจ 1 (ตารางนี้ไม่มีคอลัมน์ reviewed_at) ══
  insert into public.membership_payments (admin_id, plan_type, duration_months, amount, status, slip_image_url, created_at, note)
  values
    (v_admin, 'starter', 1, 199, 'approved', 'membership/demo-old.jpg',
     now() - interval '190 days', null)
  returning id into v_mpay2;

  insert into public.membership_payments (admin_id, plan_type, duration_months, amount, status, slip_image_url, created_at, note)
  values
    (v_admin, 'pro', 12, 2400, 'approved', 'membership/demo-pro.jpg',
     now() - interval '160 days', 'ต่ออายุรายปี (เดโม่)')
  returning id into v_mpay;

  insert into public.membership_payments (admin_id, plan_type, duration_months, amount, status, slip_image_url, created_at, note)
  values
    (v_admin, 'pro', 12, 2400, 'pending_review', 'membership/demo-renew.jpg',
     now() - interval '5 hours', 'โอนแล้ว รอแอดมินตรวจสลิป (เดโม่)');

  -- ══ 13) slip_verifications (EasySlip ตรวจแล้ว) ══════════════════
  insert into public.slip_verifications (txn_ref, kind, ref_id, amount, bank, verified_at)
  values
    ('EASYSLIP-DEMOMEM-001', 'membership', v_mpay2, 199, 'scb', now() - interval '189 days'),
    ('EASYSLIP-DEMOMEM-002', 'membership', v_mpay, 2400, 'kbank', now() - interval '159 days');

  insert into public.slip_verifications (txn_ref, kind, ref_id, amount, bank, verified_at)
  select 'EASYSLIP-DEMO-' || upper(substr(t.id::text, 1, 8)), 'tenant', t.id,
         coalesce(t.paid_amount, t.total_amount), 'kbank', t.verified_at
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin
    and t.status = 'paid'
    and t.slip_verified = true
    and t.payment_method in ('bank_transfer', 'promptpay');

  -- ══ 14) activity_logs (login/logout ผสม provider) ═══════════════
  insert into public.activity_logs (admin_id, user_email, action, detail, ip, user_agent, created_at)
  values
    (v_admin, v_demo_email, 'login',  'demo',   '171.101.77.12', 'Mozilla/5.0 (iPhone)',        now() - interval '2 hours'),
    (v_admin, v_demo_email, 'logout', 'demo',   '171.101.77.12', 'Mozilla/5.0 (iPhone)',        now() - interval '9 hours'),
    (v_admin, v_demo_email, 'login',  'google', '125.26.88.4',   'Mozilla/5.0 (Windows NT 10)', now() - interval '2 days'),
    (v_admin, v_demo_email, 'logout', 'google', '125.26.88.4',   'Mozilla/5.0 (Windows NT 10)', now() - interval '2 days'),
    (v_admin, v_demo_email, 'login',  'demo',   '202.44.14.9',   'Mozilla/5.0 (Android 14)',    now() - interval '5 days'),
    (v_admin, v_demo_email, 'login',  'email',  '202.44.14.9',   'Mozilla/5.0 (Macintosh)',     now() - interval '12 days'),
    (v_admin, v_demo_email, 'logout', 'email',  '202.44.14.9',   'Mozilla/5.0 (Macintosh)',     now() - interval '12 days'),
    (v_admin, v_demo_email, 'login',  'demo',   '118.172.90.33', 'Mozilla/5.0 (iPad)',          now() - interval '20 days');

  -- ══ 15) audit_logs + rental_audit_log + reminders ══════════════
  -- จ่ายสดห้อง 206
  insert into public.audit_logs (transaction_id, landlord_id, old_amount, new_amount, reason, created_at)
  values (v_tx206cur, v_admin, 6383, 6383, 'รับเงินสดและปิดบิล (เดโม่)', now() - interval '3 days');

  -- ค่าปรับจากระบบทวง ห้อง 103
  insert into public.audit_logs (transaction_id, landlord_id, old_amount, new_amount, reason, created_at)
  values (v_tx103cur, v_admin, 5315, 5515, 'ค่าปรับชำระล่าช้า 4 วัน × 50 บาท (run_chase เดโม่)', now() - interval '1 day');

  insert into public.rental_audit_log (rental_id, field_name, old_value, new_value, created_at)
  values
    (v_r103, 'bill_day', '1', greatest(1, v_d - 4)::text, now() - interval '6 days'),
    (v_r103, 'penalty_day', '3', greatest(1, v_d - 4)::text, now() - interval '6 days'),
    (v_r101, 'min_water_charge', '80', '100', now() - interval '10 days');

  -- แจ้งเตือนที่ระบบส่งไปแล้ว
  insert into public.reminders (transaction_id, landlord_id, kind, message_text, sent_at)
  values
    (v_tx206cur, v_admin, 'receipt', 'ใบเสร็จค่าเช่าเดือนนี้ ห้อง 206 (จ่ายสด)', now() - interval '3 days'),
    (v_tx103cur, v_admin, 'due_soon', 'ค่าเช่าใกล้ครบกำหนด ห้อง 103 — ชำระภายในวันที่ ' || greatest(1, v_d - 4)::text, now() - interval '5 days'),
    (v_tx104cur, v_admin, 'receipt', 'ได้รับแจ้งชำระแล้ว รอตรวจสลิป ห้อง 104', now() - interval '5 hours');

  -- ══ 16) app_settings : ลิงก์เพิ่มเพื่อนบอท ═════════════════════
  insert into app_settings (key, value)
  values ('bot_add_url', 'https://line.me/R/ti/p/@881gcbgc')
  on conflict (key) do nothing;

  raise notice '── seed เดโม่ครบทุกฟังก์ชันแล้ว ── admin=%', v_admin;
end;
$$;

-- ── ตรวจรับ: ทุกตารางต้องมีข้อมูล และสถานะสำคัญต้องครบ ─────────────
do $$
declare
  v_admin uuid;
  v_missing text := '';
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;

  if (select count(*) from public.rentals where landlord_id = v_admin and biz_type = 'property') = 0 then v_missing := v_missing || 'rentals/property '; end if;
  if (select count(*) from public.rentals where landlord_id = v_admin and biz_type = 'vehicle') = 0 then v_missing := v_missing || 'rentals/vehicle '; end if;
  if (select count(*) from public.rentals where landlord_id = v_admin and biz_type = 'other') = 0 then v_missing := v_missing || 'rentals/other '; end if;
  if (select count(*) from public.rentals where landlord_id = v_admin and room_status = 'vacant') = 0 then v_missing := v_missing || 'rentals/vacant '; end if;
  if (select count(*) from public.rentals where landlord_id = v_admin and room_status = 'maintenance') = 0 then v_missing := v_missing || 'rentals/maintenance '; end if;

  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and t.status = 'paid') = 0 then v_missing := v_missing || 'tx/paid '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and t.status = 'unpaid') = 0 then v_missing := v_missing || 'tx/unpaid '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and t.status = 'pending_review') = 0 then v_missing := v_missing || 'tx/pending_review '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and t.status = 'draft') = 0 then v_missing := v_missing || 'tx/draft '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and t.is_utility_only) = 0 then v_missing := v_missing || 'tx/utility_only '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id
      where r.landlord_id = v_admin and coalesce(t.penalty_amount, 0) > 0) = 0 then v_missing := v_missing || 'tx/penalty '; end if;

  if (select count(*) from public.expenses where landlord_id = v_admin) = 0 then v_missing := v_missing || 'expenses '; end if;
  if (select count(*) from public.other_income where landlord_id = v_admin) = 0 then v_missing := v_missing || 'other_income '; end if;
  if (select count(*) from public.announcements where landlord_id = v_admin and status = 'published') = 0 then v_missing := v_missing || 'announcements '; end if;
  if (select count(*) from public.notes where landlord_id = v_admin) = 0 then v_missing := v_missing || 'notes '; end if;
  if (select count(*) from public.documents where landlord_id = v_admin) = 0 then v_missing := v_missing || 'documents '; end if;
  if (select count(*) from public.repair_tickets rt join public.rentals r on r.id = rt.rental_id
      where r.landlord_id = v_admin and rt.status in ('open', 'in_progress', 'done')) < 3 then v_missing := v_missing || 'repairs '; end if;
  if (select count(*) from public.membership_payments where admin_id = v_admin) = 0 then v_missing := v_missing || 'membership_payments '; end if;
  if (select count(*) from public.slip_verifications sv
      where sv.kind = 'membership' and sv.ref_id in (select id from public.membership_payments where admin_id = v_admin)) = 0
     and (select count(*) from public.slip_verifications sv2
      where sv2.kind = 'tenant' and sv2.ref_id in (
        select t.id from public.transactions t join public.rentals r on r.id = t.rental_id
        where r.landlord_id = v_admin)) = 0
  then v_missing := v_missing || 'slip_verifications '; end if;
  if (select count(*) from public.activity_logs where admin_id = v_admin) = 0 then v_missing := v_missing || 'activity_logs '; end if;

  if v_missing <> '' then
    raise exception 'ข้อมูลเดโม่ไม่ครบ — ขาด: %', v_missing;
  end if;
  raise notice '✓ เดโม่ครบทุกฟังก์ชัน';
end;
$$;
