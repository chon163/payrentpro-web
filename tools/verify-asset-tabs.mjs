// ตรวจแท็บสินทรัพย์ 3 ประเภทของโหมดเดโม่ (อสังหา / ยานพาหนะ / อุปกรณ์)
//
// ยิง DB จริง ไม่ stub — ต้องพิสูจน์ว่าข้อมูลที่ seed ไปโชว์ในแท็บจริง
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/asset-tabs'

const SIZES = [
  { tag: '375', width: 375, height: 812, mobile: true },
  { tag: '1280', width: 1280, height: 900, mobile: false },
]

// แท็บ → ข้อความที่ต้องเจอเมื่อกดแท็บนั้น (ยืนยันว่าโชว์ข้อมูลถูกกลุ่ม)
const TABS = [
  { name: 'อสังหา', expect: ['ห้อง 10'] },
  { name: 'ยานพาหนะ', expect: ['กก 1234', 'Fortuner'] },
  { name: 'อุปกรณ์', expect: ['CNC-01', 'Sony A7'] },
]

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  let failures = 0

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.mobile,
      hasTouch: size.mobile,
      locale: 'th-TH',
    })
    // ตั้ง consent PDPA ล่วงหน้า — ผู้ใช้จริงจะเจอ modal ที่มี backdrop
    // บังปุ่มแท็บทั้งหมด (ปุ่มในหน้าจริงเขียนว่า "ยินยอม")
    await context.addInitScript(() => {
      try { localStorage.setItem('payrentpro_pdpa', '1') } catch { /* ignore */ }
    })

    const page = await context.newPage()

    // เข้าโหมดเดโม่
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('button:has-text("เข้าโหมดเดโม่")').click()
    await page.waitForTimeout(4500)

    // เผื่อ modal ยังโผล่ (localStorage ถูกล้าง/อ่านไม่ได้) — กดผ่านให้ได้
    const pdpa = page.locator('button:has-text("ยินยอม")').first()
    if (await pdpa.count()) {
      await pdpa.click()
      await page.waitForTimeout(800)
      console.log(`  (กด "ยินยอม" PDPA แล้ว @${size.tag})`)
    }

    // ไปหน้ารายการสินทรัพย์
    await page.goto(BASE + '/assets', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)

    for (const tab of TABS) {
      // ปุ่มแท็บมีเลขนับต่อท้าย จึงใช้ has-text แบบ partial
      const btn = page.locator(`button:has-text("${tab.name}")`).first()
      const exists = await btn.count()
      if (!exists) {
        console.log(`✗ @${size.tag} ไม่เจอแท็บ "${tab.name}"`)
        failures++
        continue
      }
      await btn.click()
      await page.waitForTimeout(1200)

      const body = await page.locator('body').innerText()
      const hits = tab.expect.filter((t) => body.includes(t))
      const ok = hits.length > 0
      console.log(`${ok ? '✓' : '✗'} @${size.tag} แท็บ "${tab.name}" → เจอ ${hits.length}/${tab.expect.length} (${hits.join(', ') || 'ไม่เจอเลย'})`)
      if (!ok) failures++

      // ต้องไม่ขึ้นว่าว่างเปล่า
      const empty = body.includes('ยังไม่มีสินทรัพย์') || body.includes('ไม่พบรายการ')
      if (empty) {
        console.log(`  ✗ แท็บ "${tab.name}" ขึ้นว่าไม่มีข้อมูล`)
        failures++
      }

      await page.screenshot({
        path: `${OUT}/${tab.name.replace(/[^฀-๿a-zA-Z]/g, '')}_${size.tag}.png`,
        fullPage: true,
      })
    }

    await context.close()
  }

  await browser.close()
  console.log(failures === 0 ? '\n✅ PASS — แท็บสินทรัพย์ 3 ประเภทมีข้อมูลครบ' : `\n❌ FAIL ${failures} ข้อ`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
