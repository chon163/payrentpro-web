// ตรวจหน้า /devtest — เฟรมทั้ง 4 ต้องโหลดหน้าจริงและรับคำสั่งธีมจาก toolbar
// stub ของ fixtures.mjs ผูกที่ระดับ context จึงครอบ iframe ให้ด้วย ไม่ต้อง stub ซ้ำ
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { newStubbedContext } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/devtest'
const EXPECTED_FRAMES = 4

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  // ดู /devtest บนจอกว้าง — หน้านี้เป็นเครื่องมือ dev ตั้งใจให้ scroll แนวนอน
  const context = await newStubbedContext(browser, { tag: 'devtest', width: 1600, height: 1000, mobile: false })
  const page = await context.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })

  await page.goto(`${BASE}/devtest`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const frames = page.frames().filter((f) => f !== page.mainFrame())
  console.log(`frames: ${frames.length} (ต้องได้ ${EXPECTED_FRAMES})`)
  for (const f of frames) {
    const heading = await f.locator('body').first().innerText().catch(() => '')
    console.log(`  - ${f.url().replace(BASE, '')} | เนื้อหา ${heading.trim().length} ตัวอักษร`)
  }

  await page.screenshot({ path: `${OUT}/01-dashboard-light.png`, fullPage: false })

  // สลับไปหน้า Assets แล้วเช็คว่าทุกเฟรมเปลี่ยน url ตาม
  await page.getByRole('button', { name: 'Assets' }).click()
  await page.waitForTimeout(2500)
  const urls = page.frames().filter((f) => f !== page.mainFrame()).map((f) => new URL(f.url()).pathname)
  console.log(`หลังกด Assets → ${JSON.stringify(urls)}`)
  await page.screenshot({ path: `${OUT}/02-assets-light.png`, fullPage: false })

  // สลับ dark — ต้องมี class "dark" บน <html> ของทุกเฟรม
  await page.getByRole('button', { name: /Light|Dark/ }).click()
  await page.waitForTimeout(1200)
  const darks = []
  for (const f of page.frames().filter((x) => x !== page.mainFrame())) {
    darks.push(await f.evaluate(() => document.documentElement.classList.contains('dark')).catch(() => 'err'))
  }
  console.log(`dark ในแต่ละเฟรม: ${JSON.stringify(darks)}`)
  await page.screenshot({ path: `${OUT}/03-assets-dark.png`, fullPage: false })

  const ok = frames.length === EXPECTED_FRAMES && darks.every((d) => d === true)
  console.log(`\nconsole errors: ${errors.length}`)
  errors.slice(0, 6).forEach((e) => console.log(`  ! ${e}`))
  console.log(ok ? '\n✓ ผ่าน' : '\n✗ ไม่ผ่าน')

  await context.close()
  await browser.close()
  if (!ok) process.exit(1)
}

run().catch((e) => { console.error(e); process.exit(1) })
