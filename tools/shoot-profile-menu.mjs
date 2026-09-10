// เมนูโปรไฟล์มุมขวาบน — จับภาพตอน "เปิดอยู่" ที่ 375 / 1280 × light/dark
// (shoot.mjs จับหน้าเปล่าโดยไม่กดอะไร จึงไม่เห็น dropdown ที่เป็น portal)
//
// ตรวจ: dropdown อยู่ในจอ (ไม่ล้นขอบ) / ทุกแถวสูง >= 44px / รายการครบตาม brief
// / badge แพ็ก+วันเหลือแสดงถูก และเป็นสีแดงเมื่อ <= 3 วัน
// + การ์ด "สมาชิก" บนหน้าตั้งค่ามือถือ (ทางเข้าสำรองหลัง bottom-nav เหลือ 3 ปุ่ม)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { newStubbedContext, AUDIT_FN, MEMBERSHIP } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/profile-menu'

const SIZES = [
  { tag: '375', width: 375, height: 812, mobile: true },
  { tag: '1280', width: 1280, height: 900, mobile: false },
]

// fixtures.mjs ไม่มี ok/days_left (badge จึงไม่เคยขึ้นในภาพชุดเดิม) — override เฉพาะ harness นี้
// เพื่อทดสอบทั้งสถานะปกติและสถานะใกล้หมดอายุ (<=3 วัน → ต้องเป็นแดง)
const STATES = {
  normal: { ...MEMBERSHIP, ok: true, plan: 'starter', status: 'active', days_left: 42, room_limit: 20 },
  urgent: { ...MEMBERSHIP, ok: true, plan: 'starter', status: 'active', days_left: 2, room_limit: 20 },
  founder: { ...MEMBERSHIP, ok: true, plan: 'founder', status: 'active', days_left: 300, room_limit: 0 },
}

// วันเหลือที่คาดหวังของแต่ละสถานะ — ใช้ตรวจข้อความ badge ทั้งใน dropdown และการ์ดตั้งค่า
const EXPECT_DAYS = { normal: 42, urgent: 2, founder: 300 }

// ชุดที่ยิง: normal ครบทุกความกว้าง×ธีม, urgent อย่างละความกว้างเพื่อยืนยันสีแดง,
// founder เพื่อยืนยันว่าปุ่ม "ผู้ดูแล" ยังอยู่ทั้ง sidebar และ bottom-nav
const CASES = [
  { state: 'normal', size: SIZES[0], theme: 'light' },
  { state: 'normal', size: SIZES[0], theme: 'dark' },
  { state: 'normal', size: SIZES[1], theme: 'light' },
  { state: 'normal', size: SIZES[1], theme: 'dark' },
  { state: 'urgent', size: SIZES[0], theme: 'light' },
  { state: 'urgent', size: SIZES[1], theme: 'dark' },
  { state: 'founder', size: SIZES[0], theme: 'light' },
  { state: 'founder', size: SIZES[1], theme: 'dark' },
]

// Tailwind v4 คาย oklch() ไม่ใช่ rgb() — ตัดสิน "แดง" จาก chroma + hue
// (rose-*: C ~0.12-0.25, H ~10-20 / gray-*: C ~0.01-0.03 / emerald-*: H ~165)
const isRed = (color) => {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color || '')
  if (m) {
    const c = Number(m[2]), h = Number(m[3])
    return c >= 0.08 && h >= 5 && h <= 35
  }
  const rgb = /rgb\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(color || '')
  if (!rgb) return false
  const [, r, g, b] = rgb.map(Number)
  return r > 150 && r - g > 60 && r - b > 60
}

const openMenu = async (page) => {
  await page.click('button[aria-label="เมนูโปรไฟล์"]')
  await page.waitForTimeout(400)
}

const inspectMenu = (page) => page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="เมนูโปรไฟล์"]')
  // dropdown เป็น portal ที่ document.body — กล่อง fixed z-[61]
  const box = document.querySelector('div.fixed.z-\\[61\\]')
  if (!box) return { missing: true }
  const r = box.getBoundingClientRect()
  const rows = [...box.querySelectorAll('button')].map((b) => {
    const sub = b.querySelector('span > span.block.text-xs, span.block.text-xs')
    return {
      text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 48),
      h: Math.round(b.getBoundingClientRect().height),
      color: getComputedStyle(b).color,
      subColor: sub ? getComputedStyle(sub).color : null,
    }
  })
  return {
    expanded: btn.getAttribute('aria-expanded'),
    left: Math.round(r.left), right: Math.round(r.right),
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    bg: getComputedStyle(box).backgroundColor,
    viewportW: document.documentElement.clientWidth,
    viewportH: document.documentElement.clientHeight,
    rows,
    readonly: [...box.querySelectorAll('p')].map((p) => p.innerText.trim()),
  }
})

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []

  for (const c of CASES) {
    const { state, size, theme } = c
    const tag = `${state}_${size.tag}_${theme}`
    const context = await newStubbedContext(browser, size)
    await context.addInitScript((t) => localStorage.setItem('payrentpro-theme', t), theme)
    // override หลัง installStubs — route ที่ลงทีหลังชนะของเดิมใน playwright
    await context.route('**/rest/v1/rpc/get_membership_status', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATES[state]) }))

    const page = await context.newPage()
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console:${tag}] ${m.text().slice(0, 160)}`) })

    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)

    // sanity: ธีมถูกใช้จริง (ไม่งั้นภาพ dark จะเหมือน light แล้วเทสต์ไม่มีความหมาย)
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if ((theme === 'dark') !== isDark) throw new Error(`theme mismatch: want ${theme}, html.dark=${isDark}`)

    await openMenu(page)
    const file = `${OUT}/menu_${tag}.png`
    await page.screenshot({ path: file })

    const menu = await inspectMenu(page)
    const a = await page.evaluate(AUDIT_FN, null)

    // brief ข้อ 3/4: sidebar เดสก์ท็อปเหลือ หน้าแรก/สินทรัพย์(+ผู้ดูแล) และ bottom-nav
    // เหลือ 3 ปุ่ม (+ผู้ดูแล ถ้า founder) — ทั้งสองอย่างต้องไม่มี "สมาชิก" แล้ว
    const nav = await page.evaluate(() => ({
      sidebar: [...document.querySelectorAll('aside nav a')].map((el) => el.innerText.trim()),
      bottom: [...document.querySelectorAll('nav[aria-label="เมนูหลัก"] a')].map((el) => el.innerText.trim()),
    }))

    const inViewport = !menu.missing && menu.left >= 0 && menu.right <= menu.viewportW && menu.top >= 0 && menu.bottom <= menu.viewportH
    const shortRows = (menu.rows || []).filter((r) => r.h < 44)
    // dark mode ต้องได้พื้นเข้ม ไม่ใช่ขาว
    const darkBgOk = theme !== 'dark' || !/rgb\(255,\s*255,\s*255\)/.test(menu.bg || '')

    // brief ข้อ 5: ต้อง "ทดสอบสลับโหมด" จริง ไม่ใช่แค่ seed ธีมมาแต่แรก
    // → กดปุ่มสลับธีม (เมนู ⋯ ที่ <lg / ปุ่ม 🌙 ที่ lg) ทั้งที่ dropdown เปิดอยู่
    //   แล้วเปิดใหม่ ดูว่าพื้น dropdown เปลี่ยนขั้วสีตามธีมใหม่
    const toggled = await (async () => {
      const closeOverlays = async () => {
        // ปิดทั้ง backdrop ของ dropdown (z-[60]) และของเมนู ⋯ (z-40) — ถ้าเหลือค้าง
        // มันจะกินคลิกถัดไป (ปุ่มธีมในเมนู ⋯ ตั้งใจไม่ปิดเมนู เพื่อให้กดสลับซ้ำได้)
        await page.evaluate(() => {
          for (const sel of ['div.fixed.z-\\[60\\]', 'div.fixed.inset-0.z-40']) document.querySelector(sel)?.click()
        })
        await page.waitForTimeout(200)
      }
      await closeOverlays()
      const themeBtn = `button[aria-label="${theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}"]`
      // ปุ่มธีมเดสก์ท็อปยังอยู่ใน DOM ที่ 375 แต่ถูก lg:inline-flex ซ่อนไว้ — ต้องเช็ค visible ไม่ใช่ count
      const desktopBtn = page.locator(themeBtn).first()
      if (await desktopBtn.isVisible()) {
        await desktopBtn.click()
      } else {
        // <lg: ปุ่มสลับธีมอยู่ในเมนู ⋯
        await page.click('button[aria-label="เมนูเพิ่มเติม"]')
        await page.waitForTimeout(250)
        await page.getByRole('button', { name: theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด' }).click()
      }
      await page.waitForTimeout(500)
      const nowDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      await closeOverlays()
      await openMenu(page)
      const after = await inspectMenu(page)
      await page.screenshot({ path: `${OUT}/menu_${tag}_toggled.png` })
      return { nowDark, bg: after.bg, rows: after.rows }
    })()

    report.push({ ...c, tag, inViewport, shortRows, darkBgOk, menu, nav, toggled, smallTargets: a.small })

    console.log(`✓ ${file}`)
    console.log(`   inViewport=${inViewport ? 'yes' : 'NO'} box=[${menu.left},${menu.top}]-[${menu.right},${menu.bottom}] vp=${menu.viewportW}x${menu.viewportH} bg=${menu.bg}`)
    console.log(`   readonly: ${JSON.stringify(menu.readonly)}`)
    for (const r of menu.rows || []) console.log(`   row "${r.text}" h=${r.h} color=${r.color}${r.subColor ? ` sub=${r.subColor}` : ''}`)
    console.log(`   sidebar: ${JSON.stringify(nav.sidebar)}`)
    console.log(`   bottom-nav: ${JSON.stringify(nav.bottom)}`)
    console.log(`   สลับโหมด → dark=${toggled.nowDark} bg=${toggled.bg}`)

    // การ์ด "สมาชิก" บนหน้าตั้งค่า — ควรเห็นที่ 375 และซ่อนที่ 1280 (lg:hidden)
    await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const card = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('main button')].find((b) => (b.innerText || '').includes('สมาชิก'))
      if (!btn) return { present: false }
      const r = btn.getBoundingClientRect()
      const badge = btn.querySelector('span.rounded-full')
      return {
        // lg:hidden ทำให้ปุ่มยังอยู่ใน DOM แต่ยุบเป็น 0x0 — "เห็นจริง" ต้องมีขนาด
        present: r.width > 0 && r.height > 0,
        h: Math.round(r.height), w: Math.round(r.width),
        text: btn.innerText.replace(/\s+/g, ' ').trim().slice(0, 60),
        badgeColor: badge ? getComputedStyle(badge).color : null,
      }
    })
    await page.screenshot({ path: `${OUT}/settings_${tag}.png` })
    report[report.length - 1].settingsCard = card
    console.log(`   settings card: ${JSON.stringify(card)}`)

    await context.close()
  }

  await browser.close()
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1))

  console.log('\n===== SUMMARY =====')
  let fails = 0
  const fail = (m) => { console.log(`✗ ${m}`); fails++ }
  for (const r of report) {
    if (!r.inViewport) fail(`${r.tag}: dropdown ล้นขอบจอ`)
    if (r.shortRows.length) fail(`${r.tag}: ${r.shortRows.length} แถวสูง < 44px — ${JSON.stringify(r.shortRows)}`)
    if (!r.darkBgOk) fail(`${r.tag}: dark mode แต่พื้น dropdown ยังขาว`)

    // สลับโหมดแล้วต้องข้ามขั้วจริง และ dropdown ต้องตามธีมใหม่ (ไม่ค้างสีเดิม)
    const t = r.toggled
    if (t.nowDark === (r.theme === 'dark')) fail(`${r.tag}: กดสลับโหมดแล้ว html.dark ไม่เปลี่ยน (${t.nowDark})`)
    const bgIsWhite = /rgb\(255,\s*255,\s*255\)/.test(t.bg || '')
    if (t.nowDark && bgIsWhite) fail(`${r.tag}: สลับเป็น dark แล้วพื้น dropdown ยังขาว (${t.bg})`)
    if (!t.nowDark && !bgIsWhite) fail(`${r.tag}: สลับเป็น light แล้วพื้น dropdown ไม่ขาว (${t.bg})`)
    if ((t.rows || []).length !== (r.menu.rows || []).length) fail(`${r.tag}: หลังสลับโหมด จำนวนแถวใน dropdown เปลี่ยน`)

    const rows = r.menu.rows || []
    for (const want of ['สมาชิก', 'ตั้งค่าบัญชี', 'ออกจากระบบ']) {
      if (!rows.some((x) => x.text.includes(want))) fail(`${r.tag}: ไม่มีแถว "${want}"`)
    }
    if (!(r.menu.readonly || []).some((t) => t.includes('@'))) fail(`${r.tag}: ไม่มีอีเมลเต็มแบบอ่านอย่างเดียว`)

    const member = rows.find((x) => x.text.includes('สมาชิก'))
    const expectDays = EXPECT_DAYS[r.state]
    if (!member?.text.includes(`เหลือ ${expectDays} วัน`)) fail(`${r.tag}: แถวสมาชิกไม่แสดง "เหลือ ${expectDays} วัน" — ได้ "${member?.text}"`)
    if (r.state === 'urgent' && !isRed(member?.subColor)) fail(`${r.tag}: <=3 วัน แต่ข้อความไม่แดง (${member?.subColor})`)
    if (r.state === 'normal' && isRed(member?.subColor)) fail(`${r.tag}: 42 วัน แต่ข้อความเป็นแดง (${member?.subColor})`)

    const signOut = rows.find((x) => x.text.includes('ออกจากระบบ'))
    if (!isRed(signOut?.color)) fail(`${r.tag}: ปุ่มออกจากระบบไม่ใช่ตัวอักษรแดง (${signOut?.color})`)

    // การ์ดในหน้าตั้งค่า: โชว์เฉพาะ <lg และ badge ต้องแดงเมื่อ <=3 วัน
    const wantCard = r.size.tag !== '1280'
    if (wantCard && !r.settingsCard.present) fail(`${r.tag}: หน้าตั้งค่ามือถือไม่มีการ์ด "สมาชิก"`)
    if (wantCard && r.settingsCard.present) {
      if (r.settingsCard.h < 44) fail(`${r.tag}: การ์ดสมาชิกสูง ${r.settingsCard.h}px < 44`)
      if (!r.settingsCard.text.includes(`เหลือ ${expectDays} วัน`)) fail(`${r.tag}: การ์ดสมาชิกไม่มี badge วันหมด — "${r.settingsCard.text}"`)
      if (r.state === 'urgent' && !isRed(r.settingsCard.badgeColor)) fail(`${r.tag}: การ์ดสมาชิก <=3 วัน แต่ badge ไม่แดง (${r.settingsCard.badgeColor})`)
    }
    if (!wantCard && r.settingsCard.present) fail(`${r.tag}: เดสก์ท็อปไม่ควรเห็นการ์ด "สมาชิก" (lg:hidden)`)

    // sidebar/bottom-nav ต้องไม่มี "สมาชิก" และ "ตั้งค่า" ต้องหลุดจาก sidebar (ยังอยู่ที่ bottom-nav)
    // /admin เป็น founderOnly → จำนวนรายการที่คาดหวังต่างกันตามแพ็ก
    const { sidebar, bottom } = r.nav
    const isFounder = r.state === 'founder'
    if (sidebar.some((t) => t.includes('สมาชิก'))) fail(`${r.tag}: sidebar ยังมี "สมาชิก" — ${JSON.stringify(sidebar)}`)
    if (sidebar.some((t) => t.includes('ตั้งค่า'))) fail(`${r.tag}: sidebar ยังมี "ตั้งค่า" — ${JSON.stringify(sidebar)}`)
    if (!sidebar.some((t) => t.includes('แดชบอร์ด')) || !sidebar.some((t) => t.includes('สินทรัพย์'))) {
      fail(`${r.tag}: sidebar ขาดหน้าแรก/สินทรัพย์ — ${JSON.stringify(sidebar)}`)
    }
    const wantSidebar = isFounder ? 3 : 2 // หน้าแรก/สินทรัพย์ (+ผู้ดูแล ถ้า founder)
    if (sidebar.length !== wantSidebar) fail(`${r.tag}: sidebar ควรมี ${wantSidebar} รายการ ได้ ${sidebar.length} — ${JSON.stringify(sidebar)}`)
    if (isFounder && !sidebar.some((t) => t.includes('ผู้ดูแล'))) fail(`${r.tag}: founder ควรเห็น "ผู้ดูแล" ใน sidebar`)

    if (bottom.some((t) => t.includes('สมาชิก'))) fail(`${r.tag}: bottom-nav ยังมี "สมาชิก" — ${JSON.stringify(bottom)}`)
    const wantBottom = isFounder ? 4 : 3 // หน้าแรก/สินทรัพย์/ตั้งค่า (+ผู้ดูแล ถ้า founder)
    if (bottom.length !== wantBottom) fail(`${r.tag}: bottom-nav ควรมี ${wantBottom} ปุ่ม ได้ ${bottom.length} — ${JSON.stringify(bottom)}`)
    for (const want of ['หน้าแรก', 'สินทรัพย์', 'ตั้งค่า']) {
      if (!bottom.some((t) => t.includes(want))) fail(`${r.tag}: bottom-nav ขาดปุ่ม "${want}" — ${JSON.stringify(bottom)}`)
    }
  }
  console.log(fails === 0 ? `✓ ผ่านทั้ง ${report.length} ชุด — dropdown ในจอ, 44px, badge/สีถูก, sidebar/bottom-nav สะอาด, การ์ดตั้งค่ามือถือมี` : `\n${fails} fails`)
  if (fails) process.exit(1)
}

run().catch((e) => { console.error(e); process.exit(1) })
