// ตรวจหน้าตาใบเสร็จ PNG จริง — เรนเดอร์ผ่าน canvas ของเบราว์เซอร์แล้วเซฟไฟล์ออกมาดู
// (createReceiptPng ใช้ canvas + ฟอนต์ระบบ จึงตรวจด้วย build/unit test ไม่ได้ ต้องเปิดเบราว์เซอร์จริง)
//
// รัน: node tools/verify-receipt-png.mjs
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = 'gui-test-screenshots'

const PAGE = `<!doctype html><html><head>
<link rel="stylesheet" href="/node_modules/@fontsource/sarabun/thai-400.css">
<link rel="stylesheet" href="/node_modules/@fontsource/sarabun/thai-600.css">
<link rel="stylesheet" href="/node_modules/@fontsource/sarabun/thai-700.css">
</head><body><script type="module">
import { createReceiptPng } from '/src/utils/receipt.js'
const CASES = {
  normal: {
    custName: 'สมหญิง รักเรียน',
    itemDetails: 'อาคาร A · ห้อง 104',
    businessName: 'หอพักทดสอบ พร็อพเพอร์ตี้',
    ownerName: 'อนันต์ ทากเพียร',
    address: '123/45 ถนนสุขุมวิท กรุงเทพฯ 10110',
    items: [
      { label: 'ค่าเช่าห้อง', amount: 4200 },
      { label: 'ค่าน้ำ (12 หน่วย)', amount: 120 },
      { label: 'ค่าไฟ (27 หน่วย)', amount: 135 },
    ],
    totalAmount: 4455,
    paidAmount: 4455,
  },
  long: {
    custName: 'นางสาวประภัสสรา วงศ์ไพโรจน์กุลชัย',
    itemDetails: 'อาคาร A ชั้น 3 ห้อง 304 (ห้องแอร์ พร้อมเฟอร์นิเจอร์ครบ)',
    businessName: 'หอพักสุขสันต์ พร็อพเพอร์ตี้ แอนด์ แมเนจเมนท์ จำกัด',
    ownerName: 'นายอนันต์ ทากเพียรพิพัฒน์วงศ์สกุล',
    address: '123/45 หมู่ 5 ถนนสุขุมวิท แขวงคลองเตยเหนือ เขตวัฒนา กรุงเทพมหานคร 10110',
    items: [
      { label: 'ค่าเช่าห้องพักรายเดือน (ห้องแอร์ พร้อมเฟอร์นิเจอร์ครบชุด)', amount: 8500 },
      { label: 'ค่าน้ำประปา (35 หน่วย)', amount: 350 },
      { label: 'ค่าไฟฟ้า (240 หน่วย)', amount: 1200 },
      { label: 'ค่าปรับชำระล่าช้า (3 วัน)', amount: 150 },
      { label: 'ค่าใช้จ่ายอื่น ๆ', amount: 200 },
    ],
    totalAmount: 10400,
    paidAmount: 6000,
  },
  minimal: {
    custName: 'สมชาย ใจดี',
    itemDetails: 'รถกระบะ ทะเบียน 1กก 1234',
    totalAmount: 3800,
    paidAmount: 3800,
  },
}
// ยืนยันว่า Sarabun ถูกใช้วาดจริง ไม่ได้ตกไป fallback ของระบบ
// (จุดประสงค์ทั้งหมดของการฝังฟอนต์ — ถ้าตกไป fallback ไทยจะกลายเป็นอักขระเพี้ยน)
window.__fontOk = async () => {
  await document.fonts.load('400 29px Sarabun', 'ก่ำู๊')
  await document.fonts.ready
  const ctx = document.createElement('canvas').getContext('2d')
  const sample = 'ใบเสร็จรับเงิน ก่ำู๊ 4,455'
  ctx.font = '400 29px Sarabun'
  const withSarabun = Math.round(ctx.measureText(sample).width)
  ctx.font = '400 29px NoSuchFontXYZ'
  const fallback = Math.round(ctx.measureText(sample).width)
  return {
    loaded: document.fonts.check('400 29px Sarabun', 'ก่ำู๊'),
    withSarabun,
    fallback,
    differs: withSarabun !== fallback,
  }
}

window.__make = async (key) => {
  const blob = await createReceiptPng({
    period: 'ตุลาคม 2569',
    txId: 'eecd26ee-f8e2-4fa8-887d-55a342e7db03',
    paidAt: new Date().toISOString(),
    ...CASES[key],
  })
  const buf = new Uint8Array(await blob.arrayBuffer())

  // วัดขอบหมึกจริงจากพิกเซล — กันข้อความยาววาดล้นออกนอกขอบกระดาษ
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const cx = c.getContext('2d')
  cx.drawImage(bmp, 0, 0)
  const px = cx.getImageData(0, 0, bmp.width, bmp.height).data
  let minX = bmp.width
  let maxX = -1
  // ข้ามแถบหัวสีเข้ม (เต็มความกว้างโดยเจตนา) เริ่มวัดจากใต้แถบลงมา
  for (let yy = 210; yy < bmp.height; yy++) {
    for (let xx = 0; xx < bmp.width; xx++) {
      const i = (yy * bmp.width + xx) * 4
      if (px[i] < 245 || px[i + 1] < 245 || px[i + 2] < 245) {
        if (xx < minX) minX = xx
        if (xx > maxX) maxX = xx
      }
    }
  }
  return { type: blob.type, size: blob.size, bytes: Array.from(buf), w: bmp.width, minX, maxX }
}
</script></body></html>`

const server = await createServer({
  server: { port: 5199 },
  plugins: [{
    name: 'receipt-probe',
    configureServer(s) {
      s.middlewares.use('/__receipt', (_req, res) => {
        res.setHeader('Content-Type', 'text/html')
        res.end(PAGE)
      })
    },
  }],
})
await server.listen()

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')))
await page.goto('http://localhost:5199/__receipt')
try {
  await page.waitForFunction(() => typeof window.__make === 'function', null, { timeout: 15000 })
} catch {
  // vite อาจ re-optimize deps แล้ว reload ทับ — ลองโหลดซ้ำอีกครั้ง
  await page.goto('http://localhost:5199/__receipt')
  try {
    await page.waitForFunction(() => typeof window.__make === 'function', null, { timeout: 15000 })
  } catch (err) {
    console.log('โหลดสคริปต์ไม่สำเร็จ:', err.name)
    console.log('errors ที่จับได้:', errors.length ? errors : '(ไม่มี)')
    await browser.close()
    await server.close()
    process.exit(1)
  }
}

const M = 70 // ขอบกระดาษใน createReceiptPng
const report = (label, r) => {
  const bleeds = r.minX < M || r.maxX > r.w - M
  console.log(
    `[${label}] ${(r.size / 1024).toFixed(1)} KB | หมึก x=${r.minX}..${r.maxX} ` +
    `(ขอบ ${M}..${r.w - M}) → ${bleeds ? '❌ ล้นขอบ' : '✅ ไม่ล้น'}`
  )
  return bleeds
}

mkdirSync(OUT, { recursive: true })
let bad = false

const font = await page.evaluate(() => window.__fontOk())
console.log(
  `[ฟอนต์] Sarabun โหลดแล้ว=${font.loaded} | กว้าง ${font.withSarabun}px vs fallback ${font.fallback}px ` +
  `→ ${font.loaded && font.differs ? '✅ ใช้ Sarabun จริง' : '❌ ตกไป fallback (ไทยจะเพี้ยน)'}`
)
if (!font.loaded || !font.differs) bad = true

for (const [key, label] of [['normal', 'ปกติ      '], ['long', 'ข้อความยาว'], ['minimal', 'ไม่มีรายการ']]) {
  const r = await page.evaluate((k) => window.__make(k), key)
  writeFileSync(`${OUT}/receipt-${key}.png`, Buffer.from(r.bytes))
  if (report(label, r)) bad = true
}

console.log('บันทึกที่:', `${OUT}/receipt-{normal,long,minimal}.png`)
if (errors.length) console.log('ERRORS:', errors)

await browser.close()
await server.close()
process.exit(bad ? 1 : 0)
