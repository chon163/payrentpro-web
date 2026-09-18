// ฟอร์แมตสกุลเงิน — ใช้ ฿ แทน "บาท" ทั้งโปรเจกต์
//
// โหมดเดโม่ (demo@payrentpro.app): ซ่อนตัวเลขเงินทั้งหมด → แสดง ••• แทน
// เพื่อไม่ให้ผู้ชมเห็นราคาจริง/ยอดบิลตอนพรีเซนต์ — เปิดโดย setDemoMask จาก App
// (ผูกกับบัญชีที่ล็อกอิน ณ รันไทม์ ไม่ใช่ค่าเวลาคอมไพล์)
let demoMask = false
export function setDemoMask(value) {
  demoMask = Boolean(value)
}
export function isDemoMask() {
  return demoMask
}

export function formatCurrency(value) {
  if (demoMask) return '•••'
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

// ฟอร์แมตตัวเลขใหญ่ — truncate ถ้า >6 หลักเป็น 1.23M / 456K
export function formatLargeNumber(value) {
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`
  return n.toLocaleString('th-TH')
}

// ฟอร์แมตวันที่แบบไทย
export function formatDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
}

// คำนวณช่วงเดือน — return { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
export function monthRange(year, month) {
  if (!year || !month || month < 1 || month > 12) {
    return { from: undefined, to: undefined }
  }
  const pad = (n) => String(n).padStart(2, '0')
  const from = `${year}-${pad(month)}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const to = `${nextYear}-${pad(nextMonth)}-01`
  return { from, to }
}

// Emoji/ป้ายประเภทสินทรัพย์ย้ายไป utils/asset.js แล้ว (bizTypeEmoji / bizTypeLabel)
// — ศูนย์เดียวกับ BIZ_TYPES + normalizeBizType กันสองสำนักคลายกัน

// บิล "ค้างชำระ" จริง = ออกไปแล้วแต่ยังไม่ได้จ่าย (unpaid / pending_review)
// draft = ร่างบิลที่ยังไม่ออกให้ผู้เช่า → ห้ามนับเป็นค้างชำระ/ทวงหนี้/ยอดรวมค้าง
// (ใช้แทน `tx.status !== 'paid'` ตรง ๆ ซึ่งจะจับ draft ไปด้วย)
export function isBillOpen(tx) {
  const status = String(tx?.status ?? '').toLowerCase()
  return status !== 'paid' && status !== 'draft'
}
