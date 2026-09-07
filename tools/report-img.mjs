// เรนเดอร์รายงานข้อความเป็น PNG (ช่องทางที่อ่านได้แน่นอนในสภาพแวดล้อมนี้)
import { chromium } from 'playwright'
import fs from 'node:fs'
const files = process.argv.slice(2)
const text = files.map(f => `### ${f}\n` + fs.readFileSync(f, 'utf8')).join('\n')
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: 900, height: 200 } })
await pg.setContent(`<body style="margin:0;background:#fff;font:14px/1.55 ui-monospace,Consolas,monospace;padding:14px;white-space:pre-wrap;color:#111">${text.replace(/[<&]/g, c => ({'<':'&lt;','&':'&amp;'}[c]))}</body>`)
await pg.screenshot({ path: 'gui-test-screenshots/_report.png', fullPage: true })
await br.close()
