import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from './supabaseClient'
import { BANKS, bankName } from './payment'

const ICONS = {
  building:
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  home:
    'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  document:
    'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  banknotes:
    'M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  check:
    'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bell:
    'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
  chart:
    'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
  cog:
    'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z',
}

function Icon({ name, className = 'h-6 w-6' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[name]} />
    </svg>
  )
}

const STATUS_LABELS = {
  paid: 'ชำระแล้ว',
  pending: 'รอชำระ',
  overdue: 'เกินกำหนด',
  late: 'เกินกำหนด',
  unpaid: 'ยังไม่ชำระ',
  active: 'ใช้งานอยู่',
  inactive: 'ไม่ใช้งาน',
  cancelled: 'ยกเลิก',
  canceled: 'ยกเลิก',
}

const BIZ_TYPES = [
  { value: 'อสังหาริมทรัพย์', label: 'อสังหาริมทรัพย์ (ห้องเช่า, คอนโด, โกดัง)' },
  { value: 'ยานพาหนะ', label: 'ยานพาหนะ (รถเช่า, แท็กซี่, รถบรรทุก)' },
  { value: 'อุปกรณ์', label: 'อุปกรณ์ (เครื่องจักร, กล้องถ่ายวีดีโอ, อุปกรณ์งานแต่งงาน)' },
]

const ITEM_PLACEHOLDERS = {
  'อสังหาริมทรัพย์': 'เช่น ห้อง 401, คอนโด, โกดัง A',
  'ยานพาหนะ': 'เช่น รถ กก-1234, แท็กซี่',
  'อุปกรณ์': 'เช่น กล้อง Sony A7, เครื่องจักร',
}

const CYCLE_LABELS = {
  monthly: 'รายเดือน',
  weekly: 'รายสัปดาห์',
  daily: 'รายวัน',
}

const AMOUNT_KEYS = ['amount', 'rent', 'rent_amount', 'monthly_rent', 'price', 'total', 'balance', 'deposit']
const DATE_KEYS = ['due_date', 'due', 'due_at', 'paid_at', 'payment_date', 'payment_at', 'created_at', 'date', 'start_date', 'end_date']

const COLUMN_LABELS = {
  id: 'ID',
  tenant_name: 'ผู้เช่า',
  tenant: 'ผู้เช่า',
  customer: 'ผู้เช่า',
  customer_name: 'ผู้เช่า',
  name: 'ชื่อ',
  full_name: 'ชื่อ-นามสกุล',
  property_name: 'ทรัพย์สิน',
  property: 'ทรัพย์สิน',
  unit: 'ยูนิต/ห้อง',
  room: 'ห้อง',
  address: 'ที่อยู่',
  building: 'อาคาร',
  amount: 'จำนวนเงิน',
  rent: 'ค่าเช่า',
  rent_amount: 'ค่าเช่า',
  monthly_rent: 'ค่าเช่ารายเดือน',
  price: 'ราคา',
  total: 'ยอดรวม',
  balance: 'ยอดคงเหลือ',
  deposit: 'เงินประกัน',
  due_date: 'ครบกำหนดชำระ',
  due: 'ครบกำหนด',
  due_at: 'ครบกำหนด',
  paid_at: 'ชำระเมื่อ',
  payment_date: 'วันที่ชำระ',
  payment_at: 'วันที่ชำระ',
  created_at: 'สร้างเมื่อ',
  date: 'วันที่',
  start_date: 'วันที่เริ่ม',
  end_date: 'วันที่สิ้นสุด',
  status: 'สถานะ',
  payment_status: 'สถานะชำระ',
  phone: 'เบอร์โทร',
  contact: 'ช่องทางติดต่อ',
  email: 'อีเมล',
  biz_type: 'ประเภทธุรกิจ',
  cust_name: 'ชื่อผู้เช่า',
  item_details: 'รายละเอียดสินทรัพย์',
  cycle: 'รอบการเก็บเงิน',
  penalty_per_day: 'ค่าปรับต่อวัน',
}

const TABLE_COLUMNS = ['biz_type', 'cust_name', 'item_details', 'amount', 'cycle', 'due_date', 'room_status']

// responsive: ซ่อนคอลัมน์รองบนจอมือถือ/แท็บเล็ต
const COLUMN_RESPONSIVE = {
  biz_type: '',
  cust_name: '',
  item_details: 'hidden sm:table-cell',
  amount: '',
  cycle: 'hidden md:table-cell',
  due_date: 'hidden md:table-cell',
  room_status: 'hidden lg:table-cell',
}

// ความกว้างคอลัมน์ (table-fixed): กำหนดให้พอดีจอเดสก์ท็อปโดยไม่ต้องเลื่อน
const COLUMN_WIDTH = {
  biz_type: 'w-[15%]',
  cust_name: 'w-[15%]',
  amount: 'w-[12%]',
  cycle: 'w-[10%]',
  due_date: 'w-[10%]',
  room_status: 'w-[10%]',
  // item_details (รายละเอียดสินทรัพย์) รับความกว้างส่วนที่เหลือ
}

// คอลัมน์ข้อความยาว ให้ตัดเป็นจุดไข่ปลาแทนการดันตาราง
const TRUNCATE_COLUMNS = new Set(['item_details', 'cust_name'])

function getValue(row, keys) {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function formatCurrency(value) {
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function currentPeriod() {
  const now = new Date()
  const month = THAI_MONTHS[now.getMonth()]
  const year = String((now.getFullYear() + 543) % 100).padStart(2, '0')
  return `${month} ${year}`
}

function generateSecureToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function generateBindingCode() {
  return String(Math.floor(100000000 + Math.random() * 900000000))
}

const MOCK_FIRST_NAMES = ['สมชาย', 'สมหญิง', 'วีรชน', 'อารยา', 'ธนกร', 'กิตติ', 'ณัฐวุฒิ', 'ปิยะ', 'ศิริพร', 'วัชรพล', 'จิราพร', 'อนุชา', 'พรทิพย์', 'สุชาติ', 'รัตนา']
const MOCK_LAST_NAMES = ['ใจดี', 'รุ่งเรือง', 'วงศ์สุวรรณ', 'ศรีสุข', 'มั่นคง', 'ไทยแท้', 'บุญมี', 'แก้วใส', 'ทองคำ', 'พันธ์ดี']

function mockThaiId() {
  let id = String(Math.floor(Math.random() * 9) + 1)
  for (let i = 0; i < 12; i++) id += Math.floor(Math.random() * 10)
  return id
}

// สร้างข้อมูลจำลอง (mock) สำหรับฟอร์ม เพื่อให้ทดสอบง่าย
function buildMockForm() {
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const phone = () => `08${randInt(10000000, 99999999)}`
  const pad = (n) => String(n).padStart(2, '0')
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const bizType = pick(['อสังหาริมทรัพย์', 'ยานพาหนะ', 'อุปกรณ์'])
  const items = {
    'อสังหาริมทรัพย์': ['ห้อง 401', 'คอนโด C-1205', 'โกดัง A', 'บ้านเดี่ยว 88/1', 'ห้อง 202'],
    'ยานพาหนะ': ['รถ กก-1234', 'แท็กซี่ ทส-5678', 'รถบรรทุก 70-8899', 'มอเตอร์ไซค์ 1กข-3456'],
    'อุปกรณ์': ['กล้อง Sony A7', 'เครื่องจักร CNC-01', 'โดรน DJI Mavic', 'เครื่องเสียงงานแต่ง'],
  }
  const amount = bizType === 'อสังหาริมทรัพย์' ? randInt(3000, 15000) : bizType === 'ยานพาหนะ' ? randInt(800, 5000) : randInt(500, 3000)

  const now = new Date()
  const moveIn = new Date(now)
  moveIn.setDate(moveIn.getDate() - randInt(0, 365))
  const leaseEnd = new Date(moveIn)
  leaseEnd.setFullYear(leaseEnd.getFullYear() + 1)

  return {
    biz_type: bizType,
    cust_name: `${pick(MOCK_FIRST_NAMES)} ${pick(MOCK_LAST_NAMES)}`,
    item_details: pick(items[bizType]),
    amount: String(amount),
    cycle: pick(['monthly', 'monthly', 'monthly', 'weekly', 'daily']),
    due_date: String(randInt(1, 28)),
    tenant_phone: phone(),
    tenant_id_card: mockThaiId(),
    emergency_contact: phone(),
    room_status: pick(['occupied', 'occupied', 'vacant', 'maintenance']),
    deposit_amount: String(amount),
    move_in_date: localDate(moveIn),
    lease_end_date: localDate(leaseEnd),
    penalty_enabled: true,
    penalty_per_day: String(randInt(50, 200)),
    chase_frequency: pick([3, 7]),
    stop_chase: String(randInt(0, 90)),
    utility_enabled: true,
    last_water_meter: String(randInt(0, 500)),
    water_rate: '18',
    last_elec_meter: String(randInt(0, 5000)),
    elec_rate: '5',
  }
}

function normalizeStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  for (const [key, label] of Object.entries(STATUS_LABELS)) {
    if (raw === key || raw.includes(key)) return { key, label }
  }
  return { key: raw || 'unknown', label: raw ? String(value) : 'ไม่ระบุ' }
}

function getStatusBadge(value) {
  const raw = String(value ?? '').toLowerCase()
  const { label } = normalizeStatus(value)
  let classes = 'bg-gray-100 text-gray-600 ring-gray-200'
  if (/(paid|ชำระแล้ว|จ่ายแล้ว)/.test(raw)) classes = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  else if (/(pending|รอชำระ|รอดำเนิน)/.test(raw)) classes = 'bg-amber-50 text-amber-700 ring-amber-200'
  else if (/(overdue|late|unpaid|เกินกำหนด|ค้าง|ยังไม่ชำระ)/.test(raw)) classes = 'bg-rose-50 text-rose-700 ring-rose-200'
  else if (/(active|ใช้งาน)/.test(raw)) classes = 'bg-indigo-50 text-indigo-700 ring-indigo-200'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${classes}`}>
      {label}
    </span>
  )
}

function statusKey(row) {
  return normalizeStatus(row?.status ?? row?.payment_status ?? row?.paymentStatus).key
}

function isOverdue(row) {
  const key = statusKey(row)
  if (/(overdue|late|unpaid|เกินกำหนด|ค้าง|ยังไม่ชำระ)/.test(key)) return true
  if (/(paid|ชำระแล้ว)/.test(key)) return false

  const rawDue = getValue(row, ['due_date'])
  if (rawDue !== undefined && rawDue !== null) {
    const dueDay = Number(rawDue)
    if (Number.isFinite(dueDay) && dueDay >= 1 && dueDay <= 31) {
      return new Date().getDate() > dueDay
    }
    const d = new Date(rawDue)
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return true
  }

  const due = getValue(row, ['due', 'due_at'])
  if (due) {
    const d = new Date(due)
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return true
  }
  return false
}

function isPaid(row) {
  return /(paid|ชำระแล้ว)/.test(statusKey(row))
}

function daysUntil(dateValue) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function isExpiringSoon(dateValue, withinDays = 30) {
  const days = daysUntil(dateValue)
  return days !== null && days >= 0 && days <= withinDays
}

function txAmount(tx) {
  return Number(tx?.total_amount ?? tx?.base_amount ?? 0)
}

async function sendLineWebhook(inv) {
  const webhookUrl = import.meta.env.VITE_WEBHOOK_URL
  if (!webhookUrl) throw new Error('ไม่พบ Webhook URL (VITE_WEBHOOK_URL)')
  const billLink = inv.billLink || `http://localhost:5173/bill/${inv.secureToken}`
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate_bill',
      rental_id: inv.rentalId,
      line_group_id: inv.lineGroupId || '',
      cust_name: inv.custName,
      item_details: inv.itemDetails,
      total_amount: inv.total,
      bill_link: billLink,
      payment_type: inv.paymentType || 'promptpay',
      promptpay_name: inv.promptpayName || '',
      qr_url: inv.qrUrl || '',
      bank_code: inv.bankCode || '',
      bank_account: inv.bankAccount || '',
      payment_text: inv.paymentText || '',
    }),
  })
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`)
}

function computeStats(rows) {
  let totalAmount = 0
  let hasAmount = false
  let overdue = 0
  let paid = 0
  let vacant = 0
  let occupied = 0
  let expiringSoon = 0
  for (const row of rows) {
    const amount = getValue(row, AMOUNT_KEYS)
    const n = Number(amount)
    if (amount !== undefined && !Number.isNaN(n)) {
      totalAmount += n
      hasAmount = true
    }
    if (isOverdue(row)) overdue += 1
    if (isPaid(row)) paid += 1
    const rs = String(row?.room_status ?? '').toLowerCase()
    if (rs === 'vacant') vacant += 1
    else if (rs === 'occupied') occupied += 1
    if (row?.lease_end_date && rs !== 'vacant' && isExpiringSoon(row.lease_end_date)) expiringSoon += 1
  }
  return { total: rows.length, totalAmount: hasAmount ? totalAmount : null, overdue, paid, vacant, occupied, expiringSoon }
}

function titleCase(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function labelColumn(key) {
  return COLUMN_LABELS[key] ?? titleCase(key)
}

function isAmountColumn(key) {
  return AMOUNT_KEYS.includes(key) || /amount|price|rent|balance|deposit|fee|total|penalty/i.test(key)
}

function isDateColumn(key) {
  return DATE_KEYS.includes(key) || /date|due|_at|time/i.test(key)
}

function isStatusColumn(key) {
  return /status/i.test(key)
}

function renderCell(key, value) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">—</span>
  }
  if (key === 'room_status') {
    const map = { occupied: 'ไม่ว่าง', vacant: 'ว่าง', maintenance: 'ซ่อมบำรุง' }
    const cls = value === 'vacant' ? 'bg-sky-50 text-sky-700 ring-sky-200' : value === 'maintenance' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{map[value] ?? String(value)}</span>
  }
  if (key === 'lease_end_date') {
    const expiring = isExpiringSoon(value)
    return (
      <span className={`inline-flex items-center gap-1 ${expiring ? 'font-semibold text-rose-600' : 'text-gray-600'}`}>
        {expiring && <Icon name="warning" className="h-3.5 w-3.5" />}
        {formatDate(value)}
      </span>
    )
  }
  if (isStatusColumn(key)) return getStatusBadge(value)
  if (key === 'due_date') {
    const day = Number(value)
    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      return <span className="font-semibold text-indigo-700">วันที่ {day}</span>
    }
    return <span className="text-gray-600">{formatDate(value)}</span>
  }
  if (key === 'cycle') {
    return <span className="text-gray-700">{CYCLE_LABELS[value] ?? String(value)}</span>
  }
  if (isAmountColumn(key)) return <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(value)}</span>
  if (isDateColumn(key)) return <span className="text-gray-600">{formatDate(value)}</span>
  if (typeof value === 'boolean') return <span className="text-gray-600">{value ? '✓' : '✗'}</span>
  return <span className="text-gray-700">{String(value)}</span>
}

function renderDetailValue(key, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (key === 'room_status') {
    const map = { occupied: 'มีผู้เช่า', vacant: 'ว่าง', active: 'ใช้งานอยู่', inactive: 'ไม่ใช้งาน' }
    return map[value] ?? String(value)
  }
  if (key === 'group_id' || key === 'binding_code') return <span className="font-mono text-xs">{String(value)}</span>
  return renderCell(key, value)
}

const CARD_TONES = {
  blue: { card: 'border-blue-100 bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100 text-blue-600' },
  green: { card: 'border-green-100 bg-green-50', text: 'text-green-600', icon: 'bg-green-100 text-green-600' },
  red: { card: 'border-red-100 bg-red-50', text: 'text-red-600', icon: 'bg-red-100 text-red-600' },
  orange: { card: 'border-orange-100 bg-orange-50', text: 'text-orange-600', icon: 'bg-orange-100 text-orange-600' },
}

function StatCard({ icon, label, value, tone = 'blue', onClick }) {
  const t = CARD_TONES[tone] || CARD_TONES.blue
  const inner = (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-semibold ${t.text}`}>{label}</p>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${t.text}`}>{value}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${t.icon}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
    </div>
  )
  const cls = `w-full rounded-2xl border p-5 text-left shadow-sm transition-shadow hover:shadow-md ${t.card}`
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  }
  return <div className={cls}>{inner}</div>
}

function MonthlyBreakdownModal({ monthly, onClose }) {
  const rows = Array.isArray(monthly) ? monthly : []
  const total = rows.reduce((sum, m) => sum + (Number(m.paid) || 0), 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">รายได้รายเดือน</h2>
            <p className="text-xs text-gray-500">ยอดชำระแล้ว (paid) แยกตามเดือน</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="py-2 font-medium">เดือน</th>
                <th className="py-2 text-right font-medium">รายได้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((m) => (
                <tr key={m.key}>
                  <td className="py-2.5 font-medium text-gray-700">{m.label}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(m.paid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td className="py-3 font-bold text-gray-900">รวม</td>
                <td className="py-3 text-right font-bold tabular-nums text-emerald-600">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

const NAV_ITEMS = [
  { to: '/', label: 'แดชบอร์ด', icon: 'home' },
  { to: '/assets', label: 'รายการสินทรัพย์', icon: 'building' },
  { to: '/settings', label: 'ตั้งค่าบัญชี', icon: 'cog' },
  { to: '/audit', label: 'ประวัติแก้ไข', icon: 'document' },
]

function OccupancyDonut({ occupied, vacant }) {
  const data = [
    { name: 'มีผู้เช่า', value: occupied },
    { name: 'ห้องว่าง', value: vacant },
  ]
  const total = occupied + vacant
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">สัดส่วนสินทรัพย์</h3>
          <p className="text-xs text-gray-500">ห้องมีผู้เช่าเทียบกับห้องว่าง</p>
        </div>
        <span className="text-lg font-bold text-blue-600">{total ? Math.round((occupied / total) * 100) : 0}%</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={3}>
              <Cell fill="#3b82f6" />
              <Cell fill="#9ca3af" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RevenueBar({ monthly }) {
  const data = Array.isArray(monthly) && monthly.length ? monthly : []
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-gray-900">รายงานรายได้ vs ค้างชำระ (6 เดือนล่าสุด)</h3>
        <p className="text-xs text-gray-500">เปรียบเทียบยอดชำระแล้วกับยอดค้างชำระ (ย้อนหลัง 6 เดือน)</p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `฿${Number(v).toLocaleString('th-TH')}`} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="paid" name="รายได้" fill="#10b981" radius={[6, 6, 0, 0]} />
            <Bar dataKey="outstanding" name="ค้างชำระ" fill="#f43f5e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function UrgentAlertsPanel({ expiring, overdue }) {
  const hasData = expiring.length > 0 || overdue.length > 0
  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon name="warning" className="h-5 w-5 text-amber-600" />
        <h2 className="text-base font-bold text-amber-800">การแจ้งเตือนด่วน</h2>
      </div>
      {!hasData ? (
        <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-600">ไม่มีรายการด่วนในตอนนี้</p>
      ) : (
        <div className="mt-3 space-y-4">
          {expiring.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">สัญญาเช่าที่จะหมดภายใน 7 วัน</p>
              <ul className="mt-2 space-y-2">
                {expiring.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2.5 text-sm">
                    <span className="font-medium text-gray-800">{r.cust_name} · {r.item_details}</span>
                    <span className="shrink-0 font-semibold text-amber-600">เหลือ {daysUntil(r.lease_end_date)} วัน</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {overdue.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">บิลค้างชำระเกิน 15 วัน</p>
              <ul className="mt-2 space-y-2">
                {overdue.map((t) => {
                  const rental = Array.isArray(t.rentals) ? t.rentals[0] : t.rentals
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2.5 text-sm">
                      <span className="font-medium text-gray-800">{rental?.cust_name || 'ไม่ระบุ'}</span>
                      <span className="shrink-0 font-semibold text-red-600">{formatCurrency(t.total_amount)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function NotificationsBell({ pendingReviews, expiringLeases }) {
  const [open, setOpen] = useState(false)
  const total = pendingReviews.length + expiringLeases.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-gray-300 bg-white p-2.5 text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
        aria-label="การแจ้งเตือน"
      >
        <Icon name="bell" className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-bold text-gray-900">การแจ้งเตือน</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {total === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-400">ไม่มีการแจ้งเตือน</p>
              ) : (
                <>
                  {pendingReviews.map((item) => {
                    const rental = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
                    const custName = rental?.cust_name || item.cust_name || 'ไม่ระบุ'
                    return (
                      <div key={item.id} className="flex items-start gap-3 border-b border-gray-50 px-4 py-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Icon name="warning" className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">มีบิลใหม่รอตรวจสอบ</p>
                          <p className="truncate text-xs text-gray-500">{custName} · {formatCurrency(txAmount(item))}</p>
                        </div>
                      </div>
                    )
                  })}
                  {expiringLeases.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 border-b border-gray-50 px-4 py-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600"><Icon name="warning" className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">สัญญาใกล้หมดอายุ</p>
                        <p className="truncate text-xs text-gray-500">{r.cust_name} · {r.item_details} · เหลือ {daysUntil(r.lease_end_date)} วัน</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100)
        if (error) throw error
        setLogs(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Fetch audit logs error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900">ประวัติแก้ไข (Audit Log)</h2>
        <p className="text-sm text-gray-500">บันทึกการแก้ไขยอดและเหตุผล</p>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : logs.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500">ยังไม่มีประวัติการแก้ไข</div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">เลขบิล</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">ยอดเก่า</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">ยอดใหม่</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">เหตุผล</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">วันที่แก้ไข</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log) => (
              <tr key={log.id} className="transition-colors hover:bg-gray-50">
                <td className="px-6 py-3 font-mono text-xs text-gray-700">{log.transaction_id || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{formatCurrency(log.old_amount)}</td>
                <td className="px-6 py-3 text-sm font-semibold text-gray-900">{formatCurrency(log.new_amount)}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{log.reason || '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{formatDate(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PDPAConsentModal({ onAccept }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">การยินยอมข้อมูลส่วนบุคคล (PDPA)</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">ระบบจะเก็บข้อมูลชื่อ-ที่อยู่-ยอดเงินของผู้เช่าเพื่อการทวงเงินตามกฎหมาย PDPA</p>
        <button type="button" onClick={onAccept} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500">
          ยินยอม
        </button>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <div>
          <p className="text-lg font-bold tracking-tight text-gray-900">PayRentPro</p>
          <p className="text-xs text-gray-500">ระบบจัดการค่าเช่า</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => console.log('logout')}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          <Icon name="warning" className="h-5 w-5" />
          ออกจากระบบ
        </button>
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
            ก
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">ผู้ดูแลระบบ</p>
            <p className="truncate text-xs text-gray-500">admin@payrentpro.com</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold tracking-wide text-indigo-500">PayRentPro v2.0 · build 2026-08-29</p>
      </div>
    </aside>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

function RowActionsMenu({ onViewDetails, onBillRequest, onRenew, onMoveOut, onDelete }) {
  const [open, setOpen] = useState(false)

  const items = [
    { label: 'ดูรายละเอียด', icon: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z', className: 'text-gray-700', onClick: onViewDetails },
    { label: 'สร้างบิล', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0v2.25m-3.75 6h7.5m-7.5 3H12', className: 'text-gray-700', onClick: onBillRequest },
    { label: 'ต่อสัญญา', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99', className: 'text-gray-700', onClick: onRenew },
    { label: 'ย้ายออก', icon: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9', className: 'text-amber-600', onClick: onMoveOut },
    { label: 'ลบข้อมูล', icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0', className: 'text-rose-600', onClick: onDelete },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        aria-label="เมนูจัดการ"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { setOpen(false); item.onClick() }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${item.className}`}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RentalsTable({ rentals, loading, error, columns, onRetry, onBillRequest, onViewDetails, onRenew, onMoveOut, onDelete }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">ข้อมูลสัญญาเช่า</h2>
          <p className="text-sm text-gray-500">
            ดึงข้อมูลจากตาราง{' '}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-indigo-600">rentals</code>{' '}
            จำนวน {rentals.length} รายการ
          </p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">ไม่สามารถโหลดข้อมูลได้</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Icon name="refresh" className="h-4 w-4" />
            ลองอีกครั้ง
          </button>
        </div>
      ) : rentals.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Icon name="document" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">ยังไม่มีข้อมูล</h3>
          <p className="mt-2 text-sm text-gray-500">ไม่พบข้อมูลในตาราง rentals ของ Supabase</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className={`${COLUMN_RESPONSIVE[column] || ''} ${COLUMN_WIDTH[column] || ''} whitespace-nowrap px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500`}
                  >
                    {labelColumn(column)}
                  </th>
                ))}
                <th className="w-[10%] whitespace-nowrap px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rentals.map((row, index) => (
                <tr key={row.id ?? index} className="transition-colors hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column} className={`${COLUMN_RESPONSIVE[column] || ''} whitespace-nowrap px-6 py-4 text-sm`}>
                      {TRUNCATE_COLUMNS.has(column) ? (
                        <div className="max-w-[200px] truncate">{renderCell(column, row[column])}</div>
                      ) : (
                        renderCell(column, row[column])
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <RowActionsMenu
                      onViewDetails={() => onViewDetails(row)}
                      onBillRequest={() => onBillRequest(row)}
                      onRenew={() => onRenew(row)}
                      onMoveOut={() => onMoveOut(row)}
                      onDelete={() => onDelete(row)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LeaseExpirySection({ rentals, onRenew, onMoveOut }) {
  const expiring = useMemo(() => {
    return (rentals || [])
      .filter((r) => r?.lease_end_date && String(r.room_status ?? '').toLowerCase() !== 'vacant' && isExpiringSoon(r.lease_end_date))
      .sort((a, b) => (daysUntil(a.lease_end_date) ?? 999) - (daysUntil(b.lease_end_date) ?? 999))
  }, [rentals])

  if (expiring.length === 0) return null

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-lg shadow-orange-100/60">
      <div className="flex items-center justify-between gap-4 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/40">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">สัญญาใกล้หมดอายุ</h2>
            <p className="text-sm text-orange-700">สัญญาที่จะหมดภายใน 30 วันข้างหน้า</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 ring-1 ring-inset ring-orange-200">{expiring.length} รายการ</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {expiring.map((r) => {
          const days = daysUntil(r.lease_end_date)
          return (
            <div key={r.id} className="flex flex-col rounded-xl border border-orange-200 bg-orange-50/40 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{r.cust_name}</p>
                  <p className="mt-0.5 truncate text-sm text-gray-600">{r.item_details}</p>
                </div>
                <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-inset ring-rose-200">
                  {days <= 0 ? 'หมดสัญญาแล้ว' : `เหลือ ${days} วัน`}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600">สิ้นสุดสัญญา <span className="font-semibold text-gray-900">{formatDate(r.lease_end_date)}</span></p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onRenew(r)} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500">ต่อสัญญา</button>
                <button type="button" onClick={() => onMoveOut(r)} className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">ทำเครื่องหมายว่าย้ายออก</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SettingsPage({ onSaved }) {
  const [form, setForm] = useState({ payment_type: 'promptpay', promptpay: '', promptpay_name: '', bank_code: '', bank_account: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const updateField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error: e } = await supabase.from('admins').select('payment_type, promptpay_name, promptpay, bank_code, bank_account').limit(1).maybeSingle()
        if (e) throw e
        if (!cancelled && data) {
          setForm({ payment_type: data.payment_type || 'promptpay', promptpay: data.promptpay ?? '', promptpay_name: data.promptpay_name ?? '', bank_code: data.bank_code ?? '', bank_account: data.bank_account ?? '' })
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'ดึงข้อมูลไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const isBank = form.payment_type === 'bank'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const payload = { payment_type: form.payment_type, promptpay: form.promptpay.trim(), promptpay_name: form.promptpay_name.trim(), bank_code: isBank ? form.bank_code : '', bank_account: isBank ? form.bank_account.trim() : '' }
      if (isBank && (!form.bank_code || !form.bank_account.trim() || !form.promptpay_name.trim())) throw new Error('กรุณากรอก ธนาคาร เลขบัญชี และชื่อบัญชี')
      if (!isBank && (!form.promptpay.trim() || !form.promptpay_name.trim())) throw new Error('กรุณากรอก เลขพร้อมเพย์ และชื่อบัญชี')
      const { data: existing } = await supabase.from('admins').select('id').limit(1).maybeSingle()
      if (form.promptpay.trim()) {
        let q = supabase.from('admins').select('id').eq('promptpay', form.promptpay.trim())
        if (existing?.id) q = q.neq('id', existing.id)
        const { data: dupes } = await q
        if (Array.isArray(dupes) && dupes.length > 0) throw new Error('เลขพร้อมเพย์นี้ถูกใช้สมัครในระบบแล้ว ไม่สามารถใช้สมัครใหม่ได้')
      }
      let resultError = null
      if (existing) { const { error: ue } = await supabase.from('admins').update(payload).eq('id', existing.id); resultError = ue }
      else { const { error: ie } = await supabase.from('admins').insert([{ ...payload, email: 'admin@payrentpro.com' }]); resultError = ie }
      if (resultError) throw resultError
      await onSaved()
      setSuccess(true)
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900">ตั้งค่าบัญชีรับเงิน</h2>
          <p className="mt-0.5 text-sm text-gray-500">กำหนดช่องทางที่ผู้เช่าใช้โอนเงินให้คุณ</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">บันทึกการตั้งค่าสำเร็จ</div>}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">ประเภทการรับเงิน</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setField('payment_type', 'promptpay')} className={`rounded-xl border-2 px-4 py-3 text-left ${!isBank ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                    <span className="block text-sm font-semibold text-gray-900">พร้อมเพย์ (PromptPay)</span>
                    <span className="text-xs text-gray-500">เบอร์โทร / เลขบัตรประชาชน</span>
                  </button>
                  <button type="button" onClick={() => setField('payment_type', 'bank')} className={`rounded-xl border-2 px-4 py-3 text-left ${isBank ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                    <span className="block text-sm font-semibold text-gray-900">บัญชีธนาคาร</span>
                    <span className="text-xs text-gray-500">โอนผ่านเลขบัญชี</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">ชื่อบัญชี <span className="text-rose-500">*</span></label>
                <input type="text" value={form.promptpay_name} onChange={updateField('promptpay_name')} placeholder="เช่น สมชาย ใจดี" required className={inputClass} />
              </div>

              {isBank ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">ธนาคาร <span className="text-rose-500">*</span></label>
                    <select value={form.bank_code} onChange={updateField('bank_code')} required className={inputClass}>
                      <option value="" disabled>เลือกธนาคาร</option>
                      {BANKS.map((b) => <option key={b.code} value={b.code}>ธนาคาร{b.name} ({b.short})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">เลขบัญชีธนาคาร <span className="text-rose-500">*</span></label>
                    <input type="text" inputMode="numeric" value={form.bank_account} onChange={updateField('bank_account')} placeholder="เช่น 1234567890" required className={inputClass} />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">เลขพร้อมเพย์ <span className="text-rose-500">*</span></label>
                  <input type="text" inputMode="numeric" value={form.promptpay} onChange={updateField('promptpay')} placeholder="เช่น 0812345678" required className={inputClass} />
                </div>
              )}

              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:opacity-60">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

function PendingReviewSection({ items, loading, error, reviewing, onApprove, onReject, onRetry }) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-lg shadow-amber-100/70">
      <div className="flex items-center justify-between gap-4 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-white shadow-lg shadow-amber-400/40">
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900">รอตรวจสอบสลิป</h2>
            <p className="text-sm text-amber-700">มีผู้เช่าแจ้งชำระเงินแล้ว โปรดตรวจสอบหลักฐานก่อนยืนยัน</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
          {loading ? 'กำลังโหลด...' : `${items.length} รายการ`}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-amber-50" />
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">ไม่สามารถโหลดรายการได้</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-400"
          >
            <Icon name="refresh" className="h-4 w-4" />
            ลองอีกครั้ง
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-500">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900">ไม่มีรายการรอตรวจสอบ</h3>
          <p className="mt-2 text-sm text-gray-500">ยังไม่มีผู้เช่าแจ้งชำระเงินในขณะนี้</p>
        </div>
      ) : (
        <div className="space-y-3 p-6">
          {items.map((item) => {
            const rental = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
            const custName = rental?.cust_name || item.cust_name || 'ไม่ระบุ'
            const itemDetails = rental?.item_details || item.item_details || 'ไม่ระบุ'
            const amount = item.base_amount ?? item.amount
            const isUpdating = reviewing?.id === item.id
            const isApproving = isUpdating && reviewing?.status === 'paid'
            const isRejecting = isUpdating && reviewing?.status === 'unpaid'
            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm transition-colors hover:border-amber-300 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-bold text-gray-900">{custName}</p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      รอตรวจสอบสลิป
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{itemDetails}</p>
                  {item.paid_amount > 0 && (
                    <p className="mt-1.5 text-sm font-semibold text-amber-700">
                      ผู้เช่าแจ้งจ่ายยอด {formatCurrency(item.paid_amount)} (จากยอดรวม {formatCurrency(item.total_amount || item.base_amount)})
                    </p>
                  )}
                  {item.period ? <p className="mt-1 text-xs text-gray-400">รอบบิล {item.period}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                  <p className="text-xl font-bold tabular-nums tracking-tight text-amber-600">{formatCurrency(amount)}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(item.id)}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isApproving ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      อนุมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(item.id)}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-rose-600/30 transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRejecting ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      )}
                      ปฏิเสธ
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const EMPTY_FORM = {
  biz_type: '',
  cust_name: '',
  item_details: '',
  amount: '',
  cycle: 'monthly',
  due_date: '',
  tenant_phone: '',
  tenant_id_card: '',
  emergency_contact: '',
  room_status: 'occupied',
  deposit_amount: '',
  move_in_date: '',
  lease_end_date: '',
  penalty_enabled: true,
  penalty_per_day: '',
  chase_frequency: 3,
  stop_chase: '0',
  utility_enabled: true,
  last_water_meter: '',
  water_rate: '',
  last_elec_meter: '',
  elec_rate: '',
}

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

function CollapsibleSection({ title, subtitle, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon name={icon} className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && <div className="border-t border-gray-100 px-5 py-5">{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}

function AddRentalModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(buildMockForm())
      setError(null)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const bindingCode = generateBindingCode()
      const payload = {
        biz_type: form.biz_type,
        cust_name: form.cust_name.trim(),
        tenant_phone: form.tenant_phone.trim() || null,
        tenant_id_card: form.tenant_id_card.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        item_details: form.item_details.trim(),
        room_status: form.room_status,
        amount: Number(form.amount),
        cycle: form.cycle,
        due_date: Number(form.due_date),
        penalty_per_day: Number(form.penalty_per_day) || 0,
        penalty_enabled: Boolean(form.penalty_enabled),
        chase_frequency: Number(form.chase_frequency) || 3,
        stop_chase: Number(form.stop_chase) > 0,
        credit_balance: 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        move_in_date: form.move_in_date || null,
        lease_end_date: form.lease_end_date || null,
        last_water_meter: Number(form.last_water_meter) || 0,
        water_rate: Number(form.water_rate) || 0,
        last_elec_meter: Number(form.last_elec_meter) || 0,
        elec_rate: Number(form.elec_rate) || 0,
        utility_enabled: Boolean(form.utility_enabled),
        binding_code: bindingCode,
      }
      const { error: insertError } = await supabase.from('rentals').insert([payload])
      if (insertError) throw insertError
      onCreated({ bindingCode, custName: form.cust_name.trim() })
      onClose()
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">เพิ่มสินทรัพย์ใหม่</h2>
            <p className="mt-0.5 text-sm text-gray-500">กรอกข้อมูลสัญญาเช่าเพื่อบันทึกลงในระบบ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <CollapsibleSection title="ข้อมูลสัญญาเช่า" subtitle="ข้อมูลหลักของสัญญา" icon="document" defaultOpen>
              <div className="space-y-4">
                <div>
                  <label htmlFor="biz_type" className="mb-1.5 block text-sm font-medium text-gray-700">
                    ประเภทธุรกิจ <span className="text-rose-500">*</span>
                  </label>
                  <select id="biz_type" value={form.biz_type} onChange={updateField('biz_type')} required className={inputClass}>
                    <option value="" disabled>เลือกประเภทธุรกิจ</option>
                    {BIZ_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cust_name" className="mb-1.5 block text-sm font-medium text-gray-700">
                    ชื่อผู้เช่า <span className="text-rose-500">*</span>
                  </label>
                  <input id="cust_name" type="text" value={form.cust_name} onChange={updateField('cust_name')} placeholder="เช่น นายสมชาย ใจดี" required className={inputClass} />
                </div>

                <div>
                  <label htmlFor="item_details" className="mb-1.5 block text-sm font-medium text-gray-700">
                    รายละเอียดสินทรัพย์
                  </label>
                  <input id="item_details" type="text" value={form.item_details} onChange={updateField('item_details')} placeholder={ITEM_PLACEHOLDERS[form.biz_type] || 'เช่น ห้อง 401, รถ กก-1234'} className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700">
                      ค่าเช่า / ค่างวด <span className="text-rose-500">*</span>
                    </label>
                    <input id="amount" type="number" min="0" step="0.01" value={form.amount} onChange={updateField('amount')} placeholder="0.00" required className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cycle" className="mb-1.5 block text-sm font-medium text-gray-700">
                      รอบการเก็บเงิน <span className="text-rose-500">*</span>
                    </label>
                    <select id="cycle" value={form.cycle} onChange={updateField('cycle')} required className={inputClass}>
                      {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="due_date" className="mb-1.5 block text-sm font-medium text-gray-700">
                    วันครบกำหนดชำระ (1-31) <span className="text-rose-500">*</span>
                  </label>
                  <input id="due_date" type="number" min="1" max="31" step="1" value={form.due_date} onChange={updateField('due_date')} placeholder="เช่น 1" required className={inputClass} />
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="ข้อมูลผู้เช่าและสัญญา" subtitle="ข้อมูลติดต่อและช่วงเวลาสัญญา" icon="building">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tenant_phone" className="mb-1.5 block text-sm font-medium text-gray-700">เบอร์โทรผู้เช่า</label>
                    <input id="tenant_phone" type="text" value={form.tenant_phone} onChange={updateField('tenant_phone')} placeholder="08x-xxx-xxxx" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tenant_id_card" className="mb-1.5 block text-sm font-medium text-gray-700">เลขบัตรประชาชน</label>
                    <input id="tenant_id_card" type="text" value={form.tenant_id_card} onChange={updateField('tenant_id_card')} placeholder="x-xxxx-xxxxx-xx-x" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label htmlFor="emergency_contact" className="mb-1.5 block text-sm font-medium text-gray-700">เบอร์ติดต่อฉุกเฉิน</label>
                  <input id="emergency_contact" type="text" value={form.emergency_contact} onChange={updateField('emergency_contact')} placeholder="08x-xxx-xxxx" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="room_status" className="mb-1.5 block text-sm font-medium text-gray-700">สถานะห้อง/สินทรัพย์</label>
                  <select id="room_status" value={form.room_status} onChange={updateField('room_status')} className={inputClass}>
                    <option value="occupied">ไม่ว่าง (occupied)</option>
                    <option value="vacant">ว่าง (vacant)</option>
                    <option value="maintenance">ซ่อมบำรุง (maintenance)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="deposit_amount" className="mb-1.5 block text-sm font-medium text-gray-700">เงินประกัน</label>
                  <input id="deposit_amount" type="number" min="0" step="0.01" value={form.deposit_amount} onChange={updateField('deposit_amount')} placeholder="0.00" className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="move_in_date" className="mb-1.5 block text-sm font-medium text-gray-700">วันที่ย้ายเข้า</label>
                    <input id="move_in_date" type="date" value={form.move_in_date} onChange={updateField('move_in_date')} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="lease_end_date" className="mb-1.5 block text-sm font-medium text-gray-700">วันสิ้นสุดสัญญา</label>
                    <input id="lease_end_date" type="date" value={form.lease_end_date} onChange={updateField('lease_end_date')} className={inputClass} />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="การตั้งค่าทวงเงินและค่าน้ำไฟ" subtitle="ค่าปรับ การทวงหนี้ และมิเตอร์" icon="banknotes">
              <div className="space-y-4">
                <Toggle checked={form.penalty_enabled} onChange={(v) => setField('penalty_enabled', v)} label="เปิดใช้ค่าปรับ" />

                {form.penalty_enabled && (
                  <div>
                    <label htmlFor="penalty_per_day" className="mb-1.5 block text-sm font-medium text-gray-700">ค่าปรับต่อวัน (บาท)</label>
                    <input id="penalty_per_day" type="number" min="0" step="0.01" value={form.penalty_per_day} onChange={updateField('penalty_per_day')} placeholder="0.00" className={inputClass} />
                  </div>
                )}

                <div>
                  <label htmlFor="chase_frequency" className="mb-1.5 block text-sm font-medium text-gray-700">ความถี่ทวงหนี้</label>
                  <select id="chase_frequency" value={form.chase_frequency} onChange={updateField('chase_frequency')} className={inputClass}>
                    <option value={3}>ทุก 3 วัน</option>
                    <option value={7}>ทุก 7 วัน</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stop_chase" className="mb-1.5 block text-sm font-medium text-gray-700">หยุดทวงหนี้หลังจาก (วัน)</label>
                  <input id="stop_chase" type="number" min="0" step="1" value={form.stop_chase} onChange={updateField('stop_chase')} placeholder="เช่น 30 (0 = ไม่หยุด)" className={inputClass} />
                </div>

                <Toggle checked={form.utility_enabled} onChange={(v) => setField('utility_enabled', v)} label="คิดค่าน้ำไฟ" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="last_water_meter" className="mb-1.5 block text-sm font-medium text-gray-700">เลขมิเตอร์น้ำล่าสุด</label>
                    <input id="last_water_meter" type="number" min="0" step="1" value={form.last_water_meter} onChange={updateField('last_water_meter')} placeholder="0" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="water_rate" className="mb-1.5 block text-sm font-medium text-gray-700">ค่าน้ำ/หน่วย (บาท)</label>
                    <input id="water_rate" type="number" min="0" step="0.01" value={form.water_rate} onChange={updateField('water_rate')} placeholder="0.00" className={inputClass} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="last_elec_meter" className="mb-1.5 block text-sm font-medium text-gray-700">เลขมิเตอร์ไฟล่าสุด</label>
                    <input id="last_elec_meter" type="number" min="0" step="1" value={form.last_elec_meter} onChange={updateField('last_elec_meter')} placeholder="0" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="elec_rate" className="mb-1.5 block text-sm font-medium text-gray-700">ค่าไฟ/หน่วย (บาท)</label>
                    <input id="elec_rate" type="number" min="0" step="0.01" value={form.elec_rate} onChange={updateField('elec_rate')} placeholder="0.00" className={inputClass} />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึกข้อมูล'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LineBindingModal({ code, custName, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!code) return null

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const steps = [
    { title: 'สร้างกลุ่มไลน์ระหว่างคุณกับผู้เช่า', desc: 'เปิดแอป LINE แล้วสร้างกลุ่มใหม่ร่วมกับผู้เช่าของคุณ' },
    { title: 'เชิญบอท "เลขาทวงเงิน PayRentPro" เข้ากลุ่ม', desc: 'เพิ่มบอทเข้าเป็นสมาชิกในกลุ่มที่เพิ่งสร้าง' },
    { title: 'พิมพ์รหัส 9 หลักลงในกลุ่มไลน์', desc: `พิมพ์รหัส ${code} ในกลุ่ม แล้วระบบจะผูกกลุ่มกับบิลนี้ให้อัตโนมัติ` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">เพิ่มสินทรัพย์สำเร็จ</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">ผูกกลุ่มไลน์สำหรับทวงหนี้อัตโนมัติ</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-emerald-100 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {custName && (
            <p className="text-sm text-gray-500">
              ผู้เช่า: <span className="font-semibold text-gray-900">{custName}</span>
            </p>
          )}

          <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">รหัสผูกกลุ่มของคุณ</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-gray-900">{code}</p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              {copied ? '✓ คัดลอกแล้ว' : 'คัดลอกรหัส'}
            </button>
          </div>

          <ol className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-600/30">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  )
}

function MeterBillModal({ rental, onClose, onConfirm }) {
  const [waterCurrent, setWaterCurrent] = useState('')
  const [elecCurrent, setElecCurrent] = useState('')
  const [sendToLine, setSendToLine] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rental) {
      setWaterCurrent('')
      setElecCurrent('')
      setSendToLine(true)
      setSaving(false)
    }
  }, [rental])

  if (!rental) return null

  const utilityEnabled = Boolean(rental.utility_enabled)
  const amount = Number(getValue(rental, AMOUNT_KEYS)) || 0
  const lastWater = Number(rental.last_water_meter) || 0
  const lastElec = Number(rental.last_elec_meter) || 0
  const waterRate = Number(rental.water_rate) || 0
  const elecRate = Number(rental.elec_rate) || 0

  const curWater = Number(waterCurrent) || 0
  const curElec = Number(elecCurrent) || 0
  const waterUnits = Math.max(0, curWater - lastWater)
  const waterCost = waterUnits * waterRate
  const elecUnits = Math.max(0, curElec - lastElec)
  const elecCost = elecUnits * elecRate
  const totalAmount = amount + (utilityEnabled ? waterCost + elecCost : 0)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(rental, { waterCurrent, elecCurrent }, sendToLine)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <Icon name="banknotes" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">บันทึกมิเตอร์และสร้างบิล</h2>
              <p className="mt-0.5 text-sm text-gray-500">{rental.cust_name} · {rental.item_details}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            ค่าเช่า / ค่างวด: <span className="font-semibold">{formatCurrency(amount)}</span>
          </div>

          {utilityEnabled ? (
            <>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-semibold text-blue-700">ค่าน้ำ</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="rounded-lg bg-white p-2.5">มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900">{lastWater}</span></div>
                  <div className="rounded-lg bg-white p-2.5">อัตรา: <span className="font-semibold text-gray-900">{waterRate} บาท/หน่วย</span></div>
                </div>
                <label htmlFor="water_current" className="mt-3 block text-sm font-medium text-gray-700">เลขมิเตอร์น้ำปัจจุบัน</label>
                <input id="water_current" type="number" min="0" step="1" value={waterCurrent} onChange={(e) => setWaterCurrent(e.target.value)} placeholder="เช่น 150" className={inputClass} />
                <p className="mt-2 text-xs text-gray-500">ใช้ไป {waterUnits} หน่วย = {formatCurrency(waterCost)}</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="text-sm font-semibold text-amber-700">ค่าไฟ</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div className="rounded-lg bg-white p-2.5">มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900">{lastElec}</span></div>
                  <div className="rounded-lg bg-white p-2.5">อัตรา: <span className="font-semibold text-gray-900">{elecRate} บาท/หน่วย</span></div>
                </div>
                <label htmlFor="elec_current" className="mt-3 block text-sm font-medium text-gray-700">เลขมิเตอร์ไฟปัจจุบัน</label>
                <input id="elec_current" type="number" min="0" step="1" value={elecCurrent} onChange={(e) => setElecCurrent(e.target.value)} placeholder="เช่น 2500" className={inputClass} />
                <p className="mt-2 text-xs text-gray-500">ใช้ไป {elecUnits} หน่วย = {formatCurrency(elecCost)}</p>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">ห้องนี้ไม่ได้เปิดใช้งานระบบน้ำไฟ (ข้ามการคำนวณค่าน้ำ/ค่าไฟ)</div>
          )}

          <div className="rounded-2xl bg-gray-900 px-4 py-4 text-center text-white">
            <p className="text-xs text-gray-300">ยอดรวมที่ต้องชำระ</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={sendToLine}
              onChange={(e) => setSendToLine(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            📥 ส่งบิลเข้าไลน์อัตโนมัติ
          </label>
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60">ยกเลิก</button>
            <button type="button" onClick={handleConfirm} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? (<><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>กำลังสร้างบิล...</>) : 'สร้างบิล'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RenewModal({ rental, onClose, onConfirm }) {
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (rental) {
      const defaultDate = rental.lease_end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      setDate(defaultDate)
      setSaving(false)
    }
  }, [rental])

  if (!rental) return null

  const handleConfirm = async () => {
    if (!date) return
    setSaving(true)
    try {
      await onConfirm(rental, date)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">ต่อสัญญา</h2>
            <p className="mt-0.5 text-sm text-gray-500">{rental.cust_name} · {rental.item_details}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <label htmlFor="renew_lease_end" className="mb-1.5 block text-sm font-medium text-gray-700">วันสิ้นสุดสัญญาใหม่</label>
          <input id="renew_lease_end" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LeaseActionModal({ rental, mode, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)
  const [repairCost, setRepairCost] = useState('')

  useEffect(() => {
    if (rental) {
      setSaving(false)
      setRepairCost('')
    }
  }, [rental])

  if (!rental) return null

  const isDelete = mode === 'delete'
  const title = isDelete ? 'ลบข้อมูล' : 'ย้ายออก'
  const message = isDelete
    ? 'ข้อมูลและบิลทั้งหมดของห้องนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้'
    : 'ผู้เช่าได้ย้ายออกและห้องว่างแล้วใช่ไหม'
  const confirmLabel = isDelete ? 'ลบข้อมูลถาวร' : 'ยืนยันย้ายออก'

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(rental, isDelete ? null : Number(repairCost) || 0)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`px-6 py-5 text-white ${isDelete ? 'bg-rose-600' : 'bg-amber-500'}`}>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-0.5 text-sm opacity-90">{rental.cust_name} · {rental.item_details}</p>
        </div>
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm leading-relaxed text-gray-600">{message}</p>
          {!isDelete && (
            <>
              <div>
                <label htmlFor="repair_cost" className="mb-1.5 block text-sm font-medium text-gray-700">ค่าซ่อมแซม/หักค่าเสียหาย (บาท)</label>
                <input id="repair_cost" type="number" min="0" step="0.01" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                ยอดเงินประกันคืน = <span className="font-semibold">{formatCurrency(Math.max(0, (Number(rental.deposit_amount) || 0) - (Number(repairCost) || 0)))}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isDelete ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
            {saving ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetDetailModal({ rental, onClose }) {
  if (!rental) return null

  const fields = [
    { key: 'tenant_phone', label: 'เบอร์โทรผู้เช่า' },
    { key: 'tenant_id_card', label: 'เลขบัตรประชาชน' },
    { key: 'emergency_contact', label: 'เบอร์ติดต่อฉุกเฉิน' },
    { key: 'room_status', label: 'สถานะห้อง/สินทรัพย์' },
    { key: 'deposit_amount', label: 'เงินประกัน' },
    { key: 'move_in_date', label: 'วันที่ย้ายเข้า' },
    { key: 'lease_end_date', label: 'วันสิ้นสุดสัญญา' },
    { key: 'penalty_per_day', label: 'ค่าปรับต่อวัน' },
    { key: 'penalty_enabled', label: 'เปิดใช้ค่าปรับ' },
    { key: 'chase_frequency', label: 'ความถี่ทวงหนี้ (วัน)' },
    { key: 'stop_chase', label: 'หยุดทวงหนี้' },
    { key: 'last_water_meter', label: 'เลขมิเตอร์น้ำล่าสุด' },
    { key: 'water_rate', label: 'ค่าน้ำ/หน่วย' },
    { key: 'last_elec_meter', label: 'เลขมิเตอร์ไฟล่าสุด' },
    { key: 'elec_rate', label: 'ค่าไฟ/หน่วย' },
    { key: 'utility_enabled', label: 'คิดค่าน้ำไฟ' },
    { key: 'group_id', label: 'LINE Group ID' },
    { key: 'binding_code', label: 'รหัสผูกกลุ่ม (Binding Code)' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Icon name="document" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">ข้อมูลสินทรัพย์เพิ่มเติม</h2>
              <p className="mt-0.5 text-sm text-gray-500">{rental.cust_name} · {rental.item_details}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <dl className="divide-y divide-gray-100">
            {fields.map((f) => (
              <div key={f.key} className="flex items-start justify-between gap-4 py-3">
                <dt className="text-sm text-gray-500">{f.label}</dt>
                <dd className="text-right text-sm font-semibold text-gray-900">{renderDetailValue(f.key, rental[f.key])}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    payment_type: 'promptpay',
    promptpay: '',
    promptpay_name: '',
    bank_code: '',
    bank_account: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setError(null)
      setLoading(true)
      try {
        const { data, error: fetchError } = await supabase
          .from('admins')
          .select('id, payment_type, promptpay_name, promptpay, bank_code, bank_account')
          .limit(1)
          .maybeSingle()
        if (fetchError) throw fetchError
        if (cancelled) return
        setForm({
          payment_type: data?.payment_type || 'promptpay',
          promptpay: data?.promptpay ?? '',
          promptpay_name: data?.promptpay_name ?? '',
          bank_code: data?.bank_code ?? '',
          bank_account: data?.bank_account ?? '',
        })
      } catch (err) {
        if (cancelled) return
        console.error('Settings load error:', err)
        // fallback: กรณียังไม่ migrate คอลัมน์ใหม่ใน Supabase
        try {
          const { data, error: fallbackError } = await supabase
            .from('admins')
            .select('id, promptpay_name, promptpay')
            .limit(1)
            .maybeSingle()
          if (fallbackError) throw fallbackError
          if (cancelled) return
          setForm((prev) => ({
            ...prev,
            payment_type: 'promptpay',
            promptpay: data?.promptpay ?? '',
            promptpay_name: data?.promptpay_name ?? '',
          }))
          setError(null)
        } catch (err2) {
          if (!cancelled) setError(err2?.message || 'ดึงข้อมูลไม่สำเร็จ')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const isBank = form.payment_type === 'bank'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        payment_type: form.payment_type,
        promptpay: form.promptpay.trim(),
        promptpay_name: form.promptpay_name.trim(),
        bank_code: isBank ? form.bank_code : '',
        bank_account: isBank ? form.bank_account.trim() : '',
      }
      if (isBank) {
        if (!form.bank_code || !form.bank_account.trim() || !form.promptpay_name.trim()) {
          throw new Error('กรุณากรอก ธนาคาร เลขบัญชี และชื่อบัญชี ให้ครบถ้วน')
        }
      } else if (!form.promptpay.trim() || !form.promptpay_name.trim()) {
        throw new Error('กรุณากรอก เลขพร้อมเพย์ และชื่อบัญชี ให้ครบถ้วน')
      }

      const { data: existing } = await supabase.from('admins').select('id').limit(1).maybeSingle()
      let resultError = null
      if (existing) {
        const { error: updateError } = await supabase.from('admins').update(payload).eq('id', existing.id)
        resultError = updateError
      } else {
        const { error: insertError } = await supabase
          .from('admins')
          .insert([{ ...payload, email: 'admin@payrentpro.com' }])
        resultError = insertError
      }
      if (resultError) throw resultError

      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Icon name="cog" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">ตั้งค่าบัญชีรับเงิน</h2>
              <p className="mt-0.5 text-sm text-gray-500">กำหนดช่องทางที่ผู้เช่าใช้โอนเงินให้คุณ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                กำลังโหลดข้อมูล...
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">ประเภทการรับเงิน</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, payment_type: 'promptpay' }))}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${!isBank ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900">พร้อมเพย์ (PromptPay)</span>
                      <span className="mt-0.5 block text-xs text-gray-500">เบอร์โทร / เลขบัตรประชาชน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, payment_type: 'bank' }))}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${isBank ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900">บัญชีธนาคาร</span>
                      <span className="mt-0.5 block text-xs text-gray-500">โอนผ่านเลขบัญชีธนาคาร</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="settings_account_name" className="mb-1.5 block text-sm font-medium text-gray-700">
                    ชื่อบัญชี <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="settings_account_name"
                    type="text"
                    value={form.promptpay_name}
                    onChange={updateField('promptpay_name')}
                    placeholder="เช่น สมชาย ใจดี"
                    required
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {isBank ? (
                  <>
                    <div>
                      <label htmlFor="settings_bank_code" className="mb-1.5 block text-sm font-medium text-gray-700">
                        ธนาคาร <span className="text-rose-500">*</span>
                      </label>
                      <select
                        id="settings_bank_code"
                        value={form.bank_code}
                        onChange={updateField('bank_code')}
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="" disabled>เลือกธนาคาร</option>
                        {BANKS.map((b) => (
                          <option key={b.code} value={b.code}>ธนาคาร{b.name} ({b.short})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="settings_bank_account" className="mb-1.5 block text-sm font-medium text-gray-700">
                        เลขบัญชีธนาคาร <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="settings_bank_account"
                        type="text"
                        inputMode="numeric"
                        value={form.bank_account}
                        onChange={updateField('bank_account')}
                        placeholder="เช่น 1234567890"
                        required
                        className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor="settings_promptpay" className="mb-1.5 block text-sm font-medium text-gray-700">
                      เลขพร้อมเพย์ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="settings_promptpay"
                      type="text"
                      inputMode="numeric"
                      value={form.promptpay}
                      onChange={updateField('promptpay')}
                      placeholder="เช่น 0812345678 หรือ 1234567890123"
                      required
                      className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                  </svg>
                  กำลังบันทึก...
                </>
              ) : (
                'บันทึกการตั้งค่า'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InvoiceModal({ invoice, onClose, onMarkPaid, onCopyLink, onSendToLine }) {
  const [marking, setMarking] = useState(false)
  const [sending, setSending] = useState(false)
  const [qrError, setQrError] = useState(false)

  useEffect(() => {
    if (invoice) setQrError(false)
  }, [invoice])

  useEffect(() => {
    if (!invoice) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [invoice, onClose])

  if (!invoice) return null

  const isPaid = invoice.status === 'paid'

  const handleMarkPaid = async () => {
    setMarking(true)
    try {
      await onMarkPaid()
    } finally {
      setMarking(false)
    }
  }

  const handleSendToLine = async () => {
    setSending(true)
    try {
      await onSendToLine()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-6 text-white">
          <p className="text-sm font-medium text-indigo-100">ใบแจ้งหนี้ / INVOICE</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">PayRentPro</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-indigo-100 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-6">
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${isPaid ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isPaid ? 'ชำระแล้ว' : 'รอการชำระเงิน'}
          </div>

          {invoice.sent && (
            <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ✅ ส่งบิลเข้าไลน์สำเร็จแล้ว
            </div>
          )}

          <dl className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500">ชื่อผู้เช่า</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">{invoice.custName}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500">รายละเอียดสินทรัพย์</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">{invoice.itemDetails}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500">รอบบิล</dt>
              <dd className="text-right text-sm font-semibold text-gray-900">{invoice.period}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500">เลขที่บิล</dt>
              <dd className="text-right font-mono text-sm font-semibold text-gray-900">
                {invoice.transactionId ? invoice.transactionId.slice(0, 8).toUpperCase() : '—'}
              </dd>
            </div>
          </dl>

          <div className="my-5 border-t border-dashed border-gray-200" />

          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium text-gray-500">ยอดรวมที่ต้องจ่าย</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-rose-600">{formatCurrency(invoice.total)}</p>
          </div>

          <div className="mt-5 flex flex-col items-center">
            {invoice.paymentType === 'bank' ? (
              <div className="w-full rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-5 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                  <Icon name="banknotes" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">โอนเข้าบัญชีธนาคาร</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700">{invoice.paymentText}</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                  {qrError ? (
                    <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-gray-100 p-4 text-center text-xs text-gray-400">
                      ไม่สามารถโหลด QR Code ได้
                    </div>
                  ) : (
                    <img
                      src={invoice.qrUrl}
                      alt="QR Code พร้อมเพย์"
                      width={176}
                      height={176}
                      className="h-44 w-44 object-contain"
                      onError={() => setQrError(true)}
                    />
                  )}
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  สแกนจ่ายผ่าน <span className="font-semibold text-gray-900">พร้อมเพย์</span>
                </p>
                <p className="font-mono text-sm text-gray-500">{invoice.promptpayNumber || '0812345678'}</p>
                {invoice.promptpayName && (
                  <p className="mt-1 text-sm font-semibold text-gray-700">โอนเข้าบัญชี: {invoice.promptpayName}</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={handleSendToLine}
            disabled={invoice.sent || sending}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              invoice.sent ? 'bg-emerald-500' : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {sending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                กำลังส่ง...
              </>
            ) : invoice.sent ? (
              '✅ ส่งสำเร็จแล้ว'
            ) : (
              '📤 ส่งบิลเข้าไลน์'
            )}
          </button>
          <div className={`grid gap-3 ${invoice.paymentType === 'bank' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {invoice.paymentType !== 'bank' && (
              <a
                href={invoice.qrUrl}
                download="promptpay-qr.png"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h2.25M3 7.5V5.25A2.25 2.25 0 0 1 5.25 3h2.25M21 16.5v2.25A2.25 2.25 0 0 1 18.75 21h-2.25M21 7.5V5.25A2.25 2.25 0 0 0 18.75 3h-2.25M12 7.5v9m0 0-3-3m3 3 3-3" />
                </svg>
                บันทึกรูป QR Code
              </a>
            )}
            <button
              type="button"
              onClick={onCopyLink}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              คัดลอกลิงก์บิล
            </button>
          </div>
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={isPaid || marking}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isPaid ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {marking ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
                กำลังอัปเดต...
              </>
            ) : isPaid ? (
              <>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                ชำระแล้ว
              </>
            ) : (
              'ฉันจ่ายเงินแล้ว'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const styles = {
    success: { bg: 'bg-emerald-600', icon: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    error: { bg: 'bg-rose-600', icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z' },
    warning: { bg: 'bg-amber-500', icon: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0' },
    info: { bg: 'bg-blue-600', icon: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z' },
  }
  const s = styles[toast.type] || styles.info

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] w-full max-w-sm -translate-x-1/2 px-4">
      <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${s.bg}`}>
        <svg className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
        </svg>
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onClose} className="shrink-0 opacity-80 transition-opacity hover:opacity-100" aria-label="ปิด">
          ✕
        </button>
      </div>
    </div>
  )
}

function App() {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [bindingModal, setBindingModal] = useState(null)
  const [detailRental, setDetailRental] = useState(null)
  const [billRental, setBillRental] = useState(null)
  const [renewRental, setRenewRental] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [pdpAccepted, setPdpAccepted] = useState(() => { try { return localStorage.getItem('payrentpro_pdpa') === '1' } catch { return true } })
  const [invoice, setInvoice] = useState(null)
  const [toast, setToast] = useState(null)
  const [pendingReviews, setPendingReviews] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [summary, setSummary] = useState({ paidIncome: 0, paidThisMonth: 0, outstanding: 0, monthly: [] })
  const [showMonthly, setShowMonthly] = useState(false)
  const [overdueBills, setOverdueBills] = useState([])
  const knownPendingIdsRef = useRef(null)
  const [paymentInfo, setPaymentInfo] = useState({
    payment_type: 'promptpay',
    promptpay: '',
    promptpay_name: '',
    bank_code: '',
    bank_account: '',
  })

  const fetchRentals = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const { data, error: supabaseError } = await supabase.from('rentals').select('*')
      if (supabaseError) throw supabaseError
      setRentals(Array.isArray(data) ? data : [])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRentals()
  }, [fetchRentals])

  const closeToast = useCallback(() => setToast(null), [])

  const fetchPaymentInfo = useCallback(async () => {
    try {
      const { data, error: ppError } = await supabase
        .from('admins')
        .select('payment_type, promptpay_name, promptpay, bank_code, bank_account')
        .limit(1)
        .maybeSingle()
      if (ppError) throw ppError
      if (data) {
        setPaymentInfo({
          payment_type: data.payment_type || 'promptpay',
          promptpay: data.promptpay ?? '',
          promptpay_name: data.promptpay_name ?? '',
          bank_code: data.bank_code ?? '',
          bank_account: data.bank_account ?? '',
        })
      }
    } catch (err) {
      console.error('Fetch payment info error:', err)
      // fallback: กรณียังไม่ migrate คอลัมน์ใหม่ใน Supabase
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('promptpay_name, promptpay')
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (data) {
          setPaymentInfo((prev) => ({
            ...prev,
            promptpay: data.promptpay ?? '',
            promptpay_name: data.promptpay_name ?? '',
          }))
        }
      } catch (err2) {
        console.error('Fetch payment info fallback error:', err2)
      }
    }
  }, [])

  useEffect(() => {
    fetchPaymentInfo()
  }, [fetchPaymentInfo])

  const fetchPendingReviews = useCallback(async (silent = false) => {
    if (!silent) {
      setPendingLoading(true)
      setPendingError(null)
    }
    try {
      const { data, error: supabaseError } = await supabase
        .from('transactions')
        .select('*, rentals(cust_name, item_details)')
        .eq('status', 'pending_review')
      if (supabaseError) throw supabaseError
      const items = Array.isArray(data) ? data : []
      setPendingReviews(items)
      const ids = items.map((x) => x.id)
      if (knownPendingIdsRef.current !== null) {
        const newCount = ids.filter((id) => !knownPendingIdsRef.current.includes(id)).length
        if (newCount > 0) setToast({ type: 'warning', message: `มีบิลใหม่รอตรวจสอบ ${newCount} รายการ` })
      }
      knownPendingIdsRef.current = ids
    } catch (err) {
      if (!silent) setPendingError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      if (!silent) setPendingLoading(false)
    }
  }, [])

  const fetchSummary = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('status, total_amount, base_amount, period, created_at')
      if (error) throw error
      const pad = (n) => String(n).padStart(2, '0')
      const rows = Array.isArray(data) ? data : []

      const txMonth = (tx) => {
        const p = String(tx?.period ?? '').trim()
        const m = p.slice(0, 7)
        if (/^\d{4}-\d{2}$/.test(m)) return m
        const d = tx?.created_at ? new Date(tx.created_at) : null
        if (d && !Number.isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
        return null
      }

      // หาเดือน "ปัจจุบัน" จากข้อมูลจริง (กันนาฬิกาเครื่องเพี้ยน/ไม่ตรงกับข้อมูล)
      const dataMonths = new Set()
      for (const tx of rows) { const mk = txMonth(tx); if (mk) dataMonths.add(mk) }
      const now = new Date()
      const browserKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
      const currentMonthKey = dataMonths.has(browserKey) || dataMonths.size === 0
        ? browserKey
        : [...dataMonths].sort().pop()

      let paidIncome = 0
      let paidThisMonth = 0
      let outstanding = 0

      // โครงสร้างเดือนย้อนหลัง 6 เดือน (จบที่เดือนปัจจุบัน)
      const monthly = []
      const monthMap = {}
      const [curYear, curMonth] = currentMonthKey.split('-').map(Number)
      for (let i = 5; i >= 0; i--) {
        const d = new Date(curYear, curMonth - 1 - i, 1)
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
        const item = { key, label: THAI_MONTHS[d.getMonth()], paid: 0, outstanding: 0 }
        monthly.push(item)
        monthMap[key] = item
      }

      for (const tx of rows) {
        const amt = Number(tx.total_amount ?? tx.base_amount ?? 0) || 0
        const s = String(tx.status ?? '').toLowerCase()
        const mk = txMonth(tx)
        if (s === 'paid') {
          paidIncome += amt
          if (mk === currentMonthKey) paidThisMonth += amt
          if (mk && monthMap[mk]) monthMap[mk].paid += amt
        } else if (s === 'unpaid' || s === 'pending_review') {
          outstanding += amt
          if (mk && monthMap[mk]) monthMap[mk].outstanding += amt
        }
      }
      setSummary({ paidIncome, paidThisMonth, outstanding, monthly })
    } catch (err) {
      console.error('Fetch summary error:', err)
    }
  }, [])

  const fetchOverdue = useCallback(async () => {
    try {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 15)
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total_amount, rentals(cust_name)')
        .eq('status', 'unpaid')
        .lt('created_at', cutoff.toISOString())
      if (error) throw error
      setOverdueBills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Overdue fetch error:', err)
    }
  }, [])

  useEffect(() => {
    fetchPendingReviews()
    fetchSummary()
    fetchOverdue()
  }, [fetchPendingReviews, fetchSummary, fetchOverdue])

  // polling แบบเรียลไทม์ (ทุก 20 วินาที) — รีเฟรชการ์ดสรุป + สินทรัพย์ด้วย
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPendingReviews(true)
      fetchSummary()
      fetchRentals(true)
      fetchOverdue()
    }, 20000)
    return () => clearInterval(timer)
  }, [fetchPendingReviews, fetchSummary, fetchRentals, fetchOverdue])

  const handleReviewTransaction = async (id, newStatus) => {
    if (!id) return
    setReviewing({ id, status: newStatus })
    setToast(null)
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: newStatus })
        .eq('id', id)
      if (updateError) throw updateError
      setToast({ type: 'success', message: newStatus === 'paid' ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ' })
      await fetchPendingReviews()
      fetchSummary()
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'อัปเดตสถานะไม่สำเร็จ' })
    } finally {
      setReviewing(null)
    }
  }

  const handleCreateBill = async (rental, meters, sendToLine = true) => {
    setToast(null)
    try {
      const amount = Number(getValue(rental, AMOUNT_KEYS))
      const period = currentPeriod()
      const secureToken = generateSecureToken()
      const custName = getValue(rental, ['cust_name', 'tenant_name', 'customer', 'customer_name', 'name']) ?? 'ไม่ระบุ'
      const itemDetails = getValue(rental, ['item_details', 'property_name', 'property', 'unit', 'room']) ?? 'ไม่ระบุ'
      const { data: rentalGroup } = await supabase
        .from('rentals')
        .select('group_id')
        .eq('id', rental.id)
        .maybeSingle()
      const lineGroupId = rentalGroup?.group_id || ''

      const utilityEnabled = Boolean(rental.utility_enabled)
      const lastWater = Number(rental.last_water_meter) || 0
      const lastElec = Number(rental.last_elec_meter) || 0
      const waterCurrent = utilityEnabled ? Number(meters?.waterCurrent) || 0 : 0
      const elecCurrent = utilityEnabled ? Number(meters?.elecCurrent) || 0 : 0
      const waterUnits = utilityEnabled ? Math.max(0, waterCurrent - lastWater) : 0
      const waterCost = utilityEnabled ? waterUnits * (Number(rental.water_rate) || 0) : 0
      const elecUnits = utilityEnabled ? Math.max(0, elecCurrent - lastElec) : 0
      const elecCost = utilityEnabled ? elecUnits * (Number(rental.elec_rate) || 0) : 0
      const totalAmount = amount + waterCost + elecCost

      const { data: tx, error: insertError } = await supabase
        .from('transactions')
        .insert([{
          rental_id: rental.id,
          period,
          base_amount: amount,
          water_units: waterUnits,
          water_cost: waterCost,
          elec_units: elecUnits,
          elec_cost: elecCost,
          total_amount: totalAmount,
          status: 'unpaid',
          secure_token: secureToken,
        }])
        .select()
        .single()
      if (insertError) throw insertError

      // อัปเดตเลขมิเตอร์ล่าสุดใน rentals สำหรับเดือนถัดไป
      if (utilityEnabled) {
        const { error: updateError } = await supabase
          .from('rentals')
          .update({ last_water_meter: waterCurrent, last_elec_meter: elecCurrent })
          .eq('id', rental.id)
        if (updateError) throw updateError
        fetchRentals()
      }

      const billLink = `http://localhost:5173/bill/${secureToken}`
      const isBank = paymentInfo.payment_type === 'bank'
      const ppNumber = (paymentInfo.promptpay || '0812345678').replace(/[^0-9]/g, '')
      const accountName = paymentInfo.promptpay_name || ''
      const bankCode = paymentInfo.bank_code || ''
      const bankAccount = paymentInfo.bank_account || ''
      const paymentText = isBank
        ? `โอนเข้าบัญชี ${bankName(bankCode)} เลขที่ ${bankAccount} ชื่อบัญชี ${accountName}`
        : ''

      const invoiceObj = {
        transactionId: tx.id,
        secureToken,
        rentalId: rental.id,
        lineGroupId,
        custName,
        itemDetails,
        total: totalAmount,
        baseAmount: amount,
        waterUnits,
        waterCost,
        elecUnits,
        elecCost,
        period,
        paymentType: paymentInfo.payment_type || 'promptpay',
        promptpayName: accountName,
        promptpayNumber: paymentInfo.promptpay || '0812345678',
        bankCode,
        bankAccount,
        paymentText,
        qrUrl: isBank ? '' : `https://promptpay.io/${ppNumber}/${totalAmount}.png`,
        billLink,
        status: 'unpaid',
        sent: false,
      }

      // ส่งเข้าไลน์อัตโนมัติ (ถ้าเลือก)
      if (sendToLine) {
        try {
          await sendLineWebhook(invoiceObj)
          invoiceObj.sent = true
        } catch (err) {
          console.error('Auto LINE webhook failed:', err)
          setToast({ type: 'warning', message: 'สร้างบิลแล้ว แต่ส่งเข้าไลน์ไม่สำเร็จ (กดส่งเองได้ในหน้าบิล)' })
        }
      }

      setInvoice(invoiceObj)
      setBillRental(null)
      fetchSummary()
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'สร้างบิลไม่สำเร็จ' })
    }
  }

  const handleRenew = async (rental, leaseEndDate) => {
    try {
      const { error } = await supabase.from('rentals').update({ lease_end_date: leaseEndDate }).eq('id', rental.id)
      if (error) throw error
      setToast({ type: 'success', message: 'ต่อสัญญาเรียบร้อยแล้ว' })
      setRenewRental(null)
      fetchRentals()
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'ต่อสัญญาไม่สำเร็จ' })
    }
  }

  const handleConfirmAction = async (rental, repairCost) => {
    try {
      if (confirmAction?.type === 'delete') {
        const { error } = await supabase.from('rentals').delete().eq('id', rental.id)
        if (error) throw error
        setToast({ type: 'success', message: 'ลบข้อมูลเรียบร้อยแล้ว' })
      } else {
        const { error } = await supabase.from('rentals').update({
          room_status: 'vacant',
          cust_name: 'ว่าง',
          tenant_phone: null,
          tenant_id_card: null,
          emergency_contact: null,
        }).eq('id', rental.id)
        if (error) throw error
        const refund = Math.max(0, (Number(rental.deposit_amount) || 0) - (repairCost || 0))
        setToast({ type: 'success', message: `ย้ายออกเรียบร้อย (เงินประกันคืน ${formatCurrency(refund)})` })
      }
      setConfirmAction(null)
      fetchRentals()
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'ดำเนินการไม่สำเร็จ' })
    }
  }

  const handleAcceptPDPA = () => {
    try { localStorage.setItem('payrentpro_pdpa', '1') } catch { /* ignore */ }
    setPdpAccepted(true)
  }



  const handleExportCsv = async () => {
    try {
      const { data, error } = await supabase.from('transactions').select('*')
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      if (rows.length === 0) { setToast({ type: 'warning', message: 'ไม่มีข้อมูล transactions' }); return }
      const headers = ['id', 'rental_id', 'period', 'base_amount', 'water_units', 'water_cost', 'elec_units', 'elec_cost', 'total_amount', 'status', 'created_at']
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setToast({ type: 'success', message: 'ส่งออก CSV เรียบร้อยแล้ว' })
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'ส่งออก CSV ไม่สำเร็จ' })
    }
  }

  const handleMarkPaid = async () => {
    if (!invoice) return
    try {
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'paid' })
        .eq('id', invoice.transactionId)
      if (updateError) throw updateError
      setInvoice((prev) => ({ ...prev, status: 'paid' }))
      setToast({ type: 'success', message: 'อัปเดตสถานะเป็น "ชำระแล้ว" เรียบร้อย' })
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'อัปเดตสถานะไม่สำเร็จ' })
    }
  }

  const handleCopyBillLink = async () => {
    const token = invoice?.secureToken
    if (!token) {
      setToast({ type: 'error', message: 'ไม่พบลิงก์บิล' })
      return
    }
    const link = `http://localhost:5173/bill/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setToast({ type: 'success', message: 'คัดลอกลิงก์บิลแล้ว' })
    } catch {
      setToast({ type: 'error', message: 'คัดลอกลิงก์ไม่สำเร็จ' })
    }
  }

  const handleSendBillToLine = async () => {
    if (!invoice) return
    try {
      await sendLineWebhook(invoice)
      setInvoice((prev) => ({ ...prev, sent: true }))
      setToast({ type: 'success', message: 'ส่งบิลเข้าไลน์เรียบร้อยแล้ว' })
    } catch (err) {
      console.error('Webhook request failed:', err)
      setToast({ type: 'error', message: err?.message || 'ส่งบิลเข้าไลน์ไม่สำเร็จ' })
    }
  }

  const location = useLocation()
  const isAssets = location.pathname === '/assets'
  const isSettings = location.pathname === '/settings'
  const isAudit = location.pathname === '/audit'

  const stats = useMemo(() => computeStats(rentals), [rentals])
  const columns = TABLE_COLUMNS
  const expiringLeases = useMemo(() => {
    return (rentals || []).filter((r) => r?.lease_end_date && String(r.room_status ?? '').toLowerCase() !== 'vacant' && isExpiringSoon(r.lease_end_date))
  }, [rentals])

  const urgentExpiring = useMemo(() => {
    return (rentals || []).filter((r) => {
      if (!r?.lease_end_date || String(r.room_status ?? '').toLowerCase() === 'vacant') return false
      const d = daysUntil(r.lease_end_date)
      return d !== null && d >= 0 && d <= 7
    })
  }, [rentals])

  const statCards = [
    { icon: 'chart', label: 'รายได้รวมตั้งแต่เริ่มใช้งาน', value: formatCurrency(summary.paidIncome), tone: 'blue', onClick: () => setShowMonthly(true) },
    { icon: 'banknotes', label: 'รายรับเดือนนี้', value: formatCurrency(summary.paidThisMonth), tone: 'green', onClick: () => setShowMonthly(true) },
    { icon: 'warning', label: 'ยอดค้างชำระ', value: formatCurrency(summary.outstanding), tone: 'red' },
    { icon: 'home', label: 'ห้องว่าง', value: stats.vacant, tone: 'orange' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 lg:hidden">
                <Icon name="building" className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                  {isAudit ? 'ประวัติแก้ไข' : isSettings ? 'ตั้งค่าบัญชี' : isAssets ? 'รายการสินทรัพย์' : 'แดชบอร์ด'}
                </h1>
                <p className="text-sm text-gray-500">
                  {isAudit ? 'บันทึกการแก้ไขยอดและเหตุผล' : isSettings ? 'ตั้งค่าเลขพร้อมเพย์ / บัญชีธนาคารสำหรับรับเงิน' : isAssets ? 'จัดการสัญญาเช่าและสินทรัพย์ทั้งหมด' : 'ภาพรวมการเก็บค่าเช่าและการติดตามหนี้'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationsBell pendingReviews={pendingReviews} expiringLeases={expiringLeases} />
              {!isAssets && !isSettings && !isAudit && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                >
                  Export CSV
                </button>
              )}
              {lastUpdated && (
                <p className="hidden text-xs text-gray-400 sm:block">
                  อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH')}
                </p>
              )}
              {isAssets && (
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition-colors hover:bg-blue-500"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  เพิ่มสินทรัพย์
                </button>
              )}
              <button
                type="button"
                onClick={() => { fetchRentals(); fetchSummary(); fetchPendingReviews() }}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรชข้อมูล
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isAudit ? (
            <AuditLogPage />
          ) : isSettings ? (
            <SettingsPage onSaved={fetchPaymentInfo} />
          ) : isAssets ? (
            <>
              <LeaseExpirySection
                rentals={rentals}
                onRenew={setRenewRental}
                onMoveOut={(rental) => setConfirmAction({ type: 'moveout', rental })}
              />

              <RentalsTable
                rentals={rentals}
                loading={loading}
                error={error}
                columns={columns}
                onRetry={fetchRentals}
                onBillRequest={setBillRental}
                onViewDetails={setDetailRental}
                onRenew={setRenewRental}
                onMoveOut={(rental) => setConfirmAction({ type: 'moveout', rental })}
                onDelete={(rental) => setConfirmAction({ type: 'delete', rental })}
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>

              <UrgentAlertsPanel expiring={urgentExpiring} overdue={overdueBills} />

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <OccupancyDonut occupied={stats.occupied} vacant={stats.vacant} />
                <RevenueBar monthly={summary.monthly} />
              </div>

              <PendingReviewSection
                items={pendingReviews}
                loading={pendingLoading}
                error={pendingError}
                reviewing={reviewing}
                onApprove={(id) => handleReviewTransaction(id, 'paid')}
                onReject={(id) => handleReviewTransaction(id, 'unpaid')}
                onRetry={fetchPendingReviews}
              />
            </>
          )}
        </main>
      </div>

      {!pdpAccepted && <PDPAConsentModal onAccept={handleAcceptPDPA} />}

      <AddRentalModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={({ bindingCode, custName }) => {
          fetchRentals()
          setBindingModal({ code: bindingCode, custName })
        }}
      />

      <InvoiceModal
        invoice={invoice}
        onClose={() => setInvoice(null)}
        onMarkPaid={handleMarkPaid}
        onCopyLink={handleCopyBillLink}
        onSendToLine={handleSendBillToLine}
      />

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={fetchPaymentInfo}
      />

      <LineBindingModal
        code={bindingModal?.code}
        custName={bindingModal?.custName}
        onClose={() => setBindingModal(null)}
      />

      <AssetDetailModal
        rental={detailRental}
        onClose={() => setDetailRental(null)}
      />

      <MeterBillModal
        rental={billRental}
        onClose={() => setBillRental(null)}
        onConfirm={handleCreateBill}
      />

      <RenewModal
        rental={renewRental}
        onClose={() => setRenewRental(null)}
        onConfirm={handleRenew}
      />

      <LeaseActionModal
        rental={confirmAction?.rental}
        mode={confirmAction?.type}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />

      {showMonthly && <MonthlyBreakdownModal monthly={summary.monthly} onClose={() => setShowMonthly(false)} />}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}

export default App
