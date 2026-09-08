import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from './supabaseClient'
import { BANKS, bankName } from './payment'
import AuthPage from './AuthPage'
import { createPromptpayQR } from './utils/promptpay'
import { createReceiptPdf } from './utils/receipt'
import { THAI_MONTHS, currentPeriod, formatPeriod } from './utils/period'
import { displayAssetName } from './utils/assetName'
import { useTheme, useChartTheme } from './theme'

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
  gem:
    'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
  shield:
    'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
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
  {
    value: 'property',
    label: 'อสังหาริมทรัพย์',
    tab: 'อสังหา',
    icon: '🏠',
    examples: 'หอพัก/ห้องเช่า',
    itemLabel: 'ห้อง',
    placeholder: 'เช่น 101',
    subLabel: 'ชื่อโครงการ/หมู่บ้าน',
    subPlaceholder: 'เช่น บ้านสวย, คอนโด XYZ',
  },
  {
    value: 'vehicle',
    label: 'ยานพาหนะ',
    tab: 'ยานพาหนะ',
    icon: '🚗',
    examples: 'รถเช่า/แท็กซี่',
    itemLabel: 'ทะเบียนรถ',
    placeholder: 'กก 1234',
    subLabel: 'ยี่ห้อรถ',
    subPlaceholder: 'เช่น Fortuner, Civic',
  },
  {
    value: 'other',
    label: 'อุปกรณ์/อื่นๆ',
    tab: 'อุปกรณ์/อื่นๆ',
    icon: '🛠️',
    examples: 'เครื่องจักร/กล้อง/บริการรายเดือน',
    itemLabel: 'รายการ',
    placeholder: 'เช่น กล้อง Sony A7, เครื่องจักร CNC-01',
  },
]

// แปลง biz_type จากทุกฟอร์แมต (ค่าใหม่ property/vehicle/other หรือค่าไทยเดิมสมัยแรก) ให้เป็นค่ามาตรฐาน
function normalizeBizType(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'vehicle' || raw.includes('ยานพาหนะ')) return 'vehicle'
  if (raw === 'other' || raw.includes('อุปกรณ์')) return 'other'
  return 'property'
}

function bizTypeMeta(value) {
  const key = normalizeBizType(value)
  return BIZ_TYPES.find((t) => t.value === key) || BIZ_TYPES[0]
}

const CYCLE_LABELS = {
  monthly: 'รายเดือน',
  weekly: 'รายสัปดาห์',
  daily: 'รายวัน',
}

const AMOUNT_KEYS = ['amount', 'rent', 'rent_amount', 'monthly_rent', 'price', 'total', 'balance', 'deposit']
const DATE_KEYS = ['due_date', 'due', 'due_at', 'paid_at', 'payment_date', 'payment_at', 'created_at', 'date', 'start_date', 'end_date']

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
// (รับ bizType ตอนกดเลือกการ์ดประเภท — ไม่ส่งจะสุ่มเอง)
function buildMockForm(bizTypeArg) {
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const phone = () => `08${randInt(10000000, 99999999)}`
  const pad = (n) => String(n).padStart(2, '0')
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const bizType = bizTypeArg || pick(['property', 'property', 'vehicle', 'other'])
  // item_details = ช่องหลักตามประเภท (ห้อง/ทะเบียน/รายการ), sub_label = ชื่อโครงการหรือยี่ห้อรถ
  const items = {
    property: ['101', '202', '401', 'C-1205', 'A-05'],
    vehicle: ['กก 1234', 'ทส 5678', '1กข 3456', '70-8899'],
    other: ['กล้อง Sony A7', 'เครื่องจักร CNC-01', 'โดรน DJI Mavic', 'เครื่องเสียงงานแต่ง'],
  }
  const subLabels = {
    property: ['บ้านสวย', 'คอนโดมินิมัล', 'หอพักฟ้าใส', 'บ้านวิลล่ากรีน'],
    vehicle: ['Fortuner', 'Honda Civic', 'Toyota Vios', 'Isuzu D-Max'],
    other: [],
  }
  const amount = bizType === 'property' ? randInt(3000, 15000) : bizType === 'vehicle' ? randInt(800, 5000) : randInt(500, 3000)

  const now = new Date()
  const moveIn = new Date(now)
  moveIn.setDate(moveIn.getDate() - randInt(0, 365))
  const leaseEnd = new Date(moveIn)
  leaseEnd.setFullYear(leaseEnd.getFullYear() + 1)

  return {
    biz_type: bizType,
    cust_name: `${pick(MOCK_FIRST_NAMES)} ${pick(MOCK_LAST_NAMES)}`,
    item_details: pick(items[bizType]),
    sub_label: subLabels[bizType].length ? pick(subLabels[bizType]) : '',
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
    utility_enabled: bizType === 'property',
    last_water_meter: bizType === 'property' ? String(randInt(0, 500)) : '0',
    water_rate: bizType === 'property' ? '18' : '0',
    last_elec_meter: bizType === 'property' ? String(randInt(0, 5000)) : '0',
    elec_rate: bizType === 'property' ? '5' : '0',
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
  let classes = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700'
  if (/(paid|ชำระแล้ว|จ่ายแล้ว)/.test(raw)) classes = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70'
  else if (/(pending|รอชำระ|รอดำเนิน)/.test(raw)) classes = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/70'
  else if (/(overdue|late|unpaid|เกินกำหนด|ค้าง|ยังไม่ชำระ)/.test(raw)) classes = 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70'
  else if (/(active|ใช้งาน)/.test(raw)) classes = 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 ring-indigo-200 dark:ring-indigo-800/70'
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

// คีย์เดือน 'YYYY-MM' ของบิล — ใช้ period ก่อน ถ้าไม่มี/เพี้ยน fallback เป็น created_at
function txMonthKey(tx) {
  const m = String(tx?.period ?? '').trim().slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(m)) return m
  const d = tx?.created_at ? new Date(tx.created_at) : null
  if (d && !Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return null
}

// วันครบกำหนดชำระของบิล — ไม่มีคอลัมน์ bill_due_date ใน DB จึงประกอบจากงวด (period)
// + วันที่กำหนดชำระของสัญญา (rentals.due_date เป็นเลขวันที่ 1-31 ของเดือน)
function billDueDate(tx) {
  const rental = Array.isArray(tx?.rentals) ? tx.rentals[0] : tx?.rentals
  const mk = txMonthKey(tx)
  if (!mk) return tx?.created_at ? new Date(tx.created_at) : null
  const [year, month] = mk.split('-').map(Number)
  const day = Number(rental?.due_date)
  if (Number.isFinite(day) && day >= 1 && day <= 31) return new Date(year, month - 1, day)
  const d = rental?.due_date ? new Date(rental.due_date) : null
  if (d && !Number.isNaN(d.getTime())) return d
  return new Date(year, month, 0)
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
    const cls = value === 'vacant' ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800/70' : value === 'maintenance' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/70' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70'
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{map[value] ?? String(value)}</span>
  }
  if (key === 'lease_end_date') {
    const expiring = isExpiringSoon(value)
    return (
      <span className={`inline-flex items-center gap-1 ${expiring ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-gray-600 dark:text-gray-400'}`}>
        {expiring && <Icon name="warning" className="h-3.5 w-3.5" />}
        {formatDate(value)}
      </span>
    )
  }
  if (isStatusColumn(key)) return getStatusBadge(value)
  if (key === 'due_date') {
    const day = Number(value)
    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      return <span className="font-semibold text-indigo-700 dark:text-indigo-300">วันที่ {day}</span>
    }
    return <span className="text-gray-600 dark:text-gray-400">{formatDate(value)}</span>
  }
  if (key === 'cycle') {
    return <span className="text-gray-700 dark:text-gray-300">{CYCLE_LABELS[value] ?? String(value)}</span>
  }
  if (isAmountColumn(key)) return <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(value)}</span>
  if (isDateColumn(key)) return <span className="text-gray-600 dark:text-gray-400">{formatDate(value)}</span>
  if (typeof value === 'boolean') return <span className="text-gray-600 dark:text-gray-400">{value ? '✓' : '✗'}</span>
  return <span className="text-gray-700 dark:text-gray-300">{String(value)}</span>
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
  blue: { card: 'border-blue-100 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', icon: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' },
  green: { card: 'border-green-100 dark:border-green-800/50 bg-green-50 dark:bg-green-950/30', text: 'text-green-600 dark:text-green-400', icon: 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' },
  red: { card: 'border-red-100 dark:border-red-800/50 bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', icon: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' },
  orange: { card: 'border-orange-100 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', icon: 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' },
  yellow: { card: 'border-yellow-200 dark:border-yellow-800/70 bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-300', icon: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' },
}

function StatCard({ icon, label, value, tone = 'blue', onClick }) {
  const t = CARD_TONES[tone] || CARD_TONES.blue
  const inner = (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-semibold ${t.text}`}>{label}</p>
        <p className={`mt-2 text-2xl font-bold tracking-tight ${t.text}`}>{value}</p>
      </div>
      {/* ไอคอนย่อลงที่ 375px เพื่อให้ตัวเลขคง text-2xl ได้ในการ์ด 2 คอลัมน์ */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${t.icon}`}>
        <Icon name={icon} className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
    </div>
  )
  const cls = `w-full rounded-2xl border p-4 text-left shadow-sm transition-shadow hover:shadow-md sm:p-5 ${t.card}`
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  }
  return <div className={cls}>{inner}</div>
}

function MonthlyBreakdownModal({ monthly, onClose }) {
  const rows = Array.isArray(monthly) ? monthly : []
  const total = rows.reduce((sum, m) => sum + (Number(m.paid) || 0), 0)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">รายได้รายเดือน</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">ยอดชำระแล้ว (paid) แยกตามเดือน</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="py-2 font-medium">เดือน</th>
                <th className="py-2 text-right font-medium">รายได้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((m) => (
                <tr key={m.key}>
                  <td className="py-2.5 font-medium text-gray-700 dark:text-gray-300">{m.label}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(m.paid)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-3 font-bold text-gray-900 dark:text-gray-100">รวม</td>
                <td className="py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// /admin เห็นเฉพาะ founder — Sidebar กรองออกให้คนอื่น (ดูที่ membership.plan)
const NAV_ITEMS = [
  { to: '/', label: 'แดชบอร์ด', icon: 'home' },
  { to: '/assets', label: 'รายการสินทรัพย์', icon: 'building' },
  { to: '/settings', label: 'ตั้งค่าบัญชี', icon: 'cog' },
  { to: '/audit', label: 'ประวัติแก้ไข', icon: 'document' },
  { to: '/membership', label: '💎 สมาชิก', icon: 'gem' },
  { to: '/admin', label: '🛡️ ผู้ดูแล', icon: 'shield', founderOnly: true },
]

function OccupancyDonut({ occupied, vacant }) {
  const chart = useChartTheme()
  const data = [
    { name: 'มีผู้เช่า', value: occupied },
    { name: 'ห้องว่าง', value: vacant },
  ]
  const total = occupied + vacant
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">สัดส่วนสินทรัพย์</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">ห้องมีผู้เช่าเทียบกับห้องว่าง</p>
        </div>
        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{total ? Math.round((occupied / total) * 100) : 0}%</span>
      </div>
      <div className="h-40 sm:h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={85} paddingAngle={3}>
              <Cell fill="#3b82f6" />
              <Cell fill={chart.dark ? '#6b7280' : '#9ca3af'} />
            </Pie>
            <Tooltip contentStyle={chart.tooltip} labelStyle={{ color: chart.tooltipLabel, fontWeight: 600 }} itemStyle={{ color: chart.tooltip.color }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: chart.legend }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RevenueBar({ monthly }) {
  const chart = useChartTheme()
  const data = Array.isArray(monthly) && monthly.length ? monthly : []
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">รายรับ 6 เดือน (แยกตามประเภทสินทรัพย์)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">ยอดชำระแล้วแยกตามอสังหา / ยานพาหนะ / อุปกรณ์ (ย้อนหลัง 6 เดือน)</p>
      </div>
      <div className="h-40 sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
            <XAxis dataKey="label" stroke={chart.axisLine} tick={{ fontSize: 12, fill: chart.tick }} />
            <YAxis stroke={chart.axisLine} tick={{ fontSize: 12, fill: chart.tick }} tickFormatter={(v) => `฿${Number(v).toLocaleString('th-TH')}`} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={chart.tooltip} labelStyle={{ color: chart.tooltipLabel, fontWeight: 600 }} itemStyle={{ color: chart.tooltip.color }} cursor={{ fill: chart.cursor }} />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: chart.legend }} />
            <Bar dataKey="property" name="อสังหาริมทรัพย์" stackId="rev" fill="#10b981" />
            <Bar dataKey="vehicle" name="ยานพาหนะ" stackId="rev" fill="#3b82f6" />
            <Bar dataKey="other" name="อุปกรณ์/อื่นๆ" stackId="rev" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// แถบสัญญาใกล้หมดอายุบนแดชบอร์ด — ห้องที่ lease_end_date หมดใน 90 วันข้างหน้า (ไม่นับห้องว่าง)
function LeaseExpiryBand({ rentals, onViewDetails }) {
  const rows = useMemo(() => {
    return (rentals || [])
      .filter((r) => r?.lease_end_date && String(r?.room_status ?? '').toLowerCase() !== 'vacant' && isExpiringSoon(r.lease_end_date, 90))
      .sort((a, b) => new Date(a.lease_end_date) - new Date(b.lease_end_date))
  }, [rentals])

  if (rows.length === 0) return null

  const badgeOf = (days) => {
    if (days <= 30) return { cls: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' }
    if (days <= 60) return { cls: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/70' }
    return { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-orange-100/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 dark:border-orange-800/50 bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-amber-50 dark:to-amber-950/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/40">
            <span className="text-xl leading-none">📅</span>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">สัญญาใกล้หมดอายุ</h2>
            <p className="text-sm text-orange-700 dark:text-orange-300">สัญญาที่จะสิ้นสุดภายใน 90 วันข้างหน้า</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-bold text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-200 dark:ring-orange-800/70">
          {rows.length} สัญญา
        </span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((r) => {
          const days = daysUntil(r.lease_end_date)
          const badge = badgeOf(days ?? 90)
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onViewDetails?.(r)}
                className="flex w-full flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-900/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{displayAssetName(r)}</p>
                  <p className="mt-0.5 truncate text-base text-gray-600 dark:text-gray-400">{r.cust_name || 'ไม่ระบุ'}</p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    สิ้นสุด <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(r.lease_end_date)}</span>
                  </p>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badge.cls}`}>
                    {days <= 0 ? 'หมดสัญญาแล้ว' : `อีก ${days} วัน`}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ค้างชำระแยกตามอายุหนี้ — แท่งแนวนอน 3 ช่วง นับจากวันครบกำหนด (period + due_date) เทียบวันนี้
function AgingBarChart({ buckets }) {
  const chart = useChartTheme()
  const hasData = (buckets || []).some((b) => b.count > 0)
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">ค้างชำระแยกตามอายุหนี้ (Aging)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">บิลยังไม่ชำระที่เลยวันครบกำหนด แยกตามจำนวนวันค้างชำระ</p>
      </div>
      {hasData ? (
        <>
          <div className="h-40 sm:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chart.grid} />
                <XAxis type="number" stroke={chart.axisLine} tick={{ fontSize: 12, fill: chart.tick }} tickFormatter={(v) => `฿${Number(v).toLocaleString('th-TH')}`} />
                <YAxis type="category" dataKey="name" stroke={chart.axisLine} tick={{ fontSize: 12, fill: chart.tick }} width={90} />
                <Tooltip formatter={(v, _name, item) => [`${formatCurrency(v)} · ${item?.payload?.count ?? 0} บิล`, 'ยอดค้างชำระ']} contentStyle={chart.tooltip} labelStyle={{ color: chart.tooltipLabel, fontWeight: 600 }} itemStyle={{ color: chart.tooltip.color }} cursor={{ fill: chart.cursor }} />
                <Bar dataKey="total" name="ยอดค้างชำระ" radius={[0, 6, 6, 0]} barSize={26}>
                  {buckets.map((b) => (
                    <Cell key={b.key} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {buckets.map((b) => (
              <div key={b.key} className="rounded-xl bg-gray-50 dark:bg-gray-950 px-2 py-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{b.name}</p>
                <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">{b.count} บิล</p>
                <p className="text-xs tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(b.total)}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-gray-400">ไม่มีบิลค้างชำระเกินกำหนด</p>
        </div>
      )}
    </div>
  )
}

function UrgentChaseSection({ overdue, sendingId, onSendBill, sendingReminder, onSendReminders }) {
  const rows = useMemo(() => {
    return [...(overdue || [])]
      .sort((a, b) => Number(b.total_amount ?? 0) - Number(a.total_amount ?? 0))
      .slice(0, 10)
  }, [overdue])

  if (rows.length === 0) return null

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-rose-100/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 dark:border-rose-800/50 bg-gradient-to-r from-rose-50 dark:from-rose-950/30 to-orange-50 dark:to-orange-950/30 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/40">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">ต้องทวงด่วน</h2>
            <p className="text-sm text-rose-700 dark:text-rose-300">ค้างชำระเกิน 15 วัน เรียงยอดมากไปน้อย</p>
          </div>
        </div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <button
            type="button"
            onClick={onSendReminders}
            disabled={sendingReminder}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-3 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none lg:py-2.5"
          >
            {sendingReminder ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            ) : (
              <span className="text-base leading-none">⏰</span>
            )}
            เตือนล่วงหน้า
          </button>
          <span className="inline-flex shrink-0 items-center rounded-full bg-rose-100 dark:bg-rose-900/40 px-3 py-1 text-sm font-bold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/70">
            {overdue.length} ห้อง
          </span>
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((item) => {
          const rental = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
          const room = displayAssetName(rental || item)
          const custName = rental?.cust_name || item.cust_name || 'ไม่ระบุ'
          const sending = sendingId === item.id
          return (
            <li key={item.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{room}</p>
                <p className="mt-0.5 truncate text-base text-gray-600 dark:text-gray-400">{custName}</p>
              </div>
              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:gap-5">
                <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400 sm:text-right">{formatCurrency(item.total_amount)}</p>
                <button
                  type="button"
                  onClick={() => onSendBill(item.id)}
                  disabled={sending}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-base font-semibold text-white shadow-sm shadow-green-600/30 transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {sending ? (
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  )}
                  ส่งบิล
                </button>
              </div>
            </li>
          )
        })}
      </ul>
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
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:h-auto lg:w-auto lg:p-2.5"
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
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-3">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">การแจ้งเตือน</p>
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
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"><Icon name="warning" className="h-4 w-4" /></div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">มีบิลใหม่รอตรวจสอบ</p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{custName} · {formatCurrency(txAmount(item))}</p>
                        </div>
                      </div>
                    )
                  })}
                  {expiringLeases.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 border-b border-gray-50 px-4 py-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"><Icon name="warning" className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">สัญญาใกล้หมดอายุ</p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{r.cust_name} · {displayAssetName(r)} · เหลือ {daysUntil(r.lease_end_date)} วัน</p>
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
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ประวัติแก้ไข (Audit Log)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">บันทึกการแก้ไขยอดและเหตุผล</p>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : logs.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติการแก้ไข</div>
      ) : (
        <>
          {/* ตารางที่ 768px ขึ้นไป */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">เลขบิล</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ยอดเก่า</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ยอดใหม่</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">เหตุผล</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">วันที่แก้ไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{log.transaction_id || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{formatCurrency(log.old_amount)}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(log.new_amount)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 dark:text-gray-400">{log.reason || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* การ์ดแนวตั้งที่ 375px */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
            {logs.map((log) => (
              <div key={log.id} className="space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(log.new_amount)}</p>
                  <p className="shrink-0 text-sm text-gray-500 line-through dark:text-gray-400">{formatCurrency(log.old_amount)}</p>
                </div>
                <p className="text-base text-gray-600 dark:text-gray-400">{log.reason || '—'}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span>{formatDate(log.created_at)}</span>
                  <span className="break-all font-mono">บิล {log.transaction_id || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PDPAConsentModal({ onAccept }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900 p-6 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">การยินยอมข้อมูลส่วนบุคคล (PDPA)</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">ระบบจะเก็บข้อมูลชื่อ-ที่อยู่-ยอดเงินของผู้เช่าเพื่อการทวงเงินตามกฎหมาย PDPA</p>
        <button type="button" onClick={onAccept} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 lg:py-2.5 lg:text-sm">
          ยินยอม
        </button>
      </div>
    </div>
  )
}

const MEMBERSHIP_PLANS = {
  trial: { label: 'ทดลองใช้', cls: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800/70' },
  starter: { label: 'Starter', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' },
  founder: { label: 'ผู้ก่อตั้ง', cls: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 ring-violet-200 dark:ring-violet-800/70' },
}

// แพ็กเกจต่ออายุหน้า "สมาชิกของฉัน" — Starter 399฿ 20 ห้อง / Pro 699฿ 50 ห้อง
const MEMBERSHIP_PACKAGES = [
  { type: 'starter', label: 'Starter', monthly: 399, roomLimit: 20 },
  { type: 'pro', label: 'Pro', monthly: 699, roomLimit: 50 },
]

// ราคาตามระยะเวลา (ฐาน Starter บาท) — Pro คูณสัดส่วน 699/399 แล้วปัดเป็นจำนวนเต็ม
const MEMBERSHIP_DURATION_BASE = { 1: 399, 3: 1099, 6: 1990, 12: 3990 }
const MEMBERSHIP_DURATIONS = [1, 3, 6, 12]

function membershipPrice(planType, months) {
  const base = MEMBERSHIP_DURATION_BASE[months] ?? MEMBERSHIP_DURATION_BASE[1] * months
  return planType === 'pro' ? Math.round((base * 699) / 399) : base
}

// badge สถานะคำสั่งซื้อ/ต่ออายุในประวัติการส่งสลิป
const MEMBERSHIP_PAYMENT_STATUS = {
  pending_review: { label: 'รอตรวจสอบ', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-amber-200 dark:ring-amber-800/70', dot: 'bg-amber-500' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70', dot: 'bg-emerald-500' },
  rejected: { label: 'ไม่ผ่านการตรวจสอบ', cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70', dot: 'bg-rose-500' },
}

function MembershipBadge({ membership }) {
  if (!membership?.ok) return null
  const expired = String(membership.status ?? '').toLowerCase() === 'expired'
  const plan = String(membership.plan ?? '').toLowerCase()
  const meta = MEMBERSHIP_PLANS[plan] || { label: plan || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
  const daysLeft = Number(membership.days_left)
  const hasExpiry = !expired && Boolean(membership.expire_date) && Number.isFinite(daysLeft)
  // ใกล้หมดอายุ (<= 3 วัน) หรือหมดอายุแล้ว → เปลี่ยนเป็นสีแดงทั้ง badge
  const urgent = hasExpiry && daysLeft <= 3
  return (
    <span className={`mb-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
      expired || urgent ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' : meta.cls
    }`}>
      {expired ? 'หมดอายุ' : meta.label}
      {hasExpiry && <span>· เหลือ {daysLeft} วัน</span>}
    </span>
  )
}

function Sidebar({ businessName, membership }) {
  const isFounder = String(membership?.plan ?? '').toLowerCase() === 'founder'
  const navItems = isFounder ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.founderOnly)
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 lg:flex">
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <MembershipBadge membership={membership} />
          <p className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">{businessName || 'PayRentPro'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">ระบบจัดการค่าเช่า</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700 dark:hover:text-rose-300"
        >
          <Icon name="warning" className="h-5 w-5" />
          ออกจากระบบ
        </button>
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-950 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
            ก
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">ผู้ดูแลระบบ</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">admin@payrentpro.com</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold tracking-wide text-indigo-500 dark:text-indigo-400">PayRentPro v2.0 · build 2026-08-29</p>
      </div>
    </aside>
  )
}

// แถบนำทางล่างสำหรับมือถือ/แท็บเล็ต — สูง 56px (h-14) ซ่อนที่ lg ขึ้นไปเพราะมี Sidebar แล้ว
// founder ได้ปุ่มที่ 5 (ผู้ดูแล) — คนอื่นเห็น 4 ปุ่ม
const BOTTOM_NAV_ITEMS = [
  { to: '/', label: 'หน้าแรก', icon: 'home' },
  { to: '/assets', label: 'สินทรัพย์', icon: 'building' },
  { to: '/membership', label: 'สมาชิก', icon: 'gem' },
  { to: '/settings', label: 'ตั้งค่า', icon: 'cog' },
  { to: '/admin', label: 'ผู้ดูแล', icon: 'shield', founderOnly: true },
]

function BottomNav({ membership }) {
  const isFounder = String(membership?.plan ?? '').toLowerCase() === 'founder'
  const items = isFounder ? BOTTOM_NAV_ITEMS : BOTTOM_NAV_ITEMS.filter((item) => !item.founderOnly)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="เมนูหลัก"
    >
      <div className="flex h-14 items-stretch">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800'
              }`
            }
          >
            <Icon name={item.icon} className="h-5 w-5" />
            <span className="max-w-full truncate leading-none">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// เมนู ⋯ ของ header มือถือ/แท็บเล็ต — รวบปุ่มรองที่เคยเรียงยาวจนล้นจอไว้ที่นี่
// (Export CSV / รีเฟรช / ตัวอักษรขยาย / ธีม / ประวัติแก้ไข / ออกจากระบบ)
function HeaderOverflowMenu({ onExportCsv, onRefresh, loading, lastUpdated, largeText, onToggleLargeText, theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)
  const itemClass =
    'flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800'
  const close = () => setOpen(false)
  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        aria-label="เมนูเพิ่มเติม"
        aria-expanded={open}
      >
        <span aria-hidden="true" className="text-xl font-bold leading-none">⋯</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden="true" />
          <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
            {onExportCsv && (
              <button type="button" onClick={() => { close(); onExportCsv() }} className={itemClass}>
                <span aria-hidden="true">⬇️</span> Export CSV
              </button>
            )}
            <button type="button" onClick={() => { close(); onRefresh() }} disabled={loading} className={`${itemClass} disabled:opacity-60`}>
              <Icon name="refresh" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรชข้อมูล
            </button>
            <button type="button" onClick={onToggleLargeText} aria-pressed={largeText} className={itemClass}>
              <span aria-hidden="true" className="text-base font-extrabold leading-none">
                A<span className="align-super text-[0.6em]">+</span>
              </span>
              {largeText ? 'ปิดตัวอักษรขยาย' : 'เปิดตัวอักษรขยาย'}
            </button>
            <button type="button" onClick={onToggleTheme} className={itemClass}>
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
            </button>
            <NavLink to="/audit" onClick={close} className={itemClass}>
              <Icon name="document" className="h-5 w-5" />
              ประวัติแก้ไข
            </NavLink>
            <button
              type="button"
              onClick={() => { close(); supabase.auth.signOut() }}
              className="flex w-full items-center gap-3 border-t border-gray-100 dark:border-gray-800 px-4 py-3 text-left text-sm font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:bg-rose-50 dark:hover:bg-rose-900/30"
            >
              <Icon name="warning" className="h-5 w-5" />
              ออกจากระบบ
            </button>
            {lastUpdated && (
              <p className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-2.5 text-xs text-gray-400">
                อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  )
}

const MENU_WIDTH = 208 // w-52 = 13rem

function RowActionsMenu({ onViewDetails, onBillRequest, onRenew, onMoveOut, onDelete, fullWidth = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const items = [
    { label: 'ดูรายละเอียด', icon: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z', className: 'text-gray-700 dark:text-gray-300', onClick: onViewDetails },
    { label: 'สร้างบิล', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0v2.25m-3.75 6h7.5m-7.5 3H12', className: 'text-gray-700 dark:text-gray-300', onClick: onBillRequest },
    { label: 'ต่อสัญญา', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99', className: 'text-gray-700 dark:text-gray-300', onClick: onRenew },
    { label: 'ย้ายออก', icon: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9', className: 'text-amber-600 dark:text-amber-400', onClick: onMoveOut },
    { label: 'ลบข้อมูล', icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0', className: 'text-rose-600 dark:text-rose-400', onClick: onDelete },
  ]

  const toggleMenu = () => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) {
      setOpen(true)
      return
    }
    // ปุ่มเต็มความกว้าง (การ์ดมือถือ): เมนูกว้างเท่าปุ่มและชิดขอบซ้ายของปุ่ม
    if (fullWidth) {
      setPos({ left: Math.round(rect.left), top: Math.round(rect.bottom + 4), width: Math.round(rect.width) })
      setOpen(true)
      return
    }
    // เปิดทางซ้ายของปุ่ม (ปุ่มอยู่ขวาสุดของแถว) และไม่ให้ล้นขอบขวา/ซ้ายของจอ
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    setPos({ left: Math.round(left), top: Math.round(rect.bottom + 4) })
    setOpen(true)
  }

  // วัดความสูงจริงของเมนูหลัง render แล้ว flip ขึ้นถ้าใกล้ขอบล่างของจอ
  // (ResizeObserver ช่วยวัดซ้ำเมื่อขนาดเมนูเปลี่ยน เช่น font/style โหลดช้า)
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !buttonRef.current) return
    const menu = menuRef.current
    const update = () => {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuH = menu.offsetHeight
      const spaceBelow = window.innerHeight - 8 - rect.bottom
      if (menuH > spaceBelow) {
        const target = Math.max(8, Math.round(rect.top - 4 - menuH))
        setPos((prev) => (prev.top === target ? prev : { ...prev, top: target }))
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(menu)
    return () => observer.disconnect()
  }, [open])

  // เมนูเป็น fixed ไม่เลื่อนตามตาราง จึงปิดให้เมื่อผู้ใช้เลื่อนหน้าจอ
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="เมนูจัดการ"
        aria-expanded={open}
        className={
          fullWidth
            ? `inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 px-4 py-3 text-base font-semibold transition-colors ${
                open
                  ? 'relative z-[70] bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`
            : open
              ? 'relative z-[70] flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 lg:h-auto lg:w-auto lg:p-2'
              : 'flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 lg:h-auto lg:w-auto lg:p-2'
        }
      >
        {fullWidth && <span>จัดการ</span>}
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={menuRef}
            style={{ left: pos.left, top: pos.top, width: pos.width }}
            className={`fixed z-[61] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1.5 shadow-xl ${pos.width ? '' : 'w-52'}`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => { setOpen(false); item.onClick() }}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left text-base font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${item.className}`}
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

function AssetStatusBadge({ status }) {
  const key = String(status ?? '').toLowerCase()
  if (key === 'occupied') {
    return <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-300 dark:ring-green-800/70">มีผู้เช่า</span>
  }
  if (key === 'vacant') {
    return <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm font-semibold text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-700">ว่าง</span>
  }
  const label = key === 'maintenance' ? 'ซ่อมบำรุง' : (String(status) || 'อื่นๆ')
  return <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-300 dark:ring-amber-800/70">{label}</span>
}

// คอลัมน์แรกของตารางสินทรัพย์: ถ้ามี sub_label แสดง 2 บรรทัด (sub_label ตัวเล็กสีเทา / item_details ตัวหนา) ไม่มีก็บรรทัดเดียวตามเดิม
function FirstColumnCell({ row, fallback = 'ไม่ระบุ', bold = false }) {
  const sub = String(row?.sub_label ?? '').trim()
  const item = String(row?.item_details ?? '').trim() || fallback
  const mainCls = `block truncate leading-5 ${bold ? 'text-base font-bold text-gray-900 dark:text-gray-100' : ''}`
  return (
    <div className="flex items-start gap-1.5">
      <span className="shrink-0 leading-5">{bizTypeMeta(row?.biz_type).icon}</span>
      {sub ? (
        <span className="min-w-0">
          <span className="block truncate text-xs font-normal leading-4 text-gray-500 dark:text-gray-400">{sub}</span>
          <span className={mainCls}>{item}</span>
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className={mainCls}>{item}</span>
        </span>
      )}
    </div>
  )
}

function AssetsView({ rentals, loading, error, search, onRetry, onBillRequest, onViewDetails, onRenew, onMoveOut, onDelete }) {
  const [bizTab, setBizTab] = useState('all')
  const keyword = (search ?? '').trim().toLowerCase()
  // หัวคอลัมน์แรกเปลี่ยนตามแท็ปที่เลือก
  const itemColumnLabel = { property: 'ห้อง', vehicle: 'ทะเบียน', other: 'รายการ' }[bizTab] || 'ห้อง/รายการ'

  // จำนวนต่อประเภท (นับจากทั้งหมด ไม่ขึ้นกับคำค้นหา)
  const counts = { all: (rentals || []).length, property: 0, vehicle: 0, other: 0 }
  for (const r of rentals || []) counts[normalizeBizType(r?.biz_type)] += 1

  const filtered = (rentals || []).filter((r) => {
    const matchKeyword = !keyword
      || String(r?.cust_name ?? '').toLowerCase().includes(keyword)
      || String(r?.item_details ?? '').toLowerCase().includes(keyword)
      || String(r?.sub_label ?? '').toLowerCase().includes(keyword)
    const matchTab = bizTab === 'all' || normalizeBizType(r?.biz_type) === bizTab
    return matchKeyword && matchTab
  })

  const actions = (row) => (
    <RowActionsMenu
      onViewDetails={() => onViewDetails(row)}
      onBillRequest={() => onBillRequest(row)}
      onRenew={() => onRenew(row)}
      onMoveOut={() => onMoveOut(row)}
      onDelete={() => onDelete(row)}
    />
  )

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ข้อมูลสัญญาเช่า</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">จำนวน {filtered.length} รายการ{keyword ? ` (จากทั้งหมด ${rentals.length})` : ''}</p>
        </div>
      </div>

      {/* แท็ปกรองตามประเภทสินทรัพย์ — เลื่อนแนวนอนได้ที่จอเล็ก ไม่ดันหน้าให้ล้น */}
      <div
        className="flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800 px-4 py-3 sm:px-6 lg:flex-wrap lg:overflow-visible"
        data-allow-overflow
      >
        <button
          type="button"
          onClick={() => setBizTab('all')}
          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-3 text-sm font-semibold transition-colors lg:px-3.5 lg:py-1.5 ${
            bizTab === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          ทั้งหมด {counts.all}
        </button>
        {BIZ_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setBizTab(t.value)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-3 text-sm font-semibold transition-colors lg:px-3.5 lg:py-1.5 ${
              bizTab === t.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.icon} {t.tab} {counts[t.value]}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดข้อมูลได้</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-indigo-500 lg:py-2.5 lg:text-sm"
          >
            <Icon name="refresh" className="h-4 w-4" />
            ลองอีกครั้ง
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
            <Icon name="document" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{keyword ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{keyword ? 'ลองเปลี่ยนคำค้นหา เช่น ชื่อผู้เช่า หรือชื่อห้อง' : 'ยังไม่มีสินทรัพย์ในระบบ'}</p>
        </div>
      ) : (
        <>
          {/* ตารางเดสก์ท็อป */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr className="text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="max-w-[220px] truncate px-6 py-3.5">{itemColumnLabel}</th>
                  <th className="max-w-[180px] truncate px-6 py-3.5">ผู้เช่า</th>
                  <th className="max-w-[160px] truncate px-6 py-3.5">ค่าเช่า</th>
                  <th className="max-w-[160px] truncate px-6 py-3.5">สถานะ</th>
                  <th className="w-28 px-6 py-3.5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {filtered.map((row, index) => (
                  <tr
                    key={row.id ?? index}
                    onClick={() => onViewDetails(row)}
                    className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="max-w-[260px] px-6 py-3.5 text-base font-medium text-gray-900 dark:text-gray-100">
                      <FirstColumnCell row={row} fallback="—" />
                    </td>
                    <td className="max-w-[200px] truncate px-6 py-3.5 text-base text-gray-700 dark:text-gray-300">
                      {row.cust_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      <AssetStatusBadge status={row.room_status} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* การ์ดมือถือ/แท็บเล็ต — 1 คอลัมน์ที่ 375px, 2 คอลัมน์ที่ 768px */}
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:hidden">
            {filtered.map((row, index) => (
              <div key={row.id ?? index} className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div role="button" tabIndex={0} onClick={() => onViewDetails(row)} onKeyDown={(e) => { if (e.key === 'Enter') onViewDetails(row) }} className="flex-1 cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <FirstColumnCell row={row} fallback="ไม่ระบุ" bold />
                    </div>
                    <AssetStatusBadge status={row.room_status} />
                  </div>
                  <p className="mt-1.5 truncate text-base text-gray-600 dark:text-gray-400">
                    ผู้เช่า: <span className="font-medium text-gray-800 dark:text-gray-200">{row.cust_name || '—'}</span>
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatCurrency(row.amount)}
                  </p>
                </div>
                {/* ปุ่มจัดการเต็มความกว้าง — เดิมเป็นไอคอน ⋯ เล็กมุมขวาซึ่งกดยากบนมือถือ */}
                <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <RowActionsMenu
                    fullWidth
                    onViewDetails={() => onViewDetails(row)}
                    onBillRequest={() => onBillRequest(row)}
                    onRenew={() => onRenew(row)}
                    onMoveOut={() => onMoveOut(row)}
                    onDelete={() => onDelete(row)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
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
    <section className="mt-6 overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-orange-100/60">
      <div className="flex items-center justify-between gap-4 border-b border-orange-100 dark:border-orange-800/50 bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-amber-50 dark:to-amber-950/30 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/40">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">สัญญาใกล้หมดอายุ</h2>
            <p className="text-sm text-orange-700 dark:text-orange-300">สัญญาที่จะหมดภายใน 30 วันข้างหน้า</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-xs font-semibold text-orange-800 dark:text-orange-200 ring-1 ring-inset ring-orange-200 dark:ring-orange-800/70">{expiring.length} รายการ</span>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {expiring.map((r) => {
          const days = daysUntil(r.lease_end_date)
          return (
            <div key={r.id} className="flex flex-col rounded-xl border border-orange-200 dark:border-orange-800/70 bg-orange-50/40 dark:bg-orange-950/30 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{r.cust_name}</p>
                  <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">{displayAssetName(r)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/40 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/70">
                  {days <= 0 ? 'หมดสัญญาแล้ว' : `เหลือ ${days} วัน`}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">สิ้นสุดสัญญา <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(r.lease_end_date)}</span></p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => onRenew(r)} className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500">ต่อสัญญา</button>
                <button type="button" onClick={() => onMoveOut(r)} className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">ทำเครื่องหมายว่าย้ายออก</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SettingsPage({ onSaved }) {
  const [form, setForm] = useState({ business_name: '', owner_name: '', address: '', payment_type: 'promptpay', promptpay: '', promptpay_name: '', bank_code: '', bank_account: '' })
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
        const { data, error: e } = await supabase.from('admins').select('payment_type, promptpay_name, promptpay, bank_code, bank_account, business_name, owner_name, address').limit(1).maybeSingle()
        if (e) throw e
        if (!cancelled && data) {
          setForm({ payment_type: data.payment_type || 'promptpay', promptpay: data.promptpay ?? '', promptpay_name: data.promptpay_name ?? '', bank_code: data.bank_code ?? '', bank_account: data.bank_account ?? '', business_name: data.business_name ?? '', owner_name: data.owner_name ?? '', address: data.address ?? '' })
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
      const payload = { business_name: form.business_name.trim(), owner_name: form.owner_name.trim(), address: form.address.trim(), payment_type: form.payment_type, promptpay: form.promptpay.trim(), promptpay_name: form.promptpay_name.trim(), bank_code: isBank ? form.bank_code : '', bank_account: isBank ? form.bank_account.trim() : '' }
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตั้งค่าบัญชีรับเงิน</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">กำหนดช่องทางที่ผู้เช่าใช้โอนเงินให้คุณ</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {error && <div className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">บันทึกการตั้งค่าสำเร็จ</div>}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">กำลังโหลดข้อมูล...</p>
          ) : (
            <>
              <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60 p-4">
                <p className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">โปรไฟล์ธุรกิจ</p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อธุรกิจ</label>
                    <input type="text" value={form.business_name} onChange={updateField('business_name')} placeholder="เช่น หอพักบ้านสวย" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อเจ้าของ</label>
                    <input type="text" value={form.owner_name} onChange={updateField('owner_name')} placeholder="เช่น สมชาย ใจดี" className={inputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ที่อยู่</label>
                    <textarea value={form.address} onChange={updateField('address')} rows={2} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด" className={inputClass} />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ประเภทการรับเงิน</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setField('payment_type', 'promptpay')} className={`rounded-xl border-2 px-4 py-3 text-left ${!isBank ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">พร้อมเพย์ (PromptPay)</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">เบอร์โทร / เลขบัตรประชาชน</span>
                  </button>
                  <button type="button" onClick={() => setField('payment_type', 'bank')} className={`rounded-xl border-2 px-4 py-3 text-left ${isBank ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">บัญชีธนาคาร</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">โอนผ่านเลขบัญชี</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อบัญชี <span className="text-rose-500 dark:text-rose-400">*</span></label>
                <input type="text" value={form.promptpay_name} onChange={updateField('promptpay_name')} placeholder="เช่น สมชาย ใจดี" required className={inputClass} />
              </div>

              {isBank ? (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ธนาคาร <span className="text-rose-500 dark:text-rose-400">*</span></label>
                    <select value={form.bank_code} onChange={updateField('bank_code')} required className={inputClass}>
                      <option value="" disabled>เลือกธนาคาร</option>
                      {BANKS.map((b) => <option key={b.code} value={b.code}>ธนาคาร{b.name} ({b.short})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขบัญชีธนาคาร <span className="text-rose-500 dark:text-rose-400">*</span></label>
                    <input type="text" inputMode="numeric" value={form.bank_account} onChange={updateField('bank_account')} placeholder="เช่น 1234567890" required className={inputClass} />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขพร้อมเพย์ <span className="text-rose-500 dark:text-rose-400">*</span></label>
                  <input type="text" inputMode="numeric" value={form.promptpay} onChange={updateField('promptpay')} placeholder="เช่น 0812345678" required className={inputClass} />
                </div>
              )}

              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:opacity-60 lg:w-auto lg:py-2.5 lg:text-sm">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

// ============================================================
// หน้า "สมาชิกของฉัน" (/membership)
// - การ์ดสถานะปัจจุบัน (แพ็ก / วันหมดอายุ / ห้องที่ใช้)
// - เลือกแพ็กเกจ Starter/Pro + ระยะเวลา 1/3/6/12 เดือน แล้วสั่งซื้อ
// - modal สั่งซื้อ: QR พร้อมเพย์เจ้าของระบบ (RPC get_system_promptpay)
//   + อัปโหลดสลิป → membership_payments (status pending_review)
// - ประวัติการส่งสลิปของตัวเอง
// ============================================================

// modal สั่งซื้อ: QR พร้อมเพย์ (เบอร์เจ้าของระบบ) + แนบรูปสลิปให้ทีมงานตรวจ
function MembershipOrderModal({ open, plan, months, amount, systemPromptpay, onClose, onToast, onSubmitted }) {
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrFailed, setQrFailed] = useState(false)
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // สร้าง QR ในเครื่องจากเบอร์พร้อมเพย์เจ้าของระบบ + ยอดของแพ็ก/ระยะเวลาที่เลือก
  useEffect(() => {
    if (!open || !systemPromptpay) return undefined
    let active = true
    createPromptpayQR(systemPromptpay, amount)
      .then((dataUrl) => {
        if (!active) return
        setQrDataUrl(dataUrl)
        setQrFailed(false)
      })
      .catch(() => {
        if (!active) return
        setQrDataUrl(null)
        setQrFailed(true)
      })
    return () => { active = false }
  }, [open, systemPromptpay, amount])

  // กด Escape ปิด (เฉพาะตอนที่ไม่ได้กำลังส่งสลิป)
  useEffect(() => {
    if (!open) return undefined
    const handleKey = (e) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, submitting, onClose])

  // ปิด modal → ล้างไฟล์สลิปที่เลือกไว้
  const resetSlip = () => {
    setSlipFile(null)
    setSlipPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  const handleClose = () => {
    if (submitting) return
    resetSlip()
    onClose()
  }

  const handlePickFile = (e) => {
    const file = e.target.files?.[0] || null
    setSlipPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setSlipFile(file)
    if (file) setSlipPreview(URL.createObjectURL(file))
  }

  const handleSubmitSlip = async () => {
    if (!slipFile || submitting) return
    setSubmitting(true)
    try {
      // หา admin_id ของตัวเอง (แถวเดียวกับที่หน้าตั้งค่าใช้)
      const { data: adminRow, error: adminError } = await supabase.from('admins').select('id').limit(1).maybeSingle()
      if (adminError) throw adminError
      if (!adminRow?.id) throw new Error('ไม่พบข้อมูลบัญชีแอดมินของคุณ')

      // 1) บันทึกคำสั่งซื้อเป็นรอตรวจสอบ
      const { data: payment, error: insertError } = await supabase
        .from('membership_payments')
        .insert([{ admin_id: adminRow.id, plan_type: plan.type, duration_months: months, amount, status: 'pending_review' }])
        .select()
        .single()
      if (insertError) throw insertError

      // 2) อัปโหลดรูปสลิปลง bucket receipts → membership/{id}.jpg แล้วเก็บ URL ในแถว
      const path = `membership/${payment.id}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, slipFile, { contentType: slipFile.type || 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage.from('receipts').getPublicUrl(path)
      const { error: updateError } = await supabase
        .from('membership_payments')
        .update({ slip_image_url: publicData?.publicUrl || null })
        .eq('id', payment.id)
      if (updateError) throw updateError

      onToast?.({ type: 'success', message: 'ส่งสลิปเรียบร้อย — รอตรวจสอบ' })
      onSubmitted?.()
      resetSlip()
      onClose()
    } catch (err) {
      console.error('Submit membership slip failed:', err)
      onToast?.({ type: 'error', message: err?.message || 'ส่งสลิปไม่สำเร็จ' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900 p-6 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">สั่งซื้อแพ็กเกจ</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{plan.label} · {months} เดือน</p>
          </div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-indigo-600 dark:text-indigo-400">{formatCurrency(amount)}</p>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-4 text-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR พร้อมเพย์" className="mx-auto h-56 w-56 rounded-lg bg-white dark:bg-gray-900 p-2 shadow-sm" />
          ) : qrFailed || !systemPromptpay ? (
            <div className="flex h-56 flex-col items-center justify-center gap-2 px-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              <Icon name="warning" className="h-8 w-8 text-amber-500 dark:text-amber-400" />
              สร้าง QR ไม่สำเร็จ — ชำระด้วยเบอร์พร้อมเพย์ <span className="font-bold text-gray-700 dark:text-gray-300">{systemPromptpay || '—'}</span>
            </div>
          ) : (
            <div className="mx-auto h-56 w-56 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
          )}
          <p className="mt-2 text-xs text-gray-400">พร้อมเพย์เจ้าของระบบ: {systemPromptpay || '—'}</p>
        </div>

        <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-400">
          ชำระแล้วส่งสลิปใน LINE ของเรา หรืออัปโหลดที่นี่
        </p>

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-800/60 px-4 py-5 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/30">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickFile}
            disabled={submitting}
          />
          {slipPreview ? (
            <img src={slipPreview} alt="ตัวอย่างสลิป" className="max-h-36 rounded-lg object-contain shadow-sm" />
          ) : (
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">📎 แนบรูปสลิปการโอนเงิน (แตะเพื่อเลือกไฟล์)</span>
          )}
          {slipFile && <span className="text-xs text-gray-400">{slipFile.name}</span>}
        </label>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1 lg:py-2.5 lg:text-sm"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmitSlip}
            disabled={!slipFile || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1 lg:py-2.5 lg:text-sm"
          >
            {submitting ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
              </svg>
            ) : null}
            {submitting ? 'กำลังส่ง...' : 'ส่งสลิป'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MembershipPage({ membership, onToast, onRefreshMembership }) {
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [selectedMonths, setSelectedMonths] = useState(1)
  const [systemPromptpay, setSystemPromptpay] = useState(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [previewSlip, setPreviewSlip] = useState(null)

  const expired = String(membership?.status ?? '').toLowerCase() === 'expired'
  const planKey = String(membership?.plan ?? '').toLowerCase()
  const planMeta = MEMBERSHIP_PLANS[planKey] || { label: planKey || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
  const daysLeft = Number(membership?.days_left)
  const hasExpiry = Boolean(membership?.expire_date) && Number.isFinite(daysLeft)
  const roomsUsed = Number(membership?.rooms_used) || 0
  const roomLimit = Number(membership?.room_limit) || 0
  const roomPercent = roomLimit > 0 ? Math.min(100, Math.round((roomsUsed / roomLimit) * 100)) : 0
  const selectedPkg = MEMBERSHIP_PACKAGES.find((p) => p.type === selectedPlan) || MEMBERSHIP_PACKAGES[0]
  const price = membershipPrice(selectedPlan, selectedMonths)

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const { data, error } = await supabase
        .from('membership_payments')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      setHistoryError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // เบอร์พร้อมเพย์เจ้าของระบบ (แถว founder) สำหรับสร้าง QR รับค่าต่ออายุ
  useEffect(() => {
    let active = true
    supabase.rpc('get_system_promptpay')
      .then(({ data, error }) => {
        if (!active) return
        if (error) throw error
        setSystemPromptpay(String(data ?? '').replace(/[^0-9]/g, ''))
      })
      .catch((err) => {
        if (active) console.error('get_system_promptpay error:', err)
      })
    return () => { active = false }
  }, [])

  const pendingCount = history.filter((row) => String(row.status ?? '').toLowerCase() === 'pending_review').length

  const handleSubmitted = () => {
    fetchHistory()
    onRefreshMembership?.()
  }

  return (
    <div>
      {/* สถานะสมาชิกปัจจุบัน */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">สถานะสมาชิก</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">แพ็กเกจและการใช้งานปัจจุบันของคุณ</p>
          </div>
          <MembershipBadge membership={membership} />
        </div>

        {expired && (
          <div className="flex items-center gap-2.5 border-b border-rose-100 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-6 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <Icon name="warning" className="h-5 w-5 shrink-0" />
            หมดอายุ — ต่ออายุเพื่อใช้งานต่อ
          </div>
        )}

        <div className="grid gap-6 px-6 py-6 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">แพ็กเกจ</p>
            <p className="mt-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">{planMeta.label}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">วันหมดอายุ</p>
            <p className="mt-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">
              {membership?.expire_date ? formatDate(membership.expire_date) : 'ไม่มีวันหมดอายุ'}
            </p>
            {!expired && hasExpiry && (
              <p className={`mt-0.5 text-sm font-medium ${daysLeft <= 3 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}`}>เหลืออีก {daysLeft} วัน</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">การใช้งาน</p>
            <p className="mt-1.5 text-lg font-bold text-gray-900 dark:text-gray-100">
              {roomsUsed}/{roomLimit > 0 ? roomLimit : '∞'} ห้อง
            </p>
            {roomLimit > 0 && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full ${roomPercent >= 100 ? 'bg-rose-500' : roomPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${roomPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ส่งสลิปแล้วรอทีมงานตรวจ */}
      {pendingCount > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-6 py-4 text-sm font-medium text-amber-800 dark:text-amber-200">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
          รอตรวจสอบ — ได้รับสลิปของคุณแล้ว {pendingCount} รายการ ทีมงานจะต่ออายุให้หลังตรวจสอบสลิป
        </div>
      )}

      {/* เลือกแพ็กเกจ + ระยะเวลา */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">เลือกแพ็กเกจ</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">ต่ออายุหรืออัปเกรด — เลือกแพ็กและระยะเวลา แล้วกดสั่งซื้อ</p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {MEMBERSHIP_PACKAGES.map((pkg) => {
            const selected = selectedPlan === pkg.type
            const isCurrent = planKey === pkg.type
            return (
              <button
                type="button"
                key={pkg.type}
                onClick={() => setSelectedPlan(pkg.type)}
                className={`rounded-2xl border-2 p-5 text-left transition-colors ${
                  selected ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-sm shadow-indigo-100' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100">{pkg.label}</p>
                  {isCurrent && (
                    <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">แพ็กปัจจุบัน</span>
                  )}
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">
                  ฿{pkg.monthly.toLocaleString('th-TH')}
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">/เดือน</span>
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">จำนวนห้องสูงสุด {pkg.roomLimit} ห้อง</p>
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-5">
          <p className="mb-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300">ระยะเวลา</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MEMBERSHIP_DURATIONS.map((m) => {
              const active = selectedMonths === m
              return (
                <button
                  type="button"
                  key={m}
                  onClick={() => setSelectedMonths(m)}
                  className={`rounded-xl border-2 px-3 py-2.5 text-center transition-colors ${
                    active ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-indigo-200'
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>{m} เดือน</p>
                  <p className={`mt-0.5 text-sm font-bold tabular-nums ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {formatCurrency(membershipPrice(selectedPlan, m))}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                ยอดรวม {selectedPkg.label} · {selectedMonths} เดือน
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">{formatCurrency(price)}</p>
            </div>
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
            >
              สั่งซื้อ
            </button>
          </div>
        </div>
      </section>

      {/* ประวัติการส่งสลิป (แถวของตัวเอง — RLS กรองให้) */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">ประวัติการต่ออายุ</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">คำสั่งซื้อและสถานะการตรวจสอบสลิปของคุณ</p>
          </div>
        </div>

        {historyLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : historyError ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <Icon name="warning" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดประวัติได้</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{historyError}</p>
            <button
              type="button"
              onClick={fetchHistory}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 lg:py-2.5 lg:text-sm"
            >
              <Icon name="refresh" className="h-4 w-4" />
              ลองอีกครั้ง
            </button>
          </div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
              <Icon name="document" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ยังไม่มีประวัติการต่ออายุ</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">เลือกแพ็กเกจด้านบนแล้วส่งสลิปเพื่อต่ออายุครั้งแรก</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">วันที่ส่ง</th>
                  <th className="px-6 py-3">แพ็กเกจ</th>
                  <th className="px-6 py-3">ระยะเวลา</th>
                  <th className="px-6 py-3">ยอด</th>
                  <th className="px-6 py-3">สถานะ</th>
                  <th className="px-6 py-3">สลิป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((row) => {
                  const statusKey = String(row.status ?? '').toLowerCase()
                  const statusMeta = MEMBERSHIP_PAYMENT_STATUS[statusKey] || { label: row.status || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700', dot: 'bg-gray-400' }
                  const pkgMeta = MEMBERSHIP_PACKAGES.find((p) => p.type === row.plan_type)
                  return (
                    <tr key={row.id} className="bg-white dark:bg-gray-900">
                      <td className="whitespace-nowrap px-6 py-3.5 text-gray-600 dark:text-gray-400">{formatDate(row.created_at)}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-semibold text-gray-900 dark:text-gray-100">{pkgMeta?.label || row.plan_type || '—'}</td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-gray-600 dark:text-gray-400">{row.duration_months} เดือน</td>
                      <td className="whitespace-nowrap px-6 py-3.5 font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(row.amount)}</td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusMeta.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        {row.slip_image_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewSlip(row.slip_image_url)}
                            className="block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:border-indigo-300"
                            aria-label="ดูสลิปเต็มจอ"
                          >
                            <img src={row.slip_image_url} alt="สลิปโอนเงิน" className="h-10 w-10 object-cover" loading="lazy" />
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* การ์ดแนวตั้งที่ 375px */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
            {history.map((row) => {
              const statusKey = String(row.status ?? '').toLowerCase()
              const statusMeta = MEMBERSHIP_PAYMENT_STATUS[statusKey] || { label: row.status || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700', dot: 'bg-gray-400' }
              const pkgMeta = MEMBERSHIP_PACKAGES.find((p) => p.type === row.plan_type)
              return (
                <div key={row.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {pkgMeta?.label || row.plan_type || '—'} · {row.duration_months} เดือน
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(row.amount)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusMeta.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
                        {statusMeta.label}
                      </span>
                      <span className="text-xs text-gray-400">ส่งเมื่อ {formatDate(row.created_at)}</span>
                    </div>
                  </div>
                  {row.slip_image_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewSlip(row.slip_image_url)}
                      className="shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:border-indigo-300"
                      aria-label="ดูสลิปเต็มจอ"
                    >
                      <img src={row.slip_image_url} alt="สลิปโอนเงิน" className="h-14 w-14 object-cover" loading="lazy" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
          </>
        )}
      </section>

      <MembershipOrderModal
        open={orderOpen}
        plan={selectedPkg}
        months={selectedMonths}
        amount={price}
        systemPromptpay={systemPromptpay}
        onClose={() => setOrderOpen(false)}
        onToast={onToast}
        onSubmitted={handleSubmitted}
      />

      {previewSlip && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/80 p-4"
          onClick={() => setPreviewSlip(null)}
        >
          <img src={previewSlip} alt="สลิปโอนเงิน" className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  )
}

// ============================================================
// หลังบ้านผู้ดูแลระบบ (/admin — เข้าได้เฉพาะ founder)
// - กล่อง "ค่าสมาชิกรอตรวจ": อนุมัติ (RPC approve_membership_payment
//   ต่ออายุ+ตั้ง plan/room_limit อัตโนมัติ) / ปฏิเสธ (update status)
// - ตารางสมาชิกทั้งหมด เรียงวันหมดอายุที่ใกล้สุดบนสุด แถวหมดอายุสีแดง
// ============================================================

// RPC หลังบ้าน raise 'forbidden' เมื่อผู้ login ไม่ใช่ founder
function adminBackofficeError(err) {
  if (/forbidden/i.test(err?.message || '')) return 'สำหรับผู้ก่อตั้งระบบเท่านั้น'
  return err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล'
}

function AdminPage({ onToast }) {
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState(null)
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [previewSlip, setPreviewSlip] = useState(null)

  // คืนแถวที่โหลดได้เพื่อใช้ต่อ (หาวันหมดอายุใหม่หลังอนุมัติ)
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError(null)
    try {
      const { data, error } = await supabase.rpc('get_all_members')
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setMembers(rows)
      return rows
    } catch (err) {
      setMembersError(adminBackofficeError(err))
      return []
    } finally {
      setMembersLoading(false)
    }
  }, [])

  const fetchPending = useCallback(async () => {
    setPendingLoading(true)
    setPendingError(null)
    try {
      const { data, error } = await supabase.rpc('get_pending_membership_payments')
      if (error) throw error
      setPending(Array.isArray(data) ? data : [])
    } catch (err) {
      setPendingError(adminBackofficeError(err))
    } finally {
      setPendingLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchPending()
  }, [fetchMembers, fetchPending])

  // เรียงวันหมดอายุ: หมดเร็วสุดบนสุด, ไม่มีวันหมดอายุ (null) ไปอยู่ล่างสุด
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const da = a?.expire_date ? new Date(a.expire_date).getTime() : null
      const db = b?.expire_date ? new Date(b.expire_date).getTime() : null
      if (da === null && db === null) return 0
      if (da === null) return 1
      if (db === null) return -1
      return da - db
    })
  }, [members])

  // อนุมัติ: RPC ฝั่ง DB ต่ออายุ + ตั้ง plan/room_limit ให้เอง
  const handleApprove = async (item) => {
    if (!item?.id) return
    setReviewing({ id: item.id, action: 'approve' })
    try {
      const { data, error } = await supabase.rpc('approve_membership_payment', { p_id: item.id })
      if (error) throw error
      if (data?.ok === false && data?.error === 'already_processed') {
        onToast?.({ type: 'warning', message: 'ดำเนินการรายการนี้ไปแล้ว' })
        await Promise.all([fetchMembers(), fetchPending()])
        return
      }
      if (data?.ok === false) throw new Error(data?.error || 'approve_membership_payment failed')

      // หาวันหมดอายุใหม่ (จากค่าที่ RPC คืน หรือจากตารางสมาชิกที่รีเฟรชแล้ว)
      const rows = await fetchMembers()
      await fetchPending()
      const member = rows.find((r) => String(r.email ?? '') === String(item.email ?? ''))
      const newExpire = data?.expire_date || member?.expire_date
      onToast?.({
        type: 'success',
        message: `อนุมัติ + ต่ออายุแล้ว (${item.email || 'ไม่ทราบอีเมล'}${newExpire ? ` ถึงวันที่ ${formatDate(newExpire)}` : ''})`,
      })
    } catch (err) {
      console.error('Approve membership payment failed:', err)
      if (/already_processed/i.test(err?.message || '')) {
        onToast?.({ type: 'warning', message: 'ดำเนินการรายการนี้ไปแล้ว' })
        fetchPending()
      } else {
        onToast?.({ type: 'error', message: err?.message || 'อนุมัติไม่สำเร็จ' })
      }
    } finally {
      setReviewing(null)
    }
  }

  // ปฏิเสธ:  mark แถวเป็น rejected ฝั่งเว็บ (policy founder_update อนุญาต)
  const handleReject = async (item) => {
    if (!item?.id) return
    setReviewing({ id: item.id, action: 'reject' })
    try {
      const { error } = await supabase
        .from('membership_payments')
        .update({ status: 'rejected' })
        .eq('id', item.id)
      if (error) throw error
      onToast?.({ type: 'success', message: 'ปฏิเสธรายการแล้ว' })
      await fetchPending()
    } catch (err) {
      console.error('Reject membership payment failed:', err)
      onToast?.({ type: 'error', message: err?.message || 'ปฏิเสธไม่สำเร็จ' })
    } finally {
      setReviewing(null)
    }
  }

  const refreshing = membersLoading || pendingLoading

  return (
    <div>
      {/* ปุ่มรีเฟรชหน้า */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">ภาพรวมสมาชิกและค่าสมาชิกรอตรวจทั้งหมดในระบบ</p>
        <button
          type="button"
          onClick={() => { fetchMembers(); fetchPending() }}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 lg:py-2.5 lg:text-sm"
        >
          <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          รีเฟรชข้อมูล
        </button>
      </div>

      {/* ค่าสมาชิกรอตรวจ */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-amber-100/70">
        <div className="flex items-center justify-between gap-4 border-b border-amber-100 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-yellow-50 dark:to-yellow-950/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-white shadow-lg shadow-amber-400/40">
              <Icon name="banknotes" className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">ค่าสมาชิกรอตรวจ</h2>
              <p className="text-sm text-amber-700 dark:text-amber-300">สมาชิกส่งสลิปค่าต่ออายุแล้ว โปรดตรวจสอบก่อนกดอนุมัติ</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/70">
            {pendingLoading ? 'กำลังโหลด...' : `${pending.length} รายการ`}
          </span>
        </div>

        {pendingLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-amber-50 dark:bg-amber-950/30" />
            ))}
          </div>
        ) : pendingError ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <Icon name="warning" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดรายการได้</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{pendingError}</p>
            <button
              type="button"
              onClick={fetchPending}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-amber-400 lg:py-2.5 lg:text-sm"
            >
              <Icon name="refresh" className="h-4 w-4" />
              ลองอีกครั้ง
            </button>
          </div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-500 dark:text-amber-400">
              <Icon name="check" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่มีค่าสมาชิกรอตรวจ</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีสมาชิกส่งสลิปค่าต่ออายุในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {pending.map((item) => {
              const isUpdating = reviewing?.id === item.id
              const isApproving = isUpdating && reviewing?.action === 'approve'
              const isRejecting = isUpdating && reviewing?.action === 'reject'
              const pkgMeta = MEMBERSHIP_PACKAGES.find((p) => p.type === item.plan_type)
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-gray-900 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{item.email || 'ไม่ทราบอีเมล'}</p>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                        {pkgMeta?.label || item.plan_type || '—'} · {item.duration_months} เดือน
                      </p>
                      <p className="mt-1 text-xs text-gray-400">ส่งเมื่อ {formatDate(item.created_at)}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      รอตรวจ
                    </span>
                  </div>

                  <p className="text-2xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(item.amount)}</p>

                  {item.slip_image_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewSlip(item.slip_image_url)}
                      className="group relative block overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/70"
                      aria-label="ดูสลิปเต็มจอ"
                    >
                      <img
                        src={item.slip_image_url}
                        alt="สลิปโอนเงิน"
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gray-900/60 px-3 py-1.5 text-center text-sm font-semibold text-white">
                        แตะเพื่อดูสลิปเต็มจอ
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 text-sm text-amber-600 dark:text-amber-400">
                      ไม่มีรูปสลิปแนบมา
                    </div>
                  )}

                  <div className="mt-auto flex flex-col gap-3 sm:grid sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(item)}
                      disabled={isUpdating}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isApproving ? (
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : null}
                      {isApproving ? 'กำลังอนุมัติ...' : '✅ อนุมัติ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(item)}
                      disabled={isUpdating}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rose-200 dark:border-rose-800/70 bg-white dark:bg-gray-900 px-4 py-3 text-base font-semibold text-rose-600 dark:text-rose-400 transition-colors hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRejecting ? (
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : null}
                      {isRejecting ? 'กำลังบันทึก...' : '❌ ปฏิเสธ'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ตารางสมาชิกทั้งหมด */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">สมาชิกทั้งหมด</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">เรียงตามวันหมดอายุ — หมดเร็วสุดอยู่บนสุด</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
            {membersLoading ? 'กำลังโหลด...' : `${members.length} ราย`}
          </span>
        </div>

        {membersLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : membersError ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
              <Icon name="warning" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดรายชื่อสมาชิกได้</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{membersError}</p>
            <button
              type="button"
              onClick={fetchMembers}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 lg:py-2.5 lg:text-sm"
            >
              <Icon name="refresh" className="h-4 w-4" />
              ลองอีกครั้ง
            </button>
          </div>
        ) : sortedMembers.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
              <Icon name="document" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ยังไม่มีสมาชิกในระบบ</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">สมาชิกจะปรากฏที่นี่เมื่อเริ่มใช้งานแพ็กเกจ</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-950 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-3">อีเมล</th>
                  <th className="px-6 py-3">แพ็กเกจ</th>
                  <th className="px-6 py-3">วันหมดอายุ</th>
                  <th className="px-6 py-3">การใช้งาน</th>
                  <th className="px-6 py-3">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedMembers.map((row) => {
                  const planKey = String(row.plan ?? '').toLowerCase()
                  const planMeta = MEMBERSHIP_PLANS[planKey] || { label: row.plan || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
                  const expired = String(row.status ?? '').toLowerCase() === 'expired'
                  const roomLimit = Number(row.room_limit) || 0
                  const roomsUsed = Number(row.rooms_used) || 0
                  return (
                    <tr key={`${row.email}-${row.created_at ?? ''}`} className={expired ? 'bg-rose-50/60 dark:bg-rose-950/30' : 'bg-white dark:bg-gray-900'}>
                      <td className="max-w-[16rem] truncate px-6 py-3.5 font-semibold text-gray-900 dark:text-gray-100">
                        <span className={expired ? 'text-rose-700 dark:text-rose-300' : undefined}>{row.email || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${planMeta.cls}`}>
                          {planMeta.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-gray-600 dark:text-gray-400">
                        {row.expire_date ? formatDate(row.expire_date) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5 text-gray-600 dark:text-gray-400">
                        {roomsUsed}/{roomLimit > 0 ? roomLimit : '∞'} ห้อง
                      </td>
                      <td className="whitespace-nowrap px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            expired ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${expired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {expired ? 'หมดอายุ' : 'ใช้งานได้'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* การ์ดแนวตั้งที่ 375px */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
            {sortedMembers.map((row) => {
              const planKey = String(row.plan ?? '').toLowerCase()
              const planMeta = MEMBERSHIP_PLANS[planKey] || { label: row.plan || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
              const expired = String(row.status ?? '').toLowerCase() === 'expired'
              const roomLimit = Number(row.room_limit) || 0
              const roomsUsed = Number(row.rooms_used) || 0
              return (
                <div key={`${row.email}-${row.created_at ?? ''}`} className={`space-y-2 p-4 ${expired ? 'bg-rose-50/60 dark:bg-rose-950/30' : ''}`}>
                  <p className={`break-all text-base font-semibold ${expired ? 'text-rose-700 dark:text-rose-300' : 'text-gray-900 dark:text-gray-100'}`}>
                    {row.email || '—'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${planMeta.cls}`}>
                      {planMeta.label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                        expired ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${expired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      {expired ? 'หมดอายุ' : 'ใช้งานได้'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span>หมดอายุ {row.expire_date ? formatDate(row.expire_date) : '—'}</span>
                    <span className="shrink-0 tabular-nums">{roomsUsed}/{roomLimit > 0 ? roomLimit : '∞'} ห้อง</span>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </section>

      {previewSlip && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/80 p-4"
          onClick={() => setPreviewSlip(null)}
        >
          <img src={previewSlip} alt="สลิปโอนเงิน" className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  )
}

function PendingReviewSection({ items, loading, error, reviewing, onApprove, onReject, onRetry }) {
  const [previewSlip, setPreviewSlip] = useState(null)
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-amber-100/70">
      <div className="flex items-center justify-between gap-4 border-b border-amber-100 dark:border-amber-800/50 bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-yellow-50 dark:to-yellow-950/30 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-white shadow-lg shadow-amber-400/40">
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">รอตรวจสอบสลิป</h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">มีผู้เช่าแจ้งชำระเงินแล้ว โปรดตรวจสอบหลักฐานก่อนยืนยัน</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/70">
          {loading ? 'กำลังโหลด...' : `${items.length} รายการ`}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-amber-50 dark:bg-amber-950/30" />
          ))}
        </div>
      ) : error ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดรายการได้</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-amber-400 lg:py-2.5 lg:text-sm"
          >
            <Icon name="refresh" className="h-4 w-4" />
            ลองอีกครั้ง
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-500 dark:text-amber-400">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่มีรายการรอตรวจสอบ</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีผู้เช่าแจ้งชำระเงินในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          {items.map((item) => {
            const rental = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
            const custName = rental?.cust_name || item.cust_name || 'ไม่ระบุ'
            const itemDetails = displayAssetName(rental || item)
            const amount = item.base_amount ?? item.amount
            const isUpdating = reviewing?.id === item.id
            const isApproving = isUpdating && reviewing?.status === 'paid'
            const isRejecting = isUpdating && reviewing?.status === 'unpaid'
            return (
              <div
                key={item.id}
                className="flex flex-col gap-4 rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{itemDetails}</p>
                    <p className="mt-0.5 truncate text-base text-gray-600 dark:text-gray-400">{custName}</p>
                    {item.period ? <p className="mt-1 text-sm text-gray-400">รอบบิล {formatPeriod(item.period)}</p> : null}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/70">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    รอตรวจ
                  </span>
                </div>

                <p className="text-2xl font-bold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(amount)}</p>
                {item.paid_amount > 0 && (
                  <p className="-mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                    ผู้เช่าแจ้งจ่าย {formatCurrency(item.paid_amount)}
                  </p>
                )}

                {item.slip_image_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewSlip(item.slip_image_url)}
                    className="group relative block overflow-hidden rounded-xl border border-amber-200 dark:border-amber-800/70"
                    aria-label="ดูสลิปเต็มจอ"
                  >
                    <img
                      src={item.slip_image_url}
                      alt="สลิปโอนเงิน"
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gray-900/60 px-3 py-1.5 text-center text-sm font-semibold text-white">
                      แตะเพื่อดูสลิปเต็มจอ
                    </span>
                  </button>
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 text-sm text-amber-600 dark:text-amber-400">
                    ไม่มีรูปสลิปแนบมา
                  </div>
                )}

                <div className="mt-auto flex flex-col gap-3 sm:grid sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    disabled={isUpdating}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isApproving ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(item.id)}
                    disabled={isUpdating}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-rose-600/30 transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRejecting ? (
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    )}
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {previewSlip ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewSlip(null)}
        >
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewSlip(null)}
              className="absolute -right-3 -top-3 z-10 rounded-full bg-white dark:bg-gray-900 p-1.5 text-gray-600 dark:text-gray-400 shadow-lg transition-colors hover:text-gray-900 dark:hover:text-gray-100"
              aria-label="ปิด"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewSlip}
              alt="สลิปโอนเงิน"
              className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

// กล่องแจ้งซ่อม — ticket มาจากคำสั่ง "แจ้งซ่อม" ในกลุ่ม LINE ของผู้เช่า
// รายการที่โชว์: เปิดใหม่ (open) + กำลังดำเนินการ (in_progress) — ที่เสร็จแล้วนับในการ์ดสรุปเท่านั้น
const REPAIR_TONES = {
  open: { card: 'border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300' },
  in_progress: { card: 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300' },
  done: { card: 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300' },
}

function RepairSection({ items, loading, error, completingId, onComplete, onRetry }) {
  const [previewPhoto, setPreviewPhoto] = useState(null)

  const counts = {
    open: items.filter((t) => t.status === 'open').length,
    in_progress: items.filter((t) => t.status === 'in_progress').length,
    done: items.filter((t) => t.status === 'done').length,
  }
  // เปิดก่อนเสร็จ — เรียงใหม่สุดขึ้นก่อน
  const active = items.filter((t) => t.status !== 'done')

  const summary = [
    { key: 'open', label: 'เปิดใหม่', value: counts.open },
    { key: 'in_progress', label: 'กำลังดำเนินการ', value: counts.in_progress },
    { key: 'done', label: 'เสร็จแล้ว', value: counts.done },
  ]

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-sky-100/70 dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-sky-100 dark:border-sky-800/50 bg-gradient-to-r from-sky-50 dark:from-sky-950/30 to-cyan-50 dark:to-cyan-950/30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-xl text-white shadow-lg shadow-sky-500/40">
            🔧
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">แจ้งซ่อม</h2>
            <p className="truncate text-sm text-sky-700 dark:text-sky-300">ผู้เช่าแจ้งผ่าน LINE ด้วยคำสั่ง &quot;แจ้งซ่อม&quot;</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-3 py-1 text-xs font-semibold text-sky-800 dark:text-sky-200 ring-1 ring-inset ring-sky-200 dark:ring-sky-800/70">
          {loading ? 'กำลังโหลด...' : `${active.length} รายการค้าง`}
        </span>
      </div>

      {/* การ์ดสรุป 3 ใบ — 3 คอลัมน์พอดีจอ 375px */}
      <div className="grid grid-cols-3 gap-2.5 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-5">
        {summary.map((s) => {
          const tone = REPAIR_TONES[s.key]
          return (
            <div key={s.key} className={`rounded-2xl border p-3 sm:p-4 ${tone.card}`}>
              <p className={`text-xs font-semibold sm:text-sm ${tone.text}`}>{s.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${tone.text}`}>{s.value}</p>
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-sky-50 dark:bg-sky-950/30" />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่สามารถโหลดรายการแจ้งซ่อมได้</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 lg:py-2.5 lg:text-sm"
          >
            <Icon name="refresh" className="h-4 w-4" />
            ลองอีกครั้ง
          </button>
        </div>
      ) : active.length === 0 ? (
        <div className="p-8 text-center sm:p-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
            <Icon name="check" className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">ไม่มีงานซ่อมค้าง</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ผู้เช่ายังไม่มีคำขอซ่อมใหม่ในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {active.map((t) => {
            const rental = Array.isArray(t.rentals) ? t.rentals[0] : t.rentals
            const itemDetails = displayAssetName(rental || {})
            const custName = rental?.cust_name || 'ไม่ระบุ'
            const isCompleting = completingId === t.id
            const tone = REPAIR_TONES[t.status] || REPAIR_TONES.open
            return (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-white dark:bg-gray-900 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{itemDetails}</p>
                    <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">{custName}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.card} ${tone.text}`}>
                    {t.status === 'in_progress' ? 'กำลังซ่อม' : 'เปิดใหม่'}
                  </span>
                </div>

                <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">{t.description}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">แจ้งเมื่อ {formatDate(t.created_at)}</p>

                {t.photo_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(t.photo_url)}
                    className="group relative block overflow-hidden rounded-xl border border-sky-200 dark:border-sky-800/70"
                    aria-label="ดูรูปแจ้งซ่อมเต็มจอ"
                  >
                    <img src={t.photo_url} alt="รูปแจ้งซ่อม" className="h-40 w-full object-cover" loading="lazy" />
                    <span className="absolute inset-x-0 bottom-0 bg-gray-900/60 px-3 py-1.5 text-center text-sm font-semibold text-white">
                      แตะเพื่อดูรูปเต็มจอ
                    </span>
                  </button>
                ) : (
                  <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-sky-200 dark:border-sky-800/70 bg-sky-50/60 dark:bg-sky-950/30 text-sm text-sky-600 dark:text-sky-400">
                    ไม่มีรูปประกอบ
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onComplete(t)}
                  disabled={isCompleting}
                  className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCompleting ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                      </svg>
                      กำลังบันทึก...
                    </>
                  ) : (
                    '✅ เสร็จแล้ว'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {previewPhoto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -right-3 -top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 shadow-lg transition-colors hover:text-gray-900 dark:hover:text-gray-100"
              aria-label="ปิด"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={previewPhoto} alt="รูปแจ้งซ่อม" className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" />
          </div>
        </div>
      ) : null}
    </section>
  )
}

const EMPTY_FORM = {
  biz_type: '',
  cust_name: '',
  item_details: '',
  sub_label: '',
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
  'w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-3 text-base lg:py-2.5 lg:text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

function CollapsibleSection({ title, subtitle, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
            <Icon name={icon} className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
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
      {open && <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-5">{children}</div>}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </span>
    </button>
  )
}

function AddRentalModal({ open, onClose, onCreated, onToast }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      // เริ่มที่ขั้นเลือกประเภทสินทรัพย์ก่อน (ฟอร์ม mock จะเติมให้หลังเลือกการ์ด)
      setForm({ ...EMPTY_FORM })
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

  const isProperty = normalizeBizType(form.biz_type) === 'property'
  const typeMeta = bizTypeMeta(form.biz_type)

  // กดเลือกการ์ดประเภท → เติมฟอร์ม mock ให้ตรงประเภท (vehicle/other ได้ utility_enabled=false + มิเตอร์ 0 อัตโนมัติ)
  const selectBizType = (value) => {
    setForm(buildMockForm(value))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // ดึง landlord_id (id ของ admins ตาม auth.uid()) ก่อน insert เสมอ — ถ้าไม่ได้ไม่บันทึก
      // เพราะ RLS กรองแถวที่ landlord_id ไม่ตรงออกจากการอ่าน ทิ้งแถวเปล่าจะหายจากตารางทันที
      const { data: landlordId, error: adminError } = await supabase.rpc('get_my_admin_id')
      if (adminError) throw adminError
      if (!landlordId) throw new Error('ไม่พบบัญชีเจ้าของของผู้ใช้นี้ — ลองออกจากระบบแล้วเข้าใหม่')

      const bindingCode = generateBindingCode()
      // vehicle/other: ไม่มีค่าน้ำไฟ — บังคับ utility_enabled=false และมิเตอร์/อัตราเป็น 0
      const isProperty = normalizeBizType(form.biz_type) === 'property'
      const payload = {
        landlord_id: landlordId,
        biz_type: normalizeBizType(form.biz_type),
        cust_name: form.cust_name.trim(),
        tenant_phone: form.tenant_phone.trim() || null,
        tenant_id_card: form.tenant_id_card.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        item_details: form.item_details.trim(),
        sub_label: form.sub_label.trim() || null,
        room_status: form.room_status,
        amount: Number(form.amount),
        cycle: form.cycle,
        due_date: Number(form.due_date),
        penalty_per_day: Number(form.penalty_per_day) || 0,
        penalty_enabled: Boolean(form.penalty_enabled),
        chase_frequency: Number(form.chase_frequency) || 3,
        stop_chase: Number(form.stop_chase) > 0 ? 1 : 0,
        credit_balance: 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        move_in_date: form.move_in_date || null,
        lease_end_date: form.lease_end_date || null,
        last_water_meter: isProperty ? Number(form.last_water_meter) || 0 : 0,
        water_rate: isProperty ? Number(form.water_rate) || 0 : 0,
        last_elec_meter: isProperty ? Number(form.last_elec_meter) || 0 : 0,
        elec_rate: isProperty ? Number(form.elec_rate) || 0 : 0,
        utility_enabled: isProperty ? Boolean(form.utility_enabled) : false,
        binding_code: bindingCode,
      }
      const { error: insertError } = await supabase.from('rentals').insert([payload])
      if (insertError) throw insertError
      // รีเฟรชตารางก่อนปิด modal (ผ่าน onCreated ของ parent) ให้รายการใหม่โผล่ทันทีไม่ต้อง F5
      await onCreated({ bindingCode, custName: form.cust_name.trim() })
      onClose()
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      onToast?.({ type: 'error', message: err?.message || 'บันทึกข้อมูลไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">เพิ่มสินทรัพย์ใหม่</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">กรอกข้อมูลสัญญาเช่าเพื่อบันทึกลงในระบบ</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
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
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!form.biz_type ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  เลือกประเภทสินทรัพย์ <span className="text-rose-500 dark:text-rose-400">*</span>
                </p>
                {BIZ_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => selectBizType(t.value)}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 text-left shadow-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30"
                  >
                    <span className="text-3xl leading-none">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-gray-900 dark:text-gray-100">{t.label}</span>
                      <span className="mt-0.5 block truncate text-sm text-gray-500 dark:text-gray-400">{t.examples}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
            <>
            <CollapsibleSection title="ข้อมูลสัญญาเช่า" subtitle="ข้อมูลหลักของสัญญา" icon="document" defaultOpen>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3">
                  <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{typeMeta.icon} {typeMeta.label}</p>
                  <button
                    type="button"
                    onClick={() => setField('biz_type', '')}
                    disabled={saving}
                    className="shrink-0 rounded-lg bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-sm transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-800/50"
                  >
                    เปลี่ยนประเภท
                  </button>
                </div>

                <div>
                  <label htmlFor="cust_name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    ชื่อผู้เช่า <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input id="cust_name" type="text" value={form.cust_name} onChange={updateField('cust_name')} placeholder="เช่น นายสมชาย ใจดี" required className={inputClass} />
                </div>

                {typeMeta.subLabel && (
                  <div>
                    <label htmlFor="sub_label" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {typeMeta.subLabel}
                    </label>
                    <input id="sub_label" type="text" value={form.sub_label} onChange={updateField('sub_label')} placeholder={typeMeta.subPlaceholder} className={inputClass} />
                  </div>
                )}

                <div>
                  <label htmlFor="item_details" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {typeMeta.itemLabel}
                  </label>
                  <input id="item_details" type="text" value={form.item_details} onChange={updateField('item_details')} placeholder={typeMeta.placeholder} className={inputClass} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ค่าเช่า / ค่างวด <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input id="amount" type="number" min="0" step="0.01" value={form.amount} onChange={updateField('amount')} placeholder="0.00" required className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="cycle" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      รอบการเก็บเงิน <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <select id="cycle" value={form.cycle} onChange={updateField('cycle')} required className={inputClass}>
                      {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="due_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    วันครบกำหนดชำระ (1-31) <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input id="due_date" type="number" min="1" max="31" step="1" value={form.due_date} onChange={updateField('due_date')} placeholder="เช่น 1" required className={inputClass} />
                </div>

                {!isProperty && (
                  <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 p-4">
                    <label htmlFor="deposit_amount_main" className="mb-1.5 block text-sm font-bold text-amber-800 dark:text-amber-200">
                      ค่าประกัน / เงินมัดจำ (บาท)
                    </label>
                    <input
                      id="deposit_amount_main"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.deposit_amount}
                      onChange={updateField('deposit_amount')}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="ข้อมูลผู้เช่าและสัญญา" subtitle="ข้อมูลติดต่อและช่วงเวลาสัญญา" icon="building">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="tenant_phone" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เบอร์โทรผู้เช่า</label>
                    <input id="tenant_phone" type="text" value={form.tenant_phone} onChange={updateField('tenant_phone')} placeholder="08x-xxx-xxxx" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tenant_id_card" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขบัตรประชาชน</label>
                    <input id="tenant_id_card" type="text" value={form.tenant_id_card} onChange={updateField('tenant_id_card')} placeholder="x-xxxx-xxxxx-xx-x" className={inputClass} />
                  </div>
                </div>

                <div>
                  <label htmlFor="emergency_contact" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เบอร์ติดต่อฉุกเฉิน</label>
                  <input id="emergency_contact" type="text" value={form.emergency_contact} onChange={updateField('emergency_contact')} placeholder="08x-xxx-xxxx" className={inputClass} />
                </div>

                <div>
                  <label htmlFor="room_status" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">สถานะห้อง/สินทรัพย์</label>
                  <select id="room_status" value={form.room_status} onChange={updateField('room_status')} className={inputClass}>
                    <option value="occupied">ไม่ว่าง (occupied)</option>
                    <option value="vacant">ว่าง (vacant)</option>
                    <option value="maintenance">ซ่อมบำรุง (maintenance)</option>
                  </select>
                </div>

                {isProperty && (
                  <div>
                    <label htmlFor="deposit_amount" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เงินประกัน</label>
                    <input id="deposit_amount" type="number" min="0" step="0.01" value={form.deposit_amount} onChange={updateField('deposit_amount')} placeholder="0.00" className={inputClass} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="move_in_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันที่ย้ายเข้า</label>
                    <input id="move_in_date" type="date" value={form.move_in_date} onChange={updateField('move_in_date')} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="lease_end_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันสิ้นสุดสัญญา</label>
                    <input id="lease_end_date" type="date" value={form.lease_end_date} onChange={updateField('lease_end_date')} className={inputClass} />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title={isProperty ? 'การตั้งค่าทวงเงินและค่าน้ำไฟ' : 'การตั้งค่าทวงเงิน'}
              subtitle={isProperty ? 'ค่าปรับ การทวงหนี้ และมิเตอร์' : 'ค่าปรับและการทวงหนี้'}
              icon="banknotes"
            >
              <div className="space-y-4">
                <Toggle checked={form.penalty_enabled} onChange={(v) => setField('penalty_enabled', v)} label="เปิดใช้ค่าปรับ" />

                {form.penalty_enabled && (
                  <div>
                    <label htmlFor="penalty_per_day" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าปรับต่อวัน (บาท)</label>
                    <input id="penalty_per_day" type="number" min="0" step="0.01" value={form.penalty_per_day} onChange={updateField('penalty_per_day')} placeholder="0.00" className={inputClass} />
                  </div>
                )}

                <div>
                  <label htmlFor="chase_frequency" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ความถี่ทวงหนี้</label>
                  <select id="chase_frequency" value={form.chase_frequency} onChange={updateField('chase_frequency')} className={inputClass}>
                    <option value={3}>ทุก 3 วัน</option>
                    <option value={7}>ทุก 7 วัน</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="stop_chase" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">หยุดทวงหนี้หลังจาก (วัน)</label>
                  <input id="stop_chase" type="number" min="0" step="1" value={form.stop_chase} onChange={updateField('stop_chase')} placeholder="เช่น 30 (0 = ไม่หยุด)" className={inputClass} />
                </div>

                {isProperty && (
                  <>
                    <Toggle checked={form.utility_enabled} onChange={(v) => setField('utility_enabled', v)} label="คิดค่าน้ำไฟ" />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="last_water_meter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์น้ำล่าสุด</label>
                        <input id="last_water_meter" type="number" min="0" step="1" value={form.last_water_meter} onChange={updateField('last_water_meter')} placeholder="0" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="water_rate" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าน้ำ/หน่วย (บาท)</label>
                        <input id="water_rate" type="number" min="0" step="0.01" value={form.water_rate} onChange={updateField('water_rate')} placeholder="0.00" className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="last_elec_meter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์ไฟล่าสุด</label>
                        <input id="last_elec_meter" type="number" min="0" step="1" value={form.last_elec_meter} onChange={updateField('last_elec_meter')} placeholder="0" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="elec_rate" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าไฟ/หน่วย (บาท)</label>
                        <input id="elec_rate" type="number" min="0" step="0.01" value={form.elec_rate} onChange={updateField('elec_rate')} placeholder="0.00" className={inputClass} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CollapsibleSection>
            </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">เพิ่มสินทรัพย์สำเร็จ</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">ผูกกลุ่มไลน์สำหรับทวงหนี้อัตโนมัติ</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-emerald-100 transition-colors hover:bg-white/10 hover:text-white lg:right-4 lg:top-4 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {custName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ผู้เช่า: <span className="font-semibold text-gray-900 dark:text-gray-100">{custName}</span>
            </p>
          )}

          <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">รหัสผูกกลุ่มของคุณ</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{code}</p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
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
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 sm:py-3 sm:text-sm"
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
  const [period, setPeriod] = useState(currentPeriod)
  const [existingPeriods, setExistingPeriods] = useState([])

  useEffect(() => {
    if (rental) {
      setWaterCurrent('')
      setElecCurrent('')
      setSendToLine(true)
      setSaving(false)
      setPeriod(currentPeriod())
    }
  }, [rental])

  // งวดที่ห้องนี้มีบิลแล้ว (กันสร้างซ้ำ ชน unique rental+period)
  useEffect(() => {
    const rentalId = rental?.id
    if (!rentalId) {
      setExistingPeriods([])
      return
    }
    let active = true
    supabase
      .from('transactions')
      .select('period')
      .eq('rental_id', rentalId)
      .then(({ data }) => {
        if (active) setExistingPeriods((Array.isArray(data) ? data : []).map((t) => t.period).filter(Boolean))
      })
      .catch(() => {})
    return () => { active = false }
  }, [rental?.id])

  if (!rental) return null

  // vehicle/other ไม่มีค่าน้ำไฟ — ซ่อนส่วนกรอกมิเตอร์ทั้งหมด
  const isProperty = normalizeBizType(rental?.biz_type) === 'property'
  const utilityEnabled = isProperty && Boolean(rental.utility_enabled)
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

  // ตัวเลือกงวด: 3 เดือนก่อนย้อนหลัง จนถึงเดือนหน้า (value = ISO สำหรับบันทึก, label = ไทยสำหรับแสดง)
  const periodOptions = (() => {
    const now = new Date()
    const opts = []
    for (let i = 3; i >= -1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: formatPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`),
      })
    }
    return opts
  })()
  const periodLabel = periodOptions.find((o) => o.value === period)?.label || formatPeriod(period)
  // จับคู่ทั้งงวด ISO ใหม่และงวดเดิมที่เคยบันทึกฟอร์แมตไทย
  const periodHasBill = existingPeriods.includes(period) || existingPeriods.includes(periodLabel)
  const optionHasBill = (o) => existingPeriods.includes(o.value) || existingPeriods.includes(o.label)

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(rental, { waterCurrent, elecCurrent }, sendToLine, period)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
              <Icon name="banknotes" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">บันทึกมิเตอร์และสร้างบิล</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
            ค่าเช่า / ค่างวด: <span className="font-semibold">{formatCurrency(amount)}</span>
          </div>

          <div>
            <label htmlFor="bill_period" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">งวดบิล</label>
            <select id="bill_period" value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass}>
              {periodOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}{optionHasBill(o) ? ' (มีบิลแล้ว)' : ''}</option>
              ))}
            </select>
            {periodHasBill ? (
              <p className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                ⚠️ งวดนี้มีบิลอยู่แล้ว — ไม่สามารถสร้างบิลซ้ำได้
              </p>
            ) : existingPeriods.length > 0 ? (
              <p className="mt-1.5 text-xs text-gray-400">งวดที่มีบิลแล้ว: {existingPeriods.slice(-6).map(formatPeriod).join(', ')}</p>
            ) : null}
          </div>

          {utilityEnabled ? (
            <>
              <div className="rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/30 p-4">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">ค่าน้ำ</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastWater}</span></div>
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{waterRate} บาท/หน่วย</span></div>
                </div>
                <label htmlFor="water_current" className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์น้ำปัจจุบัน</label>
                <input id="water_current" type="number" min="0" step="1" value={waterCurrent} onChange={(e) => setWaterCurrent(e.target.value)} placeholder="เช่น 150" className={inputClass} />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ใช้ไป {waterUnits} หน่วย = {formatCurrency(waterCost)}</p>
              </div>

              <div className="rounded-2xl border border-amber-100 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/30 p-4">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">ค่าไฟ</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastElec}</span></div>
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{elecRate} บาท/หน่วย</span></div>
                </div>
                <label htmlFor="elec_current" className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์ไฟปัจจุบัน</label>
                <input id="elec_current" type="number" min="0" step="1" value={elecCurrent} onChange={(e) => setElecCurrent(e.target.value)} placeholder="เช่น 2500" className={inputClass} />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ใช้ไป {elecUnits} หน่วย = {formatCurrency(elecCost)}</p>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-950 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {isProperty ? 'ห้องนี้ไม่ได้เปิดใช้งานระบบน้ำไฟ (ข้ามการคำนวณค่าน้ำ/ค่าไฟ)' : 'สินทรัพย์ประเภทนี้ไม่มีค่าน้ำไฟ (ข้ามการคำนวณค่าน้ำ/ค่าไฟ)'}
            </div>
          )}

          <div className="rounded-2xl bg-gray-900 px-4 py-4 text-center text-white">
            <p className="text-xs text-gray-300">ยอดรวมที่ต้องชำระ</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-300 lg:min-h-0 lg:gap-2">
            <input
              type="checkbox"
              checked={sendToLine}
              onChange={(e) => setSendToLine(e.target.checked)}
              className="h-6 w-6 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 lg:h-4 lg:w-4"
            />
            📥 ส่งบิลเข้าไลน์อัตโนมัติ
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm">ยกเลิก</button>
            <button type="button" onClick={handleConfirm} disabled={saving || periodHasBill} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm">
              {saving ? (<><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>กำลังสร้างบิล...</>) : periodHasBill ? 'งวดนี้มีบิลแล้ว' : 'สร้างบิล'}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ต่อสัญญา</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5" aria-label="ปิด">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <label htmlFor="renew_lease_end" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันสิ้นสุดสัญญาใหม่</label>
          <input id="renew_lease_end" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-sm sm:rounded-2xl">
        <div className={`px-6 py-5 text-white ${isDelete ? 'bg-rose-600' : 'bg-amber-500'}`}>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-0.5 text-sm opacity-90">{rental.cust_name} · {displayAssetName(rental)}</p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{message}</p>
          {!isDelete && (
            <>
              <div>
                <label htmlFor="repair_cost" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าซ่อมแซม/หักค่าเสียหาย (บาท)</label>
                <input id="repair_cost" type="number" min="0" step="0.01" value={repairCost} onChange={(e) => setRepairCost(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                ยอดเงินประกันคืน = <span className="font-semibold">{formatCurrency(Math.max(0, (Number(rental.deposit_amount) || 0) - (Number(repairCost) || 0)))}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm ${isDelete ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
            {saving ? 'กำลังดำเนินการ...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssetDetailModal({ rental, onClose, onToast }) {
  const [copied, setCopied] = useState(false)
  const [reminders, setReminders] = useState(null)
  const [expandedReminder, setExpandedReminder] = useState(null)

  // ประวัติการติดต่อ: reminders ของทุกบิลของห้องนี้ (ค้นผ่าน transaction_id แบบ client-side)
  useEffect(() => {
    const rentalId = rental?.id
    if (!rentalId) return
    let active = true
    setReminders(null)
    setExpandedReminder(null)
    async function load() {
      try {
        const { data: txs, error: txError } = await supabase
          .from('transactions')
          .select('id')
          .eq('rental_id', rentalId)
        if (txError) throw txError
        const txIds = (txs || []).map((t) => t.id)
        if (txIds.length === 0) {
          if (active) setReminders([])
          return
        }
        const { data: rows, error: remError } = await supabase
          .from('reminders')
          .select('kind, message_text, sent_at')
          .in('transaction_id', txIds)
          .order('sent_at', { ascending: false })
          .limit(20)
        if (remError) throw remError
        if (active) setReminders(Array.isArray(rows) ? rows : [])
      } catch (err) {
        console.error('Reminders fetch error:', err)
        if (active) setReminders([])
      }
    }
    load()
    return () => { active = false }
  }, [rental?.id])

  if (!rental) return null

  const copyBindingCode = async () => {
    const code = rental?.binding_code
    if (!code) return
    try {
      await navigator.clipboard.writeText(String(code))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onToast?.({ type: 'success', message: 'คัดลอกแล้ว' })
    } catch {
      onToast?.({ type: 'error', message: 'คัดลอกรหัสไม่สำเร็จ' })
    }
  }

  // มิเตอร์น้ำไฟแสดงเฉพาะสินทรัพย์ประเภทอสังหาริมทรัพย์ (property)
  const isProperty = normalizeBizType(rental?.biz_type) === 'property'

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
    ...(isProperty ? [
      { key: 'last_water_meter', label: 'เลขมิเตอร์น้ำล่าสุด' },
      { key: 'water_rate', label: 'ค่าน้ำ/หน่วย' },
      { key: 'last_elec_meter', label: 'เลขมิเตอร์ไฟล่าสุด' },
      { key: 'elec_rate', label: 'ค่าไฟ/หน่วย' },
      { key: 'utility_enabled', label: 'คิดค่าน้ำไฟ' },
    ] : []),
    { key: 'group_id', label: 'LINE Group ID' },
    { key: 'binding_code', label: 'รหัสผูกกลุ่ม (Binding Code)' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Icon name="document" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ข้อมูลสินทรัพย์เพิ่มเติม</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-4">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">เชื่อมต่อ LINE</p>
            {rental.group_id ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                🔗 ผูกกลุ่มแล้ว
              </span>
            ) : (
              <div className="mt-2">
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{rental.binding_code || '—'}</p>
                <button
                  type="button"
                  onClick={copyBindingCode}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
                >
                  {copied ? '✓ คัดลอกแล้ว' : 'คัดลอกรหัส'}
                </button>
                <ol className="mt-3 space-y-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  <li>1) เพิ่มเพื่อนบอท PayRentPro ใน LINE {import.meta.env.VITE_LINE_BOT_ID ? `(ID: ${import.meta.env.VITE_LINE_BOT_ID})` : '(ดู ID บอทในคู่มือ)'}</li>
                  <li>2) เชิญบอทเข้ากลุ่มแชทกับผู้เช่า</li>
                  <li>3) พิมพ์รหัสนี้ในกลุ่ม เพื่อผูกห้องกับกลุ่ม</li>
                </ol>
              </div>
            )}
          </div>

          <dl className="divide-y divide-gray-100 dark:divide-gray-800">
            {fields.map((f) => (
              <div key={f.key} className="flex items-start justify-between gap-4 py-3">
                <dt className="text-sm text-gray-500 dark:text-gray-400">{f.label}</dt>
                <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{renderDetailValue(f.key, rental[f.key])}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-4 py-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">ประวัติการติดต่อ</h3>
            {reminders === null ? (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                ))}
              </div>
            ) : reminders.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ยังไม่มีประวัติ</p>
            ) : (
              <ol className="mt-3 ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-5">
                {reminders.map((r, i) => {
                  const icon = r.kind === 'due_soon' ? '⏰' : r.kind === 'chase' ? '⚠️' : r.kind === 'receipt' ? '🧾' : '💬'
                  const expanded = expandedReminder === i
                  const at = r.sent_at
                    ? new Date(r.sent_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.'
                    : '—'
                  return (
                    <li key={`${r.sent_at ?? ''}-${i}`} className="relative pb-4 last:pb-0">
                      <span className="absolute -left-[35px] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base shadow-sm">
                        {icon}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{at}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedReminder(expanded ? null : i)}
                        className={`mt-0.5 w-full text-left text-sm leading-relaxed text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${expanded ? '' : 'line-clamp-2'}`}
                      >
                        {r.message_text || '—'}
                      </button>
                      <span className="mt-0.5 inline-block text-xs font-medium text-indigo-500 dark:text-indigo-400">
                        {expanded ? 'ย่อ' : 'อ่านทั้งหมด'}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 lg:py-2.5 lg:text-sm"
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
    business_name: '',
    owner_name: '',
    address: '',
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
          .select('id, payment_type, promptpay_name, promptpay, bank_code, bank_account, business_name, owner_name, address')
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
          business_name: data?.business_name ?? '',
          owner_name: data?.owner_name ?? '',
          address: data?.address ?? '',
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
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim(),
        address: form.address.trim(),
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
              <Icon name="cog" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตั้งค่าบัญชีรับเงิน</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">กำหนดช่องทางที่ผู้เช่าใช้โอนเงินให้คุณ</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
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
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
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
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/60 p-4">
                  <p className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">โปรไฟล์ธุรกิจ</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อธุรกิจ</label>
                      <input type="text" value={form.business_name} onChange={updateField('business_name')} placeholder="เช่น หอพักบ้านสวย" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อเจ้าของ</label>
                      <input type="text" value={form.owner_name} onChange={updateField('owner_name')} placeholder="เช่น สมชาย ใจดี" className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ที่อยู่</label>
                      <textarea value={form.address} onChange={updateField('address')} rows={2} placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด" className={inputClass} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ประเภทการรับเงิน</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, payment_type: 'promptpay' }))}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${!isBank ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">พร้อมเพย์ (PromptPay)</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">เบอร์โทร / เลขบัตรประชาชน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, payment_type: 'bank' }))}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${isBank ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">บัญชีธนาคาร</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">โอนผ่านเลขบัญชีธนาคาร</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="settings_account_name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    ชื่อบัญชี <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="settings_account_name"
                    type="text"
                    value={form.promptpay_name}
                    onChange={updateField('promptpay_name')}
                    placeholder="เช่น สมชาย ใจดี"
                    required
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {isBank ? (
                  <>
                    <div>
                      <label htmlFor="settings_bank_code" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        ธนาคาร <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <select
                        id="settings_bank_code"
                        value={form.bank_code}
                        onChange={updateField('bank_code')}
                        required
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="" disabled>เลือกธนาคาร</option>
                        {BANKS.map((b) => (
                          <option key={b.code} value={b.code}>ธนาคาร{b.name} ({b.short})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="settings_bank_account" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        เลขบัญชีธนาคาร <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input
                        id="settings_bank_account"
                        type="text"
                        inputMode="numeric"
                        value={form.bank_account}
                        onChange={updateField('bank_account')}
                        placeholder="เช่น 1234567890"
                        required
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label htmlFor="settings_promptpay" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      เลขพร้อมเพย์ <span className="text-rose-500 dark:text-rose-400">*</span>
                    </label>
                    <input
                      id="settings_promptpay"
                      type="text"
                      inputMode="numeric"
                      value={form.promptpay}
                      onChange={updateField('promptpay')}
                      placeholder="เช่น 0812345678 หรือ 1234567890123"
                      required
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
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

function InvoiceModal({ invoice, onClose, onMarkPaid, onCopyLink, onSendToLine, onIssueReceipt, onEditAmount }) {
  const [marking, setMarking] = useState(false)
  const [sending, setSending] = useState(false)
  const [issuingReceipt, setIssuingReceipt] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrFailed, setQrFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [justEdited, setJustEdited] = useState(false)
  const [editForm, setEditForm] = useState({ water: '', elec: '', extra: '', reason: '' })

  // รีเซ็ตฟอร์มเมื่อเปิดบิลใหม่ (key ด้วย transactionId — แก้ยอดแล้ว object เปลี่ยนแต่บิลเดิมต้องไม่รีเซ็ต)
  useEffect(() => {
    setEditing(false)
    setJustEdited(false)
    setEditForm({ water: '', elec: '', extra: '', reason: '' })
  }, [invoice?.transactionId])

  // สร้าง QR พร้อมเพย์ในเครื่องจากยอดบิล + เบอร์พร้อมเพย์ของเจ้าของ
  useEffect(() => {
    let active = true
    const isBank = invoice?.paymentType === 'bank'
    const ppNumber = String(invoice?.promptpayNumber ?? '').replace(/[^0-9]/g, '')
    if (!invoice || isBank || !ppNumber) {
      setQrDataUrl(null)
      setQrFailed(false)
      return
    }
    createPromptpayQR(ppNumber, invoice.total)
      .then((dataUrl) => {
        if (!active) return
        setQrDataUrl(dataUrl)
        setQrFailed(false)
      })
      .catch(() => {
        if (!active) return
        setQrDataUrl(null)
        setQrFailed(true)
      })
    return () => { active = false }
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
  const isUnpaid = invoice.status === 'unpaid'

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

  const handleIssueReceipt = async () => {
    setIssuingReceipt(true)
    try {
      await onIssueReceipt()
    } finally {
      setIssuingReceipt(false)
    }
  }

  const startEdit = () => {
    setEditForm({
      water: String(invoice.waterCost ?? 0),
      elec: String(invoice.elecCost ?? 0),
      extra: String(invoice.extraCharges ?? 0),
      reason: '',
    })
    setEditing(true)
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      const ok = await onEditAmount({
        waterCost: Number(editForm.water) || 0,
        elecCost: Number(editForm.elec) || 0,
        extraCharges: Number(editForm.extra) || 0,
        reason: editForm.reason.trim(),
      })
      if (ok) {
        setEditing(false)
        setJustEdited(true)
      }
    } finally {
      setSavingEdit(false)
    }
  }

  const editPreviewTotal = (Number(invoice.baseAmount) || 0) + (Number(editForm.water) || 0) + (Number(editForm.elec) || 0) + (Number(editForm.extra) || 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-6 text-white">
          <p className="text-sm font-medium text-indigo-100">ใบแจ้งหนี้ / INVOICE</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">PayRentPro</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-indigo-100 transition-colors hover:bg-white/10 hover:text-white lg:right-4 lg:top-4 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {editing ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">ค่าเช่า (แก้ไม่ได้)</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(invoice.baseAmount)}</p>
              </div>
              <div>
                <label htmlFor="edit_water" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าน้ำ (บาท)</label>
                <input
                  id="edit_water"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.water}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, water: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit_elec" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าไฟ (บาท)</label>
                <input
                  id="edit_elec"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.elec}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, elec: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit_extra" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าอื่นๆ / ซ่อมแซม (บาท)</label>
                <input
                  id="edit_extra"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.extra}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, extra: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="edit_reason" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เหตุผลการแก้ <span className="text-rose-500 dark:text-rose-400">*</span></label>
                <textarea
                  id="edit_reason"
                  rows={2}
                  value={editForm.reason}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="เช่น อ่านมิเตอร์น้ำผิด / ค่าซ่อมแอร์"
                  className={inputClass}
                />
              </div>
              <div className="rounded-2xl bg-gray-900 px-4 py-4 text-center text-white">
                <p className="text-xs text-gray-300">ยอดใหม่ที่ต้องชำระ</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{formatCurrency(editPreviewTotal)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                  className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !editForm.reason.trim()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                    </svg>
                  ) : null}
                  {savingEdit ? 'กำลังบันทึก...' : 'บันทึกยอดใหม่'}
                </button>
              </div>
            </div>
          ) : (
          <>
          {justEdited && (
            <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-200 dark:ring-amber-800/70">
              ✏️ แก้ยอดแล้ว — ลิงก์บิลเดิมที่ผู้เช่าเปิดอยู่จะแสดงยอดใหม่อัตโนมัติ
            </div>
          )}
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${isPaid ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isPaid ? 'ชำระแล้ว' : 'รอการชำระเงิน'}
          </div>

          {invoice.sent && (
            <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/70">
              ✅ ส่งบิลเข้าไลน์สำเร็จแล้ว
            </div>
          )}

          <dl className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400">ชื่อผู้เช่า</dt>
              <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{invoice.custName}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400">รายละเอียดสินทรัพย์</dt>
              <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{invoice.itemDetails}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400">รอบบิล</dt>
              <dd className="text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{formatPeriod(invoice.period)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-sm text-gray-500 dark:text-gray-400">เลขที่บิล</dt>
              <dd className="text-right font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                {invoice.transactionId ? invoice.transactionId.slice(0, 8).toUpperCase() : '—'}
              </dd>
            </div>
          </dl>

          <div className="my-5 border-t border-dashed border-gray-200 dark:border-gray-700" />

          <div className="rounded-2xl bg-gray-50 dark:bg-gray-950 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ยอดรวมที่ต้องจ่าย</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{formatCurrency(invoice.total)}</p>
          </div>

          <div className="mt-5 flex flex-col items-center">
            {invoice.paymentType === 'bank' ? (
              <div className="w-full rounded-2xl border border-blue-100 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-slate-50 dark:to-slate-950/30 p-5 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                  <Icon name="banknotes" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">โอนเข้าบัญชีธนาคาร</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{invoice.paymentText}</p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
                  {qrFailed ? (
                    <div className="flex h-44 w-44 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 p-4 text-center text-xs text-gray-400">
                      ไม่สามารถสร้าง QR Code ได้
                    </div>
                  ) : qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code พร้อมเพย์"
                      width={176}
                      height={176}
                      className="h-44 w-44 object-contain"
                    />
                  ) : (
                    <div className="h-44 w-44 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                  )}
                </div>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  สแกนจ่ายผ่าน <span className="font-semibold text-gray-900 dark:text-gray-100">พร้อมเพย์</span>
                </p>
                <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{invoice.promptpayNumber || '0812345678'}</p>
                {invoice.promptpayName && (
                  <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-300">โอนเข้าบัญชี: {invoice.promptpayName}</p>
                )}
              </>
            )}
          </div>
          </>
          )}
        </div>
        <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4">
          {isUnpaid && !editing && (
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-4 text-base font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-800/50 lg:py-2.5 lg:text-sm"
            >
              ✏️ แก้ไขยอดบิล
            </button>
          )}
          {isPaid && (
            <button
              type="button"
              onClick={handleIssueReceipt}
              disabled={issuingReceipt}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {issuingReceipt ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
              ) : (
                <span className="text-base leading-none">🧾</span>
              )}
              {issuingReceipt ? 'กำลังออกใบเสร็จ...' : 'ออกใบเสร็จ (ส่งเข้าไลน์)'}
            </button>
          )}
          <button
            type="button"
            onClick={handleSendToLine}
            disabled={invoice.sent || sending}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 lg:py-2.5 lg:text-sm ${
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
            ) : justEdited ? (
              '📤 ส่งบิลฉบับแก้ไขเข้าไลน์'
            ) : (
              '📤 ส่งบิลเข้าไลน์'
            )}
          </button>
          <div className={`grid gap-3 ${invoice.paymentType === 'bank' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {invoice.paymentType !== 'bank' && qrDataUrl && (
              <a
                href={qrDataUrl}
                download="promptpay-qr.png"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:py-2.5 lg:text-sm"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-4 text-base font-semibold text-indigo-700 dark:text-indigo-300 shadow-sm transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-800/50 lg:py-2.5 lg:text-sm"
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
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 lg:py-2.5 lg:text-sm ${
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

function TrialWelcomeScreen({ starting, notice, onStart, onSignOut }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 dark:from-indigo-950/30 via-white to-white px-4 py-10 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-xl shadow-indigo-100/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
          <Icon name="building" className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">เริ่มใช้งานฟรี 30 วัน</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          ทดลองใช้ PayRentPro ฟรี 30 วัน — จัดการห้องเช่า ออกบิล ทวงเงินเข้า LINE ได้ทันที ไม่ต้องใช้บัตรเครดิต
        </p>
        {notice && (
          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-center text-sm font-medium text-amber-700 dark:text-amber-300">
            {notice}
          </div>
        )}
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
            </svg>
          ) : null}
          {starting ? 'กำลังเริ่ม...' : 'เริ่มทดลองใช้ฟรี'}
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 w-full text-center text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

// หน้าล็อคเมื่อสมาชิกหมดอายุ — ข้อมูลยังอยู่ทั้งหมด แค่ต่ออายุเพื่อกลับมาใช้ต่อ
// (ทางต่ออายุหลัก: หน้า /membership สแกน QR + อัปโหลดสลิป / ทางสำรอง: แจ้งโอน manual ทาง LINE)
function ExpiredScreen({ promptpayNumber, onSignOut }) {
  const [showRenew, setShowRenew] = useState(false)
  const navigate = useNavigate()
  const pp = String(promptpayNumber ?? '').trim() || '08x-xxx-xxxx'
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-xl shadow-rose-100/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
          <Icon name="warning" className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">หมดอายุการใช้งาน</h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          ข้อมูลทั้งหมดยังอยู่ ต่ออายุเพื่อใช้งานต่อ
        </p>
        <button
          type="button"
          onClick={() => navigate('/membership')}
          className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500"
        >
          💎 ต่ออายุออนไลน์ (สแกน QR + อัปโหลดสลิป)
        </button>
        <button
          type="button"
          onClick={() => setShowRenew((prev) => !prev)}
          className="mt-3 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {showRenew ? 'ซ่อนวิธีต่ออายุแบบแจ้งโอน' : 'ต่ออายุด้วยการแจ้งโอนผ่าน LINE'}
        </button>
        {showRenew && (
          <div className="mt-3 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-4 text-sm leading-relaxed text-indigo-900 dark:text-indigo-200">
            ชำระค่าสมาชิกผ่านพร้อมเพย์ <span className="font-bold">{pp}</span> แล้วส่งสลิปที่ LINE ของเรา
            ทีมงานจะต่ออายุให้หลังตรวจสอบสลิป
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 w-full text-center text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setAuthLoading(false)
      }
    })

    // fallback กรณีถูกพากลับมาพร้อม magic link แบบ PKCE (?code=...)
    // ปกติ detectSessionInUrl ของ supabase จัดการตอน init แล้ว — ตรงนี้เป็นเบาะหลัง
    // (code ถ้าถูกใช้ไปแล้วจะ error แล้วเราเงียบไว้ ไม่กระทบ session เดิม)
    const url = new URL(window.location.href)
    if (url.searchParams.has('code')) {
      supabase.auth
        .exchangeCodeForSession(window.location.href)
        .catch((err) => console.warn('Magic link code exchange failed:', err?.message))
        .finally(() => {
          url.searchParams.delete('code')
          url.searchParams.delete('next')
          window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash)
        })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const user = session?.user
    if (!user) return
    supabase.from('admins')
      .update({ user_id: user.id })
      .eq('user_id', null)
      .eq('email', user.email)
      .then(({ error }) => {
        if (error) console.error('Link admin error:', error)
      })
  }, [session])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  return <Dashboard />
}

function Dashboard() {
  const { theme, toggleTheme, largeText, toggleLargeText } = useTheme()
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
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
  const [repairTickets, setRepairTickets] = useState([])
  const [repairLoading, setRepairLoading] = useState(true)
  const [repairError, setRepairError] = useState(null)
  const [completingRepairId, setCompletingRepairId] = useState(null)
  const [txInsights, setTxInsights] = useState([])
  const knownPendingIdsRef = useRef(null)
  const [paymentInfo, setPaymentInfo] = useState({
    payment_type: 'promptpay',
    promptpay: '',
    promptpay_name: '',
    bank_code: '',
    bank_account: '',
    business_name: '',
    owner_name: '',
    address: '',
  })
  const [membership, setMembership] = useState(null)
  const [startingTrial, setStartingTrial] = useState(false)
  const [trialNotice, setTrialNotice] = useState(null)

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
        .select('payment_type, promptpay_name, promptpay, bank_code, bank_account, business_name, owner_name, address')
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
          business_name: data.business_name ?? '',
          owner_name: data.owner_name ?? '',
          address: data.address ?? '',
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
        .select('*, rentals(cust_name, item_details, sub_label)')
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

  // รายการแจ้งซ่อม — RLS กรองให้เห็นเฉพาะห้องที่ตัวเองเป็นเจ้าของแล้ว
  const fetchRepairTickets = useCallback(async (silent = false) => {
    if (!silent) {
      setRepairLoading(true)
      setRepairError(null)
    }
    try {
      const { data, error } = await supabase
        .from('repair_tickets')
        .select('id, description, status, photo_url, created_at, rentals(cust_name, item_details, sub_label)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRepairTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      if (!silent) setRepairError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      if (!silent) setRepairLoading(false)
    }
  }, [])

  // ปิดงานซ่อม → update status แล้วให้ RPC push แจ้งกลุ่ม LINE
  const handleCompleteRepair = useCallback(async (ticket) => {
    if (!ticket?.id) return
    setCompletingRepairId(ticket.id)
    try {
      const { error } = await supabase
        .from('repair_tickets')
        .update({ status: 'done', done_at: new Date().toISOString() })
        .eq('id', ticket.id)
      if (error) throw error

      // แจ้งกลุ่ม LINE — ถ้าห้องยังไม่ผูกกลุ่มก็ถือว่าปิดงานสำเร็จแล้ว
      const { data: notifyResult, error: notifyError } = await supabase.rpc('notify_repair_done', {
        p_ticket_id: ticket.id,
      })
      if (notifyError) throw notifyError

      if (notifyResult?.ok === false && notifyResult?.error === 'no_group') {
        setToast({ type: 'warning', message: 'ปิดงานซ่อมแล้ว — ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE' })
      } else {
        setToast({ type: 'success', message: 'ปิดงานซ่อมแล้ว แจ้งผู้เช่าใน LINE เรียบร้อย' })
      }
      await fetchRepairTickets(true)
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'ปิดงานซ่อมไม่สำเร็จ' })
    } finally {
      setCompletingRepairId(null)
    }
  }, [fetchRepairTickets])

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
        .select('id, total_amount, rentals(cust_name, item_details, sub_label)')
        .eq('status', 'unpaid')
        .lt('created_at', cutoff.toISOString())
      if (error) throw error
      setOverdueBills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Overdue fetch error:', err)
    }
  }, [])

  // ข้อมูลดิบสำหรับกราฟใหม่บนแดชบอร์ด (Aging + รายรับแยกประเภท) — แยกจาก fetch สรุปเดิม
  // ดึงครั้งเดียวทั้ง transactions แล้วคำนวณต่อ client-side (สัญญา join เอา biz_type/due_date)
  const fetchTxInsights = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, status, total_amount, base_amount, period, created_at, rentals(cust_name, item_details, sub_label, biz_type, due_date)')
      if (error) throw error
      setTxInsights(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Insight fetch error:', err)
    }
  }, [])

  // สถานะสมาชิก (plan / วันหมดอายุ / ลิมิตห้อง) — เรียกครั้งเดียวหลัง login และหลังเริ่มทดลองใช้
  const fetchMembership = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_membership_status')
      if (error) throw error
      setMembership(data ?? { ok: false })
    } catch (err) {
      console.error('Membership status error:', err)
      setMembership({ ok: false, error: err?.message })
    }
  }, [])

  useEffect(() => {
    fetchMembership()
  }, [fetchMembership])

  useEffect(() => {
    fetchPendingReviews()
    fetchSummary()
    fetchOverdue()
    fetchTxInsights()
    fetchRepairTickets()
  }, [fetchPendingReviews, fetchSummary, fetchOverdue, fetchTxInsights, fetchRepairTickets])

  // polling แบบเรียลไทม์ (ทุก 20 วินาที) — รีเฟรชการ์ดสรุป + สินทรัพย์ด้วย
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPendingReviews(true)
      fetchSummary()
      fetchRentals(true)
      fetchOverdue()
      fetchTxInsights()
      fetchRepairTickets(true)
    }, 20000)
    return () => clearInterval(timer)
  }, [fetchPendingReviews, fetchSummary, fetchRentals, fetchOverdue, fetchTxInsights, fetchRepairTickets])

  const handleReviewTransaction = async (id, newStatus) => {
    if (!id) return false
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
      return true
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'อัปเดตสถานะไม่สำเร็จ' })
      return false
    } finally {
      setReviewing(null)
    }
  }

  // ออกใบเสร็จ PDF → อัปโหลด bucket receipts → ส่งรูปเข้ากลุ่ม LINE
  // failToast: ข้อความ toast เมื่อขั้นตอนใด ๆ พัง (คนละ flow ใช้คนละข้อความ)
  const issueReceiptAndSend = async ({ txId, custName, itemDetails, period, totalAmount, paidAmount, paidAt, failToast }) => {
    try {
      const blob = createReceiptPdf({
        custName,
        itemDetails,
        period,
        totalAmount,
        paidAmount,
        txId,
        paidAt,
        businessName: paymentInfo.business_name,
        ownerName: paymentInfo.owner_name,
        address: paymentInfo.address,
      })
      const path = `${txId}.pdf`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, blob, { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw uploadError
      const { data: publicData } = supabase.storage.from('receipts').getPublicUrl(path)
      const { data, error } = await supabase.rpc('send_receipt_to_line', { p_tx_id: txId, p_public_url: publicData?.publicUrl })
      if (error) throw error
      if (data?.ok === false && data?.error === 'no_group') {
        setToast({ type: 'warning', message: 'บิลนี้ยังไม่ได้ผูกกลุ่ม LINE — ใบเสร็จถูกบันทึกแล้ว' })
        return
      }
      if (data?.ok === false) throw new Error(data?.error || 'send_receipt_to_line failed')
      setToast({ type: 'success', message: 'ส่งใบเสร็จเข้า LINE แล้ว' })
    } catch (err) {
      console.error('Issue receipt failed:', err)
      setToast(failToast || { type: 'error', message: 'ส่งใบเสร็จไม่สำเร็จ' })
    }
  }

  // กดอนุมัติ: ทำงานเดิมก่อน แล้วออกใบเสร็จส่งเข้าไลน์เฉพาะเมื่ออนุมัติสำเร็จ
  // (ถ้าขั้นใบเสร็จพัง แค่ toast เตือน — ไม่กระทบสถานะบิลที่อนุมัติไปแล้ว)
  const handleApproveWithReceipt = async (item) => {
    if (!item?.id) return
    const ok = await handleReviewTransaction(item.id, 'paid')
    if (!ok) return
    const rental = Array.isArray(item.rentals) ? item.rentals[0] : item.rentals
    const total = Number(item.total_amount || item.base_amount || 0)
    await issueReceiptAndSend({
      txId: item.id,
      custName: rental?.cust_name || item.cust_name || 'ไม่ระบุ',
      itemDetails: displayAssetName(rental || item),
      period: item.period ? formatPeriod(item.period) : '',
      totalAmount: total,
      paidAmount: Number(item.paid_amount) > 0 ? Number(item.paid_amount) : total,
      paidAt: new Date().toISOString(),
      failToast: { type: 'warning', message: 'อนุมัติสำเร็จ แต่ส่งใบเสร็จไม่ได้' },
    })
  }

  const handleCreateBill = async (rental, meters, sendToLine = true, periodArg) => {
    setToast(null)
    try {
      const amount = Number(getValue(rental, AMOUNT_KEYS))
      const period = periodArg || currentPeriod()
      const secureToken = generateSecureToken()
      const custName = getValue(rental, ['cust_name', 'tenant_name', 'customer', 'customer_name', 'name']) ?? 'ไม่ระบุ'
      const itemDetails = displayAssetName({ sub_label: rental?.sub_label, item_details: getValue(rental, ['item_details', 'property_name', 'property', 'unit', 'room']) })
      const { data: rentalGroup } = await supabase
        .from('rentals')
        .select('group_id')
        .eq('id', rental.id)
        .maybeSingle()
      const lineGroupId = rentalGroup?.group_id || ''

      // ค่าน้ำไฟคิดเฉพาะ property — vehicle/other บังคับข้าม (แม้ข้อมูลเก่าตั้ง utility_enabled ไว้)
      const utilityEnabled = Boolean(rental.utility_enabled) && normalizeBizType(rental.biz_type) === 'property'
      const lastWater = Number(rental.last_water_meter) || 0
      const lastElec = Number(rental.last_elec_meter) || 0
      const waterCurrent = utilityEnabled ? Number(meters?.waterCurrent) || 0 : 0
      const elecCurrent = utilityEnabled ? Number(meters?.elecCurrent) || 0 : 0
      const waterUnits = utilityEnabled ? Math.max(0, waterCurrent - lastWater) : 0
      const waterCost = utilityEnabled ? waterUnits * (Number(rental.water_rate) || 0) : 0
      const elecUnits = utilityEnabled ? Math.max(0, elecCurrent - lastElec) : 0
      const elecCost = utilityEnabled ? elecUnits * (Number(rental.elec_rate) || 0) : 0
      const totalAmount = amount + waterCost + elecCost

      // guard: กันสร้างบิลซ้ำงวดเดิม — เทียบทั้งค่า ISO ที่บันทึกใหม่และค่าเดิมฟอร์แมตไทย
      const periodLabel = formatPeriod(period)
      const { data: existingTxs } = await supabase
        .from('transactions')
        .select('id, period')
        .eq('rental_id', rental.id)
      if ((existingTxs || []).some((t) => t.period === period || t.period === periodLabel)) {
        setToast({ type: 'warning', message: `งวดนี้มีบิลอยู่แล้ว (${periodLabel}) — ไม่สามารถสร้างบิลซ้ำได้` })
        setBillRental(null)
        return
      }

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
      if (insertError) {
        // ชน unique constraint ที่ตรวจไม่ทัน (เช่น สร้างพร้อมกันสองที่)
        if (insertError.code === '23505' || /uniq_tx_rental_period/i.test(insertError.message || '')) {
          setToast({ type: 'warning', message: `งวดนี้มีบิลอยู่แล้ว (${periodLabel}) — ไม่สามารถสร้างบิลซ้ำได้` })
          setBillRental(null)
          return
        }
        throw insertError
      }

      // อัปเดตเลขมิเตอร์ล่าสุดใน rentals สำหรับเดือนถัดไป
      if (utilityEnabled) {
        const { error: updateError } = await supabase
          .from('rentals')
          .update({ last_water_meter: waterCurrent, last_elec_meter: elecCurrent })
          .eq('id', rental.id)
        if (updateError) throw updateError
        fetchRentals()
      }

      const billLink = (import.meta.env.VITE_BILL_BASE_URL || window.location.origin) + '/bill/' + secureToken
      const isBank = paymentInfo.payment_type === 'bank'
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
        billLink,
        status: 'unpaid',
        sent: false,
      }

      // ส่งเข้าไลน์อัตโนมัติ (ถ้าเลือก) ผ่าน Supabase RPC
      if (sendToLine) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc('send_bill_to_line', { p_tx_id: tx.id })
          if (rpcError) throw rpcError
          if (rpcData?.ok === false && rpcData?.error === 'no_group') {
            setToast({ type: 'warning', message: 'สร้างบิลแล้ว แต่ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE — ส่งไม่ได้' })
          } else if (rpcData?.ok === false) {
            setToast({ type: 'error', message: 'ส่งบิลเข้าไลน์ไม่สำเร็จ' })
          } else {
            invoiceObj.sent = true
            setToast({ type: 'success', message: 'ส่งบิลเข้า LINE แล้ว' })
          }
        } catch (err) {
          console.error('Auto LINE send failed:', err)
          setToast({ type: 'error', message: 'ส่งบิลเข้าไลน์ไม่สำเร็จ' })
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
    const link = (import.meta.env.VITE_BILL_BASE_URL || window.location.origin) + '/bill/' + token
    try {
      await navigator.clipboard.writeText(link)
      setToast({ type: 'success', message: 'คัดลอกลิงก์บิลแล้ว' })
    } catch {
      setToast({ type: 'error', message: 'คัดลอกลิงก์ไม่สำเร็จ' })
    }
  }

  const handleSendBillToLine = async () => {
    if (!invoice?.transactionId) return
    try {
      const { data, error } = await supabase.rpc('send_bill_to_line', { p_tx_id: invoice.transactionId })
      if (error) throw error
      if (data?.ok === false && data?.error === 'no_group') {
        setToast({ type: 'warning', message: 'ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE — ส่งไม่ได้' })
        return
      }
      if (data?.ok === false) throw new Error(data?.error || 'send_bill_to_line failed')
      setInvoice((prev) => ({ ...prev, sent: true }))
      setToast({ type: 'success', message: 'ส่งบิลเข้า LINE แล้ว' })
    } catch (err) {
      console.error('Send bill to LINE failed:', err)
      setToast({ type: 'error', message: 'ส่งบิลเข้าไลน์ไม่สำเร็จ' })
    }
  }

  const [sendingBillId, setSendingBillId] = useState(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const handleSendDueSoonReminders = async () => {
    setSendingReminder(true)
    setToast(null)
    try {
      const { data, error } = await supabase.rpc('send_due_soon_reminders')
      if (error) throw error
      if (data?.ok && Number(data.sent) > 0) {
        setToast({ type: 'success', message: `ส่งการแจ้งเตือน ${Number(data.sent)} รายการแล้ว` })
      } else {
        setToast({ type: 'info', message: 'ไม่มีบิลที่ต้องเตือนวันนี้' })
      }
    } catch (err) {
      console.error('Send due-soon reminders failed:', err)
      setToast({ type: 'error', message: 'ส่งการแจ้งเตือนไม่สำเร็จ' })
    } finally {
      setSendingReminder(false)
    }
  }
  const handleSendOverdueBill = async (txId) => {
    if (!txId) return
    setSendingBillId(txId)
    setToast(null)
    try {
      const { data, error } = await supabase.rpc('send_bill_to_line', { p_tx_id: txId })
      if (error) throw error
      if (data?.ok === false && data?.error === 'no_group') {
        setToast({ type: 'warning', message: 'ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE — ส่งไม่ได้' })
        return
      }
      if (data?.ok === false) throw new Error(data?.error || 'send_bill_to_line failed')
      setToast({ type: 'success', message: 'ส่งบิลเข้า LINE แล้ว' })
    } catch (err) {
      console.error('Send bill to LINE failed:', err)
      setToast({ type: 'error', message: 'ส่งบิลเข้าไลน์ไม่สำเร็จ' })
    } finally {
      setSendingBillId(null)
    }
  }

  // แก้ยอดบิล (เฉพาะ unpaid) — เรียก RPC update_bill_amount แล้วรีเฟรชสรุป
  const handleEditBillAmount = async ({ waterCost, elecCost, extraCharges, reason }) => {
    if (!invoice?.transactionId) return false
    setToast(null)
    try {
      const { data, error } = await supabase.rpc('update_bill_amount', {
        p_tx_id: invoice.transactionId,
        p_water_cost: waterCost,
        p_elec_cost: elecCost,
        p_extra_charges: extraCharges,
        p_reason: reason,
      })
      if (error) throw error
      if (data?.ok === false) throw new Error(data?.error || 'update_bill_amount failed')
      const newTotal = (Number(invoice.baseAmount) || 0) + waterCost + elecCost + extraCharges
      setInvoice((prev) => ({ ...prev, total: newTotal, waterCost, elecCost, extraCharges, sent: false }))
      setToast({ type: 'success', message: `แก้ไขบิลแล้ว ยอดใหม่ ${formatCurrency(newTotal)} — ลิงก์บิลเดิมจะแสดงยอดใหม่อัตโนมัติ` })
      fetchSummary()
      fetchOverdue()
      return true
    } catch (err) {
      console.error('Edit bill amount failed:', err)
      setToast({ type: 'error', message: 'แก้ไขบิลไม่สำเร็จ' })
      return false
    }
  }

  // เริ่มทดลองใช้ฟรี 30 วัน (หน้าต้อนรับผู้ใช้ใหม่ที่ยังไม่มีแถวสมาชิก)
  const handleStartTrial = async () => {
    setStartingTrial(true)
    setTrialNotice(null)
    setToast(null)
    try {
      const { data, error } = await supabase.rpc('start_trial')
      if (error) throw error
      if (data?.ok === false) {
        if (data?.error === 'already_registered') {
          setTrialNotice('อีเมลนี้เคยสมัครแล้ว')
          return
        }
        throw new Error(data?.error || 'start_trial failed')
      }
      setToast({ type: 'success', message: 'เริ่มทดลองใช้ฟรี 30 วันแล้ว — ยินดีต้อนรับ!' })
      await fetchMembership()
    } catch (err) {
      console.error('Start trial failed:', err)
      setToast({ type: 'error', message: 'เริ่มทดลองใช้ไม่สำเร็จ' })
    } finally {
      setStartingTrial(false)
    }
  }

  // gate จำนวนห้องตามแพ็กเกจ — ใช้แล้วครบ room_limit ไม่ให้เปิดฟอร์มเพิ่มสินทรัพย์
  const handleOpenAddForm = () => {
    const used = rentals.length
    const limit = Number(membership?.room_limit)
    if (membership?.ok && Number.isFinite(limit) && limit > 0 && used >= limit) {
      setToast({ type: 'warning', message: `ครบจำนวนห้องของแพ็กเกจแล้ว (ใช้ ${used}/${limit} ห้อง) — อัปเกรดเพื่อเพิ่มห้อง` })
      return
    }
    setIsAddOpen(true)
  }

  const location = useLocation()
  const isAssets = location.pathname === '/assets'
  const isSettings = location.pathname === '/settings'
  const isAudit = location.pathname === '/audit'
  const isMembership = location.pathname === '/membership'
  const isAdmin = location.pathname === '/admin'

  const stats = useMemo(() => computeStats(rentals), [rentals])
  const expiringLeases = useMemo(() => {
    return (rentals || []).filter((r) => r?.lease_end_date && String(r?.room_status ?? '').toLowerCase() !== 'vacant' && isExpiringSoon(r.lease_end_date))
  }, [rentals])

  // อัตราเก็บเงินได้ = ยอด paid เดือนนี้ ÷ ยอดบิลทั้งหมดของเดือนนี้ ×100 (คำนวณจาก summary ที่โหลดแล้ว)
  const collectionRate = useMemo(() => {
    const monthly = Array.isArray(summary.monthly) ? summary.monthly : []
    const cur = monthly[monthly.length - 1]
    const paid = Number(summary.paidThisMonth) || 0
    const billed = cur ? (Number(cur.paid) || 0) + (Number(cur.outstanding) || 0) : paid
    if (billed <= 0) return null
    return (paid / billed) * 100
  }, [summary])

  // รายรับ 6 เดือนแยกตาม biz_type (paid เท่านั้น) — หน้าต่างเดือนเดียวกับ fetchSummary เพื่อให้สองกราฟตรงกัน
  const monthlyByType = useMemo(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const dataMonths = new Set()
    for (const tx of txInsights) {
      const mk = txMonthKey(tx)
      if (mk) dataMonths.add(mk)
    }
    const now = new Date()
    const browserKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    const currentMonthKey = dataMonths.has(browserKey) || dataMonths.size === 0
      ? browserKey
      : [...dataMonths].sort().pop()

    const monthly = []
    const monthMap = {}
    const [curYear, curMonth] = currentMonthKey.split('-').map(Number)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - 1 - i, 1)
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      const item = { key, label: THAI_MONTHS[d.getMonth()], property: 0, vehicle: 0, other: 0 }
      monthly.push(item)
      monthMap[key] = item
    }
    for (const tx of txInsights) {
      if (String(tx?.status ?? '').toLowerCase() !== 'paid') continue
      const item = txMonthKey(tx) ? monthMap[txMonthKey(tx)] : null
      if (!item) continue
      const rental = Array.isArray(tx.rentals) ? tx.rentals[0] : tx.rentals
      item[normalizeBizType(rental?.biz_type)] += Number(tx.total_amount ?? tx.base_amount ?? 0) || 0
    }
    return monthly
  }, [txInsights])

  // อายุหนี้: บิล unpaid ที่เลยวันครบกำหนด แบ่ง 1-30 / 31-60 / 60+ วัน (จำนวนบิล + ยอดรวมต่อช่วง)
  const agingBuckets = useMemo(() => {
    const buckets = [
      { key: '1-30', name: '1-30 วัน', count: 0, total: 0, color: '#f59e0b' },
      { key: '31-60', name: '31-60 วัน', count: 0, total: 0, color: '#f97316' },
      { key: '60+', name: 'เกิน 60 วัน', count: 0, total: 0, color: '#f43f5e' },
    ]
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (const tx of txInsights) {
      if (String(tx?.status ?? '').toLowerCase() !== 'unpaid') continue
      const due = billDueDate(tx)
      if (!due || Number.isNaN(due.getTime())) continue
      const dueDay = new Date(due)
      dueDay.setHours(0, 0, 0, 0)
      const daysOver = Math.floor((today.getTime() - dueDay.getTime()) / 86400000)
      if (daysOver <= 0) continue
      const bucket = daysOver <= 30 ? buckets[0] : daysOver <= 60 ? buckets[1] : buckets[2]
      bucket.count += 1
      bucket.total += Number(tx.total_amount ?? tx.base_amount ?? 0) || 0
    }
    return buckets
  }, [txInsights])

  const statCards = [
    { icon: 'banknotes', label: 'รายรับเดือนนี้', value: formatCurrency(summary.paidThisMonth), tone: 'green', onClick: () => setShowMonthly(true) },
    { icon: 'chart', label: 'อัตราเก็บเงินได้', value: collectionRate === null ? '—' : `${Math.round(collectionRate)}%`, tone: collectionRate === null ? 'blue' : collectionRate >= 90 ? 'green' : collectionRate >= 70 ? 'yellow' : 'red' },
    { icon: 'warning', label: 'ยอดค้างชำระรวม', value: formatCurrency(summary.outstanding), tone: 'red' },
    { icon: 'home', label: 'ห้องค้างชำระเกิน 15 วัน', value: overdueBills.length, tone: 'orange' },
    { icon: 'check', label: 'รอตรวจสลิป', value: pendingReviews.length, tone: pendingReviews.length > 0 ? 'yellow' : 'green' },
  ]

  // membership gate: กำลังโหลดสถานะ → จอว่าง, ยังไม่มีแถวสมาชิก → หน้าเริ่มทดลองใช้ฟรี
  if (!membership) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  if (membership.ok === false) {
    return (
      <>
        <TrialWelcomeScreen
          starting={startingTrial}
          notice={trialNotice}
          onStart={handleStartTrial}
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toast toast={toast} onClose={closeToast} />
      </>
    )
  }

  // สมาชิกหมดอายุ (status อัปเดตโดย cron check_membership_expiry ฝั่ง DB) → ล็อคหน้า dashboard
  // (ยกเว้นหน้า /membership — ต้องเข้าได้เพื่อต่ออายุ หน้านั้นมีแถบแดงเตือนเองอยู่แล้ว)
  if (String(membership.status ?? '').toLowerCase() === 'expired' && !isMembership) {
    return (
      <>
        <ExpiredScreen
          promptpayNumber={paymentInfo.promptpay}
          onSignOut={() => supabase.auth.signOut()}
        />
        <Toast toast={toast} onClose={closeToast} />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar businessName={paymentInfo.business_name} membership={membership} />

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 lg:hidden">
                <Icon name="building" className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                {/* มือถือ/แท็บเล็ต: โชว์ชื่อธุรกิจ — เดสก์ท็อปคงหัวข้อหน้าเดิมไว้ */}
                <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl lg:hidden">
                  {paymentInfo.business_name || 'PayRentPro'}
                </h1>
                <h1 className="hidden text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl lg:block">
                  {isAudit ? 'ประวัติแก้ไข' : isSettings ? 'ตั้งค่าบัญชี' : isAssets ? 'รายการสินทรัพย์' : isMembership ? 'สมาชิกของฉัน' : isAdmin ? 'ผู้ดูแลระบบ' : 'แดชบอร์ด'}
                </h1>
                <p className="hidden text-sm text-gray-500 dark:text-gray-400 lg:block">
                  {isAudit ? 'บันทึกการแก้ไขยอดและเหตุผล' : isSettings ? 'ตั้งค่าเลขพร้อมเพย์ / บัญชีธนาคารสำหรับรับเงิน' : isAssets ? 'จัดการสัญญาเช่าและสินทรัพย์ทั้งหมด' : isMembership ? 'แพ็กเกจ การใช้งาน และการต่ออายุ' : isAdmin ? 'จัดการสมาชิกและค่าสมาชิกรอตรวจทั้งหมด' : 'ภาพรวมการเก็บค่าเช่าและการติดตามหนี้'}
                </p>
              </div>
            </div>

            {/* whitespace-nowrap กันข้อความปุ่มตัดบรรทัด (ทำให้ header สูงขึ้น)
                แต่ไม่ใส่ shrink-0 เพื่อให้ช่องค้นหาหน้า Assets ย่อได้ ไม่ดันจนล้นที่ 1280 */}
            <div className="flex min-w-0 items-center gap-2 whitespace-nowrap sm:gap-3">
              <NotificationsBell pendingReviews={pendingReviews} expiringLeases={expiringLeases} />

              {/* มือถือ/แท็บเล็ต: ปุ่มรองทั้งหมดยุบเข้าเมนู ⋯ (เหลือ ชื่อ + กระดิ่ง + ⋯) */}
              <HeaderOverflowMenu
                onExportCsv={!isAssets && !isSettings && !isAudit && !isMembership && !isAdmin ? handleExportCsv : null}
                onRefresh={() => { fetchRentals(); fetchSummary(); fetchPendingReviews(); fetchTxInsights(); fetchRepairTickets() }}
                loading={loading}
                lastUpdated={lastUpdated}
                largeText={largeText}
                onToggleLargeText={toggleLargeText}
                theme={theme}
                onToggleTheme={toggleTheme}
              />

              {/* เดสก์ท็อป (lg+): แถวปุ่มเดิมทั้งหมด ไม่แตะ */}
              {!isAssets && !isSettings && !isAudit && !isMembership && !isAdmin && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="hidden items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:inline-flex"
                >
                  ⬇️ Export CSV
                </button>
              )}
              {lastUpdated && (
                <p className="hidden text-xs text-gray-400 lg:block">
                  อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH')}
                </p>
              )}
              {isAssets && (
                <div className="relative hidden min-w-0 flex-1 lg:block lg:max-w-xs xl:max-w-sm">
                  <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="ค้นหาชื่อผู้เช่า / ห้อง"
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-11 pr-4 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              )}
              {isAssets && (
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm shadow-blue-600/30 transition-colors hover:bg-blue-500 lg:inline-flex"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  เพิ่มสินทรัพย์
                </button>
              )}
              <button
                type="button"
                onClick={() => { fetchRentals(); fetchSummary(); fetchPendingReviews(); fetchTxInsights(); fetchRepairTickets() }}
                disabled={loading}
                className="hidden items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
              >
                <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden xl:inline">รีเฟรชข้อมูล</span>
              </button>
              <button
                type="button"
                onClick={toggleLargeText}
                title={largeText ? 'ปิดโหมดตัวอักษรขยาย' : 'เปิดโหมดตัวอักษรขยาย'}
                aria-label={largeText ? 'ปิดโหมดตัวอักษรขยาย' : 'เปิดโหมดตัวอักษรขยาย'}
                aria-pressed={largeText}
                className={`hidden items-center justify-center rounded-xl border px-4 py-2.5 text-base shadow-sm transition-colors lg:inline-flex ${
                  largeText
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 underline decoration-2 underline-offset-4'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span aria-hidden="true" className="text-lg font-extrabold leading-none">
                  A<span className="align-super text-[0.6em] font-bold">+</span>
                </span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                title={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
                aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
                className="hidden items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-base shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:inline-flex"
              >
                <span className="leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
              </button>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="hidden items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:inline-flex"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                <span className="hidden xl:inline">ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </header>

        {/* ปุ่มเพิ่มสินทรัพย์ของหน้า Assets — มือถือ/แท็บเล็ตวางเป็นแถวเต็มความกว้างใต้ header */}
        {isAssets && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:hidden">
            <button
              type="button"
              onClick={handleOpenAddForm}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-blue-600/30 transition-colors hover:bg-blue-500"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              เพิ่มสินทรัพย์
            </button>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8">
          {isAudit ? (
            <AuditLogPage />
          ) : isSettings ? (
            <SettingsPage onSaved={fetchPaymentInfo} />
          ) : isMembership ? (
            <MembershipPage membership={membership} onToast={setToast} onRefreshMembership={fetchMembership} />
          ) : isAdmin ? (
            <AdminPage onToast={setToast} />
          ) : isAssets ? (
            <>
              <div className="relative lg:hidden">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                  placeholder="ค้นหาชื่อผู้เช่า / ห้อง"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-11 pr-4 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <LeaseExpirySection
                rentals={rentals}
                onRenew={setRenewRental}
                onMoveOut={(rental) => setConfirmAction({ type: 'moveout', rental })}
              />

              <AssetsView
                rentals={rentals}
                loading={loading}
                error={error}
                search={assetSearch}
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-5">
                {statCards.map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>

              <LeaseExpiryBand rentals={rentals} onViewDetails={setDetailRental} />

              <PendingReviewSection
                items={pendingReviews}
                loading={pendingLoading}
                error={pendingError}
                reviewing={reviewing}
                onApprove={(id) => handleApproveWithReceipt(pendingReviews.find((t) => t.id === id))}
                onReject={(id) => handleReviewTransaction(id, 'unpaid')}
                onRetry={fetchPendingReviews}
              />

              <RepairSection
                items={repairTickets}
                loading={repairLoading}
                error={repairError}
                completingId={completingRepairId}
                onComplete={handleCompleteRepair}
                onRetry={fetchRepairTickets}
              />

              <UrgentChaseSection
                overdue={overdueBills}
                sendingId={sendingBillId}
                onSendBill={handleSendOverdueBill}
                sendingReminder={sendingReminder}
                onSendReminders={handleSendDueSoonReminders}
              />

              <div className="mt-6">
                <AgingBarChart buckets={agingBuckets} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <OccupancyDonut occupied={stats.occupied} vacant={stats.vacant} />
                <RevenueBar monthly={monthlyByType} />
              </div>
            </>
          )}
        </main>
      </div>

      <BottomNav membership={membership} />

      {!pdpAccepted && <PDPAConsentModal onAccept={handleAcceptPDPA} />}

      <AddRentalModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onToast={setToast}
        onCreated={async ({ bindingCode, custName }) => {
          await fetchRentals(true)
          setBindingModal({ code: bindingCode, custName })
        }}
      />

      <InvoiceModal
        invoice={invoice}
        onClose={() => setInvoice(null)}
        onMarkPaid={handleMarkPaid}
        onCopyLink={handleCopyBillLink}
        onSendToLine={handleSendBillToLine}
        onIssueReceipt={async () => {
          if (!invoice?.transactionId) return
          await issueReceiptAndSend({
            txId: invoice.transactionId,
            custName: invoice.custName,
            itemDetails: invoice.itemDetails,
            period: invoice.period ? formatPeriod(invoice.period) : '',
            totalAmount: invoice.total,
            paidAmount: invoice.total,
            paidAt: new Date().toISOString(),
          })
        }}
        onEditAmount={handleEditBillAmount}
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
        onToast={setToast}
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
