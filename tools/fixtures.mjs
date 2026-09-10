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

// กล่องแจ้งซ่อม: ครอบทุกสถานะ + มี/ไม่มีรูป (รูปเป็น data-URL เพื่อไม่ต้องยิงเน็ต)
const REPAIR_PHOTO =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#bae6fd"/><text x="160" y="110" font-size="20" text-anchor="middle" fill="#0c4a6e">repair photo</text></svg>',
  ).toString('base64')

export const REPAIR_TICKETS = [
  { id: 'rt1', rental_id: 'r1', description: 'แอร์ไม่เย็น มีน้ำหยดลงพื้น', status: 'open', photo_url: REPAIR_PHOTO, created_at: iso(now - 1 * DAY), done_at: null, rentals: [RENTALS[0]] },
  { id: 'rt2', rental_id: 'r2', description: 'ก๊อกน้ำในห้องน้ำรั่ว ปิดไม่สนิท', status: 'open', photo_url: null, created_at: iso(now - 2 * DAY), done_at: null, rentals: [RENTALS[1]] },
  { id: 'rt3', rental_id: 'r4', description: 'หลอดไฟหน้าห้องไม่ติด', status: 'in_progress', photo_url: null, created_at: iso(now - 4 * DAY), done_at: null, rentals: [RENTALS[3]] },
  { id: 'rt4', rental_id: 'r5', description: 'ประตูห้องปิดไม่สนิท', status: 'done', photo_url: null, created_at: iso(now - 9 * DAY), done_at: iso(now - 7 * DAY), rentals: [RENTALS[4]] },
]

// ── หน้าการเงิน (/finance) — รายจ่าย / รายรับอื่น / กำไรสุทธิ์ ──────
// วันที่ต้องอยู่ในเดือนปัจจุบันเพราะหน้านี้กรอง gte/lt ตามงวดที่เลือก
// (ค่าเริ่มต้น = เดือนนี้) ถ้า hardcode เดือนไว้ ตารางจะว่างเมื่อเวลาผ่านไป
const dayInMonth = (d) => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const EXPENSE_CATEGORIES = [
  { id: 'ec1', landlord_id: 'a1', name: 'ค่าไฟ (บิลกรม)', color: '#f59e0b', sort_order: 1 },
  { id: 'ec2', landlord_id: 'a1', name: 'ค่าน้ำ (บิลกรม)', color: '#0ea5e9', sort_order: 2 },
  { id: 'ec3', landlord_id: 'a1', name: 'ค่าซ่อมแซม', color: '#ef4444', sort_order: 3 },
  { id: 'ec4', landlord_id: 'a1', name: 'ค่าทำความสะอาด', color: '#22c55e', sort_order: 4 },
]

export const EXPENSES = [
  { id: 'e1', landlord_id: 'a1', category_id: 'ec1', expense_date: dayInMonth(3), description: 'ค่าไฟบิลกรม อาคาร A', amount: 8420, vendor_name: 'กฟภ.', reference_no: 'PEA-88213', payment_method: 'transfer', notes: null, expense_categories: { name: 'ค่าไฟ (บิลกรม)', color: '#f59e0b' } },
  { id: 'e2', landlord_id: 'a1', category_id: 'ec2', expense_date: dayInMonth(3), description: 'ค่าน้ำบิลกรม อาคาร A', amount: 2180, vendor_name: 'กปภ.', reference_no: 'PWA-11902', payment_method: 'transfer', notes: null, expense_categories: { name: 'ค่าน้ำ (บิลกรม)', color: '#0ea5e9' } },
  { id: 'e3', landlord_id: 'a1', category_id: 'ec3', expense_date: dayInMonth(7), description: 'เปลี่ยนคอมเพรสเซอร์แอร์ ห้อง 101', amount: 4500, vendor_name: 'ร้านช่างสมชาย', reference_no: null, payment_method: 'cash', notes: null, expense_categories: { name: 'ค่าซ่อมแซม', color: '#ef4444' } },
  { id: 'e4', landlord_id: 'a1', category_id: 'ec4', expense_date: dayInMonth(10), description: 'จ้างทำความสะอาดพื้นที่ส่วนกลาง', amount: 1500, vendor_name: 'แม่บ้านรายวัน', reference_no: null, payment_method: 'cash', notes: null, expense_categories: { name: 'ค่าทำความสะอาด', color: '#22c55e' } },
  { id: 'e5', landlord_id: 'a1', category_id: null, expense_date: dayInMonth(12), description: 'ค่าอินเทอร์เน็ตส่วนกลาง', amount: 990, vendor_name: '3BB', reference_no: 'INV-4471', payment_method: 'credit_card', notes: null, expense_categories: null },
]

export const OTHER_INCOME = [
  { id: 'oi1', landlord_id: 'a1', income_date: dayInMonth(5), description: 'ค่าปรับจ่ายช้า ห้อง 102', amount: 300, source: 'ค่าปรับ', notes: null },
  { id: 'oi2', landlord_id: 'a1', income_date: dayInMonth(8), description: 'ค่าที่จอดรถเพิ่ม ห้อง 101', amount: 500, source: 'ค่าที่จอดรถ', notes: null },
  { id: 'oi3', landlord_id: 'a1', income_date: dayInMonth(15), description: 'รายได้เครื่องซักผ้าหยอดเหรียญ', amount: 1840, source: 'เครื่องซักผ้า', notes: null },
]

export const PROFIT_SUMMARY = {
  ok: true,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  rent_income: 39000,
  other_income: 2640,
  total_income: 41640,
  total_expense: 17590,
  net_profit: 24050,
  expense_by_category: [
    { category_id: 'ec1', name: 'ค่าไฟ (บิลกรม)', color: '#f59e0b', total: 8420 },
    { category_id: 'ec3', name: 'ค่าซ่อมแซม', color: '#ef4444', total: 4500 },
    { category_id: 'ec2', name: 'ค่าน้ำ (บิลกรม)', color: '#0ea5e9', total: 2180 },
    { category_id: 'ec4', name: 'ค่าทำความสะอาด', color: '#22c55e', total: 1500 },
    { category_id: null, name: 'ไม่ระบุหมวด', color: '#94a3b8', total: 990 },
  ],
}

// 6 เดือนล่าสุด — เดือนหนึ่งขาดทุนไว้ด้วย เพื่อให้เห็นว่าการ์ดสลับเป็นโทนแดงได้จริง
export const PROFIT_TREND = (() => {
  const t = new Date()
  const rows = []
  const figures = [
    [36500, 21000], [38200, 19400], [37800, 41200], [40100, 18900], [39600, 20300], [41640, 17590],
  ]
  for (let i = 5; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1)
    const [income, expense] = figures[5 - i]
    rows.push({
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      income, expense, profit: income - expense,
    })
  }
  return rows
})()

// ── หน้าประกาศ/บันทึก/เอกสาร (/comms) ───────────────────────────────
export const ANNOUNCEMENTS = [
  { id: 'an1', landlord_id: 'a1', title: 'แจ้งดับน้ำ วันเสาร์ 9-12 น.', content: 'การประปาแจ้งซ่อมท่อเมนหน้าซอย\nขอให้ผู้เช่าสำรองน้ำไว้ล่วงหน้าครับ', publish_date: dayInMonth(6), status: 'published', sent_to_line_at: iso(now - 2 * DAY), created_at: iso(now - 3 * DAY) },
  { id: 'an2', landlord_id: 'a1', title: 'เก็บค่าเช่าเดือนนี้ ภายในวันที่ 5', content: 'โอนแล้วส่งสลิปเข้ากลุ่ม LINE ได้เลยครับ', publish_date: dayInMonth(1), status: 'published', sent_to_line_at: null, created_at: iso(now - 8 * DAY) },
  { id: 'an3', landlord_id: 'a1', title: 'ร่าง: แจ้งขึ้นค่าส่วนกลางปีหน้า', content: '', publish_date: dayInMonth(20), status: 'draft', sent_to_line_at: null, created_at: iso(now - 1 * DAY) },
]

export const NOTES = [
  { id: 'nt1', landlord_id: 'a1', title: 'นัดช่างแอร์', content: 'ล้างแอร์ห้อง 204 อาทิตย์หน้า\nเบอร์ช่าง 081-234-5678', color: '#fff7ed', pinned: true, created_at: iso(now - 3 * DAY), updated_at: iso(now - 1 * DAY) },
  { id: 'nt2', landlord_id: 'a1', title: 'สั่งของ', content: 'หลอดไฟ LED 10 ดวง + ก๊อกน้ำ 2 ตัว', color: '#dcfce7', pinned: false, created_at: iso(now - 5 * DAY), updated_at: iso(now - 5 * DAY) },
  { id: 'nt3', landlord_id: 'a1', title: 'ต่อประกันอาคาร', content: 'หมดอายุ 15 ธ.ค. ติดต่อตัวแทนล่วงหน้า 1 เดือน', color: '#e0f2fe', pinned: false, created_at: iso(now - 12 * DAY), updated_at: iso(now - 12 * DAY) },
]

export const DOCUMENTS = [
  { id: 'dc1', landlord_id: 'a1', rental_id: 'r1', title: 'สำเนาสัญญา ห้อง 101', file_path: 'a1/uuid-contract-101.pdf', file_name: 'contract-101.pdf', file_size: 284120, mime_type: 'application/pdf', notes: null, created_at: iso(now - 20 * DAY) },
  { id: 'dc2', landlord_id: 'a1', rental_id: null, title: 'ใบอนุญาตประกอบกิจการหอพัก', file_path: 'a1/uuid-license.pdf', file_name: 'license.pdf', file_size: 1048576, mime_type: 'application/pdf', notes: null, created_at: iso(now - 60 * DAY) },
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
  repair_tickets: REPAIR_TICKETS,
  expense_categories: EXPENSE_CATEGORIES,
  expenses: EXPENSES,
  other_income: OTHER_INCOME,
  announcements: ANNOUNCEMENTS,
  notes: NOTES,
  documents: DOCUMENTS,
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
    notify_repair_done: { ok: true },
    // หน้าการเงิน (/finance)
    get_profit_summary: PROFIT_SUMMARY,
    get_profit_trend: PROFIT_TREND,
    seed_expense_categories: 0,
    // หน้าประกาศ/เอกสาร (/comms)
    broadcast_announcement: { ok: true, groups: 3 },
    // ประวัติบิลของห้องบนหน้าบิล public (แท็บ "ประวัติทั้งหมด")
    get_room_bills: [
      { period: '2026-09', total_amount: 7600, paid_amount: 0, status: 'unpaid', created_at: iso(now - 3 * DAY), is_current: true },
      { period: '2026-08', total_amount: 7420, paid_amount: 7420, status: 'paid', created_at: iso(now - 33 * DAY), is_current: false },
      { period: '2026-07', total_amount: 7180, paid_amount: 7180, status: 'paid', created_at: iso(now - 63 * DAY), is_current: false },
      { period: '2026-06', total_amount: 7050, paid_amount: 7050, status: 'paid', created_at: iso(now - 93 * DAY), is_current: false },
    ],
    // หน้าแจ้งซ่อมของผู้เช่า (/repair) — public เข้าด้วยเบอร์โทร
    tenant_portal_login: {
      ok: true,
      token: 'tok-tenant-0001',
      expires_at: iso(now + 8 * 60 * 60 * 1000),
      rentals: [{ rental_id: 'r1', name: 'ตึก A · ห้อง 101' }],
    },
    tenant_portal_session: {
      ok: true,
      rentals: [{ rental_id: 'r1', name: 'ตึก A · ห้อง 101' }],
    },
    tenant_portal_repairs: [
      {
        id: 'rt1', rental_id: 'r1', rental_name: 'ตึก A · ห้อง 101',
        description: 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม ไม่มีความเย็นออกมาเลย',
        status: 'open', photo_url: null, created_at: iso(now - 2 * DAY), done_at: null,
      },
      {
        id: 'rt2', rental_id: 'r1', rental_name: 'ตึก A · ห้อง 101',
        description: 'น้ำรั่วใต้อ่างล้างหน้า',
        status: 'in_progress', photo_url: REPAIR_PHOTO, created_at: iso(now - 6 * DAY), done_at: null,
      },
      {
        id: 'rt3', rental_id: 'r1', rental_name: 'ตึก A · ห้อง 101',
        description: 'หลอดไฟห้องน้ำเสีย',
        status: 'done', photo_url: null, created_at: iso(now - 20 * DAY), done_at: iso(now - 18 * DAY),
      },
    ],
    tenant_portal_create_repair: { ok: true, ticket_id: 'rt-new' },
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
