// วัดความสูงของลูกใน header ที่ 1280 เพื่อหาปุ่มที่สูงเกิน (ตัวที่ทำให้ header โต)
import { chromium } from 'playwright'
import fs from 'node:fs'
const shoot = fs.readFileSync('tools/shoot.mjs', 'utf8')
const initSrc = shoot.slice(shoot.indexOf('const INIT = '), shoot.indexOf('const PAGES ='))
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } })
const mod = await import('./shoot-init.mjs').catch(() => null)
await pg.goto('http://localhost:5174/', { waitUntil: 'domcontentloaded' })
await pg.waitForTimeout(2500)
const out = await pg.evaluate(() => {
  const h = document.querySelector('header')
  if (!h) return { err: 'no header' }
  const inner = h.firstElementChild
  const kids = [...(inner?.children || [])]
  const detail = kids.map((k, i) => ({ i, cls: k.className.slice(0, 40), h: Math.round(k.getBoundingClientRect().height) }))
  const right = kids[kids.length - 1]
  const btns = [...(right?.children || [])].map((b) => ({
    tag: b.tagName, txt: (b.textContent || '').trim().slice(0, 18),
    h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width),
    disp: getComputedStyle(b).display,
  }))
  return { headerH: Math.round(h.getBoundingClientRect().height), detail, btns }
})
fs.writeFileSync('gui-test-screenshots/header.json', JSON.stringify(out, null, 1))
await br.close()
