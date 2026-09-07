// เทียบ modal ที่ 1280px ก่อน/หลังแก้ — ต้อง identical (0 px diff)
// baseline: gui-test-screenshots/base-modals/*_1280.png
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BEFORE = process.env.BEFORE_DIR || 'gui-test-screenshots/base-modals'
const AFTER = process.env.AFTER_DIR || 'gui-test-screenshots/modals'
const files = fs.readdirSync(BEFORE).filter((f) => f.endsWith('_1280.png'))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 400 } })

async function decode(file) {
  const b64 = fs.readFileSync(file).toString('base64')
  return page.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    return { w: c.width, h: c.height, buf: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) }
  }, b64)
}

const OUT = []
let bad = 0
for (const f of files) {
  const fb = path.join(BEFORE, f), fa = path.join(AFTER, f)
  if (!fs.existsSync(fa)) { OUT.push(`${f}: MISSING after`); bad++; continue }
  const A = await decode(fb), B = await decode(fa)
  if (A.w !== B.w || A.h !== B.h) { OUT.push(`${f}: SIZE CHANGED ${A.w}x${A.h} -> ${B.w}x${B.h}`); bad++; continue }
  let diff = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1
  for (let i = 0; i < A.buf.length; i += 4) {
    if (Math.abs(A.buf[i] - B.buf[i]) > 8 || Math.abs(A.buf[i+1] - B.buf[i+1]) > 8 || Math.abs(A.buf[i+2] - B.buf[i+2]) > 8) {
      diff++
      const p = i / 4, x = p % A.w, y = (p - x) / A.w
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  const pct = ((100 * diff) / (A.w * A.h)).toFixed(4)
  const bbox = maxX >= 0 ? ` bbox x:${minX}-${maxX} y:${minY}-${maxY}` : ''
  OUT.push(`${f.padEnd(34)} ${A.w}x${A.h}  diff=${String(diff).padStart(7)} px (${pct}%)${bbox}`)
  if (diff > 0) bad++
}
await browser.close()
const report = OUT.join('\n')
fs.writeFileSync('gui-test-screenshots/modal-pixdiff.txt', report + '\n')
console.log(report)
console.log(bad ? `\n✗ ${bad} modal(s) changed at 1280px` : '\n✓ desktop 1280 identical for all modals')
process.exit(bad ? 1 : 0)
