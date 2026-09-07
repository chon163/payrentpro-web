// เทียบภาพ before/after ที่ 1280px แบบพิกเซล เพื่อยืนยันว่าเดสก์ท็อปไม่เปลี่ยน
// ใช้ Playwright decode PNG (ไม่ต้องลง dependency เพิ่ม)
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const PAGES = ['01-dashboard', '02-assets', '03-settings', '04-audit', '05-membership', '06-admin']
const BEFORE = 'gui-test-screenshots/before'
const AFTER = 'gui-test-screenshots/after'
const OUT = []

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })

async function decode(file) {
  const b64 = fs.readFileSync(file).toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    return { w: c.width, h: c.height, buf: Array.from(d) }
  }, b64)
}

for (const name of PAGES) {
  const fb = path.join(BEFORE, `${name}_1280.png`)
  const fa = path.join(AFTER, `${name}_1280.png`)
  if (!fs.existsSync(fb) || !fs.existsSync(fa)) {
    OUT.push(`${name}: MISSING baseline or after`)
    continue
  }
  const A = await decode(fb)
  const B = await decode(fa)
  if (A.w !== B.w || A.h !== B.h) {
    OUT.push(`${name}: SIZE CHANGED ${A.w}x${A.h} -> ${B.w}x${B.h}`)
    continue
  }
  let diff = 0
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
  for (let i = 0; i < A.buf.length; i += 4) {
    if (
      Math.abs(A.buf[i] - B.buf[i]) > 8 ||
      Math.abs(A.buf[i + 1] - B.buf[i + 1]) > 8 ||
      Math.abs(A.buf[i + 2] - B.buf[i + 2]) > 8
    ) {
      diff++
      const p = i / 4
      const x = p % A.w
      const y = (p - x) / A.w
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const total = A.w * A.h
  const pct = ((100 * diff) / total).toFixed(3)
  const bbox = maxX >= 0 ? ` bbox x:${minX}-${maxX} y:${minY}-${maxY}` : ''
  OUT.push(`${name.padEnd(14)} ${A.w}x${A.h} identical-size  diff=${String(diff).padStart(7)} px (${pct}%)${bbox}`)
}

await browser.close()
const report = OUT.join('\n')
fs.writeFileSync('gui-test-screenshots/desktop-pixdiff.txt', report + '\n')
console.log(report)
