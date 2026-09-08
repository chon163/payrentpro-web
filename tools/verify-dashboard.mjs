// ตรวจโครงแดชบอร์ดใหม่ตาม tmp/dashboard-guide.md — วัดจาก DOM ไม่ต้องพึ่งการดูภาพ
import { chromium } from 'playwright'
import { newStubbedContext, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const browser = await chromium.launch()

for (const size of SIZES) {
  const ctx = await newStubbedContext(browser, size)
  const p = await ctx.newPage()
  await p.goto(BASE + '/', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)

  const r = await p.evaluate(() => {
    const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
    const main = document.querySelector('main')
    const heading = [...main.querySelectorAll('h2')].find((h) => txt(h) === 'ภาพรวมระบบ')
    // การ์ด KPI = ตัวที่มีแถบสีซ้าย (absolute inset-y-0 left-0)
    const kpi = [...main.querySelectorAll('.relative.overflow-hidden.rounded-2xl')].filter((el) => el.querySelector('span.absolute.inset-y-0'))
    const room = [...main.querySelectorAll('.bg-gradient-to-br.rounded-2xl, .rounded-2xl.bg-gradient-to-br')]
    const cols = (el) => (el ? getComputedStyle(el).gridTemplateColumns.split(' ').length : 0)
    const panels = [...main.querySelectorAll('section h3')].map((h) => txt(h))
    const quickRows = [...main.querySelectorAll('button')].filter((b) => /รอตรวจสลิป|งานซ่อมค้าง|ค้างชำระเกินกำหนด|สัญญาใกล้หมดอายุ/.test(txt(b)))
    const anchors = ['dash-lease', 'dash-pending', 'dash-repair', 'dash-urgent'].filter((id) => document.getElementById(id))
    return {
      heading: !!heading,
      subline: txt(heading?.parentElement?.querySelector('p')).slice(0, 80),
      kpiCount: kpi.length,
      kpiCols: cols(kpi[0]?.parentElement),
      kpiLabels: kpi.map((el) => txt(el.querySelector('p'))),
      roomCount: room.length,
      roomCols: cols(room[0]?.parentElement),
      roomLabels: room.map((el) => txt(el.querySelector('p'))),
      panels,
      quickRows: quickRows.length,
      anchors,
      recentPaymentRows: document.querySelectorAll('section li').length,
    }
  })

  console.log(`\n===== ${size.width}px =====`)
  console.log(`หัวเรื่อง "ภาพรวมระบบ": ${r.heading ? '✓' : '✗'}  | subline: ${r.subline}`)
  console.log(`KPI: ${r.kpiCount} ใบ / ${r.kpiCols} คอลัมน์  ${JSON.stringify(r.kpiLabels)}`)
  console.log(`สถานะห้อง: ${r.roomCount} ใบ / ${r.roomCols} คอลัมน์  ${JSON.stringify(r.roomLabels)}`)
  console.log(`สรุปด่วน: ${r.quickRows} แถว | anchors: ${r.anchors.join(',')}`)
  console.log(`การ์ด: ${JSON.stringify(r.panels)}`)
  await ctx.close()
}
await browser.close()
