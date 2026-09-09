// Responsive screenshot harness — 375 / 768 / 1280 for every page.
// Supabase REST + auth are stubbed (tools/fixtures.mjs) so all three widths
// render identical fixtures and only layout differs.
//
// Modals live in tools/shoot-modals.mjs.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { newStubbedContext, AUDIT_FN, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/responsive'

const PAGES = [
  { name: '01-dashboard', path: '/' },
  { name: '02-assets', path: '/assets' },
  { name: '02b-finance', path: '/finance' },
  { name: '02c-comms', path: '/comms' },
  { name: '03-settings', path: '/settings' },
  { name: '04-audit', path: '/audit' },
  { name: '05-membership', path: '/membership' },
  { name: '06-admin', path: '/admin' },
  { name: '07-bill', path: '/bill/tok-bill-0001' },
  // แท็บประวัติของหน้าบิล — บอท LINE ส่งลิงก์ #history ให้ผู้เช่า
  { name: '08-bill-history', path: '/bill/tok-bill-0001#history' },
]

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []

  for (const size of SIZES) {
    const context = await newStubbedContext(browser, size)
    const page = await context.newPage()
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console:${size.tag}] ${m.text().slice(0, 160)}`) })

    for (const p of PAGES) {
      await page.goto(BASE + p.path, { waitUntil: 'networkidle' })
      // Recharts เล่นอนิเมชัน ~1500ms — ต้องรอให้จบก่อน ไม่งั้นกราฟถูกจับกลางทางและ pixdiff เพี้ยน
      await page.waitForTimeout(2200)
      const file = `${OUT}/${p.name}_${size.tag}.png`
      await page.screenshot({ path: file, fullPage: true })
      const a = await page.evaluate(AUDIT_FN, null)
      report.push({ page: p.name, size: size.tag, ...a })
      console.log(`✓ ${file}  overflowX=${a.scrollW > a.docW ? 'YES(' + a.scrollW + '>' + a.docW + ')' : 'no'} smallTargets=${a.small.length}`)
    }
    await context.close()
  }

  await browser.close()
  writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 1))
  console.log('\n===== AUDIT =====')
  for (const r of report) {
    if (r.scrollW > r.docW || r.small.length || r.overflow.length) {
      console.log(`\n[${r.page} @ ${r.size}] scrollW=${r.scrollW} docW=${r.docW}`)
      if (r.overflow.length) console.log('  overflow:', JSON.stringify(r.overflow.slice(0, 8)))
      if (r.small.length) console.log('  small(<44px):', JSON.stringify(r.small.slice(0, 14)))
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1) })
