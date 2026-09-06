# PayRentPro — Google Apps Script Backend

สคริปต์นี้ทำหน้าที่แทน Supabase + Make.com โดยเป็นทั้ง API สำหรับ React
และ Webhook ของ LINE Messaging API

## ไฟล์
- `Code.gs` — โค้ดทั้งหมด (API + LINE Webhook + Google Drive เก็บสลิป)

## ขั้นตอน Deploy

### 1. สร้าง Google Sheets
สร้าง Spreadsheet ใหม่ (หรือใช้ที่มีอยู่) ชื่อ Sheet จะถูกสร้างอัตโนมัติ:
`Rentals`, `Transactions`, `Admins` (และ `AuditLogs` ทางเลือก)

### 2. สร้าง Apps Script
ใน Spreadsheet → เมนู **Extensions → Apps Script**
วางโค้ดใน `Code.gs`

### 3. ตั้งค่า CONFIG
ใน `Code.gs` ด้านบน ให้กรอก:
- `SPREADSHEET_ID` — (ไม่บังคับถ้าเป็น bound script) เอา ID จาก URL Spreadsheet
- `LINE_CHANNEL_ACCESS_TOKEN` — จาก LINE Developers Console
- `BILL_BASE_URL` — โดเมนจริงของเว็บ (ใช้ทำลิงก์บิลในข้อความ LINE)

### 4. Deploy เป็น Web App
- Deploy → New deployment → Web app
- Execute as: **Me**
- Who has access: **Anyone**
- คัดลอก Web App URL

### 5. ตั้งค่า React
ใน `.env` ของโปรเจกต์ React:
```
VITE_API_URL=<Web App URL จากข้อ 4>
```

### 6. ตั้งค่า LINE Webhook (สำหรับรับสลิป + ผูกกลุ่ม)
ใน LINE Developers Console (Messaging API channel):
- ใส่ Webhook URL = `<Web App URL จากข้อ 4>`
- เปิด Webhook (Use webhook)

## วิธีทำงานของ LINE

| เหตุการณ์ | สิ่งที่สคริปต์ทำ |
|-----------|------------------|
| ผู้เช่าส่ง **ข้อความรหัสผูก 9 หลัก** เข้ากลุ่ม | ผูก `group_id` เข้ากับ `rentals.binding_code` ที่ตรงกัน แล้วตอบกลับ "ผูกสำเร็จ" |
| ผู้เช่าส่ง **รูปภาพ (สลิป)** เข้ากลุ่ม | ดาวน์โหลดรูปจาก LINE API → บันทึกลง Google Drive → อัปเดต `slip_image_url` + เปลี่ยนสถานะบิลเป็น `pending_review` |

## ระบบทวงเงิน (Chase)

มี 2 โหมด:

| โหมด | วิธีเปิดใช้ |
|------|-------------|
| **Manual** | กดปุ่ม "📤 ส่งบิล/ทวงเงินทั้งหมด" ในหน้า Dashboard ของ React → เรียก action `send_chase` |
| **อัตโนมัติ (Cron)** | ตั้ง Trigger ให้ `sendChaseMessages()` ทำงานทุกวัน 08:00 น. |

### ตั้งเวลาทวงเงินอัตโนมัติ (ทุกวัน 08:00 น.)
1. เปิด Apps Script Editor
2. เลือกฟังก์ชัน `installDailyChaseTrigger` จาก dropdown แล้วกด **Run**
3. อนุญาตสิทธิ์ (Authorization) เมื่อระบบถาม
4. Trigger จะถูกสร้างให้เรียก `sendChaseMessages()` ทุกวัน 08:00 น.

> ⏰ **สำคัญ**: เวลาจะอิงตาม Timezone ของสคริปต์ ตรวจสอบได้ที่
> **Project Settings → General → Time zone** (ตั้งเป็น `Asia/Bangkok`)
> หรือแก้ไฟล์ `appsscript.json` เป็น `"timeZone": "Asia/Bangkok"`

### หลักการทำงาน
`sendChaseMessages()` จะ:
1. ดึงบิลทั้งหมดที่มีสถานะ `unpaid`
2. จับคู่ `rental_id` → หา `group_id` ของผู้เช่า
3. ส่ง LINE Push Message "แจ้งเตือนค่าเช่า" เข้ากลุ่มของผู้เช่าแต่ละคน
4. คืนค่า `{ sent, skipped, failed, details }` เพื่อให้เว็บแสดงผล (ข้ามรายการที่ยังไม่ผูก LINE Group)

## API Actions (ที่ React เรียก)
`get_rentals`, `get_transactions`, `get_admins`, `get_audit_logs`,
`save_admin`, `insert_rental`, `update_rental`, `delete_rental`,
`insert_transaction`, `update_transaction`, `send_line_bill`, `send_chase`

> หมายเหตุ: React เรียก API ด้วย `POST` + `Content-Type: text/plain`
> เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
