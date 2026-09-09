# TODO.md

## เจ้าของจะทำเอง — ห้ามแตะ
- **SQL Editor — เจ้าของจะเพิ่มเองพรุ่งนี้**

## ค้างจากงานเดิม (จาก MEMORY / HANDOFF)
- ทดสอบ Google OAuth login จริงบน production (ปุ่มขึ้นแล้ว ยังไม่ได้ทดสอบ)
- งานปรับแดชบอร์ด "ให้ดูโปร" 5 ข้อใน `HANDOFF_DASHBOARD.md` — ยังไม่ได้ทำ:
  1. แทนอีโมจิที่ใช้เป็นไอคอนหลักด้วย `<Icon>` (ต้องเพิ่ม path: wrench, calendar,
     download, clock, receipt)
  2. ครอบการ์ดแจ้งเตือน 4 บล็อกด้วย `PanelCard` ให้เป็นการ์ดขาวชุดเดียว
  3. เพิ่ม empty state / onboarding card ตอนยังไม่มีข้อมูล
  4. เพิ่ม context ให้ตัวเลข (`↑ 12% จากเดือนก่อน` จาก `monthlyByType`)
  5. เพิ่ม loading skeleton บนการ์ด KPI (ดู `TableSkeleton` เป็นแบบ)
