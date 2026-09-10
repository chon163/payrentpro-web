// ตรวจปุ่ม "เข้าโหมดเดโม่" ว่ากดแล้วเข้าแดชบอร์ดพร้อมข้อมูลจริง
//
// ต่างจาก harness อื่น: **ไม่ stub** Supabase — ยิง DB จริงเพื่อพิสูจน์ว่า
// บัญชีเดโม่ login ได้จริงและเห็นข้อมูลจริง (stub จะทำให้ทดสอบไม่มีความหมาย)
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/demo-mode'

const SIZES = [
  { tag: '375', width: 375, height: 812, mobile: true },
  { tag: '1280', width: 1280, height: 900, mobile: false },
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
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })

    // 1) หน้า login ต้องมีปุ่มเดโม่
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)

    const demoBtn = page.locator('button:has-text("เข้าโหมดเดโม่")')
    const found = await demoBtn.count()
    console.log(`${found ? '✓' : '✗'} @${size.tag} เจอปุ่มเดโม่: ${found}`)
    if (!found) { failures++; await context.close(); continue }

    await page.screenshot({ path: `${OUT}/login_${size.tag}.png`, fullPage: true })

    // 2) กดแล้วต้องเข้าแดชบอร์ด
    await demoBtn.click()
    await page.waitForTimeout(5000)

    const url = page.url()
    const stillLogin = await page.locator('button:has-text("เข้าโหมดเดโม่")').count()
    const okDash = stillLogin === 0
    console.log(`${okDash ? '✓' : '✗'} @${size.tag} เข้าแดชบอร์ด (url=${url.replace(BASE, '') || '/'})`)
    if (!okDash) failures++

    // 3) ต้องเห็นข้อมูลจริง ไม่ใช่หน้าว่าง
    const body = await page.locator('body').innerText()
    const checks = [
      { label: 'ชื่อกิจการเดโม่', ok: body.includes('เดโม่') || body.includes('สุขใจ') },
      { label: 'มีเลขห้อง', ok: /ห้อง\s*\d{3}/.test(body) },
      { label: 'มีจำนวนเงิน ฿', ok: body.includes('฿') },
      { label: 'ไม่ใช่หน้าเริ่มทดลองใช้', ok: !body.includes('เริ่มทดลองใช้ฟรี') },
    ]
    for (const c of checks) {
      console.log(`  ${c.ok ? '✓' : '✗'} ${c.label}`)
      if (!c.ok) failures++
    }

    await page.screenshot({ path: `${OUT}/dashboard_${size.tag}.png`, fullPage: true })

    // 4) หน้าการเงินต้องมีข้อมูล
    await page.goto(BASE + '/finance', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    const finBody = await page.locator('body').innerText()
    const finOk = finBody.includes('฿') && !finBody.includes('ยังไม่มีรายการ')
    console.log(`  ${finOk ? '✓' : '✗'} /finance มีข้อมูล`)
    if (!finOk) failures++
    await page.screenshot({ path: `${OUT}/finance_${size.tag}.png`, fullPage: true })

    // 5) หน้าสื่อสารต้องมีข้อมูล
    await page.goto(BASE + '/comms', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const commsBody = await page.locator('body').innerText()
    const commsOk = commsBody.includes('หยุดน้ำ') || commsBody.includes('Wi-Fi')
    console.log(`  ${commsOk ? '✓' : '✗'} /comms มีประกาศ`)
    if (!commsOk) failures++
    await page.screenshot({ path: `${OUT}/comms_${size.tag}.png`, fullPage: true })

    if (errors.length) console.log(`  [console errors] ${errors.slice(0, 3).join(' | ')}`)
    await context.close()
  }

  await browser.close()
  console.log(failures === 0 ? '\n✅ PASS — โหมดเดโม่ใช้ได้จริง' : `\n❌ FAIL ${failures} ข้อ`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
