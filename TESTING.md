# วิธีทดสอบตรวจสลิปผู้เช่าอัตโนมัติ

## เตรียมความพร้อม

1. **Deploy migration ใหม่**
   ```bash
   supabase db push
   ```
   หรือรันใน SQL Editor:
   ```sql
   -- supabase/migrations/20260917100000_auto_verify_tenant_slips.sql
   ```

2. **เช็คว่า Edge Function มี EASYSLIP_API_KEY**
   ```bash
   supabase secrets list
   ```
   ถ้ายังไม่มี:
   ```bash
   supabase secrets set EASYSLIP_API_KEY=your_key_here
   ```

3. **Deploy Edge Function**
   ```bash
   supabase functions deploy line-webhook
   ```

## ขั้นตอนทดสอบ

### 1. ทดสอบ Flow ปกติ (ยอดตรง → ปิดบิลทันที)

1. เข้าหน้าเว็บสร้างบิลให้ห้องที่ผูกไลน์แล้ว (เช่น ฿5,000)
2. **ส่งสลิปโอนจริง** ในกลุ่มไลน์ที่ผูกไว้
   - ยอดโอน **ตรง** กับบิล (≥ 5,000)
   - ใช้สลิปที่ไม่เคยส่งมาก่อน (ไม่ซ้ำ txnRef)
3. **ตรวจสอบ**:
   - ได้ข้อความตอบกลับ: `รับการชำระเงินแล้ว ✅ ยอด ฿5,000`
   - ได้**รูปใบเสร็จ**ส่งเข้ากลุ่มทันที (ถ้า generateAndUploadReceipt ทำเสร็จแล้ว)
   - บิลใน DB เป็น `status='paid'` + `paid_amount=5000`
   - มีแถวใหม่ใน `slip_verifications` (kind='tenant', txn_ref=...)

### 2. ทดสอบยอดไม่ตรง (< ยอดบิล)

1. สร้างบิลใหม่ ฿7,000
2. **ส่งสลิปยอดน้อยกว่า** เช่น ฿5,000
3. **ตรวจสอบ**:
   - ได้ข้อความ: `ได้รับสลิปแล้ว กำลังตรวจสอบ ⏳ (ยอดสลิป ฿5,000 ไม่ตรงกับบิล ฿7,000)`
   - บิลอยู่ที่ `status='pending_review'` (รอเจ้าของอนุมัติ)
   - **ไม่ได้**ใบเสร็จ

### 3. ทดสอบสลิปซ้ำ (txnRef ซ้ำ)

1. ใช้สลิปใบเดิมที่เคยส่งไปแล้วใน case 1
2. ส่งสลิปนั้นอีกครั้ง
3. **ตรวจสอบ**:
   - ได้ข้อความ: `ได้รับสลิปแล้ว กำลังตรวจสอบ ⏳ (ระบบตรวจพบสลิปซ้ำ รอเจ้าของตรวจสอบ)`
   - บิลอยู่ที่ `status='pending_review'`
   - **ไม่มี**แถวใหม่ใน `slip_verifications` (unique constraint ชน)

### 4. ทดสอบอ่านสลิปไม่ออก

1. ส่งรูปที่**ไม่ใช่สลิป** (เช่น รูปถ่ายทั่วไป)
2. **ตรวจสอบ**:
   - ได้ข้อความ: `ได้รับสลิปแล้ว กำลังตรวจสอบ ⏳`
   - บิลอยู่ที่ `status='pending_review'`
   - EasySlip log error: `read_failed`

### 5. ทดสอบรูปซ่อมไม่ถูกยิง EasySlip

1. พิมพ์ `แจ้งซ่อม แอร์เสีย` ในกลุ่ม
2. ส่งรูปภายใน **10 นาที**
3. **ตรวจสอบ**:
   - รูปถูกเก็บใน `repair_tickets.photo_url`
   - **ไม่ถูก**ยิงเข้า EasySlip (ไม่มี log ตรวจสลิป)
   - ไม่มีแถวใหม่ใน `slip_verifications`

## ตรวจสอบ Log

```bash
supabase functions logs line-webhook --tail
```

ดู log:
- `Auto-approved bill <id>, amount <ยอด>` = ปิดบิลสำเร็จ
- `amount mismatch: slip X < expected Y` = ยอดไม่ตรง
- `duplicate slip blocked: <txnRef>` = สลิปซ้ำ
- `EasySlip could not read slip` = อ่านไม่ออก

## ตรวจสอบ Database

```sql
-- ดูสลิปที่ตรวจผ่านแล้ว (kind='tenant')
SELECT * FROM slip_verifications 
WHERE kind = 'tenant' 
ORDER BY verified_at DESC;

-- ดูบิลที่ปิดอัตโนมัติ
SELECT id, rental_id, total_amount, paid_amount, status, created_at
FROM transactions
WHERE status = 'paid' AND paid_amount = total_amount
ORDER BY created_at DESC;
```

## หมายเหตุ

- **Receipt generation** ยังไม่ได้ทำ (generateAndUploadReceipt return null)
  → ข้อความบอก "ใบเสร็จส่งให้แล้ว" จะไม่แสดง แต่ logic ตรวจสลิปทำงานครบ
- **EasySlip API key** ต้องมีเครดิตพอ (แต่ละครั้งตัด 1 เครดิต)
- **Flow เดิม** (รอเจ้าของอนุมัติ) ยังทำงานตามเดิม ถ้ายอดไม่ตรง/อ่านไม่ออก/ซ้ำ
