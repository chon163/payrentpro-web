// จัดการค่า "งวด" ของบิล — หลักการ: หน้าเว็บและฐนาข้อมูลเก็บเป็น ISO 'YYYY-MM'
// ส่วนการแสดงผลต่อผู้ใช้เป็นภาษาไทย เช่น 'ก.ย. 69' (พ.ศ. สองหลักท้าย)
export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// งวดปัจจุบันเป็น ISO เช่น '2026-09' (ใช้บันทึกลง transactions.period)
export function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// แปลงงวดสำหรับแสดงผล — รองรับทั้ง ISO 'YYYY-MM' และค่าเดิมฟอร์แมตไทยที่เคยบันทึกไว้
export function formatPeriod(value) {
  if (!value) return '—'
  const m = String(value).trim().match(/^(\d{4})-(\d{2})$/)
  if (m) {
    const idx = Number(m[2]) - 1
    if (idx >= 0 && idx < 12) {
      const year = String((Number(m[1]) + 543) % 100).padStart(2, '0')
      return `${THAI_MONTHS[idx]} ${year}`
    }
  }
  return String(value)
}
