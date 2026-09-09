// ตรวจหน้าที่มีแท็บ + modal — วัดจาก DOM ไม่ใช่จากรูป
//
// ทำไมต้องมีแยกจาก shoot.mjs: shoot.mjs จับเฉพาะสิ่งที่เห็นตอนโหลดหน้าครั้งแรก
// มองไม่เห็นแท็บอื่นหรือ modal → ให้ผล "ผ่าน" ทั้งที่ปุ่มในตารางเล็กกว่า 44px
// (เจอจริงตอนทำ /finance — ดู DECISIONS.md D11)
//
// รันทั้งหมด:      node tools/verify-tabbed.mjs
// เจาะหน้าเดียว:   node tools/verify-tabbed.mjs finance
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { newStubbedContext, AUDIT_FN, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/tabbed'

const PAGES = {
  finance: {
    path: '/finance',
    tabs: ['ภาพรวมกำไร', 'รายจ่าย', 'รายรับอื่น'],
    // [แท็บที่ต้องอยู่, ปุ่มเปิด, id ของ form, จำนวน field อย่างน้อย]
    modals: [
      ['รายจ่าย', 'เพิ่มรายจ่าย', 'expense-form', 8],
      ['รายรับอื่น', 'เพิ่มรายรับ', 'income-form', 5],
    ],
  },
  comms: {
    path: '/comms',
    tabs: ['ประกาศ', 'บันทึก', 'เอกสาร'],
    modals: [
      ['ประกาศ', 'ประกาศใหม่', 'ann-form', 4],
      // โน้ตมี 3 input (หัวข้อ/เนื้อหา/ปักหมุด) — ตัวเลือกสี 6 ตัวเป็น <button>
      // ไม่ใช่ <input type=color> อย่างต้นทาง จึงไม่ถูกนับเป็น field
      // extra: ตรวจว่าปุ่มสีมีอยู่จริง ไม่ใช่ผ่านเพราะลดเกณฑ์ field ลง
      ['บันทึก', 'บันทึกใหม่', 'note-form', 3, { buttons: 6 }],
      ['เอกสาร', 'อัปโหลด', 'doc-form', 3],
    ],
  },
}

const only = process.argv[2]
const targets = only ? { [only]: PAGES[only] } : PAGES
if (only && !PAGES[only]) {
  console.error(`ไม่รู้จักหน้า "${only}" — มี: ${Object.keys(PAGES).join(', ')}`)
  process.exit(1)
}

// เกณฑ์เดียวกับ shoot.mjs: touch (375/768) ต้อง 0 small targets
// ที่ 1280 ยอมให้เล็กได้ เพราะ compact style ตั้งใจย้ายไป lg: (commit 83f6e66)
const isTouch = (tag) => tag !== '1280'

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  let failures = 0

  for (const [name, cfg] of Object.entries(targets)) {
    console.log(`\n=== ${name} (${cfg.path}) ===`)

    for (const size of SIZES) {
      const context = await newStubbedContext(browser, size)
      const page = await context.newPage()
      const errors = []
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
      page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 200)))

      await page.goto(BASE + cfg.path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)

      // ── ทุกแท็บ ──
      for (const tab of cfg.tabs) {
        await page.getByRole('button', { name: tab, exact: false }).first().click()
        await page.waitForTimeout(700)
        const file = `${OUT}/${name}-tab${cfg.tabs.indexOf(tab)}-${size.tag}.png`
        await page.screenshot({ path: file, fullPage: true })

        const a = await page.evaluate(AUDIT_FN, null)
        const touchFail = isTouch(size.tag) && a.small.length > 0
        const ovFail = a.scrollW > a.docW || a.overflow.length > 0
        if (touchFail || ovFail) failures++

        // ยืนยันว่าเนื้อหาขึ้นจริง ไม่ใช่การ์ดเปล่า
        const filled = await page.evaluate(() => {
          const main = document.querySelector('main')
          return (main?.innerText || '').replace(/\s+/g, ' ').trim().length
        })

        console.log(
          `${touchFail || ovFail ? '✗' : '✓'} ${file} small=${a.small.length} overflow=${a.overflow.length} text=${filled}`,
        )
        if (touchFail) console.log('   small:', JSON.stringify(a.small.slice(0, 8)))
        if (a.overflow.length) console.log('   overflow:', JSON.stringify(a.overflow.slice(0, 5)))
      }

      // ── ทุก modal ──
      for (const [tab, btn, formId, minFields, extra] of cfg.modals) {
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
            buttons: form.querySelectorAll('button[type=button]').length,
          }
        }, formId)

        const file = `${OUT}/${name}-modal-${formId}-${size.tag}.png`
        await page.screenshot({ path: file, fullPage: false })
        const a = await page.evaluate(AUDIT_FN, null)
        const touchFail = isTouch(size.tag) && a.small.length > 0
        // extra.buttons: คุมสำหรับฟอร์มที่ใช้ <button> เป็นตัวเลือก (เช่น สีโน้ต)
        // เพื่อไม่ให้ "ผ่าน" ได้ด้วยการลดเกณฑ์ field ลงเฉย ๆ
        const btnFail = extra?.buttons != null && (m.buttons ?? 0) < extra.buttons
        const bad = m.missing || (m.fields ?? 0) < minFields || btnFail || touchFail
        if (bad) failures++

        console.log(
          `${bad ? '✗' : '✓'} ${file} fields=${m.fields ?? 'MISSING'} required=${m.required ?? '-'}${extra?.buttons != null ? ` choiceBtns=${m.buttons}/${extra.buttons}` : ''} small=${a.small.length}`,
        )
        if (m.missing) console.log(`   ไม่พบ form#${formId} — modal ไม่เปิด?`)
        if (btnFail) console.log(`   ปุ่มตัวเลือกไม่ครบ: เจอ ${m.buttons} ต้องมี ${extra.buttons}`)
        if (touchFail) console.log('   small:', JSON.stringify(a.small.slice(0, 6)))

        await page.getByRole('button', { name: 'ยกเลิก', exact: true }).first().click()
        await page.waitForTimeout(400)
      }

      if (errors.length) {
        failures++
        console.log(`   [console @ ${size.tag}]`, errors.slice(0, 5))
      }
      await context.close()
    }
  }

  await browser.close()
  console.log(failures === 0 ? '\nPASS — ครบทุกแท็บทุก modal ทุกความกว้าง' : `\nFAIL — ${failures} รายการ`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => { console.error(e); process.exit(1) })
