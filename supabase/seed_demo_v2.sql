-- ============================================================
-- PayRentPro : Seed Mock Data (deterministic — ไม่เพี้ยน/ไม่ซ้ำ)
-- ============================================================

TRUNCATE TABLE audit_logs, transactions, rentals RESTART IDENTITY CASCADE;

-- 1) สร้าง rentals 50 รายการ (20 อสังหา / 15 รถ / 15 อุปกรณ์, 40 occupied / 10 vacant)
DROP TABLE IF EXISTS tmp_rentals;
CREATE TEMP TABLE tmp_rentals AS
WITH names AS (
  SELECT
    ARRAY['สมชาย','สมหญิง','มานพ','ปรีดา','ศิริพร','วีระ','อารยา','ธนกร','กิตติ','ณัฐวุฒิ'] AS first,
    ARRAY['ใจดี','รุ่งเรือง','วงศ์สุวรรณ','ศรีสุข','มั่นคง','ไทยแท้','บุญมี','แก้วใส','ทองคำ'] AS last
),
seed AS (
  SELECT
    g.i,
    CASE WHEN g.i <= 20 THEN 'อสังหาริมทรัพย์'
         WHEN g.i <= 35 THEN 'ยานพาหนะ'
         ELSE 'อุปกรณ์' END AS biz_type,
    CASE WHEN g.i <= 40 THEN 'occupied' ELSE 'vacant' END AS room_status,
    CASE
      WHEN g.i <= 20 THEN 5000 + ((g.i - 1) % 10) * 1000
      WHEN g.i <= 35 THEN 2000 + ((g.i - 1) % 10) * 300
      ELSE 1000 + ((g.i - 1) % 10) * 200
    END AS amount
  FROM generate_series(1,50) AS g(i)
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
    s.biz_type,
    CASE WHEN s.i <= 40 THEN n.first[1 + ((s.i - 1) % 10)] || ' ' || n.last[1 + ((s.i - 1) % 9)] ELSE 'ว่าง' END,
    CASE WHEN s.i <= 40 THEN '08' || lpad(((s.i * 54321) % 100000000)::text, 8, '0') ELSE NULL END,
    CASE WHEN s.i <= 40 THEN '1' || lpad(((s.i * 987654321) % 1000000000000)::text, 12, '0') ELSE NULL END,
    CASE WHEN s.i <= 40 THEN '09' || lpad(((s.i * 12345) % 100000000)::text, 8, '0') ELSE NULL END,
    CASE s.biz_type
      WHEN 'อสังหาริมทรัพย์' THEN (ARRAY['ห้อง 101','ห้อง 102','ห้อง 201','ห้อง 202','ห้อง 301','ห้อง 302','คอนโด A','คอนโด B','โกดัง A','บ้านเดี่ยว 88/1'])[1 + ((s.i - 1) % 10)]
      WHEN 'ยานพาหนะ' THEN (ARRAY['รถ กก-1234','รถ ขข-5678','แท็กซี่ ทส-3456','รถบรรทุก 70-8899','มอเตอร์ไซค์ 1กข-2345'])[1 + ((s.i - 21) % 5)]
      ELSE (ARRAY['กล้อง Sony A7','เครื่องจักร CNC-01','โดรน DJI Mavic','เครื่องเสียงงานแต่ง','เครื่องพิมพ์ 3D'])[1 + ((s.i - 36) % 5)]
    END,
    s.room_status,
    s.amount,
    'monthly',
    1 + (s.i % 28),
    50 + (s.i % 10) * 15,
    true,
    3,
    false,
    0,
    CASE WHEN s.i <= 40 THEN s.amount ELSE 0 END,
    CASE WHEN s.i <= 40 THEN CURRENT_DATE - 365 ELSE NULL END,
    CASE WHEN s.i <= 40 THEN CURRENT_DATE + ((s.i - 25) * 6) ELSE NULL END,
    CASE WHEN s.biz_type = 'อสังหาริมทรัพย์' THEN s.i * 10 ELSE 0 END,
    CASE WHEN s.biz_type = 'อสังหาริมทรัพย์' THEN 18 ELSE 0 END,
    CASE WHEN s.biz_type = 'อสังหาริมทรัพย์' THEN s.i * 100 ELSE 0 END,
    CASE WHEN s.biz_type = 'อสังหาริมทรัพย์' THEN 5 ELSE 0 END,
    (s.biz_type = 'อสังหาริมทรัพย์'),
    (100000000 + s.i)::text
  FROM seed s
  CROSS JOIN names n
  RETURNING id, biz_type, amount, room_status, utility_enabled, water_rate, elec_rate, binding_code
)
SELECT * FROM ins;

-- 2) สร้าง transactions 6 เดือน (ย้อนหลัง 3 + ล่วงหน้า 3) สำหรับ occupied
INSERT INTO transactions (
  rental_id, period, base_amount, water_units, water_cost,
  elec_units, elec_cost, total_amount, status, secure_token, created_at
)
SELECT
  o.id,
  to_char(mo.month_start, 'YYYY-MM'),
  o.amount,
  u.water_units,
  c.water_cost,
  u.elec_units,
  c.elec_cost,
  (o.amount + c.water_cost + c.elec_cost)::numeric,
  CASE WHEN ((o.seq + gs.offs) % 10) < 6 THEN 'paid'
       WHEN ((o.seq + gs.offs) % 10) < 9 THEN 'unpaid'
       ELSE 'pending_review' END,
  md5(o.id::text || gs.offs::text),
  (mo.month_start + ((o.seq % 28) * interval '1 day'))
FROM (
  SELECT id, amount, utility_enabled, water_rate, elec_rate,
         row_number() OVER (ORDER BY binding_code) AS seq
  FROM tmp_rentals
  WHERE room_status = 'occupied'
) o
CROSS JOIN generate_series(0,5) AS gs(offs)
CROSS JOIN LATERAL (
  SELECT (date_trunc('month', CURRENT_DATE) + ((gs.offs - 3) * interval '1 month')) AS month_start
) mo
CROSS JOIN LATERAL (
  SELECT
    CASE WHEN o.utility_enabled THEN 3 + (o.seq % 30) ELSE 0 END AS water_units,
    CASE WHEN o.utility_enabled THEN 10 + (o.seq % 100) ELSE 0 END AS elec_units
) u
CROSS JOIN LATERAL (
  SELECT
    u.water_units,
    (u.water_units * o.water_rate)::numeric AS water_cost,
    u.elec_units,
    (u.elec_units * o.elec_rate)::numeric AS elec_cost
) c;

-- 3) สร้าง audit_logs 8 รายการ
WITH paid AS (
  SELECT id, total_amount, row_number() OVER (ORDER BY id) AS rn
  FROM transactions WHERE status = 'paid'
  ORDER BY id LIMIT 8
)
INSERT INTO audit_logs (transaction_id, old_amount, new_amount, reason)
SELECT
  p.id,
  (p.total_amount + 100 + p.rn * 50)::numeric,
  p.total_amount,
  (ARRAY['ลดค่าปรับเพราะน้ำท่วม','แก้ยอดค่าน้ำไฟ','ลูกค้าขอส่วนลดค่าน้ำ','ปรับยอดตามสัญญาใหม่','แก้ไขยอดหลังตรวจสอบสลิป','คืนเงินมัดจำบางส่วน','ส่วนลดประจำเดือน','แก้ไขยอดตามจริง'])[1 + ((p.rn - 1) % 8)]
FROM paid p;

DROP TABLE IF EXISTS tmp_rentals;

-- 4) ตรวจสอบผลลัพธ์
SELECT 'rentals' AS t, count(*) FROM rentals
UNION ALL SELECT 'transactions', count(*) FROM transactions
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;

SELECT biz_type, count(*) FROM rentals GROUP BY biz_type ORDER BY biz_type;
SELECT room_status, count(*) FROM rentals GROUP BY room_status ORDER BY room_status;
SELECT status, count(*) FROM transactions GROUP BY status ORDER BY status;
