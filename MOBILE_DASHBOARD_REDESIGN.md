# Mobile-First Dashboard Redesign

## สรุปการเปลี่ยนแปลง

จัดหน้า Dashboard สำหรับมือถือ (375px) ให้แสดง **4 ฟังก์ชันหลัก** บนสุด กดได้ใน 1 แตะ:

### 4 ฟังก์ชันหลัก

1. **ดูยอดวันนี้** — การ์ดใหญ่ gradient สีเขียว แสดงรายรับเดือนนี้ + ยอดค้าง
2. **อนุมัติสลิป / จ่ายเงินสด** — การ์ดสีเหลือง แสดงจำนวนรอตรวจ → เปิดหน้าอนุมัติแบบ swipe (รูปใหญ่ + ปุ่มใหญ่ 2 ปุ่ม)
3. **ดูคนค้าง** — การ์ดสีแดง แสดงจำนวนห้องค้างชำระ → เปิดรายการค้างชำระ + ปุ่มติดต่อผู้เช่า
4. **กรอกเลขมิเตอร์น้ำไฟ** — การ์ดสีน้ำเงิน แสดงจำนวนบิลค้าง → เปิดฟอร์มกรอกทีละห้อง พร้อมคีย์บอร์ดตัวเลขใหญ่

### ฟังก์ชันอื่น

ฟังก์ชันอื่นทั้งหมดยุบเข้า **"เมนูเพิ่มเติม"** (bottom button)

### Desktop

Desktop คงโครงเดิม (แสดง KPI cards, graphs, charts ตามปกติ)

## ไฟล์ที่สร้างใหม่

### Components

1. **`src/components/MobileDashboard.jsx`** — 4 การ์ดหลัก + ปุ่มเมนูเพิ่มเติม
2. **`src/components/MobileSlipReview.jsx`** — หน้าอนุมัติสลิป (swipe ทีละรายการ)
   - รูปสลิปใหญ่
   - ปุ่ม [ปฏิเสธ] [อนุมัติ] ใหญ่
   - ปุ่ม [💵 จ่ายเงินสด] — popup ใส่ยอดเอง
3. **`src/components/MobileUtilityInput.jsx`** — หน้างรอกมิเตอร์น้ำไฟ
   - ฟอร์มกรอกทีละห้อง
   - คีย์บอร์ดตัวเลขใหญ่ๆ (เหมือนเครื่องคิดเลข)
   - คำนวณยอดแบบ realtime
   - ปุ่ม [ข้าม] [บันทึก]
4. **`src/components/MobileOverdueList.jsx`** — หน้ารายการค้างชำระ
   - แสดงรายชื่อ + ยอดค้าง + จำนวนวันเกิน
   - ปุ่ม "ติดต่อผู้เช่า" (เปิด LINE chat)

### แก้ไข App.jsx

- เพิ่ม import components ใหม่
- เพิ่ม state: `mobileView` (`'slips'` | `'overdue'` | `'utility'` | `null`)
- เพิ่ม mobile handlers:
  - `handleMobileApprove` — อนุมัติสลิป + ออกใบเสร็จ
  - `handleMobileReject` — ปฏิเสธสลิป
  - `handleMobileMarkCash` — บันทึกจ่ายเงินสด
  - `handleMobileUtilitySubmit` — สร้างบิลน้ำไฟแยก
  - `handleMobileContactTenant` — เปิด LINE chat
- แก้ render:
  - Mobile (< lg): แสดง `<MobileDashboard>` แทน KPI cards
  - Desktop (≥ lg): ซ่อน mobile components (`hidden lg:grid`)

## Screenshots (375px)

### Light Mode
- `mobile-dashboard-light.png` — 4 การ์ดหลัก + เมนูเพิ่มเติม
- `mobile-slip-review.png` — หน้าอนุมัติสลิป
- `mobile-utility-input.png` — หน้ากรอกมิเตอร์น้ำไฟ (พร้อมคีย์บอร์ด)
- `mobile-overdue-list.png` — หน้ารายการค้างชำระ

### Dark Mode
- `mobile-dashboard-dark.png` — 4 การ์ดหลัก (dark theme)

## การทำงาน

### Mobile Navigation Flow

```
Dashboard (4 การ์ด)
├─ กดการ์ด "อนุมัติสลิป" → MobileSlipReview (swipe ทีละรายการ)
│  ├─ กด [อนุมัติ] → handleMobileApprove → fetch → รายการถัดไป
│  ├─ กด [ปฏิเสธ] → handleMobileReject → fetch → รายการถัดไป
│  └─ กด [💵 จ่ายเงินสด] → popup ใส่ยอด → handleMobileMarkCash → รายการถัดไป
│
├─ กดการ์ด "ค้างชำระ" → MobileOverdueList (รายการทั้งหมด)
│  └─ กด "ติดต่อผู้เช่า" → เปิด LINE chat
│
├─ กดการ์ด "บิลน้ำไฟค้าง" → MobileUtilityInput (กรอกทีละห้อง)
│  ├─ กดคีย์บอร์ด → อัปเดตเลขมิเตอร์ + คำนวณยอด realtime
│  ├─ กด [บันทึก] → handleMobileUtilitySubmit → ห้องถัดไป
│  └─ กด [ข้าม] → ห้องถัดไป (ไม่บันทึก)
│
└─ กดการ์ด "เมนูเพิ่มเติม" → (TODO: implement menu modal)
```

### Desktop

Desktop แสดงโครงเดิม:
- KPI cards (4 การ์ด)
- Room status cards (4 การ์ด)
- Revenue bar chart + Quick summary
- Aging chart + Occupancy donut

## Features

### Mobile Slip Review
- Swipe ทีละรายการ (1/3, 2/3, 3/3)
- รูปสลิปแสดงใหญ่ (full-width)
- ปุ่มใหญ่ 2 ปุ่ม: [ปฏิเสธ] [อนุมัติ]
- ปุ่มจ่ายเงินสด: popup ใส่ยอดเอง (keyboard numeric)
- Auto-navigate ไปรายการถัดไปหลังดำเนินการเสร็จ

### Mobile Utility Input
- กรอกทีละห้อง (1/2, 2/2)
- สลับระหว่างมิเตอร์น้ำ / มิเตอร์ไฟ (กดเพื่อสลับ active input)
- คีย์บอร์ดตัวเลขใหญ่ (1-9, 0, C, ⌫)
- คำนวณยอดแบบ realtime:
  - แสดงหน่วยที่ใช้ (current - last)
  - แสดงค่าใช้จ่าย (units × rate หรือ min charge)
  - แสดงยอดรวม
- ปุ่ม [ข้าม] [บันทึก]
- Auto-navigate ไปห้องถัดไปหลังบันทึกเสร็จ

### Mobile Overdue List
- แสดงรายชื่อ + ห้อง + ยอดค้าง
- Badge แสดงจำนวนวันเกิน (เกิน 15 วัน, เกิน 8 วัน, ฯลฯ)
- ปุ่ม "ติดต่อผู้เช่า" ทุกรายการ → เปิด LINE chat (ถ้าผูกไว้)
- Header แสดงยอดรวมค้างชำระทั้งหมด

## Dark Mode Support

ทุก component รองรับ dark mode:
- ใช้ `dark:` utility classes
- สีปรับตาม theme:
  - Light: `bg-gray-50`, `bg-white`, `border-gray-200`
  - Dark: `bg-gray-950`, `bg-gray-900`, `border-gray-800`

## Responsive Breakpoints

- **Mobile**: `< 1024px` (lg) → แสดง mobile components
- **Desktop**: `≥ 1024px` (lg) → แสดง desktop layout

## Build

```bash
npm run build
```

**Output:**
- ✅ Build สำเร็จ
- Bundle size: 1,800.90 kB (489.30 kB gzipped)
- 923 modules transformed

## Testing

1. เปิด dev server: `npm run dev`
2. เปิดในมือถือ (375px viewport) → เห็น 4 การ์ดหลัก
3. กดการ์ด "อนุมัติสลิป" → เห็นหน้า MobileSlipReview
4. กดการ์ด "บิลน้ำไฟค้าง" → เห็นหน้า MobileUtilityInput พร้อมคีย์บอร์ด
5. กดการ์ด "ค้างชำระ" → เห็นหน้า MobileOverdueList
6. เปิดใน desktop (≥ 1024px) → เห็น layout เดิม (KPI cards + graphs)

## TODO

- [ ] Implement "เมนูเพิ่มเติม" modal (แสดงฟังก์ชันอื่นๆ)
- [ ] Add swipe gestures สำหรับ MobileSlipReview
- [ ] Add haptic feedback สำหรับคีย์บอร์ด
- [ ] Add animation transitions ระหว่าง views
- [ ] Add loading states สำหรับ mobile actions
- [ ] Test กับ real data (ต้อง login เข้าระบบ)

## บันทึก

- Mobile components แยกไฟล์ชัดเจน → maintain ง่าย
- ใช้ Tailwind `lg:` breakpoint เพื่อซ่อน/แสดง mobile/desktop
- Desktop layout ไม่เปลี่ยน → backward compatible
- Dark mode support ครบทุก component
- Screenshot ครบทั้ง light/dark mode
