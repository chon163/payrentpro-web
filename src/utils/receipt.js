import { jsPDF } from 'jspdf'

// jsPDF ฟอนต์ standard (Helvetica) วาดภาษาไทยไม่ได้
// → ข้อความไทยทั้งหมดวาดผ่าน canvas ของ browser แล้วแปลงเป็น PNG ฝังใน PDF
//
// Sarabun ฝังมากับแอป (import ใน main.jsx) จึงได้ผลเหมือนกันทุกเครื่อง
// ที่เหลือเป็น fallback เผื่อฟอนต์ยังโหลดไม่เสร็จ — เครื่องที่ไม่มีฟอนต์ไทยเลย
// จะวาดออกมาเป็นอักขระเพี้ยน ดังนั้นต้อง await ensureThaiFont() ก่อนวาดทุกครั้ง
const THAI_FONT_STACK = 'Sarabun, "Noto Sans Thai", "Leelawadee UI", "Segoe UI", Tahoma, sans-serif'

// canvas ไม่รอฟอนต์เหมือน DOM — ถ้าวาดก่อนฟอนต์โหลดเสร็จจะได้ fallback ของระบบ
// จึงต้องรอ document.fonts ให้พร้อมก่อน (กันใบเสร็จออกมาเป็นอักขระเพี้ยน)
async function ensureThaiFont() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([
      document.fonts.load('400 29px Sarabun', 'ก่ำู๊'),
      document.fonts.load('600 27px Sarabun', 'ก่ำู๊'),
      document.fonts.load('700 40px Sarabun', 'ก่ำู๊'),
    ])
    await document.fonts.ready
  } catch {
    // โหลดไม่ได้ก็ปล่อยให้ fallback ทำงาน ดีกว่าไม่ออกใบเสร็จเลย
  }
}

function linesToPng({ lines, fontSize = 34, weight = 400, color = '#111827', align = 'left', width = null, lineHeight = 1.45, padding = 8 }) {
  const canvas = document.createElement('canvas')
  let ctx = canvas.getContext('2d')
  const font = `${weight} ${fontSize}px ${THAI_FONT_STACK}`
  ctx.font = font
  const naturalWidth = Math.max(1, ...lines.map((l) => ctx.measureText(l).width))
  const canvasWidth = width ?? Math.ceil(naturalWidth) + padding * 2
  const rowHeight = Math.round(fontSize * lineHeight)
  canvas.width = canvasWidth
  canvas.height = Math.max(1, lines.length * rowHeight + padding)
  ctx = canvas.getContext('2d')
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    const textWidth = ctx.measureText(line).width
    const x = align === 'center' ? (canvasWidth - textWidth) / 2 : align === 'right' ? canvasWidth - textWidth - padding : padding
    ctx.fillText(line, x, padding / 2 + i * rowHeight + rowHeight / 2)
  })
  return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
}

function infoTablePng(rows) {
  const canvasWidth = 1000
  const rowHeight = 46
  const fontSize = 30
  const pad = 6
  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = rows.length * rowHeight + pad
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'middle'
  rows.forEach((row, i) => {
    const y = pad + i * rowHeight + rowHeight / 2
    ctx.font = `600 ${fontSize}px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#6b7280'
    ctx.fillText(row.label, 10, y)
    ctx.font = `400 ${fontSize}px ${THAI_FONT_STACK}`
    ctx.fillStyle = '#111827'
    ctx.fillText(String(row.value ?? '—'), 330, y)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(10, pad + (i + 1) * rowHeight)
    ctx.lineTo(canvasWidth - 10, pad + (i + 1) * rowHeight)
    ctx.stroke()
  })
  return { dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
}

function pngSizeMm(png, targetWidthMm) {
  return { w: targetWidthMm, h: (targetWidthMm * png.h) / png.w }
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
 * ข้อความไทยถูกวาดเป็นรูป PNG ผ่าน canvas ก่อนฝังลง PDF ทุกจุด
 */
export function createReceiptPdf({ custName, itemDetails, period, totalAmount, paidAmount, txId, paidAt, businessName, ownerName, address }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const pageW = 148
  const pageH = 210
  const margin = 14
  const contentW = pageW - margin * 2

  // หัวใบเสร็จ
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(17, 24, 39)
  doc.text('PayRentPro', margin, 20)

  const headPng = linesToPng({ lines: ['ใบเสร็จรับเงิน / RECEIPT'], fontSize: 34, weight: 700 })
  const headSize = pngSizeMm(headPng, 74)
  doc.addImage(headPng.dataUrl, 'PNG', margin, 24, headSize.w, headSize.h)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(107, 114, 128)
  doc.text(`No. INV-${String(txId ?? '').slice(0, 8).toUpperCase()}`, margin, 24 + headSize.h + 5)

  let y = 24 + headSize.h + 10

  // บล็อกโปรไฟล์ธุรกิจ (ชื่อธุรกิจ / เจ้าของ / ที่อยู่) — วาดเป็นรูปเพราะเป็นภาษาไทย
  if (businessName || ownerName || address) {
    const restLines = [
      ...(ownerName ? [`เจ้าของ: ${ownerName}`] : []),
      ...(address ? [String(address)] : []),
    ]
    if (businessName) {
      const namePng = linesToPng({ lines: [String(businessName)], fontSize: 32, weight: 700 })
      const nameSize = pngSizeMm(namePng, 88)
      doc.addImage(namePng.dataUrl, 'PNG', margin, y, nameSize.w, nameSize.h)
      y += nameSize.h + 1.5
    }
    if (restLines.length > 0) {
      const restPng = linesToPng({ lines: restLines, fontSize: 24, color: '#6b7280', width: 780 })
      const restSize = pngSizeMm(restPng, 120)
      doc.addImage(restPng.dataUrl, 'PNG', margin, y, restSize.w, restSize.h)
      y += restSize.h + 3
    }
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
  const tablePng = infoTablePng(rows)
  const tableSize = pngSizeMm(tablePng, contentW)
  doc.addImage(tablePng.dataUrl, 'PNG', margin, y, tableSize.w, tableSize.h)
  y += tableSize.h + 8

  // ประทับ PAID ใหญ่สีเขียวอ่อน เอียง 45 องศา
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(52)
  doc.setTextColor(134, 239, 172)
  doc.text('PAID', pageW / 2 - 6, y + 16, { angle: 45 })

  // ท้ายใบเสร็จ
  const footPng = linesToPng({
    lines: ['ขอบคุณที่ชำระเงิน', 'โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐานการชำระเงิน'],
    fontSize: 26,
    color: '#6b7280',
    align: 'center',
    width: 780,
  })
  const footSize = pngSizeMm(footPng, 100)
  doc.addImage(footPng.dataUrl, 'PNG', (pageW - footSize.w) / 2, pageH - 26, footSize.w, footSize.h)

  return doc.output('blob')
}

/**
 * แยกยอดบิลเป็นรายการย่อยสำหรับใบเสร็จ — ค่าเช่า / น้ำ / ไฟ / ค่าปรับ / อื่น ๆ
 * รับแถว transactions ตรง ๆ (คอลัมน์ base_amount, water_cost, elec_cost,
 * extra_charges, penalty_amount + จำนวนหน่วยน้ำ/ไฟ) ตัดรายการที่เป็น 0 ออก
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
 *
 * ทำไมต้องมีคู่กับ PDF: LINE รับ originalContentUrl เป็น JPEG/PNG เท่านั้น
 * ส่ง URL ที่ลงท้าย .pdf ไปจะไม่แสดงรูป (เห็นแต่ข้อความที่ตามมา)
 *
 * items: รายการแยกย่อย [{ label, amount }] — ถ้าไม่ส่งมาจะแสดงเฉพาะยอดรวม
 */
export async function createReceiptPng({ custName, itemDetails, period, totalAmount, paidAmount, txId, paidAt, businessName, ownerName, address, items }) {
  await ensureThaiFont()

  const W = 1000
  const H = 1419 // อัตราส่วนเท่ากระดาษ A5 (148×210 มม.)
  const M = 70
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'top'

  // canvas ไม่ตัดบรรทัดเอง — ชื่อธุรกิจ/ที่อยู่/รายการที่ยาวจะวาดล้นออกนอกขอบกระดาษ
  // จึงตัดด้วย … ให้พอดีความกว้างที่มีก่อนวาดทุกครั้ง
  const ellipsize = (text, maxWidth) => {
    const t = String(text ?? '')
    if (ctx.measureText(t).width <= maxWidth) return t
    let lo = 0
    let hi = t.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ctx.measureText(t.slice(0, mid) + '…').width <= maxWidth) lo = mid
      else hi = mid - 1
    }
    return lo > 0 ? t.slice(0, lo) + '…' : '…'
  }

  const at = (text, yPos, { size = 28, weight = 400, color = '#111827', x = M, align = 'left', maxWidth = W - M * 2 } = {}) => {
    ctx.font = `${weight} ${size}px ${THAI_FONT_STACK}`
    ctx.fillStyle = color
    const t = ellipsize(text, maxWidth)
    const drawX = align === 'right' ? x - ctx.measureText(t).width : align === 'center' ? x - ctx.measureText(t).width / 2 : x
    ctx.fillText(t, drawX, yPos)
    return Math.round(size * 1.35)
  }

  const hr = (yPos, color = '#e5e7eb', width = 1.5) => {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(M, yPos)
    ctx.lineTo(W - M, yPos)
    ctx.stroke()
  }

  // ── แถบหัวใบเสร็จ (พื้นเข้ม) ──
  const bandH = 196
  ctx.fillStyle = '#4f46e5'
  ctx.fillRect(0, 0, W, bandH)

  let y = 40
  y += at('ใบเสร็จรับเงิน', y, { size: 46, weight: 700, color: '#ffffff' }) + 2
  at('OFFICIAL RECEIPT', y, { size: 24, weight: 600, color: '#c7d2fe' })
  at('PayRentPro', 46, { size: 30, weight: 700, color: '#ffffff', x: W - M, align: 'right' })
  at(`เลขที่ INV-${String(txId ?? '').slice(0, 8).toUpperCase()}`, 92, { size: 23, color: '#c7d2fe', x: W - M, align: 'right' })
  at(`วันที่ ${thaiDateText(paidAt)}`, 126, { size: 23, color: '#c7d2fe', x: W - M, align: 'right' })

  // ── ผู้ออกใบเสร็จ ──
  y = bandH + 34
  if (businessName) y += at(businessName, y, { size: 32, weight: 700 }) + 2
  if (ownerName) y += at(`เจ้าของ: ${ownerName}`, y, { size: 23, color: '#6b7280' })
  if (address) y += at(String(address), y, { size: 23, color: '#6b7280' })

  // ── ผู้เช่า / งวด ──
  y += 22
  hr(y)
  y += 22
  at('ผู้เช่า', y + 4, { size: 22, weight: 600, color: '#6b7280' })
  at('งวด', y + 4, { size: 22, weight: 600, color: '#6b7280', x: W / 2 + 60 })
  y += 30
  at(custName ?? '—', y, { size: 29, weight: 600, maxWidth: W / 2 - M })
  at(period || '—', y, { size: 29, weight: 600, x: W / 2 + 60 })
  y += 44
  if (itemDetails) {
    at('รายการเช่า', y + 4, { size: 22, weight: 600, color: '#6b7280' })
    y += 30
    y += at(itemDetails, y, { size: 27 })
  }

  // ── ตารางรายการ ──
  y += 22
  const amountX = W - M
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(M, y, W - M * 2, 48)
  at('รายการ', y + 12, { size: 23, weight: 700, color: '#374151', x: M + 16 })
  at('จำนวนเงิน', y + 12, { size: 23, weight: 700, color: '#374151', x: amountX - 16, align: 'right' })
  y += 48

  const lines = (Array.isArray(items) ? items : []).filter((it) => it && Number(it.amount) !== 0)
  const shown = lines.length > 0 ? lines : [{ label: 'ค่าเช่า / ค่างวด', amount: totalAmount }]
  const rowH = 52
  shown.forEach((it) => {
    at(it.label, y + 13, { size: 26, x: M + 16, maxWidth: W - M * 2 - 260 })
    at(bahtText(it.amount), y + 13, { size: 26, x: amountX - 16, align: 'right' })
    hr(y + rowH, '#f3f4f6')
    y += rowH
  })

  // ── ยอดรวม ──
  y += 6
  ctx.fillStyle = '#111827'
  ctx.fillRect(M, y, W - M * 2, 76)
  at('ยอดที่ชำระ', y + 22, { size: 28, weight: 700, color: '#ffffff', x: M + 20 })
  at(bahtText(paidAmount ?? totalAmount), y + 18, { size: 36, weight: 700, color: '#86efac', x: amountX - 20, align: 'right' })
  y += 76

  // ยอดรวมบิลไม่เท่ายอดที่ชำระ (จ่ายบางส่วน) — บอกไว้ไม่ให้เข้าใจผิด
  const total = Number(totalAmount) || 0
  const paid = Number(paidAmount ?? totalAmount) || 0
  if (total > 0 && Math.abs(total - paid) > 0.5) {
    y += 12
    at(`ยอดรวมตามบิล ${bahtText(total)} · คงเหลือ ${bahtText(total - paid)}`, y, { size: 23, color: '#b45309', x: amountX, align: 'right' })
    y += 30
  }

  // ── ประทับ PAID ──
  ctx.save()
  ctx.translate(W - M - 130, y + 96)
  ctx.rotate(-Math.PI / 9)
  ctx.font = `700 76px ${THAI_FONT_STACK}`
  ctx.fillStyle = '#86efac'
  const stamp = 'PAID'
  ctx.fillText(stamp, -ctx.measureText(stamp).width / 2, -38)
  ctx.restore()
  at('ชำระเรียบร้อยแล้ว', y + 54, { size: 27, weight: 600, color: '#059669' })

  // ── ท้ายใบเสร็จ ──
  hr(H - 138, '#e5e7eb')
  at('ขอบคุณที่ชำระเงิน', H - 112, { size: 27, weight: 600, color: '#374151', x: W / 2, align: 'center' })
  at('โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐานการชำระเงิน', H - 74, { size: 22, color: '#9ca3af', x: W / 2, align: 'center' })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('สร้างรูปใบเสร็จไม่สำเร็จ'))
    }, 'image/png')
  })
}
