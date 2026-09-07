// Modal responsive harness — screenshots every reachable modal at 375 / 768 / 1280
// and audits the modal subtree for: horizontal overflow, tap targets < 44px, and
// footer buttons pushed off-screen (the "กดไม่ติด" class of bug).
//
//   node tools/shoot-modals.mjs
//
// Fails with exit 1 if any TOUCH size (375/768) has a violation. 1280 is reported
// but never enforced — desktop must stay pixel-identical to its baseline.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { newStubbedContext, AUDIT_FN, SIZES } from './fixtures.mjs'

const BASE = process.env.BASE_URL || 'http://localhost:5174'
const OUT = process.env.OUT_DIR || 'gui-test-screenshots/modals'
const TOUCH = new Set(['375', '768'])

// AssetsView renders BOTH the desktop table and the mobile cards (one hidden by
// a breakpoint class), so every locator here must be :visible or it picks the
// hidden copy and times out.
//
// เปิดเมนู "จัดการ" ของแถวที่ row แล้วกดเมนูย่อยตาม label
// (เมนูถูก portal ไป body และเป็น position:fixed จึงต้องกดจาก body ไม่ใช่ในแถว)
const rowMenu = (label, row = 0) => async (page) => {
  const trigger = page.locator('[aria-label="เมนูจัดการ"]:visible').nth(row)
  await trigger.waitFor({ state: 'visible', timeout: 8000 })
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  const item = page.locator(`.fixed.z-\\[61\\] button:has-text("${label}")`).first()
  await item.waitFor({ state: 'visible', timeout: 8000 })
  await item.click()
}

const clickText = (sel) => async (page) => {
  const el = page.locator(`${sel} >> visible=true`).first()
  await el.waitFor({ state: 'visible', timeout: 8000 })
  await el.scrollIntoViewIfNeeded()
  await el.click()
}

const MODALS = [
  { name: 'M01-monthly-breakdown', path: '/', open: clickText('button:has-text("รายรับเดือนนี้")') },
  { name: 'M02-add-rental', path: '/assets', open: clickText('button:has-text("เพิ่มสินทรัพย์")') },
  { name: 'M03-asset-detail', path: '/assets', open: rowMenu('ดูรายละเอียด') },
  // r6 (ล็อค B12) ไม่มีบิลงวดปัจจุบัน — ปุ่ม "สร้างบิล" จึงไม่ถูก disable
  { name: 'M04-meter-bill', path: '/assets', open: rowMenu('สร้างบิล', 5) },
  { name: 'M05-renew', path: '/assets', open: rowMenu('ต่อสัญญา') },
  { name: 'M06-moveout', path: '/assets', open: rowMenu('ย้ายออก') },
  { name: 'M07-delete', path: '/assets', open: rowMenu('ลบข้อมูล') },
  { name: 'M08-membership-order', path: '/membership', open: clickText('button:has-text("สั่งซื้อ")') },
  { name: 'M09-pdpa-consent', path: '/', open: null, noPdpa: true },
  {
    name: 'M10-invoice',
    path: '/assets',
    open: async (page) => {
      await rowMenu('สร้างบิล', 5)(page)
      // ปุ่มยืนยันใน MeterBillModal (ไม่ใช่ปุ่ม "เพิ่มสินทรัพย์" ของหน้า)
      const create = page.locator('.fixed.inset-0 button:has-text("สร้างบิล") >> visible=true').last()
      await create.waitFor({ state: 'visible', timeout: 8000 })
      await create.click()
      await page.waitForTimeout(1200)
    },
  },
]

// ทำเครื่องหมาย overlay ที่อยู่บนสุด เพื่อให้ audit ตรวจแค่ modal ไม่ใช่ทั้งหน้า
const MARK_TOPMOST = () => {
  document.querySelectorAll('[data-audit-scope]').forEach((el) => el.removeAttribute('data-audit-scope'))
  const candidates = [...document.querySelectorAll('div.fixed.inset-0')].filter((el) => {
    const cs = getComputedStyle(el)
    const z = Number(cs.zIndex)
    return Number.isFinite(z) && z >= 40 && el.querySelector('button, input, a[href]')
  })
  if (!candidates.length) return null
  const top = candidates.reduce((best, el) => {
    const z = Number(getComputedStyle(el).zIndex)
    return z >= Number(getComputedStyle(best).zIndex) ? el : best
  }, candidates[0])
  top.setAttribute('data-audit-scope', '1')
  const h = top.querySelector('h1, h2, h3')
  return { title: (h?.innerText || '').trim().slice(0, 60), z: getComputedStyle(top).zIndex }
}

// ปุ่มท้าย modal = ปุ่มใน footer (หรือปุ่มสุดท้ายในกล่อง) — คือปุ่มที่ผู้ใช้ต้องกดจริง
const FOOTER_FN = () => {
  const root = document.querySelector('[data-audit-scope="1"]')
  if (!root) return []
  const panel = root.querySelector(':scope > div:not([aria-hidden])') || root
  const buttons = [...panel.querySelectorAll('button, [type=submit]')].filter((b) => {
    const r = b.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
  if (!buttons.length) return []
  // เอาปุ่มที่อยู่แถวล่างสุดของ modal (ภายใน 1 บรรทัดเดียวกัน)
  const maxBottom = Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom))
  const docH = document.documentElement.clientHeight
  return buttons
    .filter((b) => maxBottom - b.getBoundingClientRect().bottom < 24)
    .map((b) => {
      const r = b.getBoundingClientRect()
      return {
        text: (b.innerText || b.getAttribute('aria-label') || '').trim().slice(0, 30),
        h: Math.round(r.height),
        w: Math.round(r.width),
        bottom: Math.round(r.bottom),
        offscreenY: r.bottom > docH + 1,
      }
    })
}

const run = async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const report = []

  for (const size of SIZES) {
    for (const m of MODALS) {
      const context = await newStubbedContext(browser, size)
      if (m.noPdpa) {
        await context.addInitScript(() => localStorage.removeItem('payrentpro_pdpa'))
      }
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (e) => { if (e.type() === 'error') consoleErrors.push(e.text().slice(0, 140)) })

      const entry = { modal: m.name, size: size.tag }
      try {
        await page.goto(BASE + m.path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(800)
        if (m.open) await m.open(page)
        await page.waitForTimeout(700)

          const marked = await page.evaluate(MARK_TOPMOST)
        if (!marked) throw new Error('no modal overlay found after open')
        entry.title = marked.title

        const file = `${OUT}/${m.name}_${size.tag}.png`
        await page.screenshot({ path: file, fullPage: false })

        const audit = await page.evaluate(AUDIT_FN, '[data-audit-scope="1"]')
        const footer = await page.evaluate(FOOTER_FN)
        Object.assign(entry, audit, { footer })
        entry.overflowX = audit.scrollW > audit.docW
        entry.footerBad = footer.filter((b) => b.h < 44 || b.offscreenY)
        entry.ok = !entry.overflowX && !audit.overflow.length && !audit.small.length && !entry.footerBad.length

        const flag = entry.ok ? 'PASS' : 'FAIL'
        console.log(
          `${flag}  ${m.name} @${size.tag}  footer=[${footer.map((b) => `${b.text || '?'}:${b.h}px${b.offscreenY ? '/OFFSCREEN' : ''}`).join(', ')}]` +
          `  overflowX=${entry.overflowX ? `YES(${audit.scrollW}>${audit.docW})` : 'no'}  small=${audit.small.length}  overflowEls=${audit.overflow.length}`
        )
      } catch (e) {
        entry.error = String(e.message || e).split('\n')[0].slice(0, 140)
        entry.ok = false
        console.log(`ERR   ${m.name} @${size.tag}  ${entry.error}`)
      }
      if (consoleErrors.length) entry.consoleErrors = consoleErrors.slice(0, 4)
      report.push(entry)
      await context.close()
    }
  }

  await browser.close()
  writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 1))

  // ===== สรุป =====
  const lines = []
  const violations = report.filter((r) => !r.ok)
  for (const r of violations) {
    lines.push(`\n[${r.modal} @ ${r.size}] ${r.title ? `"${r.title}" ` : ''}${r.error ? `ERROR: ${r.error}` : ''}`)
    if (r.overflowX) lines.push(`  overflowX: scrollW=${r.scrollW} > docW=${r.docW}`)
    if (r.overflow?.length) lines.push(`  overflowing els: ${JSON.stringify(r.overflow.slice(0, 6))}`)
    if (r.footerBad?.length) lines.push(`  footer buttons: ${JSON.stringify(r.footerBad)}`)
    if (r.small?.length) lines.push(`  small targets(<44px): ${JSON.stringify(r.small.slice(0, 12))}`)
  }
  const touchFails = violations.filter((r) => TOUCH.has(r.size))
  const summary =
    `===== MODAL AUDIT =====\n` +
    `shots: ${report.length}  pass: ${report.length - violations.length}  fail: ${violations.length}` +
    `  (touch 375/768 fails: ${touchFails.length})\n` +
    lines.join('\n')
  writeFileSync(`${OUT}/summary.txt`, summary + '\n')
  console.log('\n' + summary)

  if (touchFails.length) {
    console.log(`\n✗ ${touchFails.length} violation(s) at touch sizes — fix and re-run.`)
    process.exit(1)
  }
  console.log('\n✓ all touch sizes clean')
}

run().catch((e) => { console.error(e); process.exit(1) })
