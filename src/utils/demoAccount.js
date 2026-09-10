// บัญชีเดโม่สาธารณะ — กดปุ่มเดียวเข้าดูระบบพร้อมข้อมูลตัวอย่างครบทุกหน้า
// ข้อมูลของบัญชีนี้อยู่ใน migration 20260909150000_demo_account.sql (ผูกกับอีเมลนี้)
//
// ⚠️ รหัสอยู่ในโค้ดฝั่งหน้าเว็บโดยเจตนา — ใครก็เข้าได้
//    ห้ามใส่ข้อมูลจริงของลูกค้าลงบัญชีนี้
//
// แยกมาไว้ที่นี่เพราะทั้ง AuthPage (ใช้ล็อกอิน) และ App (ใช้ระบุที่มาของการเข้า
// ระบบใน activity log) ต้องใช้ค่าเดียวกัน — ไฟล์คอมโพเนนต์ export ค่าคงที่ไม่ได้
// เพราะทำให้ Vite fast refresh ใช้ไม่ได้ (react/only-export-components)
export const DEMO_ACCOUNT_EMAIL = 'demo@payrentpro.app'
export const DEMO_ACCOUNT_PASSWORD = 'demo12345678'
