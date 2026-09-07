// Fixtures + Supabase route stubs shared by shoot.mjs (pages) and shoot-modals.mjs.
// Every width renders the same data, so screenshots differ only by layout.
const iso = (d) => new Date(d).toISOString()
export const now = Date.now()
export const DAY = 86400000

export const RENTALS = [
  { id: 'r1', biz_type: 'property', item_details: 'อาคาร A', sub_label: 'ห้อง 101', cust_name: 'สมชาย ใจดี', amount: 6500, room_status: 'occupied', lease_end_date: iso(now + 12 * DAY), cust_phone: '0812345678', cust_id_card: '1103700123456', deposit: 13000, water_rate: 18, electric_rate: 8, billing_cycle: 'monthly', created_at: iso(now - 300 * DAY) },
  { id: 'r2', biz_type: 'property', item_details: 'อาคาร A', sub_label: 'ห้อง 102', cust_name: 'อารยา รุ่งเรือง', amount: 7200, room_status: 'occupied', lease_end_date: iso(now + 25 * DAY), cust_phone: '0823456789', deposit: 14400, water_rate: 18, electric_rate: 8, billing_cycle: 'monthly', created_at: iso(now - 200 * DAY) },
  { id: 'r3', biz_type: 'property', item_details: 'อาคาร A', sub_label: 'ห้อง 103', cust_name: '', amount: 6800, room_status: 'vacant', lease_end_date: null, created_at: iso(now - 150 * DAY) },
  { id: 'r4', biz_type: 'vehicle', item_details: 'รถกระบะ Isuzu', sub_label: 'กข 1234 กรุงเทพฯ', cust_name: 'ธนกร มั่นคง', amount: 15000, room_status: 'occupied', lease_end_date: iso(now + 60 * DAY), cust_phone: '0834567890', billing_cycle: 'monthly', created_at: iso(now - 90 * DAY) },
  { id: 'r5', biz_type: 'vehicle', item_details: 'รถตู้ Toyota', sub_label: 'งจ 5678 นนทบุรี', cust_name: 'ศิริพร ทองคำ', amount: 22000, room_status: 'occupied', lease_end_date: iso(now + 5 * DAY), cust_phone: '0845678901', billing_cycle: 'monthly', created_at: iso(now - 45 * DAY) },
  { id: 'r6', biz_type: 'other', item_details: 'พื้นที่ขายของ', sub_label: 'ล็อค B12', cust_name: 'กิตติ แก้วใส', amount: 3500, room_status: 'occupied', lease_end_date: iso(now + 200 * DAY), cust_phone: '0856789012', billing_cycle: 'monthly', created_at: iso(now - 20 * DAY) },
]

export const TX = [
  { id: 't1', rental_id: 'r1', amount: 6500, base_amount: 6500, total_amount: 6500, paid_amount: 6500, status: 'pending_review', period: '2026-09', due_date: iso(now - 3 * DAY), created_at: iso(now - 2 * DAY), slip_image_url: null, rentals: [RENTALS[0]] },
  { id: 't2', rental_id: 'r5', amount: 22000, base_amount: 22000, total_amount: 22000, paid_amount: 20000, status: 'pending_review', period: '2026-09', due_date: iso(now - 5 * DAY), created_at: iso(now - 1 * DAY), slip_image_url: null, rentals: [RENTALS[4]] },
  { id: 't3', rental_id: 'r2', amount: 7200, base_amount: 7200, total_amount: 7200, status: 'unpaid', period: '2026-07', due_date: iso(now - 40 * DAY), created_at: iso(now - 40 * DAY), rentals: [RENTALS[1]] },
  { id: 't4', rental_id: 'r4', amount: 15000, base_amount: 15000, total_amount: 15000, status: 'unpaid', period: '2026-07', due_date: iso(now - 32 * DAY), created_at: iso(now - 32 * DAY), rentals: [RENTALS[3]] },
  { id: 't5', rental_id: 'r6', amount: 3500, base_amount: 3500, total_amount: 3500, status: 'unpaid', period: '2026-08', due_date: iso(now - 20 * DAY), created_at: iso(now - 20 * DAY), rentals: [RENTALS[5]] },
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`, rental_id: 'r1', amount: 6500, base_amount: 6500, total_amount: 6500, paid_amount: 6500,
    status: 'paid', period: `2026-0${i + 1}`, due_date: iso(now - (180 - i * 30) * DAY),
    paid_at: iso(now - (178 - i * 30) * DAY), created_at: iso(now - (180 - i * 30) * DAY), rentals: [RENTALS[0]],
  })),
]

export const ADMINS = [{
  id: 'a1', user_id: 'u1', email: 'founder@payrentpro.com', payment_type: 'promptpay',
  promptpay: '0812345678', promptpay_name: 'สมชาย ใจดี', bank_code: 'kbank', bank_account: '123-4-56789-0',
  business_name: 'บ้านเช่าสุขใจ', owner_name: 'สมชาย ใจดี', address: '123 ถนนสุขุมวิท กรุงเทพฯ 10110',
}]

export const MEMBERSHIP = {
  id: 'm1', email: 'founder@payrentpro.com', plan: 'founder', status: 'active',
  expire_date: iso(now + 300 * DAY), room_limit: 0, rooms_used: 6, created_at: iso(now - 100 * DAY),
}

export const MEMBERS = [
  MEMBERSHIP,
  { email: 'user1@example.com', plan: 'pro', status: 'active', expire_date: iso(now + 40 * DAY), room_limit: 50, rooms_used: 23, created_at: iso(now - 60 * DAY) },
  { email: 'user2@example.com', plan: 'basic', status: 'active', expire_date: iso(now + 8 * DAY), room_limit: 15, rooms_used: 12, created_at: iso(now - 30 * DAY) },
  { email: 'expired@example.com', plan: 'basic', status: 'expired', expire_date: iso(now - 5 * DAY), room_limit: 15, rooms_used: 9, created_at: iso(now - 200 * DAY) },
]

export const MEMBERSHIP_PAYMENTS = [
  { id: 'mp1', email: 'user2@example.com', plan_type: 'basic', duration_months: 3, amount: 1099, status: 'pending', slip_image_url: null, created_at: iso(now - 1 * DAY) },
  { id: 'mp2', email: 'user1@example.com', plan_type: 'pro', duration_months: 12, amount: 3990, status: 'approved', slip_image_url: null, created_at: iso(now - 30 * DAY) },
]

export const AUDIT = [
  { id: 'al1', transaction_id: 't3', old_amount: 7200, new_amount: 7500, reason: 'ค่าน้ำเพิ่มตามมิเตอร์', created_at: iso(now - 4 * DAY) },
  { id: 'al2', transaction_id: 't4', old_amount: 15000, new_amount: 14500, reason: 'ส่วนลดลูกค้าเก่า', created_at: iso(now - 9 * DAY) },
]

export const BILL = {
  id: 'tok-bill-0001', rental_id: 'r1', period: '2026-09',
  base_amount: 6500, water_amount: 320, electric_amount: 780, extra_amount: 0,
  amount: 7600, total_amount: 7600, paid_amount: 0, status: 'unpaid',
  due_date: iso(now + 4 * DAY), created_at: iso(now - 3 * DAY),
  cust_name: 'สมชาย ใจดี', item_details: 'อาคาร A', sub_label: 'ห้อง 101',
  payment_type: 'promptpay', promptpay: '0812345678', promptpay_name: 'สมชาย ใจดี',
  business_name: 'บ้านเช่าสุขใจ', bank_code: 'kbank', bank_account: '123-4-56789-0',
  penalty_amount: 0, water_units: 16, electric_units: 97,
}

export const TABLES = {
  rentals: RENTALS,
  transactions: TX,
  admins: ADMINS,
  memberships: [MEMBERSHIP],
  membership_payments: MEMBERSHIP_PAYMENTS,
  audit_logs: AUDIT,
  system_settings: [{ key: 'promptpay', value: '0899999999' }],
}

export const SESSION = {
  access_token: 'stub-access-token',
  refresh_token: 'stub-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(now / 1000) + 3600,
  user: {
    id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'founder@payrentpro.com',
    email_confirmed_at: iso(now - 100 * DAY), phone: '', confirmed_at: iso(now - 100 * DAY),
    last_sign_in_at: iso(now), app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: iso(now - 100 * DAY), updated_at: iso(now),
  },
}

export const PROJECT_REF = 'ceanwvsvbiktbwydvyyi'

export const SIZES = [
  { tag: '375', width: 375, height: 812, mobile: true },
  { tag: '768', width: 768, height: 1024, mobile: true },
  { tag: '1280', width: 1280, height: 900, mobile: false },
]

function tableFor(url) {
  const m = url.match(/\/rest\/v1\/([a-z_]+)/i)
  return m ? m[1] : null
}

export async function installStubs(context) {
  // Supabase auth: always return the stub session.
  await context.route('**/auth/v1/**', (route) => {
    const url = route.request().url()
    if (url.includes('/logout')) return route.fulfill({ status: 204, body: '' })
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(url.includes('/user') ? SESSION.user : SESSION),
    })
  })

  // Supabase REST: serve fixtures; single-row requests unwrap to an object.
  await context.route('**/rest/v1/**', (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() !== 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    }
    const table = tableFor(url)
    let rows = TABLES[table] ? [...TABLES[table]] : []

    // honour ?status=eq.x so "pending review" boxes get only their rows
    const q = new URL(url).searchParams
    for (const [key, raw] of q.entries()) {
      if (['select', 'order', 'limit', 'offset', 'apikey'].includes(key)) continue
      const [op, ...rest] = String(raw).split('.')
      const val = rest.join('.')
      if (op === 'eq') rows = rows.filter((r) => String(r[key] ?? '') === val)
      else if (op === 'in') {
        const set = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
        rows = rows.filter((r) => set.includes(String(r[key] ?? '')))
      }
    }

    const accept = req.headers()['accept'] || ''
    const single = accept.includes('vnd.pgrst.object')
    const body = single ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows)
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })

  // RPCs used by the dashboard/admin/membership pages — keyed by function name
  const RPC = {
    get_all_members: MEMBERS,
    get_pending_membership_payments: MEMBERSHIP_PAYMENTS.filter((p) => p.status === 'pending'),
    get_membership_status: MEMBERSHIP,
    get_system_promptpay: '0899999999',
    get_my_admin_id: 'a1',
    get_bill_by_token: BILL,
    send_bill_to_line: { ok: true },
  }
  await context.route('**/rest/v1/rpc/*', (route) => {
    const name = route.request().url().split('/rpc/')[1].split('?')[0]
    const body = JSON.stringify(name in RPC ? RPC[name] : null)
    return route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}

export async function newStubbedContext(browser, size) {
  const context = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
    isMobile: size.mobile,
    hasTouch: size.mobile,
    locale: 'th-TH',
  })
  await installStubs(context)
  // seed the supabase session so the app boots straight into the dashboard
  await context.addInitScript(([session, ref]) => {
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))
    localStorage.setItem('payrentpro_pdpa', '1')
  }, [SESSION, PROJECT_REF])
  await context.addInitScript(FREEZE_CLOCK)
  return context
}

// Freeze anything that renders wall-clock time, so two runs of the same code
// diff to exactly 0 px and a non-zero pixdiff always means a real layout change.
// ต้องทำก่อนแอปรัน (addInitScript) — ถ้าไปแก้ DOM ทีหลัง React จะ re-render ทับ
// และความกว้างข้อความที่เปลี่ยนจะดัน layout ทำให้ diff เพี้ยนกว่าเดิม
export const FREEZE_CLOCK = () => {
  const pad = (n) => String(n).padStart(2, '0')
  const fixed = `${pad(12)}:${pad(0)}:${pad(0)}`
  Date.prototype.toLocaleTimeString = function () { return fixed }
}

// Overflow / tap-target audit run inside the page.
// scope: optional selector — restrict the audit to that subtree (used for modals).
export const AUDIT_FN = (scope) => {
  const docW = document.documentElement.clientWidth
  const docH = document.documentElement.clientHeight
  const root = scope ? document.querySelector(scope) : document
  if (!root) return { missing: true, docW, docH, scrollW: document.documentElement.scrollWidth, overflow: [], small: [] }
  const overflow = []
  const small = []
  const describe = (el) => {
    const cls = String(el.className || '')
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 3).join('.') : ''}`
  }
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
    if (r.right > docW + 1 || r.left < -1) {
      if (!el.closest('[data-allow-overflow]')) {
        overflow.push({ el: describe(el), cls: String(el.className).slice(0, 70), right: Math.round(r.right), left: Math.round(r.left) })
      }
    }
    if (el.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')) {
      // WCAG นับพื้นที่ที่กดได้จริง: checkbox/radio ที่อยู่ใน <label> ถูกกดผ่าน label ได้
      // ถ้า label สูง >=44px ก็ถือว่าเป้ากดใหญ่พอ แม้ตัว input จะเล็ก
      let effH = r.height
      if (el.matches('input[type=checkbox], input[type=radio]')) {
        const label = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))
        const lr = label?.getBoundingClientRect()
        if (lr && lr.height > effH) effH = lr.height
      }
      if (effH < 44) {
        small.push({
          el: describe(el),
          text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 34),
          h: Math.round(r.height),
          w: Math.round(r.width),
          // ปุ่มที่หลุดขอบล่างของ viewport = กดไม่ได้จริง
          offscreenY: r.bottom > docH + 1 || r.top < -1,
        })
      }
    }
  }
  return { docW, docH, scrollW: document.documentElement.scrollWidth, overflow: overflow.slice(0, 25), small: small.slice(0, 40) }
}
