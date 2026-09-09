// ตรวจหน้า /finance ทั้ง 3 แท็บ — วัดจาก DOM ไม่ใช่จากรูป
// (harness หลักจับเฉพาะแท็บแรกที่โหลดมา จึงไม่เห็นตารางรายจ่าย/รายรับ)
import { chromium } from 'playwright'
import { newStubbedContext, AUDIT_FN, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/finance'

const TABS = ['ภาพรวมกำไร', 'รายจ่าย', 'รายรับอื่น']

const run = async () => {
  const { mkdirSync } = await import('node:fs')
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  let failures = 0

  for (const size of SIZES) {
    const context = await newStubbedContext(browser, size)
    const page = await context.newPage()
    const errors = []
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)))

    await page.goto(BASE + '/finance', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    for (const tab of TABS) {
      await page.getByRole('button', { name: tab, exact: false }).first().click()
      await page.waitForTimeout(700)
      const file = `${OUT}/finance-${TABS.indexOf(tab)}-${size.tag}.png`
      await page.screenshot({ path: file, fullPage: true })

      const a = await page.evaluate(AUDIT_FN, null)
      // เกณฑ์เดียวกับ harness หลัก: touch (375/768) ต้อง 0 small targets
      const touchFail = size.tag !== '1280' && a.small.length > 0
      const ovFail = a.scrollW > a.docW || a.overflow.length > 0
      if (touchFail || ovFail) failures++

      // นับว่าข้อมูลขึ้นจริงไหม — ตัวเลขบาทและจำนวนแถว
      const stats = await page.evaluate(() => {
        const txt = document.body.innerText
        return {
          baht: (txt.match(/฿[\d,]+/g) || []).length,
          rows: document.querySelectorAll('tbody tr').length,
          hasDash: /—/.test(txt),
        }
      })

      console.log(
        `${touchFail || ovFail ? '✗' : '✓'} ${file} small=${a.small.length} overflow=${a.overflow.length} baht=${stats.baht} rows=${stats.rows}`,
      )
      if (touchFail) console.log('   small:', JSON.stringify(a.small.slice(0, 8)))
      if (a.overflow.length) console.log('   overflow:', JSON.stringify(a.overflow.slice(0, 5)))
    }

    if (errors.length) {
      failures++
      console.log(`   [console @ ${size.tag}]`, errors.slice(0, 5))
    }

    // ── modal: เพิ่มรายจ่าย / เพิ่มรายรับ ต้องเปิดได้และฟอร์มครบ ──
    for (const [tab, btn, formId, expectFields] of [
      ['รายจ่าย', 'เพิ่มรายจ่าย', 'expense-form', 8],
      ['รายรับอื่น', 'เพิ่มรายรับ', 'income-form', 5],
    ]) {
      await page.getByRole('button', { name: tab, exact: false }).first().click()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: btn, exact: false }).first().click()
      await page.waitForTimeout(600)

      const m = await page.evaluate((id) => {
        const form = document.getElementById(id)
        if (!form) return { missing: true }
        return {
          missing: false,
          fields: form.querySelectorAll('input, select, textarea').length,
          required: form.querySelectorAll('[required]').length,
        }
      }, formId)

      const file = `${OUT}/modal-${formId}-${size.tag}.png`
      await page.screenshot({ path: file, fullPage: false })
      const a = await page.evaluate(AUDIT_FN, null)
      const touchFail = size.tag !== '1280' && a.small.length > 0
      const bad = m.missing || m.fields < expectFields || touchFail
      if (bad) failures++
      console.log(
        `${bad ? '✗' : '✓'} ${file} fields=${m.fields ?? '-'} required=${m.required ?? '-'} small=${a.small.length}`,
      )
      if (touchFail) console.log('   small:', JSON.stringify(a.small.slice(0, 6)))

      await page.getByRole('button', { name: 'ยกเลิก', exact: false }).first().click()
      await page.waitForTimeout(400)
    }

    await context.close()
  }

  await browser.close()
  console.log(failures === 0 ? '\nPASS — ครบทุกแท็บทุกความกว้าง' : `\nFAIL — ${failures} รายการ`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => { console.error(e); process.exit(1) })
