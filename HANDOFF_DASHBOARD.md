# Handoff: ปรับแดชบอร์ด PayRentPro ให้ "ดูโปร"

อ่านไฟล์นี้ก่อนเริ่ม แล้วดูรูปที่ผู้ใช้แนบมาในแชทใหม่ (โฟลเดอร์ `Screen/*.jpg` ก็มีชุดเดียวกัน)

## ทำอะไรไปแล้ว (commit `67cb147` อยู่บน main + deploy ขึ้น Vercel แล้ว)

จัดโครงแดชบอร์ดใหม่ตามไกด์รอบแรก — spec อยู่ที่ `tmp/dashboard-guide.md`
ทั้งหมดอยู่ใน `src/App.jsx` ไฟล์เดียว (6000+ บรรทัด)

ลำดับหน้าแดชบอร์ดปัจจุบัน (ราวบรรทัด 6191+ ในสาขา `else` ของ `<main>`):
1. หัวเรื่อง "ภาพรวมระบบ" + `ข้อมูล ณ <เวลา> · <ชื่อกิจการ>`
2. KPI 4 ใบ — `KpiCard` การ์ดขาว แถบสีซ้าย ไอคอนมุมขวา (2 คอลัมน์ → 4 ที่ lg)
3. สถานะห้อง 4 ใบ — `RoomStatusCard` พื้น gradient ทึบ ตัวอักษรขาว
4. `RevenueBar` (lg:col-span-2) + `QuickSummaryCard` (ราง 1 ส่วน)
5. `RecentPaymentsCard` / `RecentRepairsCard` 2 คอลัมน์ อย่างละ 5 แถว
6. `AgingBarChart` + `OccupancyDonut` 2 คอลัมน์
7. ส่วนจัดการงานเดิม (`LeaseExpiryBand`, `PendingReviewSection`, `RepairSection`,
   `UrgentChaseSection`) ย้ายลงล่าง ครอบด้วย `<div id="dash-*" className="scroll-mt-24">`
   เป็นเป้าหมาย smooth-scroll ของปุ่มใน `QuickSummaryCard`

คอมโพเนนต์ที่เพิ่มไว้ (ใช้ต่อได้): `KpiCard`, `RoomStatusCard`, `PanelCard`,
`PanelLink`, `QuickSummaryCard`, `RecentPaymentsCard`, `RecentRepairsCard`
— `StatCard`/`CARD_TONES` เดิมถูกลบทิ้งแล้ว

## งานที่ยังค้าง — 5 ข้อที่เห็นจากโค้ด (ยังไม่ได้ทำ)

ผู้ใช้อยากให้ "ดูโปรเหมือนเขา" ข้อพวกนี้ยืนยันจากโค้ดจริง ไม่ใช่เดาจากรูป:

1. **อีโมจิใช้เป็นไอคอนหลัก** — `🔧` `📅` `⬇️` `✅` `💎` `🛡️` `⚠️`
   ที่บรรทัดราว 594, 664-665, 748, 1256, 2632, 3013, 3127, 5008, 6051
   เรนเดอร์ต่างกันทุก OS ดูเป็น prototype ทันที
   โปรเจกต์มี `ICONS` (object ของ SVG path) + `<Icon name>` อยู่แล้วที่บรรทัด 14-54
   → เพิ่ม path ที่ขาด (wrench, calendar, download, clock, receipt) แล้วแทนให้ครบ
2. **การ์ดแจ้งเตือน 4 บล็อกยังเป็นแถบสีจัด** — แต่ละอันมี gradient header +
   `shadow-lg` สีตัวเอง (ส้ม/ฟ้า/เหลือง/แดง) ซ้อนกันแล้วเหมือน 4 เว็บมาต่อกัน
   → ครอบด้วย `PanelCard` ให้เป็นการ์ดขาวชุดเดียว ต่างแค่ badge สีเล็ก
3. **ไม่มี empty state ตอนยังไม่มีข้อมูล** — ลูกค้าใหม่เจอการ์ดเลข 0 เรียงกัน
   ไม่มีอะไรบอกว่าต้องทำอะไรต่อ → onboarding card + ปุ่ม "เพิ่มสินทรัพย์แรก"
4. **ตัวเลขไม่มี context** — `฿19,500` เฉย ๆ ควรมี `↑ 12% จากเดือนก่อน` สีเขียว/แดง
   คำนวณได้จาก `monthlyByType` ที่มีอยู่แล้ว ไม่ต้องแตะ DB
5. **ไม่มี loading skeleton บนการ์ด KPI** — ตอนโหลดกระพริบจาก `—` เป็นเลข
   (มี `TableSkeleton` อยู่แล้วราวบรรทัด 1114 ใช้เป็นแบบได้)

## ไม่ต้องแตะ DB / SQL

ทุกข้อข้างบนเป็นงานหน้าบ้านล้วน ๆ ข้อมูลที่ต้องใช้อยู่ในตารางเดิมครบแล้ว
(`rentals`, `transactions`, `repair_tickets`, `admins`) — **ไม่ต้องรัน SQL Editor**
ถ้าดีไซน์ใหม่ต้องการฟิลด์ที่ไม่มีจริง ให้บอกผู้ใช้ก่อน อย่าเดาสร้าง migration เอง

## วิธีตรวจงาน (สำคัญ)

ต้อง `npx vite --port 5174 --host 127.0.0.1` ก่อน — **ต้องมี `--host 127.0.0.1`**
ไม่งั้น Vite bind แค่ IPv6 แล้ว Playwright ต่อไม่ได้ (ERR_CONNECTION_REFUSED)

- `node tools/shoot.mjs` — 8 หน้า × 375/768/1280
- `node tools/verify-dashboard.mjs` — วัดโครงแดชบอร์ดจาก DOM (เขียนไว้รอบนี้)
- `node tools/shrink-any.mjs <src> <out> <width>` — ย่อรูป jpg/png ผ่าน Chromium

**เกณฑ์ผ่าน = touch 375/768 ต้อง 0 small targets เท่านั้น ไม่ใช่ 1280**
ที่ 1280 จะ fail ราว 14 รายการซึ่งตั้งใจให้เป็นเช่นนั้น (commit `83f6e66`
ย้าย compact style จาก `sm:` ไป `lg:` เพราะ 44px เป็นเกณฑ์ touch)
`oxlint` มี warning `set-state-in-effect` เดิมค้างเยอะ — เกณฑ์คือ 0 errors

## ข้อควรรู้

รูปที่ผู้ใช้แนบจะถูกระบบตัดออกจาก context เมื่อบทสนทนายาว — นี่คือเหตุผลที่
ต้องเปิดแชทใหม่ ถ้ารูปหลุดอีกให้บอกผู้ใช้ตรง ๆ อย่าเดาดีไซน์แล้วลงมือ
