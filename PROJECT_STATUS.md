# PROJECT_STATUS — PayRentPro

> สรุปสถานะโปรเจกต์ ณ ปัจจุบัน (สถาปัตยกรรมแบบ Hybrid: Supabase + Google Sheets)
> อัปเดตล่าสุด: 9/5/2026

---

## 1) โครงสร้างโฟลเดอร์ / ไฟล์ทั้งหมด

```
payrentpro-web/
├── .env                          # ค่าจริง (VITE_WEBHOOK_URL) — ไม่ควร commit
├── .env.example                  # ตัวอย่าง env
├── .gitignore
├── .oxlintrc.json
├── index.html
├── vite.config.js
├── package.json
├── package-lock.json
├── README.md
│
├── src/
│   ├── main.jsx                  # Router (/, /assets, /settings, /audit, /bill/:secure_token)
│   ├── App.jsx                   # หน้าหลัก (Dashboard/Assets/Settings/Audit + modals ทั้งหมด)
│   ├── BillPage.jsx              # หน้าบิลสาธารณะ (เปิดจากลิงก์ secure_token)
│   ├── supabaseClient.js         # ★ Supabase client (version ปัจจุบัน/รายเดือน)
│   ├── payment.js                # รายชื่อธนาคาร + helper bankName()
│   └── index.css
│
├── public/
│   └── favicon.svg
│
└── google-sheets-version/        # ★ Backup โค้ด Google Sheets (ลูกค้าแบบขายขาด)
    ├── apiClient.js              #   fetch → Google Apps Script (แทน supabaseClient)
    └── google-apps-script/
        ├── Code.gs               #   API + LINE Webhook + ระบบทวงเงิน + Google Drive เก็บสลิป
        └── README.md             #   คู่มือ Deploy + ตั้ง Trigger
```

### ไฟล์ที่สร้าง/แก้/ลบ (ตลอดโปรเจกต์)

**สร้าง:**
- `src/supabaseClient.js`
- `google-sheets-version/apiClient.js` (ย้ายมาจาก `src/apiClient.js`)
- `google-sheets-version/google-apps-script/Code.gs`
- `google-sheets-version/google-apps-script/README.md`

**แก้ (หลัก):**
- `src/App.jsx`, `src/BillPage.jsx`, `package.json`, `.env`, `.env.example`

**ลบ/ย้าย:**
- `src/apiClient.js` → ย้ายไป `google-sheets-version/`
- `google-apps-script/` → ย้ายไป `google-sheets-version/`
- `supabase/` (seed_demo.sql, seed_demo_v2.sql, functions/line-binding/index.ts) → **ถูกลบแล้วและยังไม่ restore**

---

## 2) ฟีเจอร์ที่ทำเสร็จ vs ที่วางไว้แต่ยังไม่ทำ

### ✅ ทำเสร็จแล้ว
| ฟีเจอร์ | สถานที่ |
|---------|---------|
| Dashboard (การ์ดสรุป, กราฟ Recharts, ยอดค้าง/รายรับ) | `App.jsx` |
| จัดการสินทรัพย์/สัญญาเช่า (เพิ่ม, ต่อสัญญา, ย้ายออก, ลบ) | `App.jsx` |
| สร้างบิล (ค่าเช่า + ค่าน้ำไฟจากมิเตอร์) | `App.jsx` `handleCreateBill` |
| หน้าบิลสาธารณะ (QR PromptPay / โอนบัญชี) | `BillPage.jsx` |
| ระบบ "รอตรวจสอบสลิป" (อนุมัติ/ปฏิเสธ) + ดูรูปสลิปเต็มจอ | `App.jsx` `PendingReviewSection` |
| ตั้งค่าบัญชีรับเงิน (PromptPay / Bank) | `App.jsx` (SettingsPage/SettingsModal) |
| Export CSV (transactions) ปุ่ม "⬇️ Export CSV" | `App.jsx` `handleExportCsv` |
| ส่งบิลเข้า LINE (ผ่าน Make.com — Supabase version) | `App.jsx` `sendLineWebhook` |
| LINE Webhook รับสลิป + ผูกกลุ่ม + ทวงเงิน cron (Google Sheets version) | `google-sheets-version/.../Code.gs` |

### ⏳ วางไว้แต่ยังไม่ทำ (TODO)
- **EasySlip** (ตรวจสลิปอัตโนมัติ) — ยังไม่เริ่ม
- **Clerk** (Authentication/Login) — ยังไม่มีระบบล็อกอินเลย
- Supabase Edge Function สำหรับส่ง LINE (ถ้าตัดสินใจไม่ใช้ Make.com)
- Restore โฟลเดอร์ `supabase/` (seed SQL + line-binding function)
- ระบบทวงเงินในฝั่ง Supabase version (ตอนนี้มีเฉพาะใน Google Sheets version)

---

## 3) API ภายนอกที่เรียกใช้

| API | เรียกตรงไหน | หมายเหตุ |
|-----|-------------|----------|
| **Supabase** | `src/supabaseClient.js` → `App.jsx` (ตาราง `rentals`/`transactions`/`admins`/`audit_logs`) และ `BillPage.jsx` (RPC `get_bill_by_token`, `submit_payment_claim`) | ผ่าน `@supabase/supabase-js` |
| **Make.com** | `src/App.jsx` `sendLineWebhook()` (ใช้ `VITE_WEBHOOK_URL`) | ใช้ส่งบิลเข้า LINE (Supabase version) |
| **LINE Messaging API** | เฉพาะ Google Sheets version: `google-sheets-version/google-apps-script/Code.gs` (push/reply/content download + webhook) | ใน Supabase version ถูกแทนด้วย Make.com |
| **promptpay.io** | `App.jsx` + `BillPage.jsx` (สร้างรูป QR PromptPay จากเบอร์ + ยอด) | บริการสร้าง QR ภายนอก |
| **EasySlip** | ❌ **ยังไม่มีการเรียกใช้ในโค้ด** | อยู่ในแผนแต่ยังไม่ integrate |
| **Clerk** | ❌ **ยังไม่มีการเรียกใช้ในโค้ด** | อยู่ในแผนแต่ยังไม่ integrate |

---

## 4) ตัวแปร Environment (เฉพาะชื่อ — ไม่ใส่ค่าจริง)

**ฝั่ง React (Vite) — Supabase version ปัจจุบัน**
- `VITE_WEBHOOK_URL` — Webhook URL ของ Make.com

**ฝั่ง React (Vite) — Google Sheets version (backup)**
- `VITE_API_URL` — URL ของ Google Apps Script Web App

**ฝั่ง Google Apps Script (`Code.gs` → `CONFIG`)**
- `SPREADSHEET_ID`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `BILL_BASE_URL`
- `SLIP_FOLDER_NAME`

> ⚠️ หมายเหตุ: Supabase URL และ anon key ปัจจุบัน **hardcode ไว้ใน `src/supabaseClient.js`**
> (ยังไม่ได้แยกเป็น env เช่น `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)

---

## 5) บั๊ก / ปัญหาที่รู้ตัว + TODO ค้างไว้

1. **Supabase URL + anon key hardcode** ใน `supabaseClient.js` — ควรย้ายไป env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
2. **`.env` เก็บค่า Make.com จริง** — แม้ `.gitignore` จะ ignore `.env` แต่ไฟล์ยังมีค่าจริงอยู่ ต้องระวังไม่ commit
3. **ลิงก์บิล hardcode `http://localhost:5173/bill/...`** ใน `App.jsx` + `BillPage.jsx` — ต้องเปลี่ยนเป็นโดเมน production ผ่าน env
4. **คอลัมน์ `slip_image_url`** ในตาราง `transactions` ของ Supabase — ยังไม่แน่ใจว่ามีหรือยัง (ถ้าไม่มี รูปสลิปจะไม่แสดงใน "รอตรวจสอบสลิป")
5. **โฟลเดอร์ `supabase/`** (seed SQL + line-binding Edge Function) ถูกลบไปตอนย้ายไป Google Sheets และยังไม่ได้กู้คืน
6. **EasySlip + Clerk ยังไม่ implement** (ถูกระบุเป็น API ที่จะใช้ แต่ยังไม่มีโค้ด)
7. **การส่ง LINE ใน Supabase version ต้องพึ่ง Make.com** — ต้องตั้ง automation ใน Make.com (action `generate_bill` จาก `App.jsx`) และต้องสร้าง RPC `get_bill_by_token` / `submit_payment_claim` ใน Supabase ให้พร้อมใช้งาน
8. **Google Sheets version: ตาราง `AuditLogs`** อ่านได้แต่ไม่มี path เขียน (หน้า Audit จะว่างเสมอ)
9. **Build warning: bundle > 500 kB** (chunk size) — อาจทำ code-splitting เพิ่ม
10. **Lint warnings 11 รายการ** (`set-state-in-effect`) — เป็น pattern เดิมของโปรเจกต์ ยังไม่แก้ (0 errors)

---

## 6) การตัดสินใจทางเทคนิคสำคัญ

1. **สถาปัตยกรรม Hybrid** — Supabase เป็นฐานข้อมูลหลัก (ลูกค้ารายเดือน) และเก็บโค้ด Google Sheets ไว้ใน `google-sheets-version/` เป็นอีกเวอร์ชัน (ลูกค้าแบบขายขาด)
2. **Google Sheets version ถูกแยกเป็น backup** — `apiClient.js` + `google-apps-script/` ย้ายออกจากโค้ดหลัก เพื่อให้ React หลักกลับไปผูก Supabase ล้วนๆ
3. **การส่ง LINE** — สองแนวทางแยกตามเวอร์ชัน: Supabase version ใช้ **Make.com** webhook, Google Sheets version ใช้ **LINE Messaging API** ตรงจาก Apps Script
4. **Apps Script CORS workaround** — React เรียก Apps Script ด้วย `Content-Type: text/plain` เพื่อเลี่ยง CORS preflight (Apps Script ไม่รองรับ OPTIONS)
5. **CSV Export ใส่ BOM (`\uFEFF`)** — ให้เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน
6. **สลิปเก็บเป็น URL** — Google Sheets version บันทึกรูปสลิปลง Google Drive แล้วเก็บ `slip_image_url`; ฝั่ง React โชว์รูปตามคอลัมน์ `slip_image_url`
7. **ID ใน Google Sheets เป็น string เรียงลำดับ** (1, 2, 3…) แทน UUID — เพื่อให้โค้ด `.slice(0,8)` ที่ใช้ทำเลข INV ทำงานได้
8. **QR PromptPay ใช้บริการภายนอก `promptpay.io`** แทนการสร้าง QR เอง
9. **React 19 + Vite 8 + Tailwind 4 + Recharts 3** เป็นสแตกหลักของ frontend
10. **หน้าบิลใช้ Supabase RPC (Postgres function)** — `get_bill_by_token` รวมข้อมูลบิล + ข้อมูลรับเงินใน object เดียว และ `submit_payment_claim` อัปเดตสถานะแบบ atomic (กันแจ้งชำระซ้ำ) แทนการ query + update + webhook ที่ฝั่ง client
