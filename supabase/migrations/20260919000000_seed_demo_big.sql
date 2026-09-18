-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : รีเซ็ต + seed เดโม่ "ชุดใหญ่" (demo@payrentpro.app)
--
-- ใช้แทนชุด 20260918000001 — ล้างข้อมูลเดโม่แล้วสร้างใหม่ ให้มีของให้กด
-- โชว์/เทสต์หลายรอบ:
--   · 28 รายการ: ห้องเช่า 20 (มีเช่า 15 / ว่าง 3 / ปรับปรุง 2) ·
--               รถเช่า 4 (มีเช่า 2 / ว่าง 1 / ซ่อม 1) ·
--               อุปกรณ์ 4 (มีเช่า 2 / ว่าง 2)
--   · บิล ~255 ใบ: ประวัติ 12 เดือน (paid ทุกเดือนมีข้อมูลให้กราฟ) +
--     เดือนปัจจุบันครบทุกสถานะ (paid 9 / unpaid 7 / รอตรวจสลิป 3 /
--     ค่าน้ำไฟล้วนรอตรวจ 2 / จ่ายสด 1) + ร่างบิลเดือนหน้า 4 +
--     ค้างเดือนก่อน 1 (หน้า "ต้องทวงด่วน")
--   · ค้างจริงตามวัน: 1/2/3/4/5/6 วัน + การ์ดแดง (เกิน 3 วัน) 3 รายการ
--   · รายจ่าย/รายรับอื่น 12 เดือน · ประกาศ 6 · บันทึก 8 · เอกสาร 6 ·
--     แจ้งซ่อม 12 (ครบทุกสถานะ+outcome) · ค่าสมาชิก 3 · slip/activity etc.
--
-- LINE:
--   · ไม่ตั้ง group_id ปลอม — ทุกห้อง "ยังไม่ผูกกลุ่ม" เพื่อโชว์ขั้นตอน
--     ผูกกลุ่มจริงตอนพรีเซนต์ (พิมพ์ binding code ในกลุ่ม LINE)
--   · app_settings.line_token ตั้ง placeholder — ต้องแทนด้วย token จริง
--     ของบอท LINE (LINE Developers → Messaging API → Channel access
--     token) ถึงจะส่งบิล/ใบเสร็จเข้าไลน์ได้จริง (ไม่ใช่รหัสลับของเว็บ)
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_demo_email text := 'demo@payrentpro.app';
  v_admin uuid;
  v_d int := extract(day from current_date)::int;
  v_cat_elec uuid; v_cat_water uuid; v_cat_repair uuid; v_cat_clean uuid;
  v_cat_net uuid; v_cat_salary uuid; v_cat_tax uuid;
begin
  select id into v_admin from public.admins where email = v_demo_email limit 1;
  if v_admin is null then
    raise exception 'ไม่พบบัญชีเดโม่ demo@payrentpro.app — รัน 20260909150000_demo_account.sql ก่อน';
  end if;

  -- ══ 0) รีเซ็ต (เรียงตาม FK) ═══════════════════════════════════
  delete from public.reminders         where landlord_id = v_admin;
  delete from public.audit_logs        where landlord_id = v_admin;
  delete from public.rental_audit_log  where rental_id in (select id from public.rentals where landlord_id = v_admin);
  delete from public.slip_verifications
    where (kind = 'tenant' and ref_id in (
            select t.id from public.transactions t
            join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin))
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

  -- ══ 1) สินทรัพย์ 28 รายการ ═══════════════════════════════════
  -- ห้องเช่า (property) 20 — bill_day/penalty_day คำนวณให้ "ค้าง" ตามแผน
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, emergency_contact, room_status, amount, deposit_amount, cycle,
    due_date, bill_day, penalty_day, penalty_per_day, penalty_enabled,
    chase_frequency, stop_chase, credit_balance, move_in_date, lease_end_date,
    last_water_meter, water_rate, last_elec_meter, elec_rate, utility_enabled, binding_code
  )
  select
    v_admin, 'property', s.sub, 'ห้อง ' || s.sub, s.cust, s.phone,
    s.sub || '00000000' || s.seq, s.em, s.status, s.amount, s.amount, 'monthly',
    5, s.bill_day, s.pen_day, 50, true, 3, 0, 0,
    current_date + s.move_lag, current_date + s.lease_lag,
    420 + s.seq * 7, 18, 980 + s.seq * 23, 5, true,
    '9100' || lpad(s.seq::text, 5, '0')
  from (values
    (1,  '101', 'สมหญิง รักเรียน',   '0810000101', '0891111101', 'occupied',     4200,  5,  5, -400, 240),
    (2,  '102', 'วีระ ขยันงาน',      '0810000102', null,          'occupied',     4500,  greatest(1, v_d - 1),  greatest(1, v_d - 1), -380, 300),
    (3,  '103', 'ดวงใจ แสนสุข',      '0810000103', null,          'occupied',     4800,  greatest(1, v_d - 4),  greatest(1, v_d - 4), -500,  60),
    (4,  '104', 'อนันต์ พากเพียร',   '0810000104', null,          'occupied',     4500,  5, 10, -200, 160),
    (5,  '105', 'ว่าง',               null,          null,          'vacant',      4500,  5, 10,    0,   0),
    (6,  '106', 'มาลี ตั้งใจดี',      '0810000106', null,          'occupied',     5200,  5, 10, -350,  90),
    (7,  '107', 'นภา ทะเยอทะยาน',    '0810000107', null,          'occupied',     5000,  greatest(1, v_d - 2),  greatest(1, v_d - 2), -310, 180),
    (8,  '108', 'ปรีชา รอบรู้',       '0810000108', null,          'occupied',     5300,  5, 10, -420, 210),
    (9,  '109', 'ว่าง',               null,          null,          'vacant',      5500,  5, 10,    0,   0),
    (10, '110', 'อารยา สดใส',        '0810000110', null,          'occupied',     4800,  5, 10, -260, 140),
    (11, '201', 'ธนกร มุ่งมั่น',      '0810000201', null,          'occupied',     5200,  5, 10, -640,  18),
    (12, '202', 'ศิริพร ใจเย็น',      '0810000202', null,          'occupied',     5500,  greatest(1, v_d - 5),  greatest(1, v_d - 5), -730,  -5),
    (13, '203', 'ปรับปรุงห้อง',       null,          null,          'maintenance', 5500,  5, 10,    0,   0),
    (14, '204', 'กิตติ รุ่งโรจน์',    '0810000204', null,          'occupied',     5800,  5, 10, -120, 580),
    (15, '205', 'ว่าง',               null,          null,          'vacant',      5500,  5, 10,    0,   0),
    (16, '206', 'สมศักดิ์ มั่นคง',    '0810000206', '0891112206',  'occupied',     5800,  5, 10, -300, 400),
    (17, '207', 'จีรนันท์ เก่งงาน',   '0810000207', null,          'occupied',     6000,  5, 10, -450, 260),
    (18, '208', 'พิชัย หนักเอาเบาสู้', '0810000208', null,          'occupied',     6200,  greatest(1, v_d - 3),  greatest(1, v_d - 3), -520, 150),
    (19, '209', 'สุดารัตน์ สุขใจ',    '0810000209', null,          'occupied',     6500,  5, 10, -560, 320),
    (20, '210', 'วิสุทธิ์ ตั้งมั่น',   '0810000210', null,          'occupied',     6800,  5, 10, -610, 430)
  ) as s(seq, sub, cust, phone, em, status, amount, bill_day, pen_day, move_lag, lease_lag);

  -- รถเช่า (vehicle) 4
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, bill_day, penalty_day,
    penalty_per_day, penalty_enabled, binding_code, move_in_date, lease_end_date
  )
  select v_admin, 'vehicle', s.sub, s.detail, s.cust, s.phone, s.seq || '3000000000',
    s.status, s.amount, s.dep, 'monthly', s.bill_day, s.pen_day, 100, true,
    '9200' || lpad(s.seq::text, 5, '0'), current_date + s.move_lag, current_date + s.lease_lag
  from (values
    (1, 'กข 1234', 'Toyota Vios สีขาว (2566)', 'สมปอง ขับดี', '0810000301', 'occupied',  15000, 20000,  5, 10, -90, 270),
    (2, 'ฮจ 5678', 'Honda City สีเทา (2567)',  'สมศรี วิ่งเร็ว', '0810000302', 'occupied', 13500, 18000, greatest(1, v_d - 6), greatest(1, v_d - 6), -150, 210),
    (3, 'ญย 3142', 'Isuzu D-Max กระบะ (2565)', 'ว่าง', null, 'vacant', 18000, 25000, 5, 10, 0, 0),
    (4, 'ฒม 8821', 'Mazda 2 สีแดง (2566) — อยู่ร้านซ่อม', 'ว่าง', null, 'maintenance', 12000, 15000, 5, 10, 0, 0)
  ) as s(seq, sub, detail, cust, phone, status, amount, dep, bill_day, pen_day, move_lag, lease_lag);

  -- อุปกรณ์ (other) 4
  insert into public.rentals (
    landlord_id, biz_type, sub_label, item_details, cust_name, tenant_phone,
    tenant_id_card, room_status, amount, deposit_amount, cycle, binding_code,
    move_in_date, lease_end_date
  )
  select v_admin, 'other', s.sub, s.detail, s.cust, s.phone, s.seq || '4000000000',
    s.status, s.amount, s.dep, s.cycle, '9300' || lpad(s.seq::text, 5, '0'), current_date + s.move_lag, current_date + s.lease_lag
  from (values
    (1, 'CAM-001', 'กล้อง Canon EOS R6 + เลนส์ 24-70', 'สมบูรณ์ ถ่ายสวย', '0810000401', 'occupied', 800, 5000, 'daily', -10, 20),
    (2, 'DRONE-01', 'โดรน DJI Mavic 3 (แบต 3 ก้อน)', 'ว่าง', null, 'vacant', 1200, 8000, 'daily', 0, 0),
    (3, 'LENS-702', 'เลนส์ Sony GM 70-200 f/2.8', 'พงษ์ ช่างภาพ', '0810000403', 'occupied', 600, 4000, 'daily', -25, 45),
    (4, 'LIGHT-08', 'ชุดไฟถ่าย Studio ×2 + Softbox', 'ว่าง', null, 'vacant', 500, 3000, 'daily', 0, 0)
  ) as s(seq, sub, detail, cust, phone, status, amount, dep, cycle, move_lag, lease_lag);

  -- ══ 2) ประวัติบิล 12 เดือน — paid ทั้งหมด (ทุกห้อง/รถ/อุปกรณ์ที่มีผู้เช่า) ══
  -- ห้องเช่ามีค่าน้ำไฟ · รถ/อุปกรณ์ค่าเช่าล้วน · (กำหนดเลขมิเตอร์ตามรอบ)
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select
    r.id, v_admin,
    to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYY-MM'),
    r.amount,
    case when r.biz_type = 'property' then 3 + ((r.seq + m) % 10) end,
    case when r.biz_type = 'property' then (3 + ((r.seq + m) % 10)) * 18 end,
    case when r.biz_type = 'property' then 40 + ((r.seq * 7 + m * 11) % 85) end,
    case when r.biz_type = 'property' then (40 + ((r.seq * 7 + m * 11) % 85)) * 5 end,
    r.amount
      + coalesce(case when r.biz_type = 'property' then (3 + ((r.seq + m) % 10)) * 18 end, 0)
      + coalesce(case when r.biz_type = 'property' then (40 + ((r.seq * 7 + m * 11) % 85)) * 5 end, 0),
    r.amount
      + coalesce(case when r.biz_type = 'property' then (3 + ((r.seq + m) % 10)) * 18 end, 0)
      + coalesce(case when r.biz_type = 'property' then (40 + ((r.seq * 7 + m * 11) % 85)) * 5 end, 0),
    0, 'paid',
    md5(r.id::text || m::text || 'demobig')::uuid,
    ((r.seq + m) % 4) <> 2,
    case when ((r.seq + m) % 4) <> 2
         then date_trunc('month', current_date) - (m || ' month')::interval + interval '6 days' end,
    case (r.seq + m) % 4 when 0 then 'bank_transfer' when 1 then 'promptpay' else 'cash' end,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days'
  from (
    select r.id, r.amount, r.biz_type,
           row_number() over (order by r.sub_label) as seq
      from public.rentals r
     where r.landlord_id = v_admin
       and lower(coalesce(r.room_status, '')) = 'occupied'
       and r.sub_label <> '103'   -- 103 มีประวัติแยกด้านล่าง (เดือน -1 ต้องเป็นบิลค้าง)
  ) r
  cross join generate_series(1, 12) as m;

  -- ประวัติ 103 (เดือน -12..-2 ได้) — กันชนกับบิลค้างเดือน -1 ด้านล่าง
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select r.id, v_admin,
    to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYY-MM'),
    r.amount, 3 + m, (3 + m) * 18, 50 + m * 7, (50 + m * 7) * 5,
    r.amount + (3 + m) * 18 + (50 + m * 7) * 5,
    r.amount + (3 + m) * 18 + (50 + m * 7) * 5, 0, 'paid',
    md5('103-' || m::text || 'demobig')::uuid, true,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '6 days',
    case when m % 2 = 0 then 'bank_transfer' else 'promptpay' end,
    date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days'
  from public.rentals r
  cross join generate_series(2, 12) as m
  where r.landlord_id = v_admin and r.sub_label = '103';

  -- ค้างเดือนก่อนของห้อง 103 → เดือน -2 (ค้าง 2 เดือน หน้า "ต้องทวงด่วน")
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, remaining_balance, status,
    secure_token, created_at
  )
  select r.id, v_admin, to_char(current_date - interval '1 month', 'YYYY-MM'),
    r.amount, 6, 108, 70, 350,
    r.amount + 108 + 350, r.amount + 108 + 350, 'unpaid',
    md5(r.id::text || 'old-unpaid' || 'demobig')::uuid, now() - interval '20 days'
  from public.rentals r
  where landlord_id = v_admin and r.sub_label = '103';

  -- ══ 3) บิลเดือนปัจจุบัน — paid (9) + เงินสด (1) ═════════════════
  -- 106/201/207/209/210 บิลปัจจุบันจ่ายแล้วแต่ไม่มีมิเตอร์น้ำไฟ → ขึ้น "ค้างป้อนมิเตอร์"
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, remaining_balance,
    status, secure_token, slip_verified, verified_at, payment_method, created_at
  )
  select r.id, v_admin, to_char(current_date, 'YYYY-MM'),
    r.amount,
    case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210') then 5 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210') then 90 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210') then 86 end,
    case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210') then 430 end,
    r.amount + coalesce(case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210')
                    then 520 end, 0),
    r.amount + coalesce(case when r.biz_type = 'property' and r.sub_label not in ('106','201','207','209','210')
                    then 520 end, 0),
    0, 'paid', md5(r.id::text || 'cur-paid' || 'demobig')::uuid,
    r.biz_type = 'property',
    case when r.biz_type = 'property' then now() - interval '2 days' end,
    case when r.sub_label = '206' then 'cash'
         when r.biz_type = 'property' then 'bank_transfer'
         else 'promptpay' end,
    now() - interval '8 days'
  from public.rentals r
  where landlord_id = v_admin
    and r.sub_label in ('101','106','201','204','207','209','210','กข 1234','CAM-001');

  -- ══ 4) บิลเดือนปัจจุบัน — ค้างชำระ 7 รายการ (ตามวันค้างจริง) ═════
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, penalty_days, penalty_amount,
    total_amount, remaining_balance, status, secure_token, escalated_at, created_at
  )
  select r.id, v_admin, to_char(current_date, 'YYYY-MM'), r.amount,
    case when r.biz_type = 'property' then 5 end,
    case when r.biz_type = 'property' then 90 end,
    case when r.biz_type = 'property' then 70 end,
    case when r.biz_type = 'property' then 350 end,
    s.days, s.days * 50,
    r.amount + coalesce(case when r.biz_type = 'property' then 440 end, 0) + s.days * 50,
    r.amount + coalesce(case when r.biz_type = 'property' then 440 end, 0) + s.days * 50,
    'unpaid', md5(r.id::text || 'cur-unpaid' || 'demobig')::uuid,
    case when s.days >= 4 then now() - interval '1 day' end,
    now() - (s.days || ' days')::interval
  from public.rentals r
  join (values
    ('102', 1), ('107', 2), ('208', 3), ('103', 4), ('202', 5),
    ('ฮจ 5678', 6), ('LENS-702', 2)
  ) as s(sub, days) on s.sub = r.sub_label
  where r.landlord_id = v_admin;

  -- ══ 5) บิลเดือนปัจจุบัน — รอตรวจสลิป 3 + ค่าน้ำไฟล้วนรอตรวจ 2 ══
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, status, secure_token,
    slip_image_url, created_at
  )
  select r.id, v_admin, to_char(current_date, 'YYYY-MM'), r.amount,
    case when r.biz_type = 'property' then 4 end,
    case when r.biz_type = 'property' then 72 end,
    case when r.biz_type = 'property' then 66 end,
    case when r.biz_type = 'property' then 330 end,
    r.amount + coalesce(case when r.biz_type = 'property' then 402 end, 0),
    r.amount + coalesce(case when r.biz_type = 'property' then 402 end, 0),
    'pending_review', md5(r.id::text || 'cur-pending' || 'demobig')::uuid,
    'slips/demo-' || r.sub_label || '.jpg', now() - interval '5 hours'
  from public.rentals r
  where landlord_id = v_admin and r.sub_label in ('104', '108', '110');

  -- ค่าน้ำไฟล้วน (is_utility_only) — ห้องว่างที่เพิ่งย้ายออกยังติดค่าน้ำไฟ
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, water_units, water_cost,
    elec_units, elec_cost, total_amount, paid_amount, status, secure_token,
    is_utility_only, slip_image_url, created_at
  )
  select r.id, v_admin, to_char(current_date, 'YYYY-MM'), 0,
    3, 54, 40, 200, 254, 254, 'pending_review',
    md5(r.id::text || 'utility' || 'demobig')::uuid,
    true, 'slips/demo-' || r.sub_label || '-utility.jpg', now() - interval '9 hours'
  from public.rentals r
  where landlord_id = v_admin and r.sub_label in ('105', '109');

  -- ══ 6) ร่างบิลเดือนหน้า 4 ใบ ═══════════════════════════════════
  insert into public.transactions (
    rental_id, landlord_id, period, base_amount, total_amount, status, secure_token, created_at
  )
  select r.id, v_admin, to_char(current_date + interval '1 month', 'YYYY-MM'),
         r.amount, r.amount, 'draft',
         md5(r.id::text || 'next-draft' || 'demobig')::uuid, now() - interval '1 day'
  from public.rentals r
  where landlord_id = v_admin and r.sub_label in ('101', '104', '108', '201');

  -- ══ 7) หมวดรายจ่าย ═══════════════════════════════════════════
  insert into public.expense_categories (landlord_id, name, color, sort_order)
  values
    (v_admin, 'ค่าไฟ (บิลกรม)',    '#f59e0b', 1),
    (v_admin, 'ค่าน้ำ (บิลกรม)',   '#0ea5e9', 2),
    (v_admin, 'ค่าซ่อมแซม',         '#ef4444', 3),
    (v_admin, 'ค่าทำความสะอาด',     '#22c55e', 4),
    (v_admin, 'ค่าอินเทอร์เน็ต',    '#8b5cf6', 5),
    (v_admin, 'เงินเดือน/ค่าแรง',   '#ec4899', 6),
    (v_admin, 'ภาษี/ค่าธรรมเนียม',  '#64748b', 7),
    (v_admin, 'ค่าน้ำมันรถเช่า',     '#f97316', 8),
    (v_admin, 'อื่น ๆ',              '#94a3b8', 99)
  on conflict (landlord_id, lower(trim(name))) do nothing;

  select id into v_cat_elec   from public.expense_categories where landlord_id = v_admin and name like 'ค่าไฟ%' limit 1;
  select id into v_cat_water  from public.expense_categories where landlord_id = v_admin and name like 'ค่าน้ำ (บิลกรม)%' limit 1;
  select id into v_cat_repair from public.expense_categories where landlord_id = v_admin and name = 'ค่าซ่อมแซม' limit 1;
  select id into v_cat_clean  from public.expense_categories where landlord_id = v_admin and name = 'ค่าทำความสะอาด' limit 1;
  select id into v_cat_net    from public.expense_categories where landlord_id = v_admin and name = 'ค่าอินเทอร์เน็ต' limit 1;
  select id into v_cat_salary from public.expense_categories where landlord_id = v_admin and name = 'เงินเดือน/ค่าแรง' limit 1;
  select id into v_cat_tax    from public.expense_categories where landlord_id = v_admin and name like 'ภาษี%' limit 1;

  -- รายจ่าย 12 เดือน (ไฟ/น้ำ/เน็ต/แม่บ้าน ทุกเดือน)
  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method)
  select v_admin, v_cat_elec,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
         'ค่าไฟฟ้าส่วนกลาง + มิเตอร์รวม', 8200 + (m * 340) + ((m % 3) * 620),
         'การไฟฟ้าส่วนภูมิภาค', 'PEA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'), 'transfer'
  from generate_series(0, 11) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method)
  select v_admin, v_cat_water,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '18 days')::date,
         'ค่าน้ำประปาส่วนกลาง + มิเตอร์รวม', 2450 + (m * 95),
         'การประปาส่วนภูมิภาค', 'PWA-' || to_char(date_trunc('month', current_date) - (m || ' month')::interval, 'YYYYMM'), 'transfer'
  from generate_series(0, 11) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method)
  select v_admin, v_cat_net,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
         'อินเทอร์เน็ตไฟเบอร์ 1Gbps (Wi-Fi ทุกชั้น)', 1590, '3BB', 'credit_card'
  from generate_series(0, 11) as m;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, payment_method, notes)
  select v_admin, v_cat_salary,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '27 days')::date,
         'ค่าแรงแม่บ้านทำความสะอาดส่วนกลาง', 9000, 'คุณสมพร (แม่บ้าน)', 'cash', 'จ่ายสิ้นเดือน'
  from generate_series(0, 11) as m;

  -- ซ่อมเฉพาะกิจผูกห้อง/รถจริง + ปรับปรุง + ภาษี/ทำความสะอาด
  insert into public.expenses (landlord_id, category_id, rental_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
  select v_admin, v_cat_repair, r.id, s.d, s.descr, s.amt, s.vendor, s.ref, s.pm, s.note
  from (values
    ('103', (current_date - 4),  'ล้างแอร์ + เติมน้ำยา ห้อง 103', 1200, 'ช่างเอ (แอร์)', null, 'cash', 'ผู้เช่าแจ้งแอร์ไม่เย็น'),
    ('101', (current_date - 12), 'เปลี่ยนก๊อกน้ำอ่างล้างหน้า ห้อง 101', 850, 'ช่างบี (ประปา)', null, 'cash', null),
    ('กข 1234', (current_date - 9), 'เปลี่ยนยาง + ปรับสมดุลล้อ Toyota Vios', 4800, 'อู่พี่ต้อม', 'INV-7712', 'transfer', 'ตรวจสภาพรถตามรอบ'),
    ('203', (current_date - 15), 'ปรับปรุงห้อง 203 — ปูพื้นใหม่ + ทาสี', 18500, 'ร้านช่างรวมมิตร', 'INV-3021', 'transfer', 'ห้องว่างนาน ปรับปรุงก่อนปล่อยเช่า'),
    ('ฒม 8821', (current_date - 7), 'ซ่อมช่วงล่าง Mazda 2 เปลี่ยนโช้ค', 9000, 'อู่พี่ต้อม', 'INV-8821', 'transfer', 'รถอยู่ร้านซ่อม ยังไม่ปล่อยเช่า'),
    ('208', (current_date - 21), 'เปลี่ยนพัดลมระบายอากาศห้องน้ำ ห้อง 208', 650, 'ช่างเอ (แอร์)', null, 'cash', null)
  ) as s(sub, d, descr, amt, vendor, ref, pm, note)
  join public.rentals r on r.landlord_id = v_admin and r.sub_label = s.sub;

  insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
  values
    (v_admin, v_cat_repair, (current_date - 40), 'ซ่อมปั๊มน้ำอาคาร (มอเตอร์ไหม้)', 6800, 'ร้านไทยพัฒนาการช่าง', 'INV-2291', 'transfer', 'เปลี่ยนมอเตอร์ใหม่ ประกัน 1 ปี'),
    (v_admin, v_cat_clean,  (current_date - 8),  'ล้างถังเก็บน้ำ + ฆ่าเชื้อ (ปีละ 2 ครั้ง)', 3500, 'บ.คลีนโปร', 'CP-882', 'transfer', null),
    (v_admin, v_cat_clean,  (current_date - 55), 'กำจัดปลวก/แมลง ทั้งอาคาร', 4800, 'บ.เพสท์การ์ด', 'PG-441', 'transfer', 'รับประกัน 6 เดือน'),
    (v_admin, v_cat_tax,    (current_date - 20), 'ภาษีที่ดินและสิ่งปลูกสร้าง (งวดปี)', 8600, 'เทศบาล', 'TAX-2569', 'transfer', null),
    (v_admin, v_cat_tax,    (current_date - 33), 'ค่าธรรมเนียมเก็บขยะ (รายปี)', 2400, 'เทศบาล', null, 'cash', null),
    (v_admin, v_cat_net,    (current_date - 2),  'เปลี่ยน Access Point ชั้น 3 (เน็ตหลุดบ่อย)', 3200, 'ร้านไอทีมิตรภาพ', 'IT-5521', 'transfer', 'ผู้เช่าชั้น 3 ร้องเรียนสัญญาณอ่อน');

  -- ══ 8) รายรับอื่น 12 เดือน ════════════════════════════════════
  insert into public.other_income (landlord_id, income_date, description, amount, source)
  select v_admin,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '25 days')::date,
         'เครื่องซักผ้า/อบผ้าหยอดเหรียญ', 2800 + ((m % 4) * 320), 'เครื่องซักผ้า'
  from generate_series(0, 11) as m;

  insert into public.other_income (landlord_id, income_date, description, amount, source)
  select v_admin,
         (date_trunc('month', current_date) - (m || ' month')::interval + interval '5 days')::date,
         'ค่าที่จอดรถเพิ่ม 5 คัน (คันละ 500)', 2500, 'ที่จอดรถ'
  from generate_series(0, 11) as m;

  insert into public.other_income (landlord_id, rental_id, income_date, description, amount, source, notes)
  select v_admin, r.id, s.d, s.descr, s.amt, s.src, s.note
  from (values
    ('102', (current_date - 6),  'ค่าปรับชำระล่าช้า 12 วัน', 600, 'ค่าปรับ', 'คิด 50 บาท/วัน'),
    ('202', (current_date - 18), 'ค่าปรับชำระล่าช้า 5 วัน',  250, 'ค่าปรับ', null),
    ('206', (current_date - 45), 'ริบมัดจำ (ย้ายออกก่อนครบสัญญา ผู้เช่าเก่า)', 4500, 'ริบมัดจำ', null)
  ) as s(sub, d, descr, amt, src, note)
  join public.rentals r on r.landlord_id = v_admin and r.sub_label = s.sub;

  insert into public.other_income (landlord_id, income_date, description, amount, source, notes)
  values
    (v_admin, (current_date - 30), 'ค่าเช่าพื้นที่ติดตั้งตู้กดน้ำ', 1000, 'ค่าเช่าพื้นที่', 'สัญญารายปี'),
    (v_admin, (current_date - 52), 'ค่าเช่าป้ายโฆษณาหน้าอาคาร', 2500, 'ค่าเช่าพื้นที่', null),
    (v_admin, (current_date - 75), 'ค่าจอดรถชั่วคราวรายวัน (ผู้มาติดต่อ)', 850, 'ที่จอดรถ', 'เก็บรายวัน 20 บาท');

  -- ══ 9) ประกาศ ════════════════════════════════════════════════
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
    (v_admin, 'รถยนต์เช่าห้ามจอดค้างคืนในซอยหลังอาคาร',
     'ห้องเช่าที่นำรถยนต์มาจอด ต้องจอดในลานจอดของอาคารเท่านั้น' || chr(10) ||
     'ซอยหลังอาคารเป็นทางสาธารณะ ผู้เช่าที่ฝ่าฝืนอาจถูกอายัดรถ',
     current_date - 30, 'published', now() - interval '30 days'),
    (v_admin, 'ประกาศขึ้นค่าเช่าปี 2570 (ฉบับร่าง — ยังไม่เผยแพร่)',
     'ร่างประกาศ: ปรับค่าเช่าขึ้น 5% มีผล 1 ม.ค. 2570' || chr(10) ||
     'ยังไม่ส่งให้ผู้เช่า — รอหารือกับหุ้นส่วนก่อน',
     current_date + 20, 'draft', null),
    (v_admin, 'กิจกรรมทำความสะอาดใหญ่ประจำปี (จบแล้ว)',
     'ขอบคุณผู้เช่าทุกท่านที่ให้ความร่วมมือในกิจกรรมทำความสะอาดใหญ่ประจำปี',
     current_date - 95, 'archived', now() - interval '95 days');

  -- ══ 10) บันทึก — 8 รายการ ครบสี + ปักหมุด ════════════════════
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
     '#e0e7ff', false, now() - interval '14 days'),
    (v_admin, 'ห้อง 208 ค้าง 3 วัน — ผู้เช่าเพิ่งโอนเงินแล้วรอตรวจ',
     'โทรหาเมื่อวาน บอกโอนแล้ว รอสลิปเข้าอีเมลนิติบุคคล' || chr(10) ||
     'ถ้า 2 วันไม่เห็นสลิป ให้โทรถามใหม่',
     '#fef9c3', false, now() - interval '6 hours'),
    (v_admin, 'สัญญาอุปกรณ์ถ่ายวิดีโอ — ส่วนลดเหมาจ่ายรายเดือน',
     'ลูกค้าสาย Content Creator ถ่ายต่อเนื่อง ให้ส่วนลด 10%' || chr(10) ||
     'คนไหนจ่ายล่วงหน้า 3 เดือน ลด 15%',
     '#fce7f3', false, now() - interval '3 days');

  -- ══ 11) เอกสาร (path จำลอง) ══════════════════════════════════
  insert into public.documents (landlord_id, rental_id, title, file_path, file_name, file_size, mime_type, notes)
  values
    (v_admin, null,   'สัญญาเช่ามาตรฐาน (แบบฟอร์มเปล่า)',
     v_admin || '/demo-lease-template.pdf', 'สัญญาเช่ามาตรฐาน.pdf', 248000, 'application/pdf', 'ตัวอย่าง — ยังไม่มีไฟล์จริงใน storage'),
    (v_admin, (select id from public.rentals where landlord_id = v_admin and sub_label = '101' limit 1),
     'สำเนาสัญญาเช่า ห้อง 101', v_admin || '/demo-lease-101.pdf', 'สัญญาเช่า-101.pdf', 312000, 'application/pdf', 'ตัวอย่าง'),
    (v_admin, (select id from public.rentals where landlord_id = v_admin and sub_label = 'กข 1234' limit 1),
     'สัญญาเช่ารถ Toyota Vios กข 1234', v_admin || '/demo-lease-vios.pdf', 'สัญญาเช่ารถ-กข1234.pdf', 289000, 'application/pdf', 'ตัวอย่าง'),
    (v_admin, null,   'ใบประกันมอเตอร์ปั๊มน้ำ (ถึง ก.ย. 2570)',
     v_admin || '/demo-pump-warranty.pdf', 'ใบประกันปั๊มน้ำ.pdf', 96000, 'application/pdf', 'ตัวอย่าง'),
    (v_admin, null,   'ใบเสร็จภาษีที่ดิน ปี 2569',
     v_admin || '/demo-tax-2569.pdf', 'ภาษีที่ดิน-2569.pdf', 154000, 'application/pdf', 'ตัวอย่าง'),
    (v_admin, null,   'แปลนอาคาร (ผังไฟ + ผังประปา)',
     v_admin || '/demo-floorplan.jpg', 'แปลนอาคาร.jpg', 1840000, 'image/jpeg', 'ตัวอย่าง');

  -- ══ 12) แจ้งซ่อม 12 — ครบทุกสถานะ + outcome + รูป ═════════════
  insert into public.repair_tickets (rental_id, description, status, photo_url, created_at, started_at, done_at, outcome, done_note)
  select r.id, s.descr, s.st, s.photo, s.created, s.started, s.done, s.outcome, s.note
  from (values
    ('103', 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย เป็นมา 2 วันแล้ว (มีรูป)', 'open', 'repair-photos/demo-ac.jpg', now() - interval '5 hours', null::timestamptz, null::timestamptz, null::text, null),
    ('102', 'ไฟห้องน้ำกะพริบ เปิดแล้วติดๆ ดับๆ', 'open', null, now() - interval '1 day', null, null, null, null),
    ('107', 'น้ำไหลซึมใต้เคาน์เตอร์ครัว', 'open', 'repair-photos/demo-leak.jpg', now() - interval '2 days', null, null, null, null),
    ('กข 1234', 'เข็มน้ำมันขึ้นช้า สตาร์ทเช้ามีเสียงแปลก', 'open', null, now() - interval '3 days', null, null, null, null),
    ('LENS-702', 'สเกลโฟกัสหลุด ตัวโฟกัสไม่ตรง', 'open', null, now() - interval '1 day', null, null, null, null),
    ('201', 'ประตูห้องปิดไม่สนิท ต้องออกแรงดันแรงๆ (นัดช่างพรุ่งนี้ 10:00)', 'in_progress', null, now() - interval '4 days', now() - interval '1 day', null, null, null),
    ('106', 'ก๊อกน้ำในครัวหยดตลอด ปิดสุดแล้วก็ยังหยด', 'in_progress', null, now() - interval '6 days', now() - interval '3 days', null, null, null),
    ('207', 'หลอดไฟโถงทางเดินชั้น 2 กระพริบ', 'in_progress', null, now() - interval '2 days', now() - interval '5 hours', null, null, null),
    ('101', 'หลอดไฟหน้าห้องไม่ติด', 'done', null, now() - interval '12 days', now() - interval '11 days', now() - interval '10 days', 'success', 'เปลี่ยนหลอดใหม่ 1 ดวง เสร็จเรียบร้อย'),
    ('104', 'ชักโครกกดไม่ลง น้ำไม่ไหลเข้าถัง', 'done', null, now() - interval '20 days', now() - interval '20 days', now() - interval '19 days', 'success', 'เปลี่ยนชุดกด + ล้างท่อ'),
    ('202', 'มุ้งลวดหน้าต่างขาด แมลงเข้าห้อง (รออะไหล่)', 'done', null, now() - interval '35 days', now() - interval '34 days', now() - interval '31 days', 'failed', 'สั่งมุ้งไซซ์พิเศษ อะไหล่มาไม่ทัน — นัดใหม่อีกครั้ง'),
    ('110', 'ชักโครกน้ำรั่วที่ฐาน เปลี่ยนโอริง', 'done', null, now() - interval '50 days', now() - interval '49 days', now() - interval '48 days', 'success', 'เปลี่ยนโอริงใหม่ ไม่มีรอยรั่ว')
  ) as s(sub, descr, st, photo, created, started, done, outcome, note)
  join public.rentals r on r.landlord_id = v_admin and r.sub_label = s.sub;

  -- ══ 13) ค่าสมาชิก + slip_verifications + activity/audit/reminders ══
  insert into public.membership_payments (admin_id, plan_type, duration_months, amount, status, slip_image_url, created_at, note)
  values
    (v_admin, 'starter', 1, 199, 'approved', 'membership/demo-old.jpg', now() - interval '300 days', null),
    (v_admin, 'pro', 12, 2400, 'approved', 'membership/demo-pro.jpg', now() - interval '160 days', 'ต่ออายุรายปี (เดโม่)'),
    (v_admin, 'pro', 12, 2400, 'pending_review', 'membership/demo-renew.jpg', now() - interval '5 hours', 'โอนแล้ว รอแอดมินตรวจสลิป (เดโม่)');

  insert into public.slip_verifications (txn_ref, kind, ref_id, amount, bank, verified_at)
  select 'EASYSLIP-DEMO-' || upper(substr(t.id::text, 1, 8)), 'tenant', t.id,
         coalesce(t.paid_amount, t.total_amount), 'kbank', t.verified_at
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin
    and t.status = 'paid' and t.slip_verified = true
    and t.payment_method in ('bank_transfer', 'promptpay');

  insert into public.activity_logs (admin_id, user_email, action, detail, ip, user_agent, created_at)
  values
    (v_admin, v_demo_email, 'login',  'demo',   '171.101.77.12', 'Mozilla/5.0 (iPhone)',        now() - interval '2 hours'),
    (v_admin, v_demo_email, 'logout', 'demo',   '171.101.77.12', 'Mozilla/5.0 (iPhone)',        now() - interval '9 hours'),
    (v_admin, v_demo_email, 'login',  'google', '125.26.88.4',   'Mozilla/5.0 (Windows NT 10)', now() - interval '2 days'),
    (v_admin, v_demo_email, 'logout', 'google', '125.26.88.4',   'Mozilla/5.0 (Windows NT 10)', now() - interval '2 days'),
    (v_admin, v_demo_email, 'login',  'demo',   '202.44.14.9',   'Mozilla/5.0 (Android 14)',    now() - interval '5 days'),
    (v_admin, v_demo_email, 'login',  'email',  '202.44.14.9',   'Mozilla/5.0 (Macintosh)',     now() - interval '12 days'),
    (v_admin, v_demo_email, 'logout', 'email',  '202.44.14.9',   'Mozilla/5.0 (Macintosh)',     now() - interval '12 days'),
    (v_admin, v_demo_email, 'login',  'demo',   '118.172.90.33', 'Mozilla/5.0 (iPad)',          now() - interval '20 days'),
    (v_admin, v_demo_email, 'login',  'google', '49.228.11.7',   'Mozilla/5.0 (Windows NT 10)', now() - interval '33 days'),
    (v_admin, v_demo_email, 'logout', 'google', '49.228.11.7',   'Mozilla/5.0 (Windows NT 10)', now() - interval '33 days');

  -- audit_logs: จ่ายสด + ค่าปรับทวงหนี้
  insert into public.audit_logs (transaction_id, landlord_id, old_amount, new_amount, reason, created_at)
  select t.id, v_admin, t.total_amount, t.total_amount, 'รับเงินสดและปิดบิล (เดโม่)', now() - interval '3 days'
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin and r.sub_label = '206' and t.status = 'paid' and t.payment_method = 'cash' and t.period = to_char(current_date, 'YYYY-MM')
  limit 1;

  insert into public.audit_logs (transaction_id, landlord_id, old_amount, new_amount, reason, created_at)
  select t.id, v_admin,
    t.total_amount - coalesce(t.penalty_amount, 0), t.total_amount,
    'ค่าปรับชำระล่าช้า ' || coalesce(t.penalty_days, 0) || ' วัน (run_chase เดโม่)', now() - interval '1 day'
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin and r.sub_label = '103' and t.status = 'unpaid' and t.period = to_char(current_date, 'YYYY-MM')
  limit 1;

  insert into public.rental_audit_log (rental_id, field_name, old_value, new_value, created_at)
  select r.id, s.field, s.old, s.new, now() - interval '6 days'
  from (values
    ('103', 'bill_day', '1', greatest(1, v_d - 4)::text),
    ('103', 'penalty_day', '3', greatest(1, v_d - 4)::text),
    ('101', 'min_water_charge', '80', '100')
  ) as s(sub, field, old, new)
  join public.rentals r on r.landlord_id = v_admin and r.sub_label = s.sub;

  insert into public.reminders (transaction_id, landlord_id, kind, message_text, sent_at)
  select t.id, v_admin, 'receipt', 'ใบเสร็จค่าเช่าเดือนนี้ ' || r.sub_label || ' (จ่ายสด)', now() - interval '3 days'
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin and r.sub_label = '206' and t.status = 'paid' and t.payment_method = 'cash' and t.period = to_char(current_date, 'YYYY-MM')
  limit 1;

  insert into public.reminders (transaction_id, landlord_id, kind, message_text, sent_at)
  select t.id, v_admin, 'due_soon', 'ค่าเช่าใกล้ครบกำหนด ' || r.sub_label || ' — ชำระภายในวันที่ ' || greatest(1, v_d - 4)::text, now() - interval '5 days'
  from public.transactions t
  join public.rentals r on r.id = t.rental_id
  where r.landlord_id = v_admin and r.sub_label = '103' and t.status = 'unpaid' and t.period = to_char(current_date, 'YYYY-MM')
  limit 1;

  -- ══ 14) app_settings — LINE + ลิงก์บิล ════════════════════════
  -- line_token: ใส่ token จริงของบอท LINE (ไม่ใช่ความลับของเว็บ) ถึงจะส่งบิล/ใบเสร็จได้
  insert into app_settings (key, value)
  values
    ('bot_add_url', 'https://line.me/R/ti/p/@881gcbgc'),
    ('bill_base_url', 'https://payrentpro-web.vercel.app')
  on conflict (key) do nothing;

  insert into app_settings (key, value)
  values ('line_token', 'DEMO_LINE_TOKEN_PLACEHOLDER')
  on conflict (key) do nothing;

  raise notice '── seed เดโม่ชุดใหญ่เสร็จ ── admin=%', v_admin;
end;
$$;

-- ── ตรวจรับ ──────────────────────────────────────────────────────
do $$
declare
  v_admin uuid;
  v_missing text := '';
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;

  if (select count(*) from public.rentals where landlord_id = v_admin) < 25 then v_missing := v_missing || 'rentals '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin) < 180 then v_missing := v_missing || 'transactions '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin and t.status = 'unpaid') < 7 then v_missing := v_missing || 'tx/unpaid '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin and t.status = 'pending_review') < 4 then v_missing := v_missing || 'tx/pending '; end if;
  if (select count(*) from public.transactions t join public.rentals r on r.id = t.rental_id where r.landlord_id = v_admin and coalesce(t.penalty_amount, 0) > 0) < 7 then v_missing := v_missing || 'tx/penalty '; end if;
  if (select count(*) from public.expenses where landlord_id = v_admin) < 40 then v_missing := v_missing || 'expenses '; end if;
  if (select count(*) from public.other_income where landlord_id = v_admin) < 20 then v_missing := v_missing || 'other_income '; end if;
  if (select count(*) from public.repair_tickets rt join public.rentals r on r.id = rt.rental_id where r.landlord_id = v_admin) < 10 then v_missing := v_missing || 'repairs '; end if;

  if v_missing <> '' then
    raise exception 'ข้อมูลเดโม่ไม่ครบ — ขาด: %', v_missing;
  end if;
  raise notice '✓ เดโม่ชุดใหญ่ครบ';
end;
$$;