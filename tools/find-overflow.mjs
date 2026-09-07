// หา element ที่ทำให้หน้ากว้างเกิน viewport — ใช้ stub เดียวกับ shoot.mjs
// ใช้: node tools/find-overflow.mjs assets 1280   (ส่งชื่อหน้าแบบไม่มี / เพื่อกัน Git Bash แปลง path)
import { chromium } from 'playwright'
import fs from 'node:fs'

const NAME = (process.argv[2] || 'assets').replace(/^\/+/, '')
const WIDTH = Number(process.argv[3] || 1280)
const URL_PATH = NAME === 'dashboard' ? '/' : '/' + NAME

const src = fs.readFileSync('tools/shoot.mjs', 'utf8')
const m = src.match(/const INIT_SCRIPT[\s\S]*?\n\}\n/)
let INIT_SCRIPT = null
if (m) {
  fs.writeFileSync('tools/_init_tmp.mjs', m[0] + '\nexport { INIT_SCRIPT }\n')
  try {
    ;({ INIT_SCRIPT } = await import('./_init_tmp.mjs?t=' + Date.now()))
  } catch (e) {
    fs.appendFileSync('gui-test-screenshots/overflow.json', '')
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 })
if (INIT_SCRIPT) await ctx.addInitScript(INIT_SCRIPT)
const page = await ctx.newPage()
await page.goto('http://localhost:5174' + URL_PATH, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3200)

const report = await page.evaluate((VW) => {
  const bad = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const right = r.left + r.width
    if (right <= VW + 1 && r.left >= -1) continue
    // ข้าม element ที่อยู่ในกล่องซึ่งเลื่อนแนวนอนได้ (ตั้งใจให้ scroll)
    let p = el.parentElement
    let scrollable = false
    while (p && p !== document.body) {
      const cs = getComputedStyle(p)
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { scrollable = true; break }
      p = p.parentElement
    }
    if (scrollable) continue
    bad.push({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 64),
      left: Math.round(r.left),
      right: Math.round(right),
      w: Math.round(r.width),
      txt: (el.textContent || '').trim().slice(0, 22),
    })
  }
  return {
    page: location.pathname,
    viewport: VW,
    docScrollW: document.documentElement.scrollWidth,
    offenders: bad.length,
    worst: bad.sort((a, b) => b.right - a.right).slice(0, 10),
  }
}, WIDTH)

fs.writeFileSync('gui-test-screenshots/overflow.json', JSON.stringify(report, null, 1))
await browser.close()
try { fs.unlinkSync('tools/_init_tmp.mjs') } catch {}
console.log('offenders=' + report.offenders + ' docScrollW=' + report.docScrollW)
