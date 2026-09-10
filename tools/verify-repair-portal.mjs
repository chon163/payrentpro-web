// ตรวจหน้าแจ้งซ่อมของผู้เช่า (/repair) — ทั้งก่อนและหลังเข้าระบบ
// เกณฑ์: 375/768 ต้อง 0 small targets และไม่มี overflow แนวนอน
//
// หน้านี้เป็น public (ไม่มี session ของ Supabase) จึงใช้ context เปล่า
// ไม่ใช่ newStubbedContext ที่ seed session ของเจ้าของไว้ — แต่ยัง stub REST
// ผ่าน installStubs เพื่อไม่ให้ยิง DB จริง
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { installStubs, SIZES, FREEZE_CLOCK } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/repair-portal'

// วัด tap target + overflow ด้วยเกณฑ์เดียวกับ tools/shoot.mjs
const AUDIT = () => {
  const small = []
  const sel = 'button, a, input, select, textarea, [role="button"]'
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    if (r.height < 44) {
      small.push({
        el: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.'),
        text: (el.textContent || '').trim().slice(0, 40),
        h: Math.round(r.height),
        w: Math.round(r.width),
      })
    }
  }
  return {
    scrollW: document.documentElement.scrollWidth,
    docW: document.documentElement.clientWidth,
    small,
  }
}

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []
  let failures = 0

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      isMobile: size.mobile,
      hasTouch: size.mobile,
      locale: 'th-TH',
    })
    await installStubs(context)
    await context.addInitScript(FREEZE_CLOCK)
    const page = await context.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') console.log(`  [console:${size.tag}] ${m.text().slice(0, 160)}`)
    })

    // ── 1) หน้าล็อกอิน ──
    await page.goto(BASE + '/repair', { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    let a = await page.evaluate(AUDIT)
    let overflow = a.scrollW > a.docW
    let bad = size.mobile && a.small.length > 0
    if (overflow || bad) failures++
    report.push({ view: 'login', tag: size.tag, overflow, small: a.small.length })
    console.log(`${overflow || bad ? '✗' : '✓'} login @${size.tag}  overflowX=${overflow ? 'YES' : 'no'} smallTargets=${a.small.length}`)
    if (a.small.length) console.log('   ', JSON.stringify(a.small))
    await page.screenshot({ path: `${OUT}/login_${size.tag}.png`, fullPage: true })

    // ── 2) เข้าระบบ → หน้าแจ้งซ่อม + ประวัติ ──
    await page.fill('#phone', '0812345678')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(700)

    const loggedIn = await page.locator('text=ประวัติการแจ้ง').count()
    if (loggedIn === 0) {
      console.log(`✗ login @${size.tag} — เข้าระบบไม่สำเร็จ (ไม่เจอ "ประวัติการแจ้ง")`)
      failures++
    }

    a = await page.evaluate(AUDIT)
    overflow = a.scrollW > a.docW
    bad = size.mobile && a.small.length > 0
    if (overflow || bad) failures++
    report.push({ view: 'home', tag: size.tag, overflow, small: a.small.length })
    console.log(`${overflow || bad ? '✗' : '✓'} home  @${size.tag}  overflowX=${overflow ? 'YES' : 'no'} smallTargets=${a.small.length}`)
    if (a.small.length) console.log('   ', JSON.stringify(a.small))
    await page.screenshot({ path: `${OUT}/home_${size.tag}.png`, fullPage: true })

    await context.close()
  }

  await browser.close()
  console.log('\n===== SUMMARY =====')
  console.table(report)
  console.log(failures === 0 ? '✅ PASS ทุกช่อง' : `❌ FAIL ${failures} ช่อง`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
