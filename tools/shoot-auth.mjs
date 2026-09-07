// Screenshot harness สำหรับหน้าเข้าสู่ระบบ (AuthPage) — ไม่ seed session
// shoot.mjs seed session ไว้เสมอ จึงเข้าหน้า login ไม่ได้ ต้องมี harness แยก
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { installStubs, AUDIT_FN, FREEZE_CLOCK, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/auth'

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []

  for (const size of SIZES) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
        locale: 'th-TH',
      })
      await installStubs(context)
      // ไม่ seed auth token → App เห็น session=null → เรนเดอร์ AuthPage
      await context.addInitScript((t) => {
        localStorage.setItem('payrentpro-theme', t)
        localStorage.setItem('payrentpro_pdpa', '1')
      }, theme)
      await context.addInitScript(FREEZE_CLOCK)

      const page = await context.newPage()
      page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console] ${m.text().slice(0, 160)}`) })
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
      await page.waitForSelector('text=ดำเนินการต่อด้วย Google', { timeout: 10000 })

      const file = `${OUT}/auth_${size.tag}_${theme}.png`
      await page.screenshot({ path: file, fullPage: true })

      const a = await page.evaluate(AUDIT_FN, null)
      const g = await page.locator('button', { hasText: 'ดำเนินการต่อด้วย Google' }).boundingBox()
      report.push({ size: size.tag, theme, googleBtn: g, ...a })
      console.log(`✓ ${file}  google=${Math.round(g.width)}x${Math.round(g.height)}  overflowX=${a.scrollW > a.docW ? 'YES' : 'no'}  smallTargets=${a.small.length}`)
      if (a.small.length) console.log('  small(<44px):', JSON.stringify(a.small.slice(0, 10)))

      await context.close()
    }
  }

  await browser.close()
}

run().catch((e) => { console.error(e); process.exit(1) })
