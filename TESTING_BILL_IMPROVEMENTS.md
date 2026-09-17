# วิธีทดสอบงาน 4 ข้อ: วันส่งบิล/วันคิดปรับ/ค่าขั้นต่ำ/บิลน้ำไฟแยก

## สรุปที่เปลี่ยน

1. **ฟอร์มแก้ไขห้อง** — เพิ่มช่อง `bill_day`, `penalty_day`, `min_water_charge`, `min_elec_charge` (section "รอบบิล & ค่าปรับ")
2. **แยก bill_day (วันส่งบิล) จาก penalty_day (วันคิดปรับ)** — migration + RPC `bill_due_date` / `run_chase` ใช้ค่าแยก
3. **บิลน้ำไฟแยก** — dashboard แสดงการ์ดเหลือง "ห้องที่ยังไม่ได้ส่งบิลน้ำไฟ (N)" → กดแล้วกรอกมิเตอร์ → ออกบิลใหม่ (เฉพาะยอดน้ำไฟ)
4. **ค่าขั้นต่ำ** — คำนวณมิเตอร์แล้วถ้ายอดต่ำกว่าขั้นต่ำ = ใช้ยอดขั้นต่ำ (`Math.max(units * rate, min)`)

## ขั้นตอนทดสอบ

### 1. ทดสอบฟอร์มแก้ไขห้อง (bill_day / penalty_day / min_water_charge / min_elec_charge)

```bash
# 1. เปิดแอพ → เลือกห้องใดก็ได้ → กดปุ่ม "แก้ไขรายละเอียด" (Asset card มุมขวาบน)
# 2. เลื่อนลงไปที่ section "รอบบิล & ค่าปรับ" (ใต้ค่าน้ำไฟ)
# 3. เห็นช่อง:
#    - วันส่งบิล (bill_day) — เช่น 1
#    - วันเริ่มคิดค่าปรับ (penalty_day) — เช่น 5
#    - ค่าน้ำขั้นต่ำ (min_water_charge) — เช่น 50
#    - ค่าไฟขั้นต่ำ (min_elec_charge) — เช่น 100
# 4. แก้เป็น bill_day=3, penalty_day=10, min_water=80, min_elec=150 → บันทึก
# 5. เปิดห้องอีกครั้ง → ค่าที่แก้ติดอยู่ ✅
```

**ผลที่คาดหวัง:**
- ฟอร์มแสดงช่องครบ 4 ช่อง
- บันทึกแล้วค่าติด

---

### 2. ทดสอบ bill_day แยกจาก penalty_day (RPC bill_due_date / run_chase)

```sql
-- เช็คว่า RPC ทำงานถูกต้อง (ส่งบิลวันที่ bill_day, คิดปรับวันที่ penalty_day)

-- ตั้งห้องตัวอย่าง: bill_day=1, penalty_day=5
UPDATE rentals
SET bill_day = 1, penalty_day = 5
WHERE id = '<rental_id>';

-- เรียก RPC bill_due_date('2024-03') → ควรได้ 2024-03-01
SELECT bill_due_date('2024-03', 1);

-- เรียก RPC penalty_due_date('2024-03') → ควรได้ 2024-03-05
SELECT penalty_due_date('2024-03', 5);

-- ทดสอบ run_chase → ควรส่งบิลวันที่ 1, คิดปรับวันที่ 5+
SELECT * FROM run_chase();
```

**ผลที่คาดหวัง:**
- `bill_due_date('2024-03', 1)` → `2024-03-01`
- `penalty_due_date('2024-03', 5)` → `2024-03-05`
- RPC `run_chase` ส่งบิลตาม bill_day, คำนวณค่าปรับตาม penalty_day

---

### 3. ทดสอบบิลน้ำไฟแยก (dashboard → กรอกมิเตอร์ → ออกบิลใหม่)

```bash
# A. สร้างบิลค่าเช่าที่ไม่มีน้ำไฟ
# 1. เลือกห้องที่เปิดค่าน้ำไฟ (utility_enabled=true)
# 2. สร้างบิลค่าเช่า → ใส่ค่าเช่า 3000 → ข้ามช่องมิเตอร์ (ปล่อยว่าง) → ส่งบิล
# 3. ผล: บิลมีแค่ค่าเช่า 3000, water_units=0, elec_units=0

# B. dashboard แสดงการ์ดเตือน
# 4. กลับไปหน้า Dashboard → เห็นการ์ดเหลือง "ห้องที่ยังไม่ได้ส่งบิลน้ำไฟ (1)"
# 5. กดที่การ์ด → popup รายชื่อห้องที่ยังไม่ส่งบิลน้ำไฟ
# 6. เลือกห้อง → เปิด UtilityBillModal (ฟอร์มกรอกมิเตอร์)

# C. กรอกมิเตอร์ → ออกบิลน้ำไฟแยก
# 7. กรอกเลขมิเตอร์น้ำ 150 (เดิม 100), มิเตอร์ไฟ 2500 (เดิม 2000)
# 8. เห็นยอดคำนวณ: น้ำ 50 หน่วย * 20 = 1000, ไฟ 500 หน่วย * 5 = 2500
#    → รวม 3500 บาท
# 9. กด "สร้างบิลน้ำไฟ" → ระบบสร้าง transaction ใหม่ (is_utility_only=true)
# 10. ระบบส่งบิลเข้าไลน์ (ถ้าห้องผูกไลน์ไว้)

# D. เช็คผล
# 11. ไปที่ BillPage (เปิดลิงก์บิล) → เห็นบิลใหม่ที่มีแค่ยอดน้ำไฟ (ไม่มีค่าเช่า)
```

**ผลที่คาดหวัง:**
- Dashboard แสดงการ์ด "ห้องที่ยังไม่ได้ส่งบิลน้ำไฟ (N)" เมื่อมีบิลที่ water_units=0 และ elec_units=0
- กดแล้วเปิด popup รายชื่อห้อง → เลือกห้อง → เปิดฟอร์มกรอกมิเตอร์
- กรอกมิเตอร์ → ออกบิลใหม่ (base_amount=0, เฉพาะยอดน้ำไฟ)
- ส่งเข้าไลน์สำเร็จ (ถ้าผูกไว้)

---

### 4. ทดสอบค่าขั้นต่ำ (min_water_charge / min_elec_charge)

```bash
# Case A: ยอดต่ำกว่าขั้นต่ำ → ใช้ยอดขั้นต่ำ
# 1. ตั้งค่า min_water_charge=100, min_elec_charge=200
# 2. กรอกมิเตอร์น้ำ: เดิม 100 → ใหม่ 101 (ใช้ 1 หน่วย * 20 = 20 บาท)
#    → ควรได้ 100 บาท (ขั้นต่ำ)
# 3. กรอกมิเตอร์ไฟ: เดิม 2000 → ใหม่ 2010 (ใช้ 10 หน่วย * 5 = 50 บาท)
#    → ควรได้ 200 บาท (ขั้นต่ำ)
# 4. ยอดรวม = 100 + 200 = 300 บาท ✅

# Case B: ยอดสูงกว่าขั้นต่ำ → ใช้ยอดจริง
# 1. กรอกมิเตอร์น้ำ: เดิม 100 → ใหม่ 200 (ใช้ 100 หน่วย * 20 = 2000 บาท)
#    → ควรได้ 2000 บาท (ยอดจริง > ขั้นต่ำ 100)
# 2. กรอกมิเตอร์ไฟ: เดิม 2000 → ใหม่ 3000 (ใช้ 1000 หน่วย * 5 = 5000 บาท)
#    → ควรได้ 5000 บาท (ยอดจริง > ขั้นต่ำ 200)
# 3. ยอดรวม = 2000 + 5000 = 7000 บาท ✅
```

**ผลที่คาดหวัง:**
- **Logic:** `waterCost = Math.max(waterUnits * waterRate, minWater)`
- **Logic:** `elecCost = Math.max(elecUnits * elecRate, minElec)`
- Case A: ยอดคำนวณ < ขั้นต่ำ → ใช้ขั้นต่ำ
- Case B: ยอดคำนวณ > ขั้นต่ำ → ใช้ยอดจริง

---

## SQL Migrations

```bash
# 1. Auto verify tenant slips
supabase/migrations/20260917100000_auto_verify_tenant_slips.sql
# - ขยาง slip_verifications รองรับ kind='tenant'
# - เพิ่ม RLS policy + index

# 2. Bill/penalty separation
supabase/migrations/20260917110000_bill_penalty_separation.sql
# - เพิ่มคอลัมน์ bill_day, penalty_day ใน rentals
# - แก้ RPC bill_due_date / penalty_due_date / run_chase

# 3. Utility bill flag
supabase/migrations/20260917120000_utility_bill_flag.sql
# - เพิ่มคอลัมน์ is_utility_only ใน transactions
# - index สำหรับหาบิลน้ำไฟแยก
```

---

## ไฟล์ที่แก้

- `supabase/migrations/20260917100000_auto_verify_tenant_slips.sql` (ใหม่)
- `supabase/migrations/20260917110000_bill_penalty_separation.sql` (ใหม่)
- `supabase/migrations/20260917120000_utility_bill_flag.sql` (ใหม่)
- `src/App.jsx` — logic ค่าขั้นต่ำ + บิลน้ำไฟแยก (มีอยู่แล้ว)
- `src/modals/EditRentalModal.jsx` — ช่อง bill_day/penalty_day/min_water/min_elec (มีอยู่แล้ว)
- `src/modals/UtilityBillModal.jsx` — ฟอร์มกรอกมิเตอร์บิลน้ำไฟแยก (มีอยู่แล้ว)
- `src/modals/UtilityListModal.jsx` — popup รายชื่อห้องที่ยังไม่ส่งบิลน้ำไฟ (มีอยู่แล้ว)

---

## บันทึก

- ข้อ 1-4 ทำงานครบแล้ว — code มีอยู่ก่อนหน้า, migrations ใหม่เพิ่มคอลัมน์ + RPC
- Build ผ่าน ✅ (1.78 MB bundle, no errors)
- ไฟล์เดิมไม่ได้แก้ (logic ค่าขั้นต่ำ + บิลน้ำไฟแยกมีอยู่แล้ว)
