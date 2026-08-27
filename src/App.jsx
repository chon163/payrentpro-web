import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

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

const BIZ_TYPES = ['อสังหาริมทรัพย์', 'ยานพาหนะ', 'อุปกรณ์']

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

function getValue(row, keys) {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

const currency = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 2,
})

function formatCurrency(value) {
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  return currency.format(n)
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

function computeStats(rows) {
  let totalAmount = 0
  let hasAmount = false
  let overdue = 0
  let paid = 0
  for (const row of rows) {
    const amount = getValue(row, AMOUNT_KEYS)
    const n = Number(amount)
    if (amount !== undefined && !Number.isNaN(n)) {
      totalAmount += n
      hasAmount = true
    }
    if (isOverdue(row)) overdue += 1
    if (isPaid(row)) paid += 1
  }
  return { total: rows.length, totalAmount: hasAmount ? totalAmount : null, overdue, paid }
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

function StatCard({ icon, label, value, iconClass, valueClass = 'text-gray-900' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg ${iconClass}`}>
          <Icon name={icon} className="h-6 w-6" />
        </div>
      </div>
    </div>
  )
}

const NAV_ITEMS = [
  { label: 'แดชบอร์ด', icon: 'home', active: true },
  { label: 'สัญญาเช่า', icon: 'document', active: false },
  { label: 'การแจ้งเตือน', icon: 'bell', active: false },
  { label: 'รายงาน', icon: 'chart', active: false },
]

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
          <button
            key={item.label}
            type="button"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              item.active
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </button>
        ))}
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

function RentalsTable({ rentals, loading, error, columns, onRetry, onGenerateBill, generatingId }) {
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
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="whitespace-nowrap px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {labelColumn(column)}
                  </th>
                ))}
                <th className="whitespace-nowrap px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {rentals.map((row, index) => (
                <tr key={row.id ?? index} className="transition-colors hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-6 py-4 text-sm">
                      {renderCell(column, row[column])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                      type="button"
                      onClick={() => onGenerateBill(row)}
                      disabled={generatingId === row.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {generatingId === row.id ? (
                        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0v2.25m-3.75 6h7.5m-7.5 3H12" />
                        </svg>
                      )}
                      สร้างบิล
                    </button>
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

const EMPTY_FORM = {
  biz_type: '',
  cust_name: '',
  item_details: '',
  amount: '',
  cycle: 'monthly',
  due_date: '',
  penalty_per_day: '',
}

const inputClass =
  'w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

function AddRentalModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('rentals').insert([
        {
          biz_type: form.biz_type,
          cust_name: form.cust_name.trim(),
          item_details: form.item_details.trim(),
          amount: Number(form.amount),
          cycle: form.cycle,
          due_date: Number(form.due_date),
          penalty_per_day: form.penalty_per_day === '' ? 0 : Number(form.penalty_per_day),
        },
      ])
      if (insertError) throw insertError
      onCreated()
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

            <div>
              <label htmlFor="biz_type" className="mb-1.5 block text-sm font-medium text-gray-700">
                ประเภทธุรกิจ <span className="text-rose-500">*</span>
              </label>
              <select id="biz_type" value={form.biz_type} onChange={updateField('biz_type')} required className={inputClass}>
                <option value="" disabled>เลือกประเภทธุรกิจ</option>
                {BIZ_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cust_name" className="mb-1.5 block text-sm font-medium text-gray-700">
                ชื่อผู้เช่า <span className="text-rose-500">*</span>
              </label>
              <input
                id="cust_name"
                type="text"
                value={form.cust_name}
                onChange={updateField('cust_name')}
                placeholder="เช่น นายสมชาย ใจดี"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="item_details" className="mb-1.5 block text-sm font-medium text-gray-700">
                รายละเอียดสินทรัพย์
              </label>
              <input
                id="item_details"
                type="text"
                value={form.item_details}
                onChange={updateField('item_details')}
                placeholder="เช่น ห้อง 401, รถ กก-1234"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700">
                  ค่าเช่า / ค่างวด <span className="text-rose-500">*</span>
                </label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={updateField('amount')}
                  placeholder="0.00"
                  required
                  className={inputClass}
                />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="due_date" className="mb-1.5 block text-sm font-medium text-gray-700">
                  วันครบกำหนด (1-31) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="due_date"
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  value={form.due_date}
                  onChange={updateField('due_date')}
                  placeholder="เช่น 1"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="penalty_per_day" className="mb-1.5 block text-sm font-medium text-gray-700">
                  ค่าปรับต่อวัน
                </label>
                <input
                  id="penalty_per_day"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.penalty_per_day}
                  onChange={updateField('penalty_per_day')}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            </div>
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

function InvoiceModal({ invoice, onClose, onMarkPaid, onCopyLink }) {
  const [marking, setMarking] = useState(false)
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
            <p className="font-mono text-sm text-gray-500">081-234-5678</p>
          </div>
        </div>
        <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
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

  return (
    <div className="fixed bottom-6 left-1/2 z-[60] w-full max-w-sm -translate-x-1/2 px-4">
      <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
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
  const [generatingId, setGeneratingId] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [toast, setToast] = useState(null)

  const fetchRentals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: supabaseError } = await supabase.from('rentals').select('*')
      if (supabaseError) throw supabaseError
      setRentals(Array.isArray(data) ? data : [])
      setLastUpdated(new Date())
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRentals()
  }, [fetchRentals])

  const closeToast = useCallback(() => setToast(null), [])

  const handleGenerateBill = async (row) => {
    setGeneratingId(row.id)
    setToast(null)
    try {
      const amount = Number(getValue(row, AMOUNT_KEYS))
      const period = currentPeriod()
      const secureToken = generateSecureToken()
      const custName = getValue(row, ['cust_name', 'tenant_name', 'customer', 'customer_name', 'name']) ?? 'ไม่ระบุ'
      const itemDetails = getValue(row, ['item_details', 'property_name', 'property', 'unit', 'room']) ?? 'ไม่ระบุ'
      const { data: tx, error: insertError } = await supabase
        .from('transactions')
        .insert([{ base_amount: amount, status: 'unpaid', period, secure_token: secureToken, rental_id: row.id }])
        .select()
        .single()
      if (insertError) throw insertError

      const billLink = `http://localhost:5173/bill/${secureToken}`

      setInvoice({
        transactionId: tx.id,
        secureToken,
        custName,
        itemDetails,
        total: amount,
        period,
        qrUrl: `https://promptpay.io/0812345678/${amount}.png`,
        status: 'unpaid',
      })

      // ส่ง Webhook แบบ background (เงียบ ๆ ไม่แสดงผลกับผู้ใช้)
      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL
      if (webhookUrl) {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_bill',
            rental_id: row.id,
            cust_name: custName,
            item_details: itemDetails,
            total_amount: amount,
            bill_link: billLink,
          }),
        }).catch((err) => {
          console.error('Webhook request failed:', err)
        })
      }
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'สร้างบิลไม่สำเร็จ' })
    } finally {
      setGeneratingId(null)
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

  const stats = useMemo(() => computeStats(rentals), [rentals])
  const columns = useMemo(() => (rentals.length ? Object.keys(rentals[0]) : []), [rentals])

  const statCards = [
    { icon: 'document', label: 'สัญญาเช่าทั้งหมด', value: stats.total, iconClass: 'bg-indigo-600 shadow-indigo-600/30' },
    {
      icon: 'banknotes',
      label: 'ยอดค่าเช่ารวม',
      value: stats.totalAmount === null ? '—' : formatCurrency(stats.totalAmount),
      iconClass: 'bg-violet-600 shadow-violet-600/30',
    },
    { icon: 'warning', label: 'ค้างชำระ / เกินกำหนด', value: stats.overdue, iconClass: 'bg-rose-500 shadow-rose-500/30', valueClass: 'text-rose-600' },
    { icon: 'check', label: 'ชำระแล้ว', value: stats.paid, iconClass: 'bg-emerald-500 shadow-emerald-500/30', valueClass: 'text-emerald-600' },
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
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">แดชบอร์ด</h1>
                <p className="text-sm text-gray-500">ภาพรวมการเก็บค่าเช่าและการติดตามหนี้</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {lastUpdated && (
                <p className="hidden text-xs text-gray-400 sm:block">
                  อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH')}
                </p>
              )}
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
              <button
                type="button"
                onClick={fetchRentals}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <RentalsTable
            rentals={rentals}
            loading={loading}
            error={error}
            columns={columns}
            onRetry={fetchRentals}
            onGenerateBill={handleGenerateBill}
            generatingId={generatingId}
          />
        </main>
      </div>

      <AddRentalModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={fetchRentals}
      />

      <InvoiceModal
        invoice={invoice}
        onClose={() => setInvoice(null)}
        onMarkPaid={handleMarkPaid}
        onCopyLink={handleCopyBillLink}
      />

      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}

export default App
