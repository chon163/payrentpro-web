// ฟอร์แมตเงิน/วันที่ที่ใช้ร่วมกันทั้งแอป
// แยกออกมาจาก App.jsx เพื่อให้หน้าใหม่ใน src/pages/ ใช้ตัวเดียวกันได้
// — ไม่ให้เกิดสองสำนักที่แสดงเลขคนละแบบ

export function formatCurrency(value) {
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

// 'YYYY-MM' → 'กันยายน 2569' (พ.ศ. ตามที่คนไทยอ่าน — เว็บทั้งเว็บใช้ locale th-TH อยู่แล้ว)
export function formatPeriodLabel(period) {
  if (!period) return '—'
  const [y, m] = String(period).split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) return String(period)
  return `${THAI_MONTH_NAMES[m - 1]} ${y + 543}`
}

// วันแรก/วันสุดท้ายของเดือนในรูป 'YYYY-MM-DD' สำหรับส่งเข้า Supabase filter
export function monthRange(year, month) {
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const nextY = month === 12 ? year + 1 : year
  const nextM = month === 12 ? 1 : month + 1
  return { from, to: `${nextY}-${pad(nextM)}-01` }
}
