import { jsPDF } from 'jspdf'

// jsPDF ฟอนต์ standard (Helvetica) วาดภาษาไทยไม่ได้
// → ข้อความไทยทั้งหมดวาดผ่าน canvas ของ browser (ฟอนต์ระบบ) แล้วแปลงเป็น PNG ฝังใน PDF
const THAI_FONT_STACK = '"Segoe UI", "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'

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
