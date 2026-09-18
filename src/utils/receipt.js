import { jsPDF } from 'jspdf'

// ── ฟอนต์ Sarabun สำหรับภาษาไทยใน PDF ─────────────────────────────
// jsPDF รองรับเฉพาะ TTF (ไม่รองรับ woff2) → เก็บไฟล์ไว้ที่ public/fonts/
// fetch มาแปลง base64 ตอนออกใบเสร็จครั้งแรก แล้ว cache ไว้ใช้ทั้ง session
const BASE = import.meta.env.BASE_URL || '/'
const FONT_FILES = {
  normal: 'fonts/Sarabun-Regular.ttf',
  semibold: 'fonts/Sarabun-SemiBold.ttf',
  bold: 'fonts/Sarabun-Bold.ttf',
}

let fontBase64Promise = null

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

async function loadSarabunBase64() {
  if (!fontBase64Promise) {
    fontBase64Promise = (async () => {
      const entries = await Promise.all(
        Object.entries(FONT_FILES).map(async ([weight, path]) => {
          const res = await fetch(BASE + path)
          if (!res.ok) throw new Error(`โหลดฟอนต์ไม่สำเร็จ (${path}: HTTP ${res.status})`)
          return [weight, arrayBufferToBase64(await res.arrayBuffer())]
        })
      )
      return Object.fromEntries(entries)
    })()
    // พลาด = ให้รอบหน้าได้ลองใหม่ ไม่ lock cache ด้วย error
    fontBase64Promise.catch(() => { fontBase64Promise = null })
  }
  return fontBase64Promise
}

// ลงทะเบียนฟอนต์กับ doc (addFileToVFS/addFont ถูกเก็บแบบ global ใน jsPDF
// แต่เรียกซ้ำทุก doc ก็ถูก — ส่วนที่แพงคือ fetch ซึ่ง cache แล้ว)
let sarabunAvailable = null

async function embedSarabunFont(doc) {
  if (sarabunAvailable !== null) {
    if (sarabunAvailable) registerSarabun(doc)
    return sarabunAvailable
  }
  try {
    const fonts = await loadSarabunBase64()
    registerSarabun(doc, fonts)
    sarabunAvailable = true
  } catch (e) {
    console.error('Failed to embed Sarabun font:', e)
    sarabunAvailable = false
  }
  return sarabunAvailable
}

function registerSarabun(doc, fonts) {
  doc.addFileToVFS('Sarabun-Regular.ttf', fonts.normal)
  doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
  doc.addFileToVFS('Sarabun-SemiBold.ttf', fonts.semibold)
  doc.addFont('Sarabun-SemiBold.ttf', 'Sarabun', 'semibold')
  doc.addFileToVFS('Sarabun-Bold.ttf', fonts.bold)
  doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold')
}

// ถ้าไม่มี Sarabun → ยกเลิก helvetica (ไทยจะไม่ขึ้น แต่ PDF ยังออกได้)
function thaiFont(doc, weight) {
  return sarabunAvailable ? ['Sarabun', weight] : ['helvetica', weight === 'bold' ? 'bold' : 'normal']
}

const THAI_FONT_STACK = 'Sarabun, "Noto Sans Thai", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif'

async function ensureThaiFont() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load('400 29px Sarabun', 'ก่ำู๊'),
      document.fonts.load('600 27px Sarabun', 'ก่ำู๊'),
      document.fonts.load('700 40px Sarabun', 'ก่ำู๊'),
    ])
    await document.fonts.ready
  } catch {
    // โหลดไม่ได้ก็ปล่อยให้ fallback ทำงาน
  }
}

function bahtText(value) {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  return `฿${safe.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function thaiDateText(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * สร้างใบเสร็จรับเงิน A5 แนวตั้ง คืนเป็น Blob (application/pdf)
 * ใช้ฟอนต์ Sarabun ฝังใน PDF → ไทยอ่านได้ + คัดลอกข้อความได้
 */
export async function createReceiptPdf({ custName, itemDetails, period, totalAmount, paidAmount, txId, paidAt, businessName, ownerName, address }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  await embedSarabunFont(doc)

  const pageW = 148
  const pageH = 210
  const margin = 14
  const contentW = pageW - margin * 2

  // หัวใบเสร็จ
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(17, 24, 39)
  doc.text('PayRentPro', margin, 20)

  doc.setFont(...thaiFont(doc, 'bold'))
  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text('ใบเสร็จรับเงิน / RECEIPT', margin, 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(107, 114, 128)
  doc.text(`No. INV-${String(txId ?? '').slice(0, 8).toUpperCase()}`, margin, 34)

  let y = 42

  // บล็อกโปรไฟล์ธุรกิจ
  if (businessName) {
    doc.setFont(...thaiFont(doc, 'bold'))
    doc.setFontSize(15)
    doc.setTextColor(17, 24, 39)
    doc.text(String(businessName), margin, y)
    y += 6
  }
  if (ownerName) {
    doc.setFont(...thaiFont(doc, 'normal'))
    doc.setFontSize(11)
    doc.setTextColor(107, 114, 128)
    doc.text(`เจ้าของ: ${ownerName}`, margin, y)
    y += 5
  }
  if (address) {
    doc.setFont(...thaiFont(doc, 'normal'))
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    const lines = doc.splitTextToSize(String(address), contentW)
    doc.text(lines, margin, y)
    y += lines.length * 4 + 2
  }

  doc.setDrawColor(209, 213, 219)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  // ตารางข้อมูล
  const rows = [
    { label: 'ผู้เช่า / Customer', value: custName },
    { label: 'รายการ / Description', value: itemDetails },
    { label: 'งวด / Period', value: period },
    { label: 'ยอดรวม / Total', value: bahtText(totalAmount) },
    { label: 'ยอดที่ชำระ / Paid', value: bahtText(paidAmount ?? totalAmount) },
    { label: 'วันที่ชำระ / Paid date', value: thaiDateText(paidAt) },
  ]

  rows.forEach((row, i) => {
    const rowY = y + i * 8
    doc.setFont(...thaiFont(doc, 'semibold'))
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(row.label, margin, rowY)
    doc.setFont(...thaiFont(doc, 'normal'))
    doc.setTextColor(17, 24, 39)
    doc.text(String(row.value ?? '—'), margin + 50, rowY)
  })

  y += rows.length * 8 + 6

  // ประทับ PAID
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(52)
  doc.setTextColor(134, 239, 172)
  doc.text('PAID', pageW / 2 - 6, y + 16, { angle: 45 })
  y += 28

  // ท้ายใบเสร็จ
  doc.setFont(...thaiFont(doc, 'normal'))
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text('ขอบคุณที่ชำระเงิน', pageW / 2, pageH - 20, { align: 'center' })
  doc.text('โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐานการชำระเงิน', pageW / 2, pageH - 15, { align: 'center' })

  return doc.output('blob')
}

/**
 * แยกยอดบิลเป็นรายการย่อยสำหรับใบเสร็จ
 */
export function receiptItemsFromTx(tx) {
  if (!tx) return []
  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  const waterUnits = num(tx.water_units)
  const elecUnits = num(tx.elec_units)
  const penaltyDays = num(tx.penalty_days)
  const rows = [
    { label: 'ค่าเช่า / ค่างวด', amount: num(tx.base_amount) },
    { label: waterUnits > 0 ? `ค่าน้ำ (${waterUnits} หน่วย)` : 'ค่าน้ำ', amount: num(tx.water_cost) },
    { label: elecUnits > 0 ? `ค่าไฟ (${elecUnits} หน่วย)` : 'ค่าไฟ', amount: num(tx.elec_cost) },
    { label: 'ค่าใช้จ่ายอื่น ๆ', amount: num(tx.extra_charges) },
    { label: penaltyDays > 0 ? `ค่าปรับล่าช้า (${penaltyDays} วัน)` : 'ค่าปรับล่าช้า', amount: num(tx.penalty_amount) },
  ]
  return rows.filter((r) => r.amount !== 0)
}

/**
 * สร้างใบเสร็จรับเงินเป็นรูป PNG (สัดส่วน A5 แนวตั้ง) คืนเป็น Blob (image/png)
 * LINE รับรูปได้แค่ JPEG/PNG → ใบเสร็จที่ส่งเข้ากลุ่มใช้ path นี้ (canvas)
 */
export async function createReceiptPng({ custName, itemDetails, period, totalAmount, paidAmount, txId, paidAt, businessName, ownerName, address, items }) {
  await ensureThaiFont()

  const W = 1000
  const H = 1419 // อัตราส่วนเท่ากระดาษ A5
  const M = 70
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'top'

  const ellipsize = (text, maxWidth) => {
    const t = String(text ?? '')
    if (ctx.measureText(t).width <= maxWidth) return t
    let truncated = t
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1)
    }
    return truncated + '…'
  }

  let y = M

  // หัวใบเสร็จ
  ctx.font = `700 66px ${THAI_FONT_STACK}`
  ctx.fillStyle = '#111827'
  ctx.fillText('PayRentPro', M, y)
  y += 76

  ctx.font = `700 50px ${THAI_FONT_STACK}`
  ctx.fillStyle = '#1f2937'
  ctx.fillText('ใบเสร็จรับเงิน', M, y)
  y += 60

  ctx.font = `400 32px ${THAI_FONT_STACK}`
  ctx.fillStyle = '#6b7280'
  ctx.fillText(`No. INV-${String(txId ?? '').slice(0, 8).toUpperCase()}`, M, y)
  y += 52

  // ข้อมูลธุรกิจ
  if (businessName) {
    ctx.font = `700 44px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#111827'
    ctx.fillText(ellipsize(businessName, W - M * 2), M, y)
    y += 54
  }
  if (ownerName) {
    ctx.font = `400 32px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#6b7280'
    ctx.fillText(ellipsize(`เจ้าของ: ${ownerName}`, W - M * 2), M, y)
    y += 42
  }
  if (address) {
    ctx.font = `400 30px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#6b7280'
    ctx.fillText(ellipsize(address, W - M * 2), M, y)
    y += 50
  }

  // เส้นแบ่ง
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(M, y)
  ctx.lineTo(W - M, y)
  ctx.stroke()
  y += 30

  // รายการ
  const rowData = items || [
    { label: 'ผู้เช่า', value: custName },
    { label: 'รายการ', value: itemDetails },
    { label: 'งวด', value: period },
    { label: 'ยอดรวม', value: bahtText(totalAmount) },
    { label: 'ยอดที่ชำระ', value: bahtText(paidAmount ?? totalAmount) },
    { label: 'วันที่ชำระ', value: thaiDateText(paidAt) },
  ]

  const rowH = 52
  rowData.forEach((row) => {
    ctx.font = `600 34px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#6b7280'
    ctx.fillText(row.label, M, y)
    ctx.font = `400 34px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#111827'
    const val = ellipsize(String(row.value ?? '—'), W - M - 320)
    ctx.fillText(val, M + 280, y)
    y += rowH
  })

  y += 30

  // ประทับ PAID
  ctx.save()
  ctx.translate(W / 2, y + 60)
  ctx.rotate((45 * Math.PI) / 180)
  ctx.font = '700 120px Helvetica'
  ctx.fillStyle = '#86efac'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('PAID', 0, 0)
  ctx.restore()

  y += 140

  // ท้ายใบเสร็จ
  ctx.font = `400 32px ${THAI_FONT_STACK}`
  ctx.fillStyle = '#6b7280'
  ctx.textAlign = 'center'
  ctx.fillText('ขอบคุณที่ชำระเงิน', W / 2, H - 100)
  ctx.fillText('โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐานการชำระเงิน', W / 2, H - 60)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}
