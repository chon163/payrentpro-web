// หาแถวพิกเซลแรกที่ต่างระหว่าง before/after ที่ 1280 เพื่อระบุจุดที่ layout เดสก์ท็อปเลื่อน
import { chromium } from 'playwright'
import fs from 'node:fs'
const page = process.argv[2] || '01-dashboard'
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 400, height: 400 } })
const rows = async (f) => {
  const b64 = fs.readFileSync(f).toString('base64')
  return pg.evaluate(async (d) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode()
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
    const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const px = x.getImageData(0, 0, c.width, c.height).data, sig = []
    for (let y = 0; y < c.height; y++) {
      let s = 0
      for (let X = 250; X < c.width; X += 5) { const i = (y * c.width + X) * 4; s = (s + px[i] * 3 + px[i+1] * 5 + px[i+2] * 7) % 99991 }
      sig.push(s)
    }
    return sig
  }, b64)
}
const A = await rows(`gui-test-screenshots/before/${page}_1280.png`)
const B = await rows(`gui-test-screenshots/after/${page}_1280.png`)
const delta = B.length - A.length
let first = -1
for (let i = 0; i < Math.min(A.length, B.length); i++) if (A[i] !== B[i]) { first = i; break }
let sync = -1
if (delta !== 0) {
  for (let i = Math.max(first, 0); i < A.length - 80; i++) {
    if (A[i] === B[i + delta] && A[i+10] === B[i+10+delta] && A[i+30] === B[i+30+delta] && A[i+60] === B[i+60+delta]) { sync = i; break }
  }
}
await br.close()
const lines = [
  `page ${page}`,
  `heightBefore ${A.length}`,
  `heightAfter ${B.length}`,
  `delta ${delta}`,
  `firstDiffRow ${first}`,
  `resyncRow ${sync}`,
]
fs.writeFileSync('gui-test-screenshots/rowdiff.txt', lines.join('\n') + '\n')
for (const l of lines) console.log(l)
