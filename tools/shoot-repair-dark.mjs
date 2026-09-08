// ตรวจกล่องแจ้งซ่อม + แท็บประวัติในธีมมืด และวัด tap target ของปุ่มใหม่เท่านั้น
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { newStubbedContext, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const OUT = 'gui-test-screenshots/repair-dark'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
for (const size of SIZES) {
  const ctx = await newStubbedContext(browser, size)
  await ctx.addInitScript(() => {
    localStorage.setItem('payrentpro-theme', 'dark')
    document.documentElement.classList.add('dark')
  })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `${OUT}/dashboard_${size.tag}_dark.png`, fullPage: true })

  const repair = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find((s) => s.textContent.includes('แจ้งซ่อม'))
    if (!sec) return { found: false }
    const btns = [...sec.querySelectorAll('button')].map((b) => {
      const r = b.getBoundingClientRect()
      return { text: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 20), h: Math.round(r.height), w: Math.round(r.width) }
    })
    const cs = getComputedStyle(sec)
    return { found: true, bg: cs.backgroundColor, buttons: btns, cards: sec.querySelectorAll('.tabular-nums').length }
  })
  console.log(`[${size.tag} dark] repair:`, JSON.stringify(repair))

  // แท็บประวัติของหน้าบิล
  await page.goto(`${BASE}/bill/tok-bill-0001#history`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/bill-history_${size.tag}_dark.png`, fullPage: true })
  const hist = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')].filter((b) => /บิลงวดนี้|ประวัติทั้งหมด/.test(b.innerText))
    return {
      tabs: tabs.map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), h: Math.round(r.height) } }),
      rows: document.querySelectorAll('li').length,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
  console.log(`[${size.tag}] history:`, JSON.stringify(hist))

  await ctx.close()
}
await browser.close()
