// ตรวจการแยก 4 บล็อกงานค้างออกจากแดชบอร์ดเป็นหน้าของตัวเอง — วัดจาก DOM ไม่ต้องดูภาพ
//
// เกณฑ์:
//  1. แดชบอร์ด (/) ต้องไม่มีหัวเรื่องของงานค้างทั้ง 4 เหลืออยู่ และไม่มีการ์ด "ล่าสุด" ทั้งสอง
//  2. แต่ละหน้างานค้างต้องมีหัวเรื่องของเรื่องตัวเอง และไม่มีของหน้าอื่นปนมา
//  3. แถบแท็บต้องมี 4 ปุ่มทุกหน้า สูง >= 44px ที่ touch และไม่ล้นจอ
//  4. การ์ด "สรุปด่วน" บนแดชบอร์ดต้องเป็นลิงก์ไป 4 หน้านั้น (ไม่ใช่ scroll ในหน้าเดิม)
//  5. เมนู "งานค้าง" ต้องไฮไลต์ทุกหน้าในกลุ่ม
import { chromium } from 'playwright'
import { newStubbedContext, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'

// หัวเรื่อง <h2> ประจำแต่ละบล็อกงาน (ข้อความจริงที่คอมโพเนนต์เรนเดอร์)
const HEADINGS = {
  pending: 'รอตรวจสอบสลิป',
  overdue: 'ต้องทวงด่วน',
  repairs: 'แจ้งซ่อม',
  leases: 'สัญญาใกล้หมดอายุ',
}
const TASK_ROUTES = [
  { path: '/pending', key: 'pending' },
  { path: '/overdue', key: 'overdue' },
  { path: '/repairs', key: 'repairs' },
  { path: '/leases', key: 'leases' },
]

const PROBE = () => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const main = document.querySelector('main')
  const box = (el) => {
    const r = el?.getBoundingClientRect()
    return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null
  }
  // แถบแท็บ = กล่องที่มีลิงก์ไป 4 path นี้
  const tabLinks = [...document.querySelectorAll('main a[href]')].filter((a) =>
    ['/pending', '/overdue', '/repairs', '/leases'].includes(new URL(a.href).pathname))
  return {
    h2: [...main.querySelectorAll('h2')].map(txt),
    h3: [...main.querySelectorAll('h3')].map(txt),
    // ลิงก์ในแถบแท็บ (ตัวแรกของแต่ละ path) + ขนาดปุ่ม
    tabs: ['/pending', '/overdue', '/repairs', '/leases'].map((p) => {
      const a = tabLinks.find((x) => new URL(x.href).pathname === p)
      return { path: p, found: !!a, ...(box(a) || {}) }
    }),
    // เมนูข้าง/แถบล่างที่ไฮไลต์อยู่ (คลาส indigo)
    navActive: [...document.querySelectorAll('aside a, nav a')]
      .filter((a) => /indigo/.test(a.className))
      .map((a) => new URL(a.href).pathname),
    scrollW: document.documentElement.scrollWidth,
    docW: document.documentElement.clientWidth,
    // anchor เดิมของแดชบอร์ดต้องไม่เหลือ
    oldAnchors: ['dash-pending', 'dash-urgent', 'dash-repair', 'dash-lease'].filter((id) => document.getElementById(id)),
  }
}

const browser = await chromium.launch()
let fails = 0
const fail = (msg) => { fails++; console.log(`  ✗ ${msg}`) }
const ok = (msg) => console.log(`  ✓ ${msg}`)

for (const size of SIZES) {
  console.log(`\n===== ${size.width}px =====`)
  const ctx = await newStubbedContext(browser, size)
  const page = await ctx.newPage()

  // ---- 1. แดชบอร์ดต้องเหลือแค่ภาพรวม ----
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  const dash = await page.evaluate(PROBE)

  const leaked = Object.entries(HEADINGS).filter(([, h]) => dash.h2.includes(h)).map(([k]) => k)
  if (leaked.length) fail(`แดชบอร์ดยังมีบล็อกงานค้างเหลืออยู่: ${leaked.join(', ')}`)
  else ok('แดชบอร์ดไม่มีบล็อกงานค้างทั้ง 4 แล้ว')

  const recentLeft = ['ชำระเงินล่าสุด', 'คำขอซ่อมล่าสุด'].filter((t) => dash.h3.includes(t))
  if (recentLeft.length) fail(`แดชบอร์ดยังมีการ์ดล่าสุด: ${recentLeft.join(', ')}`)
  else ok('การ์ด "ล่าสุด" ทั้งสองย้ายออกจากแดชบอร์ดแล้ว')

  if (dash.oldAnchors.length) fail(`anchor เดิมยังเหลือ: ${dash.oldAnchors.join(', ')}`)
  else ok('ไม่มี anchor dash-* ค้าง')

  // สรุปด่วนต้องยังอยู่ และเป็นลิงก์ไป 4 หน้า
  if (!dash.h3.includes('สรุปด่วน')) fail('การ์ด "สรุปด่วน" หายจากแดชบอร์ด')
  else {
    const missing = dash.tabs.filter((t) => !t.found).map((t) => t.path)
    if (missing.length) fail(`สรุปด่วนไม่ได้ลิงก์ไป: ${missing.join(', ')}`)
    else ok('สรุปด่วนลิงก์ไปครบทั้ง 4 หน้า')
  }

  // ---- 2-5. แต่ละหน้างานค้าง ----
  for (const route of TASK_ROUTES) {
    await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const r = await page.evaluate(PROBE)
    const mine = HEADINGS[route.key]

    // หน้านี้ต้องมีเรื่องของตัวเอง — ยอมรับทั้งกรณีมีรายการ (h2) และกรณีว่าง (h3 ในการ์ดว่าง)
    const hasOwn = r.h2.includes(mine) || r.h3.some((h) => h.includes(mine.slice(0, 8)))
      || r.h3.some((h) => /ไม่มี/.test(h))
    if (!hasOwn) fail(`${route.path} ไม่มีหัวเรื่อง "${mine}"`)

    // ต้องไม่มีเรื่องของหน้าอื่นปนมา ("แจ้งซ่อม" เป็น substring ของข้อความอื่นได้ จึงเทียบเต็มคำ)
    const others = Object.entries(HEADINGS)
      .filter(([k]) => k !== route.key)
      .filter(([, h]) => r.h2.includes(h))
      .map(([k]) => k)
    if (others.length) fail(`${route.path} มีบล็อกของหน้าอื่นปนมา: ${others.join(', ')}`)

    // แถบแท็บครบ 4 ปุ่ม + tap target 44px ที่ touch
    const missingTabs = r.tabs.filter((t) => !t.found).map((t) => t.path)
    if (missingTabs.length) fail(`${route.path} แถบแท็บขาด: ${missingTabs.join(', ')}`)
    if (size.mobile) {
      const small = r.tabs.filter((t) => t.found && t.h < 44).map((t) => `${t.path}=${t.h}px`)
      if (small.length) fail(`${route.path} ปุ่มแท็บเตี้ยกว่า 44px: ${small.join(', ')}`)
    }

    // เมนูหลักต้องไฮไลต์ /pending (กลุ่มงานค้าง) ทุกหน้าในกลุ่ม
    if (!r.navActive.includes('/pending')) fail(`${route.path} เมนู "งานค้าง" ไม่ไฮไลต์`)

    if (r.scrollW > r.docW) fail(`${route.path} ล้นแนวนอน (${r.scrollW} > ${r.docW})`)

    if (hasOwn && !others.length && !missingTabs.length) ok(`${route.path} — "${mine}" อยู่หน้าตัวเอง แท็บครบ ไม่ล้น`)
  }

  await ctx.close()
}

await browser.close()
console.log(fails === 0 ? '\n✓ ผ่านทุกเกณฑ์' : `\n✗ ไม่ผ่าน ${fails} ข้อ`)
process.exit(fails === 0 ? 0 : 1)
