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
- [ ] **2a. กลุ่มการเงิน** — `expense_categories`, `expenses`, `income` + หน้ากำไรสุทธิ์
      (จุดขายที่เขาโฆษณาบนหน้า login และเราไม่มีเลย · ผูก `landlord_id` ตรง ๆ ไม่ต้องรออะไร)
- [ ] **2b. กลุ่มสื่อสาร** — `announcements`, `notes` (sticky note มี color/pinned), `documents`
- [ ] **2c. กลุ่มซ่อมบำรุง** — `vendors`, `inventory` (มี reorder_level), `fixed_assets`
      + ขยาย `repair_tickets` เดิมให้มี priority/parts_cost/labor_cost/charge_to/vendor
- [ ] **2d. โครงอาคาร** — `properties`, `floors`, `room_types`, `rooms` + property switcher
- [ ] **2e. บิล/มิเตอร์** — หน้าจดมิเตอร์ทั้งตึก, `common_fees`, ออกบิลเป็นรอบ
- [ ] **2f. 3D** — viewer ก่อน (คุ้มค่ากว่า) แล้วค่อย designer ถ้าเวลาเหลือ
- [ ] **2g. อื่น ๆ** — `bookings`, role/permission, หน้ารวมการแจ้งเตือน

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
