# Implementation Plan — สถานะล่าสุด (2026-09-18)

## ✅ ทำเสร็จแล้วทั้งหมด

### #10 [Font ไทยใน PDF] Sarabun Embedded — ✅ เสร็จ + ทดสอบแล้ว
- ดาวน์โหลด Sarabun TTF 3 น้ำหนัก (Regular/SemiBold/Bold) → `public/fonts/`
  (jsPDF รองรับเฉพาะ TTF — woff2 ใช้ไม่ได้)
- `src/utils/receipt.js`: fetch TTF → base64 → addFileToVFS/addFont (cache ทั้ง session, fallback helvetica)
- `createReceiptPdf` เป็น async แล้ว — caller เดียวคือ `issueReceiptAndSend` (await แล้ว)
- ทดสอบจริง: jsPDF embed FontFile2 ×2, render ผ่าน pdf.js → สระ/วรรณยุกต์/฿ ถูกต้องไม่มี tofu

### #5 [ใบเสร็จในกลุ่ม] Auto Receipt after EasySlip — ✅
- line-webhook `autoVerifyTenantSlip` อัปเดต slip_verified/verified_at แล้วเรียก
  RPC `send_receipt_to_line` ตรง ๆ

### #6 [จ่ายสด] Cash Payment — ✅ + smoke test ผ่าน
- `handleMobileMarkCash(source, cashAmount)` รับได้ทั้ง rental (หน้าค้างชำระ)
  และ transaction (หน้ารอตรวจสลิป)
- audit_logs ใช้ schema จริง (transaction_id/old_amount/new_amount/reason)
- ปิดบิล + paid_amount + remaining_balance=0 + payment_method='cash' + ออกใบเสร็จส่ง LINE
- MobileSlipReview แก้ฟิลด์จริง: slip_image_url / total_amount / rentals.cust_name

### #7 [เตือนด่วน] การ์ดแดง 3+ วัน — ✅ + smoke test ผ่าน
- การ์ดแดงเข้ม "⚠️ ค้างเกิน 3 วัน" + หน้า urgent (แชร์ MobileOverdueList กับ filter)
- เรียงตามวันค้างมาก→น้อย, badge แดงทึบเกิน 3 วัน

### #8 [เดโม 3 ธุรกิจ] Seed — ✅ (แก้ชื่อคอลัมน์ให้ตรง schema จริง)
- `20260918000001_seed_demo_3business.sql`:
  - cust_contact→tenant_phone, cust_id_card→tenant_id_card,
    penalty_rate→penalty_per_day
  - ตัด due_date ออกจาก transactions (คอลัมน์ไม่มีจริง) — วันครบกำหนดคำนวณ
    จาก period+bill_day แทน
  - bill_day คำนวณจาก current_date ให้ "ค้าง 3/1/5 วัน" จริงตามชื่อห้อง
- `20260918000000_tx_payment_method_columns.sql` (ใหม่): เพิ่ม slip_verified /
  verified_at / payment_method ให้ transactions — ต้องรันก่อน seed

### #9 [ลิงก์บอท] Bot Add URL — ✅ (session ก่อน)
- แก้ hook order lint error ใน LineBindingModal (ย้าย early return หลัง useEffect)

## 🔧 งานแถมที่แก้ระหว่างทาง (บั๊กเดิม)
1. **fetchRentals ไม่ embed transactions** → หน้ามือถือค้างชำระ/การ์ดแดง/จ่ายสด
   ว่างตลอดตั้งแต่ก่อนหน้านี้ → embed `transactions(...)` แล้ว (ยกเว้น due_date ที่ไม่มีใน DB)
2. **normalizeStatus('unpaid') ชน 'paid'** ('unpaid'.includes('paid')) → บิลค้างถูก
   แสดง "ชำระแล้ว" → เช็ค exact match ก่อน substring แล้ว
3. **isBillOpen(tx)** ใหม่ใน utils/format.js — draft ไม่นับเป็นค้างชำระ/ทวงหนี้
   ใช้แทน `tx.status !== 'paid'` ทุกจุด + STATUS_LABELS เพิ่ม draft/รอตรวจสลิป
4. **billDueDate(period, billDay)** ใหม่ใน utils/period.js — มิเรอร์ DB,
   local billDueDate(tx, fallbackRental) ใน App ใช้ bill_day ก่อน due_date
5. fetchPendingUtilityBills ข้ามบิล draft ตอนหา "บิลล่าสุดของห้อง"

## ตรวจรับประทาน
- `npm run build` ✅ / `npm run lint` 0 errors ✅
- e2e ผ่าน playwright (บัญชีเดโม่): การ์ดแดง 9 รายการ, ค้างชำระ 9 ห้อง,
  เรียงวันค้างถูก, ปุ่มจ่ายสดครบ, ไม่มี page error
