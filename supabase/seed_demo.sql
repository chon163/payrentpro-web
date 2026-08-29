-- ============================================================
-- PayRentPro : Seed Mock Data (Supabase SQL Editor)
-- ล้างข้อมูลเก่า แล้วสร้างข้อมูลจำลองครบทุกฟีเจอร์
-- ============================================================

-- 1) ล้างข้อมูลเก่าทั้งหมด
TRUNCATE TABLE audit_logs, transactions, rentals RESTART IDENTITY CASCADE;

-- 2) สร้างสินทรัพย์ (rentals) 50 รายการ
DROP TABLE IF EXISTS tmp_rentals;
CREATE TEMP TABLE tmp_rentals AS
WITH names AS (
  SELECT
    ARRAY['สมชาย','สมหญิง','มานพ','ปรีดา','ศิริพร','วีระ','อารยา','ธนกร','กิตติ','ณัฐวุฒิ','ปิยะ','วัชรพล','จิราพร','อนุชา','พรทิพย์','สุชาติ','รัตนา','ประสิทธิ์','สุภาพ','นงนุช'] AS first_names,
    ARRAY['ใจดี','รุ่งเรือง','วงศ์สุวรรณ','ศรีสุข','มั่นคง','ไทยแท้','บุญมี','แก้วใส','ทองคำ','พันธ์ดี','อินทร์','ชัยชนะ','สุขสวัสดิ์','พิริยะ','แสงทอง'] AS last_names
),
ins AS (
  INSERT INTO rentals (
    biz_type, cust_name, tenant_phone, tenant_id_card, emergency_contact,
    item_details, room_status, amount, cycle, due_date,
    penalty_per_day, penalty_enabled, chase_frequency, stop_chase,
    credit_balance, deposit_amount, move_in_date, lease_end_date,
    last_water_meter, water_rate, last_elec_meter, elec_rate,
    utility_enabled, binding_code
  )
  SELECT
    b.biz_type,
    CASE WHEN (g.i % 5) = 0 THEN 'ว่าง'
         ELSE n.first_names[1 + (floor(random()*20))::int] || ' ' || n.last_names[1 + (floor(random()*15))::int]
    END,
    CASE WHEN (g.i % 5) = 0 THEN NULL ELSE '08' || lpad((floor(random()*100000000))::text, 8, '0') END,
    CASE WHEN (g.i % 5) = 0 THEN NULL ELSE ((1 + (floor(random()*8))::int)::text || lpad((floor(random()*1000000000000))::text, 12, '0')) END,
    CASE WHEN (g.i % 5) = 0 THEN NULL ELSE '09' || lpad((floor(random()*100000000))::text, 8, '0') END,
    it.item_details,
    CASE WHEN (g.i % 5) = 0 THEN 'vacant' ELSE 'occupied' END,
    a.amount,
    (ARRAY['monthly','monthly','monthly','weekly','daily'])[1 + (floor(random()*5))::int],
    1 + (floor(random()*28))::int,
    50 + (floor(random()*151))::int,
    true,
    (ARRAY[3,7,14])[1 + (floor(random()*3))::int],
    false,
    0,
    CASE WHEN (g.i % 5) = 0 THEN 0 ELSE a.amount END,
    CASE WHEN (g.i % 5) = 0 THEN NULL ELSE le.lease_end_date - 365 END,
    CASE WHEN (g.i % 5) = 0 THEN NULL ELSE le.lease_end_date END,
    CASE WHEN b.biz_type = 'อสังหาริมทรัพย์' THEN (floor(random()*500))::int ELSE 0 END,
    CASE WHEN b.biz_type = 'อสังหาริมทรัพย์' THEN 18 ELSE 0 END,
    CASE WHEN b.biz_type = 'อสังหาริมทรัพย์' THEN (floor(random()*5000))::int ELSE 0 END,
    CASE WHEN b.biz_type = 'อสังหาริมทรัพย์' THEN 5 ELSE 0 END,
    (b.biz_type = 'อสังหาริมทรัพย์'),
    (100000000 + g.i)::text
  FROM generate_series(1,50) AS g(i)
  CROSS JOIN names n
  CROSS JOIN LATERAL (SELECT (ARRAY['อสังหาริมทรัพย์','ยานพาหนะ','อุปกรณ์'])[1 + (floor(random()*3))::int] AS biz_type, g.i AS _gi) b
  CROSS JOIN LATERAL (
    SELECT CASE b.biz_type
      WHEN 'อสังหาริมทรัพย์' THEN (ARRAY['ห้อง 101','ห้อง 102','ห้อง 201','ห้อง 202','ห้อง 301','ห้อง 303','ห้อง 401','ห้อง 402','ห้อง 501','คอนโด A','คอนโด B','คอนโด C','โกดัง A','โกดัง B','โกดัง C','บ้านเดี่ยว 88/1','ทาวน์เฮาส์ 12','ห้อง 505'])[1 + (floor(random()*18))::int]
      WHEN 'ยานพาหนะ' THEN (ARRAY['รถ กก-1234','รถ ขข-5678','รถ คค-9012','แท็กซี่ ทส-3456','รถบรรทุก 70-8899','มอเตอร์ไซค์ 1กข-2345','รถตู้ ฮล-6789','รถกระบะ ผผ-1122'])[1 + (floor(random()*8))::int]
      ELSE (ARRAY['กล้อง Sony A7','เครื่องจักร CNC-01','โดรน DJI Mavic','เครื่องเสียงงานแต่ง','โปรเจคเตอร์ Epson','เครื่องพิมพ์ 3D','เครื่องชงกาแฟ','เครื่องปั่นไฟ 5kW'])[1 + (floor(random()*8))::int]
    END AS item_details
  ) it
  CROSS JOIN LATERAL (SELECT (2000 + (floor(random()*13001))::int) AS amount, g.i AS _gi) a
  CROSS JOIN LATERAL (SELECT (CURRENT_DATE + ((floor(random()*181))::int - 90)) AS lease_end_date, g.i AS _gi) le
  RETURNING id, biz_type, amount, room_status, utility_enabled, water_rate, elec_rate
)
SELECT * FROM ins;

-- 3) สร้างบิล (transactions) 6 เดือนสำหรับ occupied
INSERT INTO transactions (
  rental_id, period, base_amount, water_units, water_cost,
  elec_units, elec_cost, total_amount, status, secure_token, created_at
)
SELECT
  r.id,
  to_char(mo.month_start, 'YYYY-MM'),
  r.amount,
  u.water_units,
  c.water_cost,
  u.elec_units,
  c.elec_cost,
  (r.amount + c.water_cost + c.elec_cost)::numeric,
  CASE WHEN mo.rnd < 0.60 THEN 'paid' WHEN mo.rnd < 0.90 THEN 'unpaid' ELSE 'pending_review' END,
  md5(random()::text || clock_timestamp()::text),
  (mo.month_start + ((floor(random()*28))::int * interval '1 day'))
FROM tmp_rentals r
CROSS JOIN generate_series(0,5) AS gs(offs)
CROSS JOIN LATERAL (
  SELECT
    (date_trunc('month', CURRENT_DATE) + ((gs.offs - 3) * interval '1 month')) AS month_start,
    random() AS rnd
) mo
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN r.utility_enabled THEN 3 + (floor(random()*30))::int ELSE 0 END AS water_units,
    CASE WHEN r.utility_enabled THEN 10 + (floor(random()*100))::int ELSE 0 END AS elec_units
) u
CROSS JOIN LATERAL (
  SELECT
    u.water_units,
    (u.water_units * COALESCE(r.water_rate, 0))::numeric AS water_cost,
    u.elec_units,
    (u.elec_units * COALESCE(r.elec_rate, 0))::numeric AS elec_cost
) c
WHERE r.room_status = 'occupied';

-- 4) สร้างประวัติแก้ไข (audit_logs) 8 รายการ
INSERT INTO audit_logs (transaction_id, old_amount, new_amount, reason)
SELECT
  t.id,
  (t.total_amount + (100 + (floor(random()*400))::int))::numeric,
  t.total_amount,
  (ARRAY['ลดค่าปรับเพราะน้ำท่วม','แก้ยอดค่าน้ำไฟ','ลูกค้าขอส่วนลดค่าน้ำ','ปรับยอดตามสัญญาใหม่','แก้ไขยอดหลังตรวจสอบสลิป','คืนเงินมัดจำบางส่วน','ส่วนลดประจำเดือน'])[1 + (floor(random()*7))::int]
FROM transactions t
WHERE t.status = 'paid'
  AND t.rental_id IN (SELECT id FROM tmp_rentals)
ORDER BY random()
LIMIT 8;

-- ล้าง temp table
DROP TABLE IF EXISTS tmp_rentals;

-- 5) ตรวจสอบผลลัพธ์
SELECT 'rentals' AS table_name, count(*) AS row_count FROM rentals
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;

SELECT status, count(*) AS cnt FROM transactions GROUP BY status ORDER BY cnt DESC;

SELECT room_status, count(*) AS cnt FROM rentals GROUP BY room_status ORDER BY cnt DESC;