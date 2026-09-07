// ครอปเทียบสองไดเรกทอรีเฉพาะช่วง y ที่สนใจ
// usage: BEFORE_DIR=.. AFTER_DIR=.. node tools/crop2.mjs <page> <y0> <y1>
import { chromium } from 'playwright'
import fs from 'node:fs'
const [page, y0, y1] = [process.argv[2], +process.argv[3], +process.argv[4]]
const B = process.env.BEFORE_DIR, A = process.env.AFTER_DIR
const b64 = (f) => fs.readFileSync(f).toString('base64')
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 1300, height: 400 } })
await pg.setContent(`
<body style="margin:0;background:#eee;font:13px system-ui">
${[['before', B], ['after', A]].map(([t, d]) => `
<div style="padding:4px 8px;font-weight:700">${t} (${d})</div>
<div style="width:1280px;height:${y1-y0}px;overflow:hidden;position:relative;border:1px solid #999">
  <img src="data:image/png;base64,${b64(`${d}/${page}_1280.png`)}" style="position:absolute;top:-${y0}px;left:0">
</div>`).join('')}
</body>`)
await pg.screenshot({ path: 'gui-test-screenshots/_crop2.png', fullPage: true })
await br.close()
console.log('wrote gui-test-screenshots/_crop2.png')
