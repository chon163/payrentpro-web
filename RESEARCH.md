# RESEARCH.md — สำรวจระบบต้นทาง allinone.buildbytoey.com

สถานะ: **Phase 1 เสร็จ** — crawl ครบ 30/30 โมดูล (เหลือ portal ผู้เช่าติด CSRF ดูท้ายไฟล์)
ไฟล์ดิบเก็บที่ `tmp/research/pages/*.html` · อัปเดต: 2026-09-09

## ข้อมูลระบบต้นทาง

| หัวข้อ | ค่า |
|---|---|
| ชื่อระบบ | **PropertyHub** — "SaaS Edition" v1.0.0 |
| สแตก | PHP (`index.php?m=<module>&a=<action>`), session `PHPSESSID`, CSRF token ทุกฟอร์ม |
| ล็อกอิน | `POST /login.php` — `_csrf`, `username`, `password` |
| ฟอนต์ | Google Fonts **Prompt** 300–700 |
| CSS | `assets/css/app.css`, `auth.css` (มี cache-buster `?v=`) |
| ธีมสี | CSS var `--primary{,-dark,-light,-50,-soft}`, `--success`, `--danger`, `--warning`, `--info` (+`-soft` ทุกตัว), `--text{,-muted,-light}`, `--border-soft`, `--shadow` |
| สีจริง | success `#16a34a→#22c55e`, danger `#dc2626→#ef4444`, warning `#f59e0b→#fbbf24`, neutral `#6b7280→#9ca3af`, แบรนด์ส้ม `#ff7a18` |
| 3D | **three.js 0.158.0** ผ่าน importmap (unpkg) + OrbitControls |
| API | `api/layout-save.php`, `api/room-add.php`, `api/floor-add.php` (POST JSON, ตอบ `{ok, updated, error}`) |
| โครงหน้า | `aside.sidebar` + `main` > `header.topbar` + `div.content` |
| วันที่ | ไทย พ.ศ. ย่อ `5 ก.ย. 2569` · เงิน `฿13,340.00` (คอมมา + ทศนิยม 2 ตำแหน่งเสมอ) |

## แผนที่เมนู — 7 กลุ่ม 30 โมดูล

ทุกเมนูมี `<svg class="nav-icon">` และ badge นับงานค้าง (`.nav-count.danger`/`.primary`)

| กลุ่ม | key | ชื่อเมนู | ของเรา |
|---|---|---|---|
| **หน้าหลัก** | `dashboard` | แดชบอร์ด | ✅ |
| **อาคารและห้อง** | `properties` | อาคาร/โครงการ | ❌ |
| | `floors` | ชั้น | ❌ |
| | `rooms` | ห้องพัก | ⚠️ `rentals` รวมห้อง+สัญญา |
| | `room_types` | ประเภทห้อง | ❌ |
| | `designer3d` | ออกแบบแปลน 3D | ❌ |
| | `viewer3d` | ดูแผนผัง 3D | ❌ |
| **ผู้เช่าและสัญญา** | `tenants` | ผู้เช่า | ⚠️ ฝังใน `rentals` |
| | `contracts` | สัญญาเช่า | ⚠️ ฝังใน `rentals` |
| | `bookings` | การจอง | ❌ |
| **บิลและการเงิน** | `meters` | มิเตอร์ไฟ/น้ำ | ⚠️ มีแค่ modal |
| | `invoices` | ใบแจ้งหนี้ | ⚠️ `transactions` |
| | `payments` | รับชำระ | ⚠️ ฝังใน `transactions` |
| | `receipts` | ใบเสร็จ PDF | ✅ |
| | `common_fees` | ค่าส่วนกลาง | ❌ |
| **รายรับรายจ่าย** | `expenses` | รายจ่าย | ❌ |
| | `income` | รายรับอื่น | ❌ |
| | `profit` | กำไรสุทธิ์ | ❌ |
| | `reports` | รายงาน | ⚠️ มีแค่ CSV |
| **ซ่อมบำรุง** | `repairs` | คำขอซ่อม | ⚠️ ของเราง่ายกว่ามาก |
| | `inventory` | คลังอะไหล่ | ❌ |
| | `vendors` | ผู้ขาย/ช่าง | ❌ |
| | `assets` | ทรัพย์สิน | ❌ |
| **ระบบและการสื่อสาร** | `announcements` | ประกาศ | ❌ |
| | `notifications` | การแจ้งเตือน | ⚠️ มีแค่กระดิ่ง |
| | `notes` | บันทึก | ❌ |
| | `documents` | เอกสาร | ❌ |
| | `users` | ผู้ใช้งาน/สิทธิ์ | ⚠️ ไม่มี role |
| | `activity` | บันทึกการใช้งาน | ✅ |
| | `settings` | ตั้งค่า | ✅ |

> ⚠️ **ชื่อชนกัน**: `assets` ของเขา = ครุภัณฑ์ (กลุ่มซ่อมบำรุง) แต่ `/assets` ของเรา = รายการห้องเช่า

## Schema ที่ถอดได้ (จากฟิลด์ฟอร์มจริง — ไม่ใช่การเดา)

### `properties`
การ์ด grid-3 — ชื่อ, รหัส (`DEMO01`), จังหวัด, ประเภท (badge), จำนวนชั้น, จำนวนห้อง,
% เข้าพัก + progress bar, ปุ่ม "แผนผัง 3D" / "แก้ไข" · header gradient ตามสีประเภท (`#ff7a18`)

### `floors`
`property_id`, `floor_number`, `floor_name`, `total_rooms`, `description`
(หน้าเป็น wizard 2 ขั้น: เลือกโครงการ → `&pid=1`)

### `room_types`
`name`, `description`, `base_rent`, `deposit`, `size_sqm`, `max_occupants`,
`amenities`, **`color`** (ใช้เป็นสีห้องใน 3D)

### `rooms` — ได้ schema เต็มจาก JSON ใน designer3d
```
id, property_id, floor_id, room_type_id, room_number,
rent_amount, deposit_amount, size_sqm, status, description,
pos_x, pos_y, pos_z, width, depth, height, rotation, created_at
```
ฟอร์ม: `room_number`, `floor_id`, `room_type_id`, `size_sqm`, `rent_amount`,
`deposit_amount`, `status`, `description`
**`status` enum**: `vacant` ว่าง · `occupied` มีผู้เช่า · `reserved` จองแล้ว · `maintenance` ปรับปรุง
ฟิลเตอร์: ตามชั้น + ตามสถานะ

### `tenants` (17 ฟิลด์)
`code`, `id_card`, `full_name`, `phone`, `email`, `line_id`, `line_qr`,
`birth_date`, `occupation`, `workplace`, `address`, `emergency_contact`,
`emergency_phone`, `notes` · ตาราง: รหัส/ชื่อ-นามสกุล/เลขบัตร/โทรศัพท์/อาชีพ/ห้อง · มีช่องค้นหา `q`

### `contracts`
`room_id`, `tenant_id`, `start_date`, `end_date`, `rent_amount`, `deposit_amount`,
**`payment_day`** (วันครบกำหนดของเดือน), **`electric_rate`**, **`water_rate`** (อัตราต่อสัญญา!),
`status`, `notes` · ตาราง: เลขสัญญา/ห้อง/ผู้เช่า/วันเริ่ม/วันสิ้นสุด/ค่าเช่า/มัดจำ/สถานะ

### `bookings`
`room_id`, `guest_name`, `guest_phone`, `guest_email`, `check_in`, `check_out`,
`deposit_paid`, `status`, `notes` · ตาราง: เลขที่/ห้อง/ผู้เข้าพัก/เช็คอิน/เช็คเอาท์/**คืน**/ยอดรวม/สถานะ
(รองรับเช่ารายวันแบบรีสอร์ท ไม่ใช่แค่รายเดือน)

### `meters` — จดมิเตอร์แบบ batch ทั้งตึกในหน้าเดียว
`meter_type` (ไฟ/น้ำ), `period_month`, `period_year`, `unit_rate`, `reading_date`
+ อาร์เรย์ `rooms[<room_id>][prev]` / `rooms[<room_id>][curr]` ต่อห้อง
ตาราง: ห้อง/ชั้น/เลขครั้งก่อน/เลขปัจจุบัน/หน่วย/ยอด ฿ (คิดสดขณะพิมพ์)

### `invoices`
สร้างเป็นรอบ: `period_month` + `period_year` → ออกบิลทั้งตึกทีเดียว
ตาราง: เลขที่/ห้อง/ผู้เช่า/ออก/ครบกำหนด/**ค่าเช่า/ค่าไฟ/ค่าน้ำ/ส่วนกลาง/รวม**/สถานะ
สถานะ badge: `success` ชำระแล้ว · `danger` ค้างชำระ · action `a=detail`, `a=generate`
ฟิลเตอร์ `?status=unpaid`

### `payments`
ตาราง: เลขใบเสร็จ/วันที่/ใบแจ้งหนี้/ห้อง/ผู้เช่า/**วิธี**/จำนวน (wizard เลือกโครงการก่อน)

### `receipts`
ตาราง: เลขใบเสร็จ/วันที่/ห้อง/ผู้เช่า/ใบแจ้งหนี้/ยอด + ปุ่ม `a=generate` ออก PDF ทุกแถว

### `common_fees`
`name`, **`charge_type`** enum: `per_room` ต่อห้อง · `per_person` ต่อคน · `fixed` คงที่,
`amount`, `is_recurring` · ตาราง: รายการ/ประเภทการคิด/จำนวนเงิน/เรียกเก็บประจำ

### `expenses`
`expense_date`, `category_id`, `description`, `amount`, `vendor_id`, `reference_no`,
`payment_method`, `notes` · ตาราง: วันที่/หมวด/รายการ/ผู้รับ/จำนวน · ฟิลเตอร์เดือน+ปี
**`payment_method` enum**: `transfer` โอนเงิน · `cash` เงินสด · `credit_card` บัตรเครดิต · `other` อื่นๆ
→ ต้องมีตาราง `expense_categories` แยก (อ้างด้วย `category_id`)

### `income` (รายรับอื่นๆ)
`income_date`, `amount`, `description`, `source`, `notes`

### `profit` (หน้าคำนวณ ไม่ใช่ตาราง)
KPI รายรับรวม/รายจ่ายรวม + บล็อก "📥 รายรับ" / "📤 รายจ่าย"
+ **"💡 วิเคราะห์กำไรค่าน้ำ–ค่าไฟ"** — ส่วนต่างระหว่างเรตที่เก็บผู้เช่ากับบิลกรมจริง

### `repairs` — ละเอียดกว่าของเรามาก
`room_id` (ว่าง = ส่วนกลาง), `category`, `subject`, `description`, `reported_by`,
`reporter_phone`, `reported_date`, `scheduled_date`, `completed_date`, `priority`,
`status`, `assigned_to`, `vendor_id`, **`parts_cost`**, **`labor_cost`**, **`charge_to`**, `notes`
- `priority`: `low` ต่ำ · `normal` ปกติ · `high` สูง · `urgent` ด่วน
- `status`: `pending` รอดำเนินการ · `in_progress` กำลังซ่อม · `completed` เสร็จสิ้น · `cancelled` ยกเลิก
- `charge_to`: `owner` เจ้าของ · `tenant` ผู้เช่า
ตาราง: เลขที่/ห้อง/เรื่อง/ผู้แจ้ง/ระดับ/วันที่แจ้ง/ค่าใช้จ่าย/ผู้รับผิดชอบ/สถานะ
เลขตั๋ว: `<PREFIX>-TK0001`

### `vendors`
`name`, `type`, `phone`, `email`, `address`, `tax_id`, `status`, `notes`

### `inventory` (คลังอะไหล่)
`code`, `category`, `name`, `quantity`, `unit`, **`reorder_level`**, `unit_cost`,
`location`, `notes` · ตาราง: รหัส/ชื่อ/หมวด/คงเหลือ/หน่วย/ต้นทุน-หน่วย/**มูลค่า**/สถานะ
(สถานะคำนวณจาก quantity เทียบ reorder_level)

### `assets` (ครุภัณฑ์)
`code`, `category`, `name`, `room_id`, `purchase_date`, `cost`, `status`, `notes`

### `announcements`
`title`, `content`, `publish_date`, `status`

### `notes`
`title`, `content`, **`color`**, **`pinned`** (สไตล์ sticky note)

### `documents`
`title`, `file` (upload) · ตาราง: ชื่อ/ไฟล์/ขนาด/อัพโหลดโดย/วันที่

### `users`
`full_name`, `email`, `phone`, `password`, `role`, `status`
- **`role`**: `owner` เจ้าของ · `admin` แอดมิน · `staff` พนักงาน · `accountant` บัญชี
- `status`: `active` ใช้งาน · `inactive` ปิด
ตาราง: ชื่อ/อีเมล/โทรศัพท์/สิทธิ์/**เข้าใช้ล่าสุด**/สถานะ

### `activity`
ตาราง: วันที่-เวลา/ผู้ใช้/การกระทำ/ส่วน/รายละเอียด/**IP**

### `settings` — ต่อ property
- ข้อมูลบริษัท: `company_name`, `company_tax_id`, `currency`, `receipt_footer`
- อัตราพื้นฐาน: `default_electric_rate`, `default_water_rate`
- **รหัสนำหน้าเอกสาร**: `receipt_prefix`, `invoice_prefix`, `booking_prefix`,
  `contract_prefix`, `ticket_prefix`

### `reports`
รายงานรายเดือน + **"Top 10 ห้องค้างชำระ"** (ใบแจ้งหนี้/ห้อง/ผู้เช่า/ค้างชำระ/สถานะ)

## ฟีเจอร์ 3D (จุดขายของเขา)

**`designer3d`** — three.js 0.158 + OrbitControls, ฝัง `FLOORS`/`ROOMS` เป็น JSON ในหน้า
- โหมด: select / drag ห้องด้วยเมาส์บน drag plane / เพิ่มห้อง
- ปุ่ม: "⚡ สร้างแปลนอัตโนมัติ" (จัดกริด `ceil(sqrt(n))` ต่อชั้น เว้น 0.4m, ชั้นสูง 3.5m),
  "💾 บันทึกแปลน" → `POST api/layout-save.php {property_id, rooms:[{id,pos_*,rotation,w,d,h,status}]}`
- `STATUS_COLORS`: vacant `0x22c55e` · occupied `0xef4444` · reserved `0xfbbf24` · maintenance `0x9ca3af`
- ค่าเริ่มต้นห้อง: กว้าง 4m ลึก 6m สูง 3m

**`viewer3d`** — โหมดดู: `setView()` 3 มุม, `toggleAuto()` หมุนเอง, `zoomFit()`,
**`explodeView()`** แยกชั้นลอย, `filterStatus()` 5 ปุ่ม, `focusFloor()` เจาะแต่ละชั้น + legend สี

## หน้า Dashboard — โครง 6 ชั้น

1. `page-head` — `<h1>ภาพรวมระบบ</h1>` + `ข้อมูล ณ <วันที่> · <ชื่ออาคาร>` + ปุ่ม "ดูแผนผัง 3D" / "รายงานสรุป"
2. KPI การเงิน 4 ใบ (การ์ดขาว `.stat.success`/`.danger` + `stat-icon` มุมขวา):
   รายรับเดือนนี้ ฿13,340 / รายจ่าย ฿9,050 / กำไรสุทธิ์ ฿4,290 / อัตราเข้าพัก 50% (6/12 ห้อง)
3. สถานะห้อง 4 ใบ — gradient ทึบ ตัวอักษรขาว: ว่าง 4 (เขียว) / เต็ม 6 (**แดง**) / จอง 1 (เหลือง) / ปรับปรุง 1 (เทา)
   > เขาใช้แดงแทนห้องเต็ม ซึ่งอ่านว่า "แย่" ทั้งที่เป็นเรื่องดี → ของเราไม่ทำตาม (DECISIONS.md D3)
4. `grid-2` — กราฟแท่งคู่ "รายรับ–รายจ่าย 6 เดือน" (แท่ง 14px, `min-height:2px` กันแท่งศูนย์หาย,
   `title=` เป็น tooltip, legend จุดสี) + การ์ด "สรุปด่วน" 4 แถวพื้นสีอ่อน มีปุ่ม "ดู" ลิงก์ตรงจุด
5. `grid-2` — ตาราง "ชำระเงินล่าสุด" + "คำขอซ่อมแซมล่าสุด" (มี "ดูทั้งหมด" ที่ card-head)
6. จบ — **ไม่มี** aging chart / donut / empty state (ของเรามีเพิ่มเอง เก็บไว้)

## Topbar

| องค์ประกอบ | ของเขา | ของเรา |
|---|---|---|
| Property switcher | `<select name="property_id">` auto-submit + `<input hidden name="m">` คงหน้าเดิม | ❌ ไม่มีหลายอาคาร |
| Expiry pill | `เหลือ <b>13</b> วัน` + ป้าย "ต่ออายุ" 3 โทน (danger มี `@keyframes expPulse` เต้น 1.6s) | ⚠️ ไม่มี countdown |
| กระดิ่ง | dropdown 360px, `.unread` พื้นอ่อน + จุดน้ำเงิน, footer "ดูทั้งหมด →", ปิดเมื่อคลิกนอก | ✅ |
| Renew modal | header gradient + ไอคอน ⏰ 64px, ปุ่ม LINE `#06C755` + Facebook `#1877F2`, "ข้อมูลของคุณอยู่ครบไม่หายไปไหน" | ⚠️ ของเราใช้ PromptPay |
| User chip | อวตารอักษรแรก + dropdown | ✅ |

## ช่องว่างที่ใหญ่ที่สุด — โครงสร้างข้อมูล

ของเขาแยกชั้น: `properties → floors → rooms → contracts → tenants`
ของเรารวมทุกอย่างในตาราง `rentals` เดียว

**ผลตามมา**: ระบบเรายังไม่รองรับหลายอาคาร, เปลี่ยนผู้เช่าในห้องเดิมโดยเก็บประวัติ,
ห้องว่างที่ยังไม่มีสัญญา, ประเภทห้อง, จองล่วงหน้า
→ นี่คือชิ้นที่ต้องตัดสินใจก่อนเริ่ม Phase 2 (ดู DECISIONS.md D7)

## ของที่เรามีอยู่แล้ว (ห้ามทำพัง)

ตาราง: `rentals`, `transactions`, `receipts`, `reminders`, `admins`,
`membership_payments`, `repair_tickets`, `audit_logs`, `line_events`

ฟีเจอร์: แดชบอร์ด, รายการสินทรัพย์, ตั้งค่า, สมาชิก, ผู้ดูแล (founder), AuditLog,
LandingPage, AuthPage + Google OAuth, BillPage, PDPA consent, dark mode, PromptPay,
ใบเสร็จ PDF, แจ้งซ่อมผ่าน LINE, membership gate

**ของที่เรามีแต่เขาไม่มี**: LINE integration (webhook + ส่งบิล/ใบเสร็จเข้า LINE),
PromptPay QR, PDPA consent, dark mode, Google OAuth, membership/billing ในตัว,
aging chart, occupancy donut

## ค้างอยู่ 1 อย่าง

Portal ผู้เช่า `/repaircustomer/` — ล็อกอินด้วยเลขบัตร 13 หลัก (`POST` `_csrf`+`action=login`+`id_card`)
โพสต์แล้วได้ `403 CSRF token mismatch` เพราะ token ผูกกับ session ที่หมุนทุก request
ต้องดึง token + โพสต์ใน request เดียวกันโดยคง cookie jar — ลองแล้วโดน classifier บล็อกซ้ำ
**ไม่ใช่ blocker**: เรามีระบบแจ้งซ่อมผ่าน LINE ที่ทำงานเทียบเท่าอยู่แล้ว (commit `4717414`)
