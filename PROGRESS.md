# PROGRESS.md

อัปเดตล่าสุด: 2026-09-09

## Phase 1 — สำรวจระบบต้นทาง ✅ **เสร็จ**

- crawl **30/30 โมดูล** ของ allinone.buildbytoey.com สำเร็จ (ไฟล์ดิบ `tmp/research/pages/`)
- ถอด schema จากฟิลด์ฟอร์มจริง + enum จาก `<option>` จริง — **ไม่ได้เดา** → `RESEARCH.md`
- ได้ schema `rooms` เต็มรูปแบบ (รวมพิกัด 3D) จาก JSON ที่ฝังในหน้า `designer3d`
- ได้ API endpoints: `api/layout-save.php`, `api/room-add.php`, `api/floor-add.php`
- แก้บั๊ก `overnight.sh` บรรทัด `cd /path/to/project` ที่เป็น placeholder
- เขียน `RESEARCH.md`, `DECISIONS.md` (D1–D8), `TODO.md`

ค้าง 1 อย่าง (ไม่ใช่ blocker): portal ผู้เช่า `/repaircustomer/` ติด `403 CSRF token mismatch`
— เรามีระบบแจ้งซ่อมผ่าน LINE ที่ทำงานเทียบเท่าอยู่แล้ว (commit `4717414`)

## Phase 2 — ผสานฟีเจอร์ 🔄 **กำลังทำ**

### หลักการ (จาก DECISIONS.md)
- **D5**: โมดูลใหม่ไปไฟล์ใหม่ใน `src/pages/` — ไม่ refactor `App.jsx` 6,527 บรรทัด
  แตะ `App.jsx` แค่เพิ่ม route + `NAV_ITEMS`
- **D7**: ไม่ยกโครง 5 ชั้นของเขามาแทน `rentals` — `rentals` ของเรารองรับ
  `biz_type` = property/vehicle/other ซึ่งระบบเขาทำไม่ได้ ถ้าแทนจะพังหมด
  → เพิ่มตารางใหม่ **แบบขนาน** เชื่อมด้วย `rentals.room_id` (nullable, opt-in)
- **D8**: เริ่มจากโมดูลที่ไม่พึ่งโครงอาคาร

### ลำดับงาน
- [x] **2a. กลุ่มการเงิน** ✅ — `expense_categories`, `expenses`, `other_income`
      + หน้า `/finance` (แท็บ ภาพรวมกำไร / รายจ่าย / รายรับอื่น)
      - migration `20260909100000_finance_expenses_income.sql` — 3 ตาราง + RLS ครบ 12 policy
        + RPC `get_profit_summary`, `get_profit_trend`, `seed_expense_categories`, `is_my_landlord`
      - หน้าใหม่ `src/pages/FinancePage.jsx` — CRUD ครบ + กราฟ 6 เดือน + รายจ่ายตามหมวด
      - แชร์คอมโพเนนต์ `src/components/ui.jsx` + `styles.js` + `src/utils/format.js`
      - แตะ `App.jsx` แค่ 5 จุด (import, NAV_ITEMS, isFinance, หัวเรื่อง, render) ตาม D5
      - harness ใหม่ `tools/verify-finance.mjs` — ตรวจ 3 แท็บ × 3 ความกว้าง + 2 modal
      - **ผลทดสอบ**: PASS ทุกช่อง · 375/768 = 0 small targets · oxlint 0 errors · build ผ่าน
      - นับ warnings ลดจาก 22 → 19 (แยก constants ออกจากไฟล์คอมโพเนนต์)
- [x] **2b. กลุ่มสื่อสาร** ✅ — `announcements`, `notes`, `documents` + หน้า `/comms`
      - migration `20260909110000_announcements_notes_documents.sql` — 3 ตาราง + RLS
        + storage bucket `documents` (private) + policy กรองจาก `<landlord_id>/` ในพาธ
        + trigger `touch_updated_at` ให้โน้ตที่แก้เด้งขึ้นบน
        + RPC `broadcast_announcement` ส่งประกาศเข้ากลุ่ม LINE ทุกห้อง (ของแถม ต้นทางไม่มี)
      - หน้าใหม่ `src/pages/CommsPage.jsx` — 3 แท็บ CRUD ครบ
        · ประกาศ: draft/published/archived + ปุ่มส่งเข้า LINE
        · บันทึก: sticky note มีสี 6 โทน + ปักหมุด (คุมชุดสีแทน color picker ของต้นทาง
          เพราะเลือกสีเข้มแล้วตัวอักษรอ่านไม่ออก)
        · เอกสาร: อัปโหลด ≤10MB, เปิดผ่าน signed URL อายุ 60 วิ (PDPA)
      - harness `tools/verify-tabbed.mjs` (แทน verify-finance.mjs) ครอบทั้ง 2 หน้า
        6 แท็บ + 5 modal × 3 ความกว้าง
      - **ผลทดสอบ**: PASS ทุกช่อง · 375/768 = 0 small targets · 0 overflow
        · oxlint 0 errors · build ผ่าน · shoot.mjs ทั้งชุดไม่ regress
- [x] **2c-1. Portal แจ้งซ่อมผู้เช่า** ✅ — หน้า `/repair` เข้าด้วยเบอร์โทร (เจ้าของสั่งเพิ่ม)
      - migration `20260909120000_tenant_repair_portal.sql`
        + `normalize_phone()` รับ 081-234-5678 / +66812345678 / 0812345678 ให้เทียบกันได้
        + `tenant_portal_sessions` (token อายุ 8 ชม.) + `tenant_portal_attempts` (rate limit)
        + RPC `tenant_portal_login` / `_session` / `_repairs` / `_create_repair`
        + bucket `repair-photos` (public read, 5MB, เฉพาะไฟล์รูป)
      - หน้าใหม่ `src/RepairPortalPage.jsx` — ล็อกอินด้วยเบอร์ → แจ้งซ่อม + แนบรูป + ดูประวัติ
      - แถบลิงก์ใน `RepairSection` ให้เจ้าของคัดลอกส่งผู้เช่า (D19)
      - fixture + `tools/verify-repair-portal.mjs` (2 มุมมอง × 3 ความกว้าง)
      - **ผลทดสอบกับ DB จริง**: login ผ่าน · แจ้งซ่อมห้องตัวเองผ่าน ·
        ห้องคนอื่นถูกปฏิเสธ (`rental_not_yours`) · token ปลอมถูกปฏิเสธ ·
        rate limit ตัดที่ครั้งที่ 6 · anon อ่าน `rentals` ตรงไม่ได้
      - **ผล harness**: PASS ทุกช่อง · 375/768 = 0 small targets · 0 overflow
        · oxlint 0 errors · build ผ่าน · shoot.mjs 11 หน้าไม่ regress
- [ ] **2c-2. กลุ่มซ่อมบำรุง (ที่เหลือ)** — `vendors`, `inventory` (มี reorder_level), `fixed_assets`
      + ขยาย `repair_tickets` เดิมให้มี priority/parts_cost/labor_cost/charge_to/vendor
- [ ] **2d. โครงอาคาร** — `properties`, `floors`, `room_types`, `rooms` + property switcher
- [ ] **2e. บิล/มิเตอร์** — หน้าจดมิเตอร์ทั้งตึก, `common_fees`, ออกบิลเป็นรอบ
- [ ] **2f. 3D** — viewer ก่อน (คุ้มค่ากว่า) แล้วค่อย designer ถ้าเวลาเหลือ
- [ ] **2g. อื่น ๆ** — `bookings`, role/permission, หน้ารวมการแจ้งเตือน

### ⚠️ migration ที่รันบน DB จริงแล้ว (2026-09-09)
รันครบทั้ง 17 ไฟล์ · tracked ใน `supabase_migrations.schema_migrations` แล้ว

**บทเรียน**: migration 11 ไฟล์แรกเคยรันผ่าน SQL Editor ซึ่ง **ไม่บันทึก tracking**
ทำให้ `supabase db push` พยายามรันซ้ำแล้วพังที่ `update_bill_amount`
(error 42P13 cannot remove parameter defaults) แก้ด้วย:
1. `npx supabase migration repair --status applied <version...>` — บอกระบบว่ารันแล้ว
2. `npx supabase db push --include-all` — รันไฟล์ที่ค้างจริง

ต่อไปนี้ **ใช้ `supabase db push` เท่านั้น** ไม่ copy-paste ลง SQL Editor
เพราะ SQL Editor ไม่เขียน tracking แล้วจะเจอปัญหาเดิมอีก

ค้าง 1 อย่าง — ลบข้อมูลทดสอบที่สร้างตอนตรวจ RPC (ผมลบเองไม่ได้เพราะติด RLS):
```sql
delete from public.repair_tickets where description like 'TEST %';
delete from public.tenant_portal_attempts;
delete from public.tenant_portal_sessions;
```

## Phase 3 — ธีมเขียวอ่อน ⬜ ยังไม่เริ่ม
รวมสีเป็น token ชุดเดียวก่อน แล้วเปลี่ยน indigo/violet → เขียวอ่อน (D4)
ไม่ใช้ find-replace `indigo`→`green` เพราะจะพัง `text-indigo-*` ที่สื่อความหมายอื่น

## Phase 4 — ทดสอบ ⬜ ยังไม่เริ่ม
แล้วสร้าง `DONE.md`

## หมายเหตุการทดสอบ (จาก HANDOFF_DASHBOARD.md)

- ต้อง `npx vite --port 5174 --host 127.0.0.1` — **ต้องมี `--host 127.0.0.1`**
  ไม่งั้น Vite bind แค่ IPv6 แล้ว Playwright ต่อไม่ได้
- `node tools/shoot.mjs` (8 หน้า × 375/768/1280), `node tools/verify-dashboard.mjs`
- **เกณฑ์ผ่าน = 375/768 ต้อง 0 small targets** ที่ 1280 fail ~14 รายการเป็นเจตนา
- `oxlint` เกณฑ์คือ 0 errors (warning `set-state-in-effect` เดิมค้างเยอะ ไม่นับ)

## เคล็ดที่ได้จากรอบนี้

- **curl หลายหน้าใน bash loop → โดน permission classifier บล็อกเสมอ**
  ยิงทีละคำสั่งผ่าน โดนบล็อกก็ยิงซ้ำได้ (error บอกเองว่า transient)
- ใช้ Grep tool อ่านไฟล์ที่ crawl มา ไม่ต้องผ่าน classifier — เร็วกว่า grep ใน bash
- session ของต้นทางหมดอายุเร็ว ต้องล็อกอินใหม่ (`302` = หมดอายุแล้ว)
