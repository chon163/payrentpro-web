-- ============================================================
-- PayRentPro : Seed ข้อมูลจำลอง 20 ห้องพัก (+ บิลย้อนหลัง 6 เดือน)
--
-- - เพิ่มแบบ additive (ไม่ลบข้อมูลเดิม) — รันซ้ำได้ (ข้ามห้องที่มีแล้ว)
-- - ห้อง 105 / 110 / 208 / 210 = ว่าง, ที่เหลือมีผู้เช่า
-- - สถานะบิลคละกัน: paid / unpaid (ค้างเกิน 15 วัน ให้ทวงด่วน) /
--   pending_review (มี paid_amount ให้กดอนุมัติ)
-- - 3 ห้องสัญญาจะหมดใน 30 วัน (ห้อง 101 / 107 / 113)
-- - period เก็บ ISO 'YYYY-MM' ตามระบบปัจจุบัน
--
-- รันผ่าน supabase db push หรือ Supabase SQL Editor
-- ============================================================

DROP TABLE IF EXISTS tmp_seed_rooms;
CREATE TEMP TABLE tmp_seed_rooms AS
WITH seed AS (
  SELECT g.i,
    (ARRAY['ห้อง 101','ห้อง 102','ห้อง 103','ห้อง 104','ห้อง 105',
           'ห้อง 106','ห้อง 107','ห้อง 108','ห้อง 109','ห้อง 110',
           'ห้อง 201','ห้อง 202','ห้อง 203','ห้อง 204','ห้อง 205',
           'ห้อง 206','ห้อง 207','ห้อง 208','ห้อง 209','ห้อง 210'])[g.i] AS room,
    (ARRAY['สมชาย ใจดี','สมหญิง รุ่งเรือง','มานพ วงศ์สุวรรณ','ปรีดา ศรีสุข',
           'ว่าง','วีระ มั่นคง','อารยา บุญมี','ธนกร แก้วใส','กิตติ ทองคำ',
           'ว่าง','ณัฐวุฒิ ไทยแท้','สุนิสา ใจดี','พรชัย รุ่งเรือง','มาลี วงศ์สุวรรณ',
           'อนันต์ ศรีสุข','จิราพร มั่นคง','สมศักดิ์ บุญมี','ว่าง',
           'รัชนี แก้วใส','ว่าง'])[g.i] AS cust,
    (ARRAY[4500,5000,5500,6000,0,
           6500,7000,7500,8000,0,
           3500,4000,4800,5200,5800,
           6200,6800,0,8500,0])[g.i] AS amount,
    (ARRAY[10,20,28,75,120,
           90,150,200,260,300,
           45,100,180,240,320,
           60,130,360,210,400])[g.i] AS lease_left_days,
    (ARRAY[18,17,16,15,14,
           13,12,11,10,9,
           1,2,3,4,5,
           6,7,8,9,10])[g.i] AS due_day
  FROM generate_series(1, 20) AS g(i)
),
ins AS (
  INSERT INTO rentals (
    biz_type, cust_name, tenant_phone, tenant_id_card, emergency_contact,
    item_details, room_status, amount, cycle, due_date,
    penalty_per_day, penalty_enabled, chase_frequency, stop_chase,
    deposit_amount, move_in_date, lease_end_date,
    last_water_meter, water_rate, last_elec_meter, elec_rate,
    utility_enabled, binding_code
  )
  SELECT
    'อสังหาริมทรัพย์',
    s.cust,
    CASE WHEN s.cust <> 'ว่าง' THEN '08' || lpad(((s.i * 54321) % 100000000)::text, 8, '0') END,
    CASE WHEN s.cust <> 'ว่าง' THEN '1' || lpad((((s.i::bigint * 987654321) % 100000000000)::text), 12, '0') END,
    CASE WHEN s.cust <> 'ว่าง' THEN '09' || lpad(((s.i * 12345) % 100000000)::text, 8, '0') END,
    s.room,
    CASE WHEN s.cust = 'ว่าง' THEN 'vacant' ELSE 'occupied' END,
    CASE WHEN s.amount = 0 THEN 3500 + (s.i * 100) ELSE s.amount END,
    'monthly',
    s.due_day,
    50 + (s.i % 6) * 10,
    true,
    3,
    0,
    CASE WHEN s.cust <> 'ว่าง' THEN (CASE WHEN s.amount = 0 THEN 3500 + (s.i * 100) ELSE s.amount END) ELSE 0 END,
    CASE WHEN s.cust <> 'ว่าง' THEN CURRENT_DATE - 400 - (s.i * 5) END,
    CASE WHEN s.cust <> 'ว่าง' THEN CURRENT_DATE + s.lease_left_days END,
    500 + s.i * 12,
    18,
    1000 + s.i * 137,
    5,
    true,
    (900000000 + s.i)::text
  FROM seed s
  WHERE NOT EXISTS (SELECT 1 FROM rentals r WHERE r.item_details = s.room)
  RETURNING id, item_details, amount, room_status, utility_enabled, water_rate, elec_rate
)
SELECT * FROM ins;

-- บิลย้อนหลัง 6 เดือน (5..0 เดือนก่อน, เดือนล่าสุด = เดือนปัจจุบัน)
INSERT INTO transactions (
  rental_id, period, base_amount, water_units, water_cost,
  elec_units, elec_cost, total_amount, status, secure_token, paid_amount, created_at
)
SELECT
  o.id,
  to_char(mo.month_start, 'YYYY-MM'),
  o.amount,
  u.water_units,
  (u.water_units * o.water_rate)::numeric,
  u.elec_units,
  (u.elec_units * o.elec_rate)::numeric,
  (o.amount + (u.water_units * o.water_rate) + (u.elec_units * o.elec_rate))::numeric,
  CASE
    WHEN gs.offs >= 3 THEN 'paid'                                             -- เดือนเก่าๆ ชำระหมด
    WHEN gs.offs = 2 AND o.seq % 4 = 0 THEN 'unpaid'                          -- ค้างชำระเกิน 15 วัน (ทวงด่วน)
    WHEN gs.offs = 1 AND o.seq % 4 = 0 THEN 'unpaid'                          -- ค้างชำระเกิน 15 วัน (ทวงด่วน)
    WHEN gs.offs <= 1 AND o.seq % 5 = 3 THEN 'pending_review'                 -- รอตรวจสลิป
    WHEN gs.offs = 0 AND o.seq % 4 = 0 THEN 'unpaid'                          -- ค้างชำระเดือนนี้ (ยังไม่เกิน 15 วัน)
    ELSE 'paid'
  END,
  md5(o.id::text || gs.offs::text || 'seedv3')::uuid,
  CASE WHEN (gs.offs <= 1 AND o.seq % 5 = 3) THEN (o.amount + (u.water_units * o.water_rate) + (u.elec_units * o.elec_rate))::numeric END,
  CASE
    WHEN gs.offs = 0 AND (o.seq % 4 = 0 OR o.seq % 5 = 3) THEN now() - (interval '2 days')   -- เพิ่งออก (ไม่นับ overdue)
    WHEN gs.offs = 0 THEN now() - (interval '1 day')
    ELSE mo.month_start + ((o.seq % 25) * interval '1 day')                                    -- เดือนก่อนๆ กระจายวัน
  END
FROM (
  SELECT id, amount, water_rate, elec_rate, row_number() OVER (ORDER BY item_details) AS seq
  FROM tmp_seed_rooms
  WHERE room_status = 'occupied'
) o
CROSS JOIN generate_series(0, 5) AS gs(offs)
CROSS JOIN LATERAL (
  SELECT (date_trunc('month', CURRENT_DATE) - ((5 - gs.offs) * interval '1 month')) AS month_start
) mo
CROSS JOIN LATERAL (
  SELECT (3 + (o.seq % 12)) AS water_units, (25 + (o.seq % 90)) AS elec_units
) u
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS tmp_seed_rooms;
