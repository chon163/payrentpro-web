import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from './supabaseClient'
import { BANKS, bankName } from './payment'
import AuthPage from './AuthPage'
import { createPromptpayQR } from './utils/promptpay'
import { createReceiptPdf, createReceiptPng, receiptItemsFromTx } from './utils/receipt'
import { THAI_MONTHS, currentPeriod, formatPeriod, billDueDate as billDueDateFromPeriod } from './utils/period'
import { displayAssetName } from './utils/assetName'
import { DEMO_ACCOUNT_EMAIL } from './utils/demoAccount'
import { useTheme, useChartTheme } from './theme'
import { CloseButton, EmptyState, Field, Icon, Modal } from './components/ui'
import { BTN, MODAL_INPUT_CLS as inputClass } from './components/styles'
import FinancePage from './pages/FinancePage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import NotesPage from './pages/NotesPage'
import DocumentsPage from './pages/DocumentsPage'
import { BIZ_TYPES, CYCLE_LABELS, normalizeBizType, bizTypeMeta, bizTypeEmoji, countByStatus, isVacant, buildMoveOutPatch, buildMoveOutNote } from './utils/asset'
import { AddAssetModal } from './modals/AddAssetModal'
import { AddTenantModal } from './modals/AddTenantModal'
import { UtilityBillModal } from './modals/UtilityBillModal'
import { UtilityListModal } from './modals/UtilityListModal'
import { MobileDashboard } from './components/MobileDashboard'
import { MobileSlipReview } from './components/MobileSlipReview'
import { MobileUtilityInput } from './components/MobileUtilityInput'
import { MobileOverdueList } from './components/MobileOverdueList'
import { ErrorBoundary } from './components/ErrorBoundary'
import { formatCurrency as formatCurrencyUtil, isBillOpen } from './utils/format'


const STATUS_LABELS = {
  paid: 'ชำระแล้ว',
  pending_review: 'รอตรวจสลิป',
  pending: 'รอชำระ',
  overdue: 'เกินกำหนด',
  late: 'เกินกำหนด',
  unpaid: 'ยังไม่ชำระ',
  // 'rejected' เป็นสถานะเก่าจากปุ่มปฏิเสธบนมือถือ (ปัจจุบันใช้ 'unpaid' ทั้งสองฝั่งแล้ว)
  // เก็บ label ไว้กันข้อมูลเดิมใน DB แสดงเป็นภาษาอังกฤษดิบๆ
  rejected: 'ปฏิเสธแล้ว',
  draft: 'ร่างบิล',
  active: 'ใช้งานอยู่',
  inactive: 'ไม่ใช้งาน',
  cancelled: 'ยกเลิก',
  canceled: 'ยกเลิก',
}

// BIZ_TYPES, CYCLE_LABELS, normalizeBizType, bizTypeMeta ย้ายไป src/utils/asset.js แล้ว

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
  return formatCurrencyUtil(value)
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// วันที่ + เวลา (นาที) — ใช้ในประวัติเข้าใช้งาน ที่ต้องรู้ว่าเข้าตอนไหนของวัน
// formatDate ให้แค่วันที่ จึงแยกฟังก์ชันไว้ ไม่ไปแก้ของเดิมที่ใช้อยู่หลายที่
function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d)
}

// ป้ายการกระทำในประวัติเข้าใช้งาน — เข้า=เขียว ออก=เทา
const ACTIVITY_ACTIONS = {
  login: { label: 'เข้าสู่ระบบ', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' },
  logout: { label: 'ออกจากระบบ', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' },
}

// ที่มาของการเข้าระบบ (detail ที่ log_activity บันทึกไว้) → ข้อความไทย
const ACTIVITY_DETAILS = {
  google: 'Google',
  email: 'ลิงก์ทางอีเมล',
  magic_link: 'ลิงก์ทางอีเมล',
  demo: 'โหมดเดโม่',
}

// log ก่อน signOut เพราะหลัง signOut ไม่มี JWT แล้ว เรียก RPC ไม่ได้อีก
// (await ตัว log ก่อน แต่ห่อ try ไว้ — log ล้มต้องไม่ขัดการออกจากระบบ)
async function signOutWithLog() {
  try {
    await supabase.rpc('log_activity', { p_action: 'logout' })
  } catch (err) {
    console.warn('Log logout failed:', err?.message)
  }
  await supabase.auth.signOut()
}

function generateSecureToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// generateSecureToken ยังใช้ใน handleCreateBill — เก็บไว้ที่นี่

function normalizeStatus(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  // เช็ค exact ก่อน substring — ไม่งั้น 'unpaid'.includes('paid') ทำให้บิลค้างชำระ
  // กลายเป็น "ชำระแล้ว" เพราะชนกับ key 'paid' ก่อนเสมอ
  if (Object.prototype.hasOwnProperty.call(STATUS_LABELS, raw)) {
    return { key: raw, label: STATUS_LABELS[raw] }
  }
  for (const [key, label] of Object.entries(STATUS_LABELS)) {
    if (raw.includes(key)) return { key, label }
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
  else if (/(active|ใช้งาน)/.test(raw)) classes = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70'
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
// + วันส่งบิลของห้อง (bill_day ก่อน ตาม DB coalesce(r.bill_day, r.due_date, 1))
// fallbackRental = ใช้เมื่อ tx ไม่ได้ embed rentals มา (เช่น tx จาก r.transactions ในหน้ามือถือ)
function billDueDate(tx, fallbackRental) {
  const rental = (Array.isArray(tx?.rentals) ? tx.rentals[0] : tx?.rentals) || fallbackRental
  const mk = txMonthKey(tx)
  if (!mk) return tx?.created_at ? new Date(tx.created_at) : null
  const dueMs = billDueDateFromPeriod(mk, rental?.bill_day ?? rental?.due_date)
  if (dueMs) return new Date(dueMs)
  return tx?.created_at ? new Date(tx.created_at) : null
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
      return <span className="font-semibold text-emerald-700 dark:text-emerald-300">วันที่ {day}</span>
    }
    return <span className="text-gray-600 dark:text-gray-400">{formatDate(value)}</span>
  }
  if (key === 'cycle') {
    return <span className="text-gray-700 dark:text-gray-300">{CYCLE_LABELS[value] ?? String(value)}</span>
  }
  if (isAmountColumn(key)) return <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(value)}</span>
  if (isDateColumn(key)) return <span className="text-gray-600 dark:text-gray-400">{formatDate(value)}</span>
  if (typeof value === 'boolean') return <span className="text-gray-600 dark:text-gray-400">{value ? <Icon name="check" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <Icon name="close" className="h-4 w-4 text-gray-300" />}</span>
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

// การ์ด KPI แถวบนสุดของแดชบอร์ด — พื้นขาว แถบสีทางซ้าย ไอคอนมุมขวา (ดู tmp/dashboard-guide.md)
const KPI_TONES = {
  emerald: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  green: { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' },
  red: { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300' },
  orange: { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300' },
  yellow: { bar: 'bg-yellow-400', icon: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300' },
}

function KpiCard({ icon, label, value, hint, tone = 'emerald', onClick }) {
  const t = KPI_TONES[tone] || KPI_TONES.emerald
  const inner = (
    <>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2 pl-2.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{hint}</p> : null}
        </div>
        {/* ไอคอนย่อลงที่ 375px เพื่อให้ตัวเลขคงขนาดได้ในการ์ด 2 คอลัมน์ */}
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${t.icon}`}>
          <Icon name={icon} className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      </div>
    </>
  )
  const cls =
    'relative w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:p-5'
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  }
  return <div className={cls}>{inner}</div>
}

// การ์ดสถานะห้อง — พื้นไล่สีทึบ ตัวอักษรขาว (แถวที่สองของแดชบอร์ด)
const ROOM_TONES = {
  green: 'from-emerald-500 to-green-600 shadow-emerald-500/25',
  red: 'from-rose-500 to-red-600 shadow-rose-500/25',
  orange: 'from-amber-500 to-orange-600 shadow-amber-500/25',
  slate: 'from-slate-500 to-gray-600 shadow-slate-500/25',
}

function RoomStatusCard({ icon, label, value, hint, tone = 'slate', onClick }) {
  const grad = ROOM_TONES[tone] || ROOM_TONES.slate
  const inner = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-white/80 sm:text-sm">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">{value}</p>
        {hint ? <p className="mt-1 truncate text-xs text-white/70">{hint}</p> : null}
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white sm:h-11 sm:w-11">
        <Icon name={icon} className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
    </div>
  )
  const cls = `w-full rounded-2xl bg-gradient-to-br p-4 text-left shadow-lg transition-transform hover:-translate-y-0.5 sm:p-5 ${grad}`
  if (onClick) {
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>
  }
  return <div className={cls}>{inner}</div>
}

// กรอบการ์ดมาตรฐานของแดชบอร์ด — หัวเรื่อง + คำอธิบาย
function PanelCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

// "สรุปด่วน" — รายการแถวพื้นสีอ่อน กดแล้วไปยังส่วนที่เกี่ยวข้อง
const QUICK_TONES = {
  amber: { row: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/25 dark:hover:bg-amber-950/40', icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', value: 'text-amber-700 dark:text-amber-300' },
  rose: { row: 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/25 dark:hover:bg-rose-950/40', icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', value: 'text-rose-700 dark:text-rose-300' },
  sky: { row: 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/25 dark:hover:bg-sky-950/40', icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300', value: 'text-sky-700 dark:text-sky-300' },
  emerald: { row: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40', icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', value: 'text-emerald-700 dark:text-emerald-300' },
}

function QuickSummaryCard({ items }) {
  return (
    <PanelCard title="สรุปด่วน" subtitle="งานที่ต้องจัดการวันนี้">
      <div className="flex flex-col gap-2.5 p-4 sm:p-5">
        {items.map((it) => {
          const t = QUICK_TONES[it.tone] || QUICK_TONES.sky
          const El = it.onClick ? 'button' : NavLink
          return (
            <El
              key={it.label}
              to={it.to}
              onClick={it.onClick}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${t.row}`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>
                <Icon name={it.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{it.label}</span>
                {it.hint ? <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{it.hint}</span> : null}
              </span>
              <span className={`shrink-0 text-lg font-bold tabular-nums ${t.value}`}>{it.value}</span>
              <span aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500">›</span>
            </El>
          )
        })}
      </div>
    </PanelCard>
  )
}

// สถานะว่างของหน้างานค้าง — เดิมส่วนพวกนี้ return null เมื่อไม่มีรายการ (เพราะซ้อนอยู่ในแดชบอร์ด)
// พอแยกเป็นหน้าของตัวเองแล้ว หน้าว่างเปล่าจะดูเหมือนโหลดไม่ขึ้น จึงต้องบอกว่า "ไม่มีงานค้าง"
function TaskEmptyCard({ icon = 'check', title, hint }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      {hint ? <p className="mx-auto mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </section>
  )
}

// แถบลิงก์ "ดูทั้งหมด" — แทนการ์ดย่อ "ล่าสุด" ที่ถอดออกจากหน้างานค้างแล้ว
// คงเหลือทางเข้าเบา ๆ ไปหน้าเต็ม (ทุกสถานะ / แยกตามเดือน) โดยไม่กินพื้นที่เท่าการ์ดรายการ
function SeeAllLinkBar({ to, tone = 'sky', children }) {
  const tones = {
    sky: 'border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800/70 dark:text-sky-300 dark:hover:bg-sky-950/40',
    emerald:
      'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/70 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
  }
  const t = tones[tone] || tones.sky
  return (
    <NavLink
      to={to}
      className={`flex min-h-11 items-center justify-center gap-1 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold shadow-sm transition-colors dark:bg-gray-900 ${t}`}
    >
      {children}
      <span aria-hidden="true">→</span>
    </NavLink>
  )
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
          <CloseButton onClose={onClose} />
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
// เรื่องบัญชีส่วนตัว (สมาชิก / ตั้งค่าบัญชี / ประวัติแก้ไข / ออกจากระบบ) ย้ายไปเมนูโปรไฟล์
// มุมขวาบนแล้ว (ProfileMenu) — sidebar เหลือเฉพาะการนำทางหลัก
const NAV_ITEMS = [
  { to: '/', label: 'แดชบอร์ด', icon: 'home' },
  { to: '/assets', label: 'รายการสินทรัพย์', icon: 'building' },

  // กลุ่มการเงิน
  {
    label: 'การเงิน',
    icon: 'banknotes',
    group: 'finance',
    children: [
      { to: '/finance/pending', label: 'รอตรวจสอบสลิป', badge: 'pending' },
      { to: '/finance/overdue', label: 'ต้องทวงด่วน', badge: 'overdue' },
      { to: '/finance/recent', label: 'ชำระเงินทั้งหมด' },
    ],
  },

  // กลุ่มซ่อมแซม
  {
    label: 'ซ่อมแซม',
    icon: 'wrench',
    group: 'repairs',
    children: [
      { to: '/repairs/active', label: 'ค้างดำเนินการ', badge: 'repairs' },
      { to: '/repairs/recent', label: 'คำขอซ่อมทั้งหมด' },
    ],
  },

  // กลุ่มสัญญา
  {
    label: 'สัญญา',
    icon: 'document',
    group: 'leases',
    children: [
      { to: '/leases/expired', label: 'หมดอายุแล้ว', badge: 'expired' },
      { to: '/leases/expiring', label: 'ใกล้หมดอายุ', badge: 'expiring' },
    ],
  },

  { to: '/profit', label: 'กำไรสุทธิ', icon: 'trending-up' },

  // กลุ่มเอกสาร
  {
    label: 'เอกสาร',
    icon: 'folder',
    group: 'docs',
    children: [
      { to: '/docs/announcements', label: 'ประกาศ' },
      { to: '/docs/notes', label: 'บันทึก' },
      { to: '/docs/files', label: 'ไฟล์เอกสาร' },
    ],
  },

  { to: '/admin', label: 'ผู้ดูแล', icon: 'shield', founderOnly: true },
]

// Badge resolver — แปลง badge key เป็นตัวเลขจริงจาก taskCounts
function resolveBadge(badgeKey, taskCounts) {
  if (!badgeKey || !taskCounts) return 0
  return Number(taskCounts[badgeKey]) || 0
}

// 4 หน้างานค้าง — สลับกันเองด้วยแถบแท็บนี้
// (ไม่ยัดทั้ง 4 ลง sidebar/bottom-nav เพราะแถบล่างที่ 375px จะเหลือปุ่มละ ~53px ป้ายตัดทิ้ง)
// to ต้องชี้ nested path จริง — ถ้าชี้ redirect เก่า (/pending ฯลฯ) NavLink จะ active ไม่ได้เลย
// 4 หน้างานค้างหลัก — ป้อนหัวเรื่อง header เดสก์ท็อป (PAGE_TITLES) เท่านั้น
// เดิมเคยมีแถบแท็บสลับ TaskTabs วางบนหน้าเหล่านี้ ถอดออกแล้วตาม feedback:
// งานค้างแต่ละหน้าเข้าผ่านการ์ด "สรุปด่วน" ของแดชบอร์ด / sidebar / bottom-nav
const TASK_PAGES = [
  { to: '/finance/pending', label: 'รอตรวจสอบสลิป', subtitle: 'ผู้เช่าแจ้งชำระแล้ว ตรวจหลักฐานก่อนยืนยัน' },
  { to: '/finance/overdue', label: 'ต้องทวงด่วน', subtitle: 'ค้างชำระเกิน 15 วัน เรียงยอดมากไปน้อย' },
  { to: '/repairs/active', label: 'แจ้งซ่อม', subtitle: 'คำขอซ่อมจากผู้เช่า และการปิดงาน' },
  { to: '/leases/expiring', label: 'สัญญาใกล้หมดอายุ', subtitle: 'ต่อสัญญาหรือแจ้งย้ายออกก่อนหมดอายุ' },
]

// ครอบทั้ง 4 หน้างานค้างหลัก + หน้า "ทั้งหมด" และสัญญาหมดอายุแล้ว (ครอบครัวเดียวกัน — ไฮไลต์ปุ่ม "งานค้าง" ของแถบล่าง)
const TASK_PATH_PREFIXES = [
  '/finance/pending',
  '/finance/overdue',
  '/finance/recent',
  '/repairs/active',
  '/repairs/recent',
  '/leases/expired',
  '/leases/expiring',
]

// หัวเรื่อง header เดสก์ท็อปของหน้างานค้าง + เอกสาร — หน้าที่ไม่อยู่ในนี้ตกไปเงื่อนไขเดิม (แดชบอร์ด ฯลฯ)
// เดิมพึ่ง taskPage ที่เป็น null ตลอด ทำให้ทุกหน้าขึ้น "แดชบอร์ด"
const PAGE_TITLES = {
  ...Object.fromEntries(TASK_PAGES.map((t) => [t.to, [t.label, t.subtitle]])),
  '/finance/recent': ['ชำระเงินทั้งหมด', 'บิลที่ยืนยันการชำระแล้ว เรียงใหม่สุดขึ้นก่อน'],
  '/repairs/recent': ['คำขอซ่อมทั้งหมด', 'รวมทุกสถานะ เรียงใหม่สุดขึ้นก่อน'],
  '/leases/expired': ['สัญญาหมดอายุแล้ว', 'สัญญาที่เลยวันสิ้นสุดไปแล้ว'],
  '/docs/announcements': ['ประกาศ', 'แจ้งข่าวถึงผู้เช่า ส่งเข้ากลุ่ม LINE ได้ในคลิกเดียว'],
  '/docs/notes': ['บันทึก', 'โน้ตส่วนตัว จดสิ่งที่ต้องทำ ไอเดียที่นึกได้'],
  '/docs/files': ['ไฟล์เอกสาร', 'เก็บไฟล์สำคัญไว้ในระบบ เช่น สำเนาบัตร สัญญาเช่า'],
}

// ตรวจว่า path ปัจจุบันอยู่ในครอบครัวหน้างานค้าง — ใช้ไฮไลต์ปุ่ม "งานค้าง" ของแถบล่าง (BottomNav)
function isTaskPath(pathname) {
  return TASK_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function OccupancyDonut({ occupied, vacant }) {
  const chart = useChartTheme()
  const data = [
    { name: 'มีผู้เช่า', value: occupied, color: '#10b981' },
    { name: 'ห้องว่าง', value: vacant, color: chart.dark ? '#6b7280' : '#9ca3af' },
  ]
  const total = occupied + vacant
  const occupancyRate = total ? Math.round((occupied / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">สัดส่วนสินทรัพย์</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">ห้องมีผู้เช่าเทียบกับห้องว่าง</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Donut Chart with Center Text */}
        <div className="relative flex-shrink-0" style={{ width: '160px', height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                paddingAngle={2}
                startAngle={90}
                endAngle={450}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chart.tooltip}
                labelStyle={{ color: chart.tooltipLabel, fontWeight: 600 }}
                itemStyle={{ color: chart.tooltip.color }}
                formatter={(value) => `${value} ห้อง`}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{occupancyRate}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">อัตราเข้าพัก</p>
          </div>
        </div>

        {/* Custom Legend */}
        <div className="flex-1 space-y-3">
          {data.map((item, index) => {
            const percentage = total ? Math.round((item.value / total) * 100) : 0
            return (
              <div key={index} className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.name} <span className="font-bold">{item.value}</span>
                    <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                      ({percentage}%)
                    </span>
                  </p>
                </div>
              </div>
            )
          })}
        </div>
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
            <Bar dataKey="property" name="🏠 อสังหาริมทรัพย์" stackId="rev" fill="#10b981" />
            <Bar dataKey="vehicle" name="🚗 ยานพาหนะ" stackId="rev" fill="#14b8a6" />
            <Bar dataKey="other" name="🔧 อุปกรณ์/อื่นๆ" stackId="rev" fill="#f59e0b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// แถบสัญญาใกล้หมดอายุ — ห้องที่ lease_end_date หมดใน 90 วันข้างหน้า (ไม่นับห้องว่าง)
// ใช้ทั้งหน้า /leases (ส่ง onRenew/onMoveOut มาด้วย) และหน้า /assets
// หมวด 1: สัญญาหมดอายุแล้ว (days < 0) — เร่งด่วน ต้องจัดการทันที
function ExpiredLeasesSection({ rentals, onViewDetails, onRenew, onMoveOut }) {
  const expired = useMemo(() => {
    return (rentals || [])
      .filter((r) => {
        if (!r?.lease_end_date || String(r?.room_status ?? '').toLowerCase() === 'vacant') return false
        const days = daysUntil(r.lease_end_date)
        return days !== null && days < 0
      })
      .sort((a, b) => daysUntil(a.lease_end_date) - daysUntil(b.lease_end_date))
  }, [rentals])

  if (expired.length === 0) return null

  return (
    <section className="overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-rose-100/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 dark:border-rose-800/50 bg-gradient-to-r from-rose-50 dark:from-rose-950/30 to-orange-50 dark:to-orange-950/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/40">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">สัญญาหมดอายุแล้ว</h2>
            <p className="text-sm text-rose-700 dark:text-rose-300 lg:hidden">ผู้เช่ายังอยู่แต่ไม่มีสัญญา ต้องรีบจัดการ</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-rose-100 dark:bg-rose-900/40 px-3 py-1 text-sm font-bold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/70">
          {expired.length} สัญญา
        </span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {expired.map((r) => {
          const days = daysUntil(r.lease_end_date)
          const absDays = Math.abs(days ?? 0)
          return (
            <li key={r.id} className="px-5 py-4 transition-colors hover:bg-rose-50/50 dark:hover:bg-rose-900/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => onViewDetails?.(r)}
                  className="min-w-0 flex-1 rounded-lg text-left"
                >
                  <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{displayAssetName(r)}</p>
                  <p className="mt-0.5 truncate text-base text-gray-600 dark:text-gray-400">{r.cust_name || 'ไม่ระบุ'}</p>
                </button>
                <div className="flex items-center gap-4 sm:gap-6">
                  {Number(r.amount) > 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ค่าเช่า <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(r.amount)}</span>
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    สิ้นสุด <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(r.lease_end_date)}</span>
                  </p>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-rose-50 dark:bg-rose-950/30 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-800/70">
                    หมดไป {absDays} วัน
                  </span>
                </div>
              </div>

              {onRenew || onMoveOut ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {onRenew ? (
                    <button
                      type="button"
                      onClick={() => onRenew(r)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:flex-none lg:py-2"
                    >
                      ต่อสัญญา
                    </button>
                  ) : null}
                  {onMoveOut ? (
                    <button
                      type="button"
                      onClick={() => onMoveOut(r)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:min-h-0 lg:flex-none lg:py-2"
                    >
                      ทำเครื่องหมายว่าย้ายออก
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// หมวด 2: ใกล้หมดอายุ (0 ≤ days ≤ 90) — ยังมีเวลา แต่ต้องเตรียมตัว
function ExpiringSoonLeasesSection({ rentals, onViewDetails, onRenew, onMoveOut }) {
  const expiring = useMemo(() => {
    return (rentals || [])
      .filter((r) => {
        if (!r?.lease_end_date || String(r?.room_status ?? '').toLowerCase() === 'vacant') return false
        const days = daysUntil(r.lease_end_date)
        return days !== null && days >= 0 && days <= 90
      })
      .sort((a, b) => daysUntil(a.lease_end_date) - daysUntil(b.lease_end_date))
  }, [rentals])

  if (expiring.length === 0) return null

  const badgeOf = (days) => {
    if (days === 0) return { cls: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' }
    if (days <= 30) return { cls: 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-800/70' }
    if (days <= 60) return { cls: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-800/70' }
    return { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-orange-100/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 dark:border-orange-800/50 bg-gradient-to-r from-orange-50 dark:from-orange-950/30 to-amber-50 dark:to-amber-950/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/40">
            <Icon name="clock" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">สัญญาใกล้หมดอายุ</h2>
            <p className="text-sm text-orange-700 dark:text-orange-300 lg:hidden">สัญญาที่จะสิ้นสุดในอีก 0-90 วันข้างหน้า</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-bold text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-200 dark:ring-orange-800/70">
          {expiring.length} สัญญา
        </span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {expiring.map((r) => {
          const days = daysUntil(r.lease_end_date)
          const badge = badgeOf(days ?? 90)
          return (
            <li key={r.id} className="px-5 py-4 transition-colors hover:bg-orange-50/50 dark:hover:bg-orange-900/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => onViewDetails?.(r)}
                  className="min-w-0 flex-1 rounded-lg text-left"
                >
                  <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{displayAssetName(r)}</p>
                  <p className="mt-0.5 truncate text-base text-gray-600 dark:text-gray-400">{r.cust_name || 'ไม่ระบุ'}</p>
                </button>
                <div className="flex items-center gap-4 sm:gap-6">
                  {Number(r.amount) > 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      ค่าเช่า <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(r.amount)}</span>
                    </p>
                  ) : null}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    สิ้นสุด <span className="font-semibold text-gray-900 dark:text-gray-100">{formatDate(r.lease_end_date)}</span>
                  </p>
                  <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badge.cls}`}>
                    {days === 0 ? 'หมดวันนี้' : `เหลือ ${days} วัน`}
                  </span>
                </div>
              </div>

              {onRenew || onMoveOut ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {onRenew ? (
                    <button
                      type="button"
                      onClick={() => onRenew(r)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:flex-none lg:py-2"
                    >
                      ต่อสัญญา
                    </button>
                  ) : null}
                  {onMoveOut ? (
                    <button
                      type="button"
                      onClick={() => onMoveOut(r)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:min-h-0 lg:flex-none lg:py-2"
                    >
                      ทำเครื่องหมายว่าย้ายออก
                    </button>
                  ) : null}
                </div>
              ) : null}
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
    <section className="overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-rose-100/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 dark:border-rose-800/50 bg-gradient-to-r from-rose-50 dark:from-rose-950/30 to-orange-50 dark:to-orange-950/30 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/40">
            <Icon name="warning" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">ต้องทวงด่วน</h2>
            <p className="text-sm text-rose-700 dark:text-rose-300 lg:hidden">ค้างชำระเกิน 15 วัน เรียงยอดมากไปน้อย</p>
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
                  className={`${BTN.primary} w-full sm:w-auto`}
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
        <EmptyState icon="document" title="ยังไม่มีประวัติการแก้ไข" />
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

// ตารางประวัติเข้าใช้งาน — ใช้ร่วมกันทั้งหน้า /activity (ของตัวเอง)
// และแท็บใน /admin (ของทุกคน) จึงรับแค่ logs ไม่ดึงข้อมูลเอง
// โครง "ตารางที่ >=768px + การ์ดแนวตั้งที่ 375px" ตามแบบเดียวกับ AuditLogPage
function ActivityLogTable({ logs }) {
  const actionMeta = (action) =>
    ACTIVITY_ACTIONS[String(action ?? '').toLowerCase()] || {
      label: action || '—',
      cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700',
    }
  const detailText = (detail) => {
    const key = String(detail ?? '').toLowerCase()
    if (!key) return null
    return ACTIVITY_DETAILS[key] || detail
  }

  return (
    <>
      {/* ตารางที่ 768px ขึ้นไป */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">วันที่/เวลา</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ผู้ใช้</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">การกระทำ</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.map((log) => {
              const meta = actionMeta(log.action)
              const detail = detailText(log.detail)
              return (
                <tr key={log.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="whitespace-nowrap px-6 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(log.created_at)}</td>
                  <td className="px-6 py-3 text-sm text-gray-700 dark:text-gray-300">{log.user_email || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.cls}`}>
                      {meta.label}
                    </span>
                    {detail ? <span className="ml-2 text-xs text-gray-400">{detail}</span> : null}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{log.ip || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* การ์ดแนวตั้งที่ 375px */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
        {logs.map((log) => {
          const meta = actionMeta(log.action)
          const detail = detailText(log.detail)
          return (
            <div key={log.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${meta.cls}`}>
                  {meta.label}
                </span>
                <p className="text-right text-xs text-gray-500 dark:text-gray-400">{formatDateTime(log.created_at)}</p>
              </div>
              <p className="break-all text-base text-gray-700 dark:text-gray-300">{log.user_email || '—'}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                <span className="font-mono">IP {log.ip || '—'}</span>
                {detail ? <span>{detail}</span> : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// หน้า /activity — เจ้าของที่ดูประวัติเข้า/ออกระบบของบัญชีตัวเอง
// (RPC get_activity_logs คืนแค่แถวของ admin_id ตัวเอง — RLS คุมอีกชั้น)
function ActivityLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_activity_logs', { p_limit: 200 })
      if (rpcError) throw rpcError
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch activity logs error:', err)
      setError(err?.message || 'ไม่สามารถโหลดประวัติได้')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ประวัติเข้าใช้งาน</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">การเข้า-ออกระบบของบัญชีคุณ (เก็บย้อนหลัง 90 วัน)</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดประวัติได้" hint={error} action={<button type="button" onClick={load} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : logs.length === 0 ? (
        <EmptyState icon="document" title="ยังไม่มีประวัติการเข้าใช้งาน" />
      ) : (
        <ActivityLogTable logs={logs} />
      )}
    </div>
  )
}

function PDPAConsentModal({ onAccept }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white dark:bg-gray-900 p-6 shadow-2xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">การยินยอมข้อมูลส่วนบุคคล (PDPA)</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">ระบบจะเก็บข้อมูลชื่อ-ที่อยู่-ยอดเงินของผู้เช่าเพื่อการทวงเงินตามกฎหมาย PDPA</p>
        <button type="button" onClick={onAccept} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 lg:py-2.5 lg:text-sm">
          ยินยอม
        </button>
      </div>
    </div>
  )
}

const MEMBERSHIP_PLANS = {
  trial: { label: 'ทดลองใช้', cls: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800/70' },
  starter: { label: 'Starter', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' },
  // pro = แพ็กเกจที่ขายอยู่จริงใน MEMBERSHIP_PACKAGES (บัญชีเดโม่ก็ใช้ค่านี้)
  // basic = ค่าเก่าที่ยังมีในแถวสมาชิกบางราย — ไม่ใส่ไว้จะโชว์เป็นตัวพิมพ์เล็กดิบในตาราง /admin
  pro: { label: 'Pro', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' },
  basic: { label: 'Basic', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ring-slate-200 dark:ring-slate-700' },
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
  // สถานะชั่วคราวระหว่าง EasySlip ยืนยันยอดแล้วแต่ RPC ต่ออายุยังไม่จบ
  // (ปกติผู้ใช้จะไม่ทันเห็น เพราะกลายเป็น approved ในทรานแซกชันถัดไป)
  auto_verified: { label: 'ตรวจอัตโนมัติผ่าน', cls: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 ring-teal-200 dark:ring-teal-800/70', dot: 'bg-teal-500' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70', dot: 'bg-emerald-500' },
  rejected: { label: 'ไม่ผ่านการตรวจสอบ', cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70', dot: 'bg-rose-500' },
}

// ชื่อแพ็กเกจของสมาชิก — คอลัมน์บน DB จริงชื่อ `plan_type` แต่ migration เก่า
// (20260906150000_membership_gate.sql) เขียนเป็น `plan` เพราะ DB ถูกแก้ตรงผ่าน
// SQL Editor ภายหลัง ทีนี้ get_membership_status() คืนคีย์ `plan_type` มา
// โค้ดจึงต้องรับทั้งสองชื่อ ไม่ใช่ `plan` อย่างเดียว (ไม่งั้นได้ undefined
// แล้ว isFounder เป็น false ตลอด → เมนู/หน้า /admin หายไปทั้งที่เป็น founder)
function membershipPlan(membership) {
  return String(membership?.plan_type ?? membership?.plan ?? '').toLowerCase()
}

function isFounderPlan(membership) {
  return membershipPlan(membership) === 'founder'
}

// สรุปสถานะสมาชิกแบบสั้น — ใช้ร่วมกันระหว่าง badge ใน sidebar, เมนูโปรไฟล์
// และการ์ด "สมาชิก" บนหน้าตั้งค่ามือถือ เพื่อให้กฎ "แดงเมื่อ <=3 วัน/หมดอายุ" อยู่ที่เดียว
function membershipSummary(membership) {
  const expired = String(membership?.status ?? '').toLowerCase() === 'expired'
  const plan = membershipPlan(membership)
  const meta = MEMBERSHIP_PLANS[plan] || { label: plan || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
  const daysLeft = Number(membership?.days_left)
  const hasExpiry = !expired && Boolean(membership?.expire_date) && Number.isFinite(daysLeft)
  return {
    planLabel: expired ? 'หมดอายุ' : meta.label,
    cls: meta.cls,
    daysLeft,
    hasExpiry,
    // ใกล้หมดอายุ (<= 3 วัน) หรือหมดอายุแล้ว → เปลี่ยนเป็นสีแดง
    urgent: expired || (hasExpiry && daysLeft <= 3),
  }
}

function MembershipBadge({ membership, className = '' }) {
  if (!membership?.ok) return null
  const { planLabel, cls, daysLeft, hasExpiry, urgent } = membershipSummary(membership)
  return (
    // whitespace-nowrap กันข้อความยาว ๆ ("ทดลองใช้ · เหลือ 30 วัน") ถูกตัดคำ "วัน" ตกบรรทัดล่าง
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
      urgent ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70' : cls
    } ${className}`}>
      {planLabel}
      {hasExpiry && <span>· เหลือ {daysLeft} วัน</span>}
    </span>
  )
}

// NavGroup — เมนูที่มี submenu (collapsible)
function NavGroup({ item, totalBadge, isActive, taskCounts, children }) {
  const [open, setOpen] = useState(isActive)

  useEffect(() => {
    if (isActive && !open) setOpen(true)
  }, [isActive, open])

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon name={item.icon} className="h-5 w-5 shrink-0" />
          <span>{item.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {totalBadge > 0 && (
            <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-700 dark:text-rose-300">
              {totalBadge}
            </span>
          )}
          <Icon name={open ? 'chevron-down' : 'chevron-right'} className="h-4 w-4 shrink-0" />
        </div>
      </button>

      {open && (
        <div className="ml-8 mt-1 space-y-1">
          {item.children.map((child) => (
            <NavGroupItem
              key={child.to}
              to={child.to}
              label={child.label}
              badge={child.badge ? resolveBadge(child.badge, taskCounts) : 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// NavGroupItem — submenu link
function NavGroupItem({ to, label, badge }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-semibold'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`
      }
    >
      <span>{label}</span>
      {badge > 0 && (
        <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-700 dark:text-rose-300">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function Sidebar({ businessName, membership, taskCounts, email }) {
  const location = useLocation()
  const isFounder = isFounderPlan(membership)
  const navItems = isFounder ? NAV_ITEMS : NAV_ITEMS.filter((item) => !item.founderOnly)

  // ตรวจว่า path ปัจจุบันอยู่ในกลุ่มไหน
  const isInGroup = (group) => {
    if (group === 'finance') return location.pathname.startsWith('/finance')
    if (group === 'repairs') return location.pathname.startsWith('/repairs')
    if (group === 'leases') return location.pathname.startsWith('/leases')
    if (group === 'docs') return location.pathname.startsWith('/docs')
    return false
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 lg:flex">
      {/* px-4 แทน px-6 — ให้ป้ายสมาชิก ("ทดลองใช้ · เหลือ 30 วัน") อยู่บรรทัดเดียวได้สบาย ๆ */}
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
          <Icon name="building" className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <MembershipBadge className="mb-1" membership={membership} />
          <p className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">{businessName || 'PayRentPro'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">ระบบจัดการค่าเช่า</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navItems.map((item) => {
          if (item.children) {
            // กลุ่มที่มี submenu
            const isActive = isInGroup(item.group)
            const totalBadge = item.children.reduce((sum, child) => {
              return sum + (child.badge ? resolveBadge(child.badge, taskCounts) : 0)
            }, 0)

            return (
              <NavGroup
                key={item.group}
                item={item}
                totalBadge={totalBadge}
                isActive={isActive}
                taskCounts={taskCounts}
              />
            )
          } else {
            // เมนูปกติ (ไม่มี submenu)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                  }`
                }
              >
                <Icon name={item.icon} className="h-5 w-5" />
                {item.label}
              </NavLink>
            )
          }
        })}
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-800 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-950 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
            {(email || 'ผ').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">ผู้ดูแลระบบ</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{email || '—'}</p>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] font-semibold tracking-wide text-emerald-500 dark:text-emerald-400">PayRentPro v2.0 · build 2026-09-12</p>
      </div>
    </aside>
  )
}

// แถบนำทางล่างสำหรับมือถือ/แท็บเล็ต — สูง 56px (h-14) ซ่อนที่ lg ขึ้นไปเพราะมี Sidebar แล้ว
// ต้องมีทุกหน้าที่ sidebar มี เพราะ Sidebar เป็น lg:flex — ต่ำกว่า 1024px มีทางเข้าทางนี้ทางเดียว
// (กำไรสุทธิ/ประกาศฯ เคยตกหล่นจนมือถือกับแท็บเล็ตเข้า 2 หน้านั้นไม่ได้เลย)
// "ตั้งค่า" ไม่ต้องมีที่นี่ — ProfileMenu ที่ header มี "ตั้งค่าบัญชี" อยู่แล้วและไม่ใช่ lg:hidden
const BOTTOM_NAV_ITEMS = [
  { to: '/', label: 'หน้าแรก', icon: 'home' },
  { to: '/assets', label: 'สินทรัพย์', icon: 'building' },
  { to: '/finance/pending', label: 'งานค้าง', icon: 'clock', group: 'tasks' },
  { to: '/profit', label: 'กำไรสุทธิ', icon: 'chart' },
  { to: '/docs/announcements', label: 'ประกาศ', icon: 'megaphone' },
  { to: '/admin', label: 'ผู้ดูแล', icon: 'shield', founderOnly: true },
]

function BottomNav({ membership }) {
  const isFounder = isFounderPlan(membership)
  const items = isFounder ? BOTTOM_NAV_ITEMS : BOTTOM_NAV_ITEMS.filter((item) => !item.founderOnly)
  const onTaskPage = isTaskPath(useLocation().pathname)
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
                isActive || (item.group === 'tasks' && onTaskPage)
                  ? 'text-emerald-600 dark:text-emerald-400'
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

// เมนูโปรไฟล์มุมขวาบน (ใช้ร่วมกันทั้ง desktop และ header มือถือ) — รวบเรื่องบัญชีส่วนตัว
// ที่เคยกระจายอยู่ใน sidebar/bottom-nav: อีเมล / สมาชิก / ตั้งค่าบัญชี / ออกจากระบบ
// pattern เดียวกับ RowActionsMenu: createPortal + fixed + กดนอกปิด + flip กันขอบจอ
const PROFILE_MENU_WIDTH = 256 // w-64 = 16rem

function ProfileMenu({ email, membership }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const navigate = useNavigate()

  const addr = String(email ?? '').trim()
  // ปุ่มโชว์แค่ 2 ตัวแรกของอีเมล (ไม่ให้ header ยาวจนล้น) — ไม่มีอีเมลก็ใช้ไอคอนแทน
  const short = addr ? `${addr.slice(0, 2)}…` : ''
  const summary = membership?.ok ? membershipSummary(membership) : null

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
    // ปุ่มอยู่ขวาสุดของ header → เปิดชิดขวาของปุ่ม แล้วหนีขอบจอทั้งสองข้าง
    const left = Math.max(8, Math.min(rect.right - PROFILE_MENU_WIDTH, window.innerWidth - PROFILE_MENU_WIDTH - 8))
    setPos({ left: Math.round(left), top: Math.round(rect.bottom + 6) })
    setOpen(true)
  }

  // วัดความสูงจริงหลัง render แล้ว flip ขึ้นถ้าใกล้ขอบล่างของจอ (เหมือน RowActionsMenu)
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !buttonRef.current) return
    const menu = menuRef.current
    const update = () => {
      const rect = buttonRef.current.getBoundingClientRect()
      const menuH = menu.offsetHeight
      const spaceBelow = window.innerHeight - 8 - rect.bottom
      if (menuH > spaceBelow) {
        const target = Math.max(8, Math.round(rect.top - 6 - menuH))
        setPos((prev) => (prev.top === target ? prev : { ...prev, top: target }))
      }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(menu)
    return () => observer.disconnect()
  }, [open])

  // เมนูเป็น fixed ไม่เลื่อนตาม header จึงปิดให้เมื่อผู้ใช้เลื่อนหน้าจอ
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [open])

  const go = (to) => { setOpen(false); navigate(to) }
  const itemClass =
    'flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label="เมนูโปรไฟล์"
        aria-expanded={open}
        className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-sm transition-colors ${
          open
            ? 'relative z-[70] border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
          {short ? short.slice(0, 2) : <span aria-hidden="true"><Icon name="user" className="h-5 w-5" /></span>}
        </span>
        {/* จุดแดงเตือนเมื่อสมาชิกใกล้หมด/หมดอายุ — เห็นได้แม้ไม่เปิดเมนู */}
        {summary?.urgent && <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
        <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={menuRef}
            style={{ left: pos.left, top: pos.top, width: PROFILE_MENU_WIDTH }}
            className="fixed z-[61] overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1.5 shadow-xl"
          >
            {/* อีเมลเต็ม — อ่านอย่างเดียว ไม่ใช่ปุ่ม */}
            <p className="break-all px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{addr || 'ยังไม่มีอีเมล'}</p>

            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

            <button type="button" onClick={() => go('/membership')} className={`${itemClass} text-gray-700 dark:text-gray-300`}>
              <span aria-hidden="true" className="shrink-0"><Icon name="identification" className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block">สมาชิก</span>
                {summary && (
                  <span className={`block whitespace-nowrap text-xs font-medium ${
                    summary.urgent ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {summary.planLabel}
                    {summary.hasExpiry && ` · เหลือ ${summary.daysLeft} วัน`}
                  </span>
                )}
              </span>
            </button>

            <button type="button" onClick={() => go('/settings')} className={`${itemClass} text-gray-700 dark:text-gray-300`}>
              <span aria-hidden="true" className="shrink-0"><Icon name="cog" className="h-5 w-5" /></span>
              ตั้งค่าบัญชี
            </button>

            {/* /audit และ /activity ไม่มีที่อยู่ใน sidebar แล้ว (เหลือ หน้าแรก/สินทรัพย์/ผู้ดูแล)
                และเมนู ⋯ เป็น lg:hidden — ถ้าไม่วางไว้ที่นี่ เดสก์ท็อปจะเข้าหน้านี้ไม่ได้เลย */}
            <button type="button" onClick={() => go('/audit')} className={`${itemClass} text-gray-700 dark:text-gray-300`}>
              <span aria-hidden="true" className="shrink-0"><Icon name="document" className="h-5 w-5" /></span>
              ประวัติแก้ไข
            </button>

            <button type="button" onClick={() => go('/activity')} className={`${itemClass} text-gray-700 dark:text-gray-300`}>
              <span aria-hidden="true" className="shrink-0"><Icon name="clock" className="h-5 w-5" /></span>
              ประวัติเข้าใช้งาน
            </button>

            <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

            <button
              type="button"
              onClick={() => { setOpen(false); signOutWithLog() }}
              className={`${itemClass} text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30`}
            >
              <span aria-hidden="true" className="shrink-0"><Icon name="logout" className="h-5 w-5" /></span>
              ออกจากระบบ
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// เมนู ⋯ ของ header มือถือ/แท็บเล็ต — เหลือเฉพาะ "เครื่องมือมุมมอง"
// (Export CSV / รีเฟรช / ตัวอักษรขยาย / ธีม) — เรื่องบัญชี (ประวัติแก้ไข / ออกจากระบบ)
// ย้ายไป ProfileMenu ที่อยู่ติดกันแล้ว จึงไม่ซ้ำสองเมนูข้างกัน
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
                <Icon name="download" className="h-5 w-5" aria-hidden="true" /> Export CSV
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
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" aria-hidden="true" />
              {theme === 'dark' ? 'โหมดสว่าง' : 'โหมดมืด'}
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
      <span className="mt-0.5 shrink-0 leading-5 text-lg">{bizTypeEmoji(row?.biz_type)}</span>
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

  // สรุปจำนวนสินทรัพย์ตามสถานะ (vacant/occupied)
  const statusCounts = countByStatus(rentals)

  // จำนวนต่อประเภท (นับจากทั้งหมด ไม่ขึ้นกับคำค้นหา)
  const counts = { all: (rentals || []).length, vacant: statusCounts.vacant, property: 0, vehicle: 0, other: 0 }
  for (const r of rentals || []) counts[normalizeBizType(r?.biz_type)] += 1

  const filtered = (rentals || []).filter((r) => {
    const matchKeyword = !keyword
      || String(r?.cust_name ?? '').toLowerCase().includes(keyword)
      || String(r?.item_details ?? '').toLowerCase().includes(keyword)
      || String(r?.sub_label ?? '').toLowerCase().includes(keyword)
    // แท็บ 'vacant' กรองเฉพาะห้องว่าง ไม่จำกัดประเภท
    const matchTab = bizTab === 'all' || bizTab === 'vacant' ? (bizTab === 'vacant' ? isVacant(r) : true) : normalizeBizType(r?.biz_type) === bizTab
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
    <>
      {/* การ์ดสรุป: ทั้งหมด / ว่าง / มีผู้เช่า */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts.total}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ว่าง</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{statusCounts.vacant}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">มีผู้เช่า</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{statusCounts.occupied}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ข้อมูลสัญญาเช่า</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">จำนวน {filtered.length} รายการ{keyword ? ` (จากทั้งหมด ${rentals.length})` : ''}</p>
          </div>
        </div>

        {/* แท็ปกรองตามประเภทสินทรัพย์ + แท็บ "ว่าง" — เลื่อนแนวนอนได้ที่จอเล็ก ไม่ดันหน้าให้ล้น */}
        <div
          className="flex gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800 px-4 py-3 sm:px-6 lg:flex-wrap lg:overflow-visible"
          data-allow-overflow
        >
          <button
            type="button"
            onClick={() => setBizTab('all')}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-3 text-sm font-semibold transition-colors lg:px-3.5 lg:py-1.5 ${
              bizTab === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            ทั้งหมด {counts.all}
          </button>
          <button
            type="button"
            onClick={() => setBizTab('vacant')}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-3 text-sm font-semibold transition-colors lg:px-3.5 lg:py-1.5 ${
              bizTab === 'vacant' ? 'bg-amber-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            ว่าง {counts.vacant}
          </button>
          {BIZ_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setBizTab(t.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-3 text-sm font-semibold transition-colors lg:px-3.5 lg:py-1.5 ${
                bizTab === t.value ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-base leading-none">{t.emoji}</span>
              {t.tab} {counts[t.value]}
            </button>
          ))}
        </div>

        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดข้อมูลได้" hint={error} action={<button type="button" onClick={onRetry} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="document" tone="gray" title={keyword ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'} hint={keyword ? 'ลองเปลี่ยนคำค้นหา เช่น ชื่อผู้เช่า หรือชื่อห้อง' : 'ยังไม่มีสินทรัพย์ในระบบ'} />
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
    </>
  )
}

// การ์ด "สมาชิก" บนสุดของหน้าตั้งค่า — เฉพาะมือถือ/แท็บเล็ต (lg:hidden)
// bottom-nav เหลือ 3 ปุ่มแล้ว ไม่มีปุ่มสมาชิก การ์ดนี้เลยเป็นทางเข้าที่หาง่ายที่สุด
// (อีกทางคือเมนูโปรไฟล์ใน header)
function MembershipSettingsLink({ membership }) {
  const navigate = useNavigate()
  const summary = membership?.ok ? membershipSummary(membership) : null
  return (
    <button
      type="button"
      onClick={() => navigate('/membership')}
      className="mb-4 flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4 text-left shadow-sm transition-colors active:bg-gray-50 dark:active:bg-gray-800 lg:hidden"
    >
      <span aria-hidden="true" className="shrink-0"><Icon name="identification" className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-gray-900 dark:text-gray-100">สมาชิก</span>
        <span className="mt-1 block">
          {summary ? (
            <MembershipBadge membership={membership} />
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">แพ็กเกจ การใช้งาน และการต่ออายุ</span>
          )}
        </span>
      </span>
      <svg className="h-5 w-5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  )
}

function SettingsPage({ onSaved, membership }) {
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
      <MembershipSettingsLink membership={membership} />

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
                  <button type="button" onClick={() => setField('payment_type', 'promptpay')} className={`rounded-xl border-2 px-4 py-3 text-left ${!isBank ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">พร้อมเพย์ (PromptPay)</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">เบอร์โทร / เลขบัตรประชาชน</span>
                  </button>
                  <button type="button" onClick={() => setField('payment_type', 'bank')} className={`rounded-xl border-2 px-4 py-3 text-left ${isBank ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
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

              <button type="submit" disabled={saving} className={`${BTN.primary} w-full lg:w-auto`}>
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

// อ่านไฟล์รูป → base64 (ส่งให้ Edge Function verify-slip)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('อ่านไฟล์รูปไม่สำเร็จ'))
    reader.readAsDataURL(file)
  })
}

// เรียก verify-slip ตรวจสลิปค่าสมาชิกอัตโนมัติ
// คืน verdict เสมอ — ไม่ throw เพราะแถว pending_review ถูกสร้างไว้แล้ว
// ต่อให้ตรวจอัตโนมัติล้มเหลว ก็ยังรอ founder อนุมัติมือได้ตามเดิม
async function verifyMembershipSlip(slipFile, refId) {
  try {
    const imageBase64 = await fileToBase64(slipFile)
    const { data, error } = await supabase.functions.invoke('verify-slip', {
      body: { image_base64: imageBase64, kind: 'membership', ref_id: refId },
    })
    if (error) throw error
    return data || { ok: false, error: 'read_failed' }
  } catch (err) {
    console.error('verify-slip failed:', err)
    return { ok: false, error: 'read_failed' }
  }
}

// แปลง verdict จาก verify-slip → toast ที่ผู้ใช้อ่านรู้เรื่อง
function membershipVerifyToast(verdict) {
  if (verdict?.ok && verdict?.approved) {
    return { type: 'success', message: 'ตรวจสอบอัตโนมัติสำเร็จ — ต่ออายุแล้ว' }
  }
  // อ่านสลิปได้แต่ยอดไม่ตรงแพ็ก → ให้ founder ตัดสิน
  if (verdict?.ok && verdict?.matched === false) {
    return { type: 'warning', message: `${verdict.note || 'ยอดสลิปไม่ตรงกับยอดแพ็ก'} — ส่งให้ทีมงานตรวจสอบแล้ว` }
  }
  // ยอดตรงแต่ต่ออายุอัตโนมัติไม่สำเร็จ (RPC พลาด/แถวถูกแก้ไปแล้ว)
  if (verdict?.ok) {
    return { type: 'warning', message: 'ตรวจสลิปผ่านแล้ว แต่ต่ออายุอัตโนมัติไม่สำเร็จ — รอทีมงานยืนยัน' }
  }
  const reasons = {
    duplicate: 'สลิปนี้ถูกใช้ไปแล้ว — ส่งให้ทีมงานตรวจสอบแล้ว',
    quota: 'ระบบตรวจสลิปอัตโนมัติไม่พร้อมใช้งาน — ส่งให้ทีมงานตรวจสอบแล้ว',
    read_failed: 'อ่านสลิปอัตโนมัติไม่ได้ — ส่งให้ทีมงานตรวจสอบแล้ว',
  }
  return { type: 'warning', message: reasons[verdict?.error] || 'ส่งสลิปเรียบร้อย — รอตรวจสอบ' }
}

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
      //    (ต้อง insert ก่อนเรียก verify-slip เพราะ ref_id = id ของแถวนี้
      //     และ Edge Function ใช้แถวนี้ตรวจสิทธิ์ว่าเป็นเจ้าของจริง)
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

      // 3) ตรวจสลิปอัตโนมัติด้วย EasySlip (ล้มเหลวก็ยังมีแถวรออนุมัติมืออยู่)
      const verdict = await verifyMembershipSlip(slipFile, payment.id)
      onToast?.(membershipVerifyToast(verdict))
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
          <p className="text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(amount)}</p>
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

        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-800/60 px-4 py-5 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/30">
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
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400"><Icon name="upload" className="h-4 w-4" /> แนบรูปสลิปการโอนเงิน (แตะเพื่อเลือกไฟล์)</span>
          )}
          {slipFile && <span className="text-xs text-gray-400">{slipFile.name}</span>}
        </label>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className={`${BTN.secondary} sm:flex-1`}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmitSlip}
            disabled={!slipFile || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1 lg:py-2.5 lg:text-sm"
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
  const planKey = membershipPlan(membership)
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
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
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
                  selected ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm shadow-emerald-100' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-200'
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
                    active ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-200'
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300'}`}>{m} เดือน</p>
                  <p className={`mt-0.5 text-sm font-bold tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
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
              className={`${BTN.primary} px-6 shadow-lg shadow-emerald-600/30`}
            >
              สั่งซื้อ
            </button>
          </div>
        </div>
      </section>

      {/* ประวัติการส่งสลิป (แถวของตัวเอง — RLS กรองให้) */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
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
          <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดประวัติได้" hint={historyError} action={<button type="button" onClick={fetchHistory} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
        ) : history.length === 0 ? (
          <EmptyState icon="document" tone="gray" title="ยังไม่มีประวัติการต่ออายุ" hint="เลือกแพ็กเกจด้านบนแล้วส่งสลิปเพื่อต่ออายุครั้งแรก" />
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
                            className="block overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:border-emerald-300"
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
                      className="shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 transition-colors hover:border-emerald-300"
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

// ข้อความตอบ RPC admin_change_member_email (ฝั่ง DB ตรวจให้ — นี่คือคำอธิบายภาษาไทย)
const ADMIN_EMAIL_ERRORS = {
  forbidden: 'เฉพาะผู้ดูแลระบบ (founder) เท่านั้นที่เปลี่ยนอีเมลได้',
  invalid_email: 'รูปแบบอีเมลใหม่ไม่ถูกต้อง',
  member_not_found: 'ไม่พบสมาชิกอีเมลนี้ในระบบ',
  no_auth_account: 'สมาชิกนี้ยังไม่ผูกบัญชีเข้าสู่ระบบ',
  same_email: 'อีเมลใหม่ต้องต่างจากอีเมลปัจจุบัน',
  email_taken: 'อีเมลนี้ถูกใช้โดยบัญชีอื่นแล้ว',
}

// ข้อความตอบ RPC admin_update_member_plan (ตรง mapping ฝั่ง DB ทุกตัว)
const ADMIN_PLAN_ERRORS = {
  forbidden: 'เฉพาะผู้ดูแลระบบ (founder) เท่านั้นที่แก้แพ็กเกจได้',
  invalid_plan: 'แพ็กเกจที่เลือกไม่ถูกต้อง',
  member_not_found: 'ไม่พบสมาชิกอีเมลนี้ในระบบ',
}

// ตัวเลือกแพ็กเกจใน modal แก้สมาชิก — label/จำนวนห้องตรง MEMBERSHIP_PLANS
// และ mapping ฝั่ง DB (trial 10 / starter 20 / pro 50 / founder ไม่จำกัด)
const ADMIN_PLAN_OPTIONS = [
  { value: 'trial', label: 'ทดลองใช้ (10 ห้อง)' },
  { value: 'starter', label: 'Starter (20 ห้อง)' },
  { value: 'pro', label: 'Pro (50 ห้อง)' },
  { value: 'founder', label: 'ผู้ก่อตั้ง (ไม่จำกัด)' },
]

function AdminPage({ onToast }) {
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError] = useState(null)
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState(null)
  const [reviewing, setReviewing] = useState(null)
  const [previewSlip, setPreviewSlip] = useState(null)
  // เปลี่ยนอีเมลสมาชิก — เก็บแถวที่กำลังแก้ (กรณีลูกค้าลืมรหัส Gmail เข้าอีเมลเดิมไม่ได้)
  const [emailEdit, setEmailEdit] = useState(null)
  const [savingEmail, setSavingEmail] = useState(false)
  // แก้แพ็กเกจ/วันหมดอายุสมาชิก — เก็บ { email, plan, expireDate } ของแถวที่กำลังแก้
  const [planEdit, setPlanEdit] = useState(null)
  const [savingPlan, setSavingPlan] = useState(false)
  // แท็บ: 'members' = สมาชิก+ค่าสมาชิกรอตรวจ (เดิม) / 'activity' = ประวัติเข้าใช้งานของทุกคน
  const [tab, setTab] = useState('members')
  const [activity, setActivity] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState(null)

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

  // ย้ายบัญชีสมาชิกไปอีเมลใหม่ — กรณีลูกค้าลืมรหัส Gmail เข้าอีเมลเดิมไม่ได้
  // (RPC อัปเดต auth.users + admins ให้ตรงกัน แล้วลูกค้าขอลิงก์เข้าสู่ระบบด้วยอีเมลใหม่ได้ทันที)
  const handleChangeMemberEmail = useCallback(async (memberEmail, newEmail) => {
    setSavingEmail(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_change_member_email', {
        p_member_email: memberEmail,
        p_new_email: newEmail,
      })
      if (rpcError) throw rpcError
      if (data?.ok === false) throw new Error(ADMIN_EMAIL_ERRORS[data?.error] || 'เปลี่ยนอีเมลไม่สำเร็จ')
      onToast?.({ type: 'success', message: `เปลี่ยนอีเมลเป็น ${newEmail} แล้ว — ลูกค้าขอลิงก์เข้าสู่ระบบด้วยอีเมลใหม่ได้ทันที` })
      setEmailEdit(null)
      await fetchMembers()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'เปลี่ยนอีเมลไม่สำเร็จ' })
    } finally {
      setSavingEmail(false)
    }
  }, [fetchMembers, onToast])

  // แก้แพ็กเกจ + วันหมดอายุสมาชิก — RPC ปรับ room_limit ตามแพ็กเกจให้อัตโนมัติ
  // (สถานะ active/expired คำนวณใหม่จากวันหมดอายุที่ส่งไปฝั่ง DB)
  const handleChangeMemberPlan = useCallback(async (memberEmail, planType, expireDate) => {
    setSavingPlan(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_update_member_plan', {
        p_member_email: memberEmail,
        p_plan_type: planType,
        p_expire_date: expireDate || null,
      })
      if (rpcError) throw rpcError
      if (data?.ok === false) throw new Error(ADMIN_PLAN_ERRORS[data?.error] || 'แก้แพ็กเกจไม่สำเร็จ')
      const newExpire = data?.expire_date
      onToast?.({
        type: 'success',
        message: `แก้เป็นแพ็กเกจ ${MEMBERSHIP_PLANS[planType]?.label || planType} แล้ว${newExpire ? ` (หมดอายุ ${formatDate(newExpire)})` : ''}`,
      })
      setPlanEdit(null)
      await fetchMembers()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'แก้แพ็กเกจไม่สำเร็จ' })
    } finally {
      setSavingPlan(false)
    }
  }, [fetchMembers, onToast])

  // ประวัติเข้าใช้งานของสมาชิกทุกคน (founder เท่านั้น — guard อยู่ที่ตัว RPC)
  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    setActivityError(null)
    try {
      const { data, error } = await supabase.rpc('get_all_activity_logs', { p_limit: 500 })
      if (error) throw error
      setActivity(Array.isArray(data) ? data : [])
    } catch (err) {
      setActivityError(adminBackofficeError(err))
    } finally {
      setActivityLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchPending()
  }, [fetchMembers, fetchPending])

  // โหลดประวัติตอนเปิดแท็บครั้งแรก (ไม่ดึงมาก่อน เพราะ 500 แถวไม่จำเป็นถ้าไม่เปิดดู)
  useEffect(() => {
    if (tab === 'activity') fetchActivity()
  }, [tab, fetchActivity])

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

  // ปุ่มรีเฟรชหมุนตามงานของแท็บที่เปิดอยู่ (ไม่ใช่ของทั้งหน้า)
  const refreshing = tab === 'activity' ? activityLoading : membersLoading || pendingLoading
  const refreshCurrentTab = () => {
    if (tab === 'activity') fetchActivity()
    else { fetchMembers(); fetchPending() }
  }

  const ADMIN_TABS = [
    { key: 'members', label: 'ค่าสมาชิก', icon: 'banknotes', count: pending.length },
    { key: 'activity', label: 'ประวัติเข้าใช้งาน', icon: 'clock', count: 0 },
  ]

  return (
    <div>
      {/* ปุ่มรีเฟรชหน้า */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tab === 'activity' ? 'การเข้า-ออกระบบของสมาชิกทุกคน (เก็บย้อนหลัง 90 วัน)' : 'ภาพรวมสมาชิกและค่าสมาชิกรอตรวจทั้งหมดในระบบ'}
        </p>
        <button
          type="button"
          onClick={refreshCurrentTab}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 lg:py-2.5 lg:text-sm"
        >
          <Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          รีเฟรชข้อมูล
        </button>
      </div>

      {/* แท็บ — min-h-11 ตามเกณฑ์ tap target ของโปรเจกต์ */}
      <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
            {t.count > 0 ? <span className="text-xs font-normal opacity-70">({t.count})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'activity' ? (
        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100">ประวัติเข้าใช้งาน</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">วันที่/เวลา · อีเมลผู้ใช้ · การกระทำ · IP</p>
          </div>
          {activityLoading ? (
            <TableSkeleton />
          ) : activityError ? (
            <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดประวัติได้" hint={activityError} action={<button type="button" onClick={fetchActivity} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
          ) : activity.length === 0 ? (
            <EmptyState icon="document" title="ยังไม่มีประวัติการเข้าใช้งาน" />
          ) : (
            <ActivityLogTable logs={activity} />
          )}
        </section>
      ) : (
      <>
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
          <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายการได้" hint={pendingError} action={<button type="button" onClick={fetchPending} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
        ) : pending.length === 0 ? (
          <EmptyState icon="check" tone="amber" title="ไม่มีค่าสมาชิกรอตรวจ" hint="ยังไม่มีสมาชิกส่งสลิปค่าต่ออายุในขณะนี้" />
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

                  {/* หมายเหตุจากการตรวจอัตโนมัติ (เช่น ยอดสลิปไม่ตรงกับยอดแพ็ก) */}
                  {item.note ? (
                    <p className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                      <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="min-w-0">{item.note}</span>
                    </p>
                  ) : null}

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
                      className={BTN.primary}
                    >
                      {isApproving ? (
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                      ) : null}
                      {isApproving ? 'กำลังอนุมัติ...' : (<><Icon name="check" className="h-5 w-5" /> อนุมัติ</>)}
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
                      {isRejecting ? 'กำลังบันทึก...' : (<><Icon name="close" className="h-5 w-5" /> ปฏิเสธ</>)}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ตารางสมาชิกทั้งหมด */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
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
          <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายชื่อสมาชิกได้" hint={membersError} action={<button type="button" onClick={fetchMembers} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
        ) : sortedMembers.length === 0 ? (
          <EmptyState icon="document" tone="gray" title="ยังไม่มีสมาชิกในระบบ" hint="สมาชิกจะปรากฏที่นี่เมื่อเริ่มใช้งานแพ็กเกจ" />
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
                  <th className="px-6 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedMembers.map((row) => {
                  const planKey = membershipPlan(row)
                  const planMeta = MEMBERSHIP_PLANS[planKey] || { label: planKey || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
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
                      <td className="whitespace-nowrap px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPlanEdit({ email: row.email, plan: planKey || 'starter', expireDate: row.expire_date ? String(row.expire_date).slice(0, 10) : '' })}
                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300 lg:h-8"
                            aria-label={`แก้แพ็กเกจ ${row.email}`}
                          >
                            <Icon name="banknotes" className="h-4 w-4" />
                            แก้แพ็กเกจ/วันหมดอายุ
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmailEdit({ email: row.email })}
                            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-xs font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300 lg:h-8"
                            aria-label={`เปลี่ยนอีเมล ${row.email}`}
                          >
                            <Icon name="envelope" className="h-4 w-4" />
                            เปลี่ยนอีเมล
                          </button>
                        </div>
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
              const planKey = membershipPlan(row)
              const planMeta = MEMBERSHIP_PLANS[planKey] || { label: planKey || '—', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700' }
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
                  <button
                    type="button"
                    onClick={() => setPlanEdit({ email: row.email, plan: planKey || 'starter', expireDate: row.expire_date ? String(row.expire_date).slice(0, 10) : '' })}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                  >
                    <Icon name="banknotes" className="h-4 w-4" />
                    แก้แพ็กเกจ/วันหมดอายุ
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailEdit({ email: row.email })}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:border-emerald-300 hover:text-emerald-700 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
                  >
                    <Icon name="envelope" className="h-4 w-4" />
                    เปลี่ยนอีเมล (ลืมรหัส Gmail)
                  </button>
                </div>
              )
            })}
          </div>
          </>
        )}
      </section>
      </>
      )}

      {emailEdit ? (
        <Modal
          title="เปลี่ยนอีเมลสมาชิก"
          subtitle="สำหรับลูกค้าที่ลืมรหัส Gmail เข้าอีเมลเดิมไม่ได้"
          onClose={() => setEmailEdit(null)}
          maxWidth="sm:max-w-md"
          footer={
            <>
              <button type="button" onClick={() => setEmailEdit(null)} className={BTN.secondary}>ยกเลิก</button>
              <button
                type="submit"
                form="admin-email-form"
                disabled={savingEmail || !emailEdit.newEmail?.trim()}
                className={BTN.primary}
              >
                {savingEmail ? 'กำลังเปลี่ยน...' : 'ยืนยันเปลี่ยนอีเมล'}
              </button>
            </>
          }
        >
          <form
            id="admin-email-form"
            onSubmit={(e) => {
              e.preventDefault()
              const next = emailEdit.newEmail?.trim()
              if (next) handleChangeMemberEmail(emailEdit.email, next)
            }}
            className="space-y-4"
          >
            <div className="rounded-xl bg-gray-50 dark:bg-gray-950 px-3.5 py-3 text-sm">
              <p className="text-gray-500 dark:text-gray-400">อีเมลปัจจุบัน</p>
              <p className="mt-0.5 break-all font-semibold text-gray-900 dark:text-gray-100">{emailEdit.email}</p>
            </div>
            <Field label="อีเมลใหม่" required>
              <input
                type="email"
                value={emailEdit.newEmail ?? ''}
                onChange={(e) => setEmailEdit((p) => ({ ...p, newEmail: e.target.value }))}
                className={inputClass}
                placeholder="เช่น somchai.new@gmail.com"
                required
                autoFocus
              />
            </Field>
            <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              หลังเปลี่ยน ลูกค้ากด "ส่งลิงก์เข้าสู่ระบบ" ที่หน้าเข้าสู่ระบบด้วยอีเมลใหม่ได้ทันที — ข้อมูลห้อง บิล และสัญญาทั้งหมดยังอยู่ครบในบัญชีเดิม
            </p>
          </form>
        </Modal>
      ) : null}

      {planEdit ? (
        <Modal
          title="แก้แพ็กเกจและวันหมดอายุ"
          subtitle="อัปเดตแพ็กเกจและวันหมดอายุของสมาชิกให้ตรงตามที่ตกลงกัน"
          onClose={() => setPlanEdit(null)}
          maxWidth="sm:max-w-md"
          footer={
            <>
              <button type="button" onClick={() => setPlanEdit(null)} className={BTN.secondary}>ยกเลิก</button>
              <button
                type="submit"
                form="admin-plan-form"
                disabled={savingPlan || !planEdit.plan}
                className={BTN.primary}
              >
                {savingPlan ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
              </button>
            </>
          }
        >
          <form
            id="admin-plan-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (planEdit.plan) handleChangeMemberPlan(planEdit.email, planEdit.plan, planEdit.expireDate)
            }}
            className="space-y-4"
          >
            <div className="rounded-xl bg-gray-50 dark:bg-gray-950 px-3.5 py-3 text-sm">
              <p className="text-gray-500 dark:text-gray-400">สมาชิก</p>
              <p className="mt-0.5 break-all font-semibold text-gray-900 dark:text-gray-100">{planEdit.email}</p>
            </div>
            <Field label="แพ็กเกจ" required>
              <select
                value={planEdit.plan}
                onChange={(e) => setPlanEdit((p) => ({ ...p, plan: e.target.value }))}
                className={inputClass}
              >
                {ADMIN_PLAN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <Field label="วันหมดอายุ" hint="เว้นว่าง = คงวันเดิมไว้ (ถ้าเลือกผู้ก่อตั้งระบบจะตั้งให้ 100 ปีอัตโนมัติ)">
              <input
                type="date"
                value={planEdit.expireDate ?? ''}
                onChange={(e) => setPlanEdit((p) => ({ ...p, expireDate: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <p className="rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3.5 py-2.5 text-xs leading-relaxed text-sky-700 dark:text-sky-300">
              จำนวนห้องที่ใช้ได้จะปรับตามแพ็กเกจอัตโนมัติ (ทดลองใช้ 10 · Starter 20 · Pro 50 · ผู้ก่อตั้งไม่จำกัด) และสถานะจะเปลี่ยนเป็น "หมดอายุ" เองถ้าวันที่ตั้งอยู่ในอดีต
            </p>
          </form>
        </Modal>
      ) : null}

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
    <section className="overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-amber-100/70">
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
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">รอตรวจสอบสลิป</h2>
            <p className="text-sm text-amber-700 dark:text-amber-300 lg:hidden">มีผู้เช่าแจ้งชำระเงินแล้ว โปรดตรวจสอบหลักฐานก่อนยืนยัน</p>
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
        <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายการได้" hint={error} action={<button type="button" onClick={onRetry} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : items.length === 0 ? (
        <EmptyState icon="check" tone="amber" title="ไม่มีรายการรอตรวจสอบ" hint="ยังไม่มีผู้เช่าแจ้งชำระเงินในขณะนี้" />
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
                    className={BTN.primary}
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
                      <Icon name="close" className="h-5 w-5" />
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
            <CloseButton variant="floating" onClose={() => setPreviewSlip(null)} />
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

// แถบลิงก์แจ้งซ่อมสำหรับผู้เช่า — คัดลอกส่งในกลุ่ม LINE หรือติดหน้าห้องได้
// ลิงก์ใช้โดเมนของหน้าที่เปิดอยู่ (แพทเทิร์นเดียวกับลิงก์บิล) ถ้าตั้ง
// VITE_BILL_BASE_URL ไว้ก็ใช้ค่านั้นเพื่อให้ได้โดเมนจริงแม้เปิดจาก localhost
function RepairPortalLinkBand() {
  const [copied, setCopied] = useState(false)
  const link = (import.meta.env.VITE_BILL_BASE_URL || window.location.origin) + '/repair'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ใช้ไม่ได้ (ต้อง https หรือผู้ใช้ไม่อนุญาต) — ผู้ใช้ยังเลือกข้อความเองได้
    }
  }

  return (
    <div className="border-b border-sky-100 bg-sky-50/60 px-4 py-3 dark:border-sky-800/50 dark:bg-sky-950/20 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="w-full text-xs font-semibold text-sky-900 dark:text-sky-200 sm:w-auto">
          ลิงก์ให้ผู้เช่าแจ้งซ่อมเอง
        </p>
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2.5 py-2 text-xs text-gray-700 ring-1 ring-inset ring-sky-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-sky-800/70">
          {link}
        </code>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white transition-colors hover:bg-sky-700 lg:min-h-0 lg:py-2"
          >
            {copied ? (<><Icon name="check" className="h-4 w-4" /> คัดลอกแล้ว</>) : 'คัดลอกลิงก์'}
          </button>
          <a
            href="/repair"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg bg-white px-3 text-xs font-bold text-sky-700 ring-1 ring-inset ring-sky-300 transition-colors hover:bg-sky-50 dark:bg-gray-900 dark:text-sky-300 dark:ring-sky-800 lg:min-h-0 lg:py-2"
          >
            เปิดดู
          </a>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-sky-800/70 dark:text-sky-300/70">
        ผู้เช่ากรอกเบอร์โทรที่บันทึกในระบบเพื่อเข้าใช้ · ไม่ต้องสมัคร ไม่ต้องมีรหัสผ่าน
      </p>
    </div>
  )
}

// Modal ปิดงานซ่อม — เลือกผล สำเร็จ/ไม่สำเร็จ + หมายเหตุสั้นๆ ก่อนบันทึกเป็นประวัติ
function RepairOutcomeModal({ ticket, saving, onClose, onConfirm }) {
  const [outcome, setOutcome] = useState('success')
  const [note, setNote] = useState('')
  const rental = Array.isArray(ticket?.rentals) ? ticket.rentals[0] : ticket?.rentals

  const choices = [
    {
      key: 'success',
      label: 'ซ่อมสำเร็จ',
      icon: 'check',
      hint: 'ส่งข้อความแจ้งผู้เช่าในกลุ่ม LINE อัตโนมัติ',
      cls: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-500',
      idle: 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700',
    },
    {
      key: 'failed',
      label: 'ซ่อมไม่สำเร็จ',
      icon: 'close',
      hint: 'ไม่ส่งข้อความเข้า LINE — บันทึกผลเป็นประวัติเท่านั้น',
      cls: 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 ring-1 ring-rose-500',
      idle: 'border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-700',
    },
  ]

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ปิดงานซ่อม</h2>
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
              {displayAssetName(rental || {})} · {rental?.cust_name || 'ไม่ระบุ'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label="ปิด"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <form
          id="repair-close-form"
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm(ticket, outcome, note)
          }}
          className="flex-1 space-y-4 overflow-y-auto px-6 py-4"
        >
          <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm leading-relaxed text-gray-600 dark:bg-gray-950 dark:text-gray-400">
            {ticket?.description}
          </p>

          <div className="grid gap-2.5">
            {choices.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setOutcome(c.key)}
                aria-pressed={outcome === c.key}
                className={`min-h-11 rounded-xl border px-4 py-3 text-left transition-colors ${
                  outcome === c.key ? c.cls : c.idle
                }`}
              >
                <span className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100"><Icon name={c.icon} className="h-5 w-5" />{c.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{c.hint}</span>
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="repair-done-note" className="mb-1.5 block text-sm font-semibold text-gray-700 dark:text-gray-300">
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              id="repair-done-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder={outcome === 'success' ? 'เช่น เปลี่ยนวาล์วน้ำใหม่ ใช้งานได้ปกติ' : 'เช่น ต้องสั่งอะไรเพิ่ม นัดซ่อมใหม่สัปดาห์หน้า'}
            />
          </div>
        </form>

        <div className="flex gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
            ยกเลิก
          </button>
          <button
            type="submit"
            form="repair-close-form"
            disabled={saving}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกปิดงาน'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RepairSection({ items, loading, error, completingId, startingId, onComplete, onStart, onRetry }) {
  const [previewPhoto, setPreviewPhoto] = useState(null)
  // กรองตามการ์ดสรุปที่กด — done ไม่มีในลิสต์ (กดแล้วพาไปหน้าประวัติซ่อมแทน)
  const [filterStatus, setFilterStatus] = useState('all')
  const navigate = useNavigate()

  const counts = {
    open: items.filter((t) => t.status === 'open').length,
    in_progress: items.filter((t) => t.status === 'in_progress').length,
    done: items.filter((t) => t.status === 'done').length,
  }
  // เปิดก่อนเสร็จ — เรียงใหม่สุดขึ้นก่อน
  const active = items.filter((t) => t.status !== 'done')
  // กรองตามการ์ดสรุปที่กดค้างไว้
  const visible = filterStatus === 'all' ? active : active.filter((t) => t.status === filterStatus)

  const summary = [
    { key: 'open', label: 'เปิดใหม่', value: counts.open },
    { key: 'in_progress', label: 'กำลังดำเนินการ', value: counts.in_progress },
    { key: 'done', label: 'เสร็จแล้ว', value: counts.done },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-sky-100/70 dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-sky-100 dark:border-sky-800/50 bg-gradient-to-r from-sky-50 dark:from-sky-950/30 to-cyan-50 dark:to-cyan-950/30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/40">
            <Icon name="wrench" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">แจ้งซ่อม</h2>
            <p className="truncate text-sm text-sky-700 dark:text-sky-300 lg:hidden">ผู้เช่าแจ้งผ่าน LINE หรือลิงก์แจ้งซ่อมด้านล่าง</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-3 py-1 text-xs font-semibold text-sky-800 dark:text-sky-200 ring-1 ring-inset ring-sky-200 dark:ring-sky-800/70">
          {loading ? 'กำลังโหลด...' : `${active.length} รายการค้าง`}
        </span>
      </div>

      {/* ลิงก์แจ้งซ่อมสำหรับผู้เช่า — ถ้าไม่โชว์ที่นี่ เจ้าของจะไม่รู้ว่ามีหน้านี้
          ผู้เช่าเข้าด้วยเบอร์โทรที่บันทึกไว้ในระบบ ไม่ต้องสมัคร ไม่ต้องมีรหัส */}
      <RepairPortalLinkBand />

      {/* การ์ดสรุป 3 ใบ — กดเพื่อกรองรายการด้านล่าง (ส่วน "เสร็จแล้ว" พาไปหน้าประวัติซ่อม) */}
      <div className="grid grid-cols-3 gap-2.5 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-5">
        {summary.map((s) => {
          const tone = REPAIR_TONES[s.key]
          const selected = filterStatus === s.key
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => (s.key === 'done' ? navigate('/repairs/recent') : setFilterStatus(selected ? 'all' : s.key))}
              aria-pressed={s.key === 'done' ? undefined : selected}
              className={`rounded-2xl border p-3 text-left transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:p-4 ${tone.card} ${
                s.key !== 'done' && selected ? 'ring-2 ring-sky-500 ring-offset-1 dark:ring-offset-gray-900' : ''
              }`}
            >
              <p className={`text-xs font-semibold sm:text-sm ${tone.text}`}>{s.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${tone.text}`}>{s.value}</p>
            </button>
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
        <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายการแจ้งซ่อมได้" hint={error} action={<button type="button" onClick={onRetry} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : visible.length === 0 ? (
        <EmptyState icon="check" tone="emerald" title={filterStatus === 'all' ? 'ไม่มีงานซ่อมค้าง' : 'ไม่มีงานในสถานะนี้'} hint={filterStatus === 'all'
              ? 'ผู้เช่ายังไม่มีคำขอซ่อมใหม่ในขณะนี้'
              : `กดการ์ด "${filterStatus === 'open' ? 'เปิดใหม่' : 'กำลังดำเนินการ'}' อีกครั้งเพื่อดูทุกสถานะ`} />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {visible.map((t) => {
            const rental = Array.isArray(t.rentals) ? t.rentals[0] : t.rentals
            const itemDetails = displayAssetName(rental || {})
            const custName = rental?.cust_name || 'ไม่ระบุ'
            const isCompleting = completingId === t.id
            const isStarting = startingId === t.id
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

                {t.status === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onStart(t)}
                    disabled={isStarting}
                    className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-base font-semibold text-white shadow-sm shadow-amber-500/30 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isStarting ? (
                      <>
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                        </svg>
                        กำลังบันทึก...
                      </>
                    ) : (
                      (<><Icon name="wrench" className="h-5 w-5" /> เริ่มซ่อม</>)
                    )}
                  </button>
                ) : (
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
                      (<><Icon name="check" className="h-5 w-5" /> ปิดงานซ่อม — บันทึกผล</>)
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {previewPhoto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewPhoto(null)}>
          <div className="relative max-h-[90vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <CloseButton variant="floating" onClose={() => setPreviewPhoto(null)} />
            <img src={previewPhoto} alt="รูปแจ้งซ่อม" className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AllRepairsSection({ items, loading, error, onRetry }) {
  const [previewPhoto, setPreviewPhoto] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const counts = {
    all: items.length,
    open: items.filter((t) => t.status === 'open').length,
    in_progress: items.filter((t) => t.status === 'in_progress').length,
    done: items.filter((t) => t.status === 'done').length,
  }

  const filteredItems = filterStatus === 'all' ? items : items.filter((t) => t.status === filterStatus)

  const tabs = [
    { key: 'all', label: 'ทั้งหมด', count: counts.all },
    { key: 'open', label: 'เปิดใหม่', count: counts.open },
    { key: 'in_progress', label: 'กำลังซ่อม', count: counts.in_progress },
    { key: 'done', label: 'ประวัติซ่อม', count: counts.done },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 dark:border-sky-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-sky-100/70 dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-sky-100 dark:border-sky-800/50 bg-gradient-to-r from-sky-50 dark:from-sky-950/30 to-cyan-50 dark:to-cyan-950/30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/40">
            <Icon name="wrench" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">คำขอซ่อมทั้งหมด</h2>
            <p className="truncate text-sm text-sky-700 dark:text-sky-300 lg:hidden">รวมทุกสถานะ · เรียงใหม่สุดขึ้นก่อน</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 dark:bg-sky-900/40 px-3 py-1 text-xs font-semibold text-sky-800 dark:text-sky-200 ring-1 ring-inset ring-sky-200 dark:ring-sky-800/70">
          {loading ? 'กำลังโหลด...' : `${filteredItems.length} รายการ`}
        </span>
      </div>

      {/* แท็บกรอง */}
      <div className="border-b border-sky-100 dark:border-sky-800/50 bg-white dark:bg-gray-900">
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => {
            const isActive = filterStatus === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterStatus(tab.key)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive
                    ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-sky-50 dark:bg-sky-950/30" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายการแจ้งซ่อมได้" hint={error} action={<button type="button" onClick={onRetry} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : filteredItems.length === 0 ? (
        <EmptyState icon="document" tone="gray" title="ไม่มีรายการที่ตรงกัน" hint="ลองเปลี่ยนแท็บเพื่อดูรายการอื่น" />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {filteredItems.map((t) => {
            const rental = Array.isArray(t.rentals) ? t.rentals[0] : t.rentals
            const itemDetails = displayAssetName(rental || {})
            const custName = rental?.cust_name || 'ไม่ระบุ'
            const isFailed = t.status === 'done' && t.outcome === 'failed'
            const tone = isFailed ? REPAIR_TONES.open : REPAIR_TONES[t.status] || REPAIR_TONES.open
            const statusLabel =
              t.status === 'done'
                ? t.outcome === 'success'
                  ? 'ซ่อมสำเร็จ'
                  : isFailed
                    ? 'ซ่อมไม่สำเร็จ'
                    : 'เสร็จแล้ว'
                : t.status === 'in_progress'
                  ? 'กำลังซ่อม'
                  : 'เปิดใหม่'

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
                    {statusLabel}
                  </span>
                </div>

                <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200">{t.description}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  แจ้งเมื่อ {formatDate(t.created_at)}
                  {t.status === 'done' && t.done_at ? ` · ปิดงาน ${formatDate(t.done_at)}` : ''}
                </p>

                {t.done_note ? (
                  <p className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-400">
                    หมายเหตุ: {t.done_note}
                  </p>
                ) : null}

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
              <Icon name="close" className="h-5 w-5" />
            </button>
            <img src={previewPhoto} alt="รูปแจ้งซ่อม" className="max-h-[90vh] rounded-2xl shadow-2xl" />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AllPaymentsSection({ items, loading, error, onRetry }) {
  const [filterPeriod, setFilterPeriod] = useState('all')

  // แท็บเดือนย้อนหลัง 3 เดือน — เก็บเป็น ISO 'YYYY-MM' ให้เทียบกับ tx.period ได้ตรงๆ
  // (formatPeriod รับเฉพาะรูปแบบนี้ ถ้าส่ง ISO timestamp เต็มเข้าไปจะได้ string ดิบกลับ ทำให้ label เพี้ยนและ count เป็น 0 เสมอ)
  const periods = []
  const now = new Date()
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  // เทียบสองฝั่งผ่าน formatPeriod เพื่อรองรับ period เก่าที่เคยบันทึกเป็นข้อความไทย
  const samePeriod = (a, b) => formatPeriod(a) === formatPeriod(b)
  const filteredItems = filterPeriod === 'all' ? items : items.filter((tx) => samePeriod(tx.period, filterPeriod))

  const tabs = [
    { key: 'all', label: 'ทั้งหมด', count: items.length },
    ...periods.map((p) => ({
      key: p,
      label: formatPeriod(p),
      count: items.filter((tx) => samePeriod(tx.period, p)).length,
    })),
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-gray-900 shadow-lg shadow-emerald-100/70 dark:shadow-none">
      <div className="flex items-center justify-between gap-4 border-b border-emerald-100 dark:border-emerald-800/50 bg-gradient-to-r from-emerald-50 dark:from-emerald-950/30 to-teal-50 dark:to-teal-950/30 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
            <Icon name="banknotes" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 lg:hidden">ชำระเงินทั้งหมด</h2>
            <p className="truncate text-sm text-emerald-700 dark:text-emerald-300 lg:hidden">บิลที่ยืนยันการชำระแล้ว · เรียงใหม่สุดขึ้นก่อน</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/70">
          {loading ? 'กำลังโหลด...' : `${filteredItems.length} รายการ`}
        </span>
      </div>

      {/* แท็บกรอง */}
      <div className="border-b border-emerald-100 dark:border-emerald-800/50 bg-white dark:bg-gray-900">
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => {
            const isActive = filterPeriod === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterPeriod(tab.key)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 p-4 sm:p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-emerald-50 dark:bg-emerald-950/30" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon="warning" tone="rose" title="ไม่สามารถโหลดรายการชำระเงินได้" hint={error} action={<button type="button" onClick={onRetry} className={BTN.primary}><Icon name="refresh" className="h-4 w-4" />ลองอีกครั้ง</button>} />
      ) : filteredItems.length === 0 ? (
        <EmptyState icon="document" tone="gray" title="ไม่มีรายการที่ตรงกัน" hint="ลองเปลี่ยนแท็บเพื่อดูรายการอื่น" />
      ) : (
        <div className="divide-y divide-emerald-100 dark:divide-emerald-800/50">
          {filteredItems.map((tx) => {
            const rental = Array.isArray(tx.rentals) ? tx.rentals[0] : tx.rentals
            return (
              <div key={tx.id} className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <Icon name="check" className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{rental?.cust_name || 'ไม่ระบุ'}</p>
                  <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">
                    {displayAssetName(rental || {})} · {formatPeriod(tx.period) || formatDate(tx.created_at)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(txAmount(tx))}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatDate(tx.created_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}


// EMPTY_FORM, inputClass, CollapsibleSection, Toggle, AddRentalModal
// ย้ายไป src/utils/asset.js, src/components/styles.js, src/components/formControls.jsx,
// src/modals/AddAssetModal.jsx แล้ว


function LineBindingModal({ code, custName, onClose }) {
  const [copied, setCopied] = useState(false)
  const [botUrl, setBotUrl] = useState('')

  useEffect(() => {
    if (!code) return
    // โหลด bot_add_url จาก app_settings
    async function fetchBotUrl() {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'bot_add_url')
        .single()
      if (data?.value) {
        setBotUrl(data.value)
      }
    }
    fetchBotUrl()
  }, [code])

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
    { title: 'เพิ่มเพื่อนบอท PayRentPro ใน LINE', desc: botUrl ? 'คลิกปุ่มด้านล่างเพื่อเพิ่มเพื่อน' : 'เพิ่มเพื่อนบอทใน LINE' },
    { title: 'เชิญบอทเข้ากลุ่มแชทกับผู้เช่า', desc: 'สร้างกลุ่มใหม่หรือใช้กลุ่มเดิม แล้วเชิญบอทเข้า' },
    { title: 'พิมพ์รหัส 9 หลักลงในกลุ่มไลน์', desc: `พิมพ์รหัส ${code} ในกลุ่ม แล้วระบบจะผูกกลุ่มกับบิลนี้ให้อัตโนมัติ` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto overflow-x-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">เพิ่มผู้เช่าสำเร็จ</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">ผูกกลุ่มไลน์สำหรับทวงหนี้อัตโนมัติ</h2>
          <CloseButton variant="floating" onClose={onClose} />
        </div>

        <div className="px-6 py-6">
          {custName && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ผู้เช่า: <span className="font-semibold text-gray-900 dark:text-gray-100">{custName}</span>
            </p>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-3.5 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
            <Icon name="refresh" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>รหัสถูกออกใหม่ให้ผู้เช่ารายนี้แล้ว — ต้องพิมพ์รหัสนี้ในกลุ่มไลน์ก่อน ระบบจึงจะส่งบิลเข้ากลุ่ม (รหัสและกลุ่มของผู้เช่าก่อนหน้าใช้ต่อไม่ได้)</span>
          </div>

          <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">รหัสผูกกลุ่มของคุณ</p>
            <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{code}</p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
            >
              {copied ? (<><Icon name="check" className="h-4 w-4" /> คัดลอกแล้ว</>) : 'คัดลอกรหัส'}
            </button>
          </div>

          <ol className="mt-6 space-y-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-sm shadow-emerald-600/30">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{step.desc}</p>
                  {i === 0 && botUrl && (
                    <a
                      href={botUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
                    >
                      <Icon name="external-link" className="h-3.5 w-3.5" />
                      เพิ่มเพื่อนบอท
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-4 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 sm:py-3 sm:text-sm"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  )
}

function MeterBillModal({ rental, onClose, onConfirm, onResendBill, onResendReceipt }) {
  const [waterCurrent, setWaterCurrent] = useState('')
  const [elecCurrent, setElecCurrent] = useState('')
  const [sendToLine, setSendToLine] = useState(true)
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState(currentPeriod())
  const [existingBills, setExistingBills] = useState([])
  const [resending, setResending] = useState(false)
  const [resendingReceipt, setResendingReceipt] = useState(false)

  useEffect(() => {
    if (rental) {
      setWaterCurrent('')
      setElecCurrent('')
      setSendToLine(true)
      setSaving(false)
      setResending(false)
      setResendingReceipt(false)
      setPeriod(currentPeriod())
    }
  }, [rental])

  // บิลที่ห้องนี้มีอยู่แล้ว (กันสร้างซ้ำ ชน unique rental+period)
  // เก็บ id/สถานะ/ยอด ด้วยเพื่อให้ส่งบิลเดิมหรือใบเสร็จซ้ำได้เมื่อลูกค้าไม่ได้รับ/ไลน์หาย
  useEffect(() => {
    const rentalId = rental?.id
    if (!rentalId) {
      setExistingBills([])
      return
    }
    let active = true
    supabase
      .from('transactions')
      .select('id, period, status, total_amount, base_amount, paid_amount, water_units, water_cost, elec_units, elec_cost, extra_charges, penalty_days, penalty_amount')
      .eq('rental_id', rentalId)
      .then(({ data }) => {
        if (active) setExistingBills((Array.isArray(data) ? data : []).filter((t) => t.period))
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
  const minWater = Number(rental.min_water_charge) || 0
  const minElec = Number(rental.min_elec_charge) || 0

  const curWater = Number(waterCurrent) || 0
  const curElec = Number(elecCurrent) || 0
  const waterUnits = Math.max(0, curWater - lastWater)
  const waterCost = Math.max(waterUnits * waterRate, minWater)
  const elecUnits = Math.max(0, curElec - lastElec)
  const elecCost = Math.max(elecUnits * elecRate, minElec)
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
  const existingPeriods = existingBills.map((t) => t.period)
  const billForPeriod = existingBills.find((t) => t.period === period || t.period === periodLabel)
  const periodHasBill = Boolean(billForPeriod)
  const optionHasBill = (o) => existingPeriods.includes(o.value) || existingPeriods.includes(o.label)
  // ใบเสร็จออกได้เฉพาะบิลที่ยืนยันการชำระแล้ว
  const billIsPaid = String(billForPeriod?.status ?? '').toLowerCase() === 'paid'

  const handleConfirm = async () => {
    setSaving(true)
    try {
      await onConfirm(rental, { waterCurrent, elecCurrent }, sendToLine, period)
    } finally {
      setSaving(false)
    }
  }

  // ส่งบิลเดิมของงวดนี้เข้าไลน์อีกครั้ง (ลูกค้าไม่ได้รับ / ไลน์หาย) — ไม่สร้างบิลใหม่
  const handleResend = async () => {
    if (!billForPeriod?.id) return
    setResending(true)
    try {
      await onResendBill?.(billForPeriod.id)
    } finally {
      setResending(false)
    }
  }

  // ออกใบเสร็จของบิลงวดนี้ส่งเข้าไลน์อีกครั้ง (เฉพาะบิลที่ชำระแล้ว)
  const handleResendReceipt = async () => {
    if (!billForPeriod?.id) return
    setResendingReceipt(true)
    try {
      const total = Number(billForPeriod.total_amount || billForPeriod.base_amount || 0)
      await onResendReceipt?.({
        txId: billForPeriod.id,
        custName: rental.cust_name,
        itemDetails: displayAssetName(rental),
        period: billForPeriod.period,
        totalAmount: total,
        paidAmount: Number(billForPeriod.paid_amount) > 0 ? Number(billForPeriod.paid_amount) : total,
        items: receiptItemsFromTx(billForPeriod),
      })
    } finally {
      setResendingReceipt(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Icon name="banknotes" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">บันทึกมิเตอร์และสร้างบิล</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
            </div>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
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
              <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  <Icon name="warning" className="h-5 w-5" /> งวดนี้มีบิลอยู่แล้ว — ไม่สามารถสร้างบิลซ้ำได้
                </p>
                <p className="mt-1 text-xs text-amber-600/90 dark:text-amber-400/80">
                  {billIsPaid
                    ? 'บิลนี้ชำระแล้ว — ถ้าลูกค้าไม่ได้รับใบเสร็จ หรือข้อความในไลน์หาย ส่งอีกครั้งได้ (ไม่สร้างบิลใหม่)'
                    : 'ถ้าลูกค้าไม่ได้รับบิล หรือข้อความในไลน์หาย ส่งบิลเดิมอีกครั้งได้ (ไม่สร้างบิลใหม่)'}
                </p>
                <div className="mt-2.5 flex flex-col gap-2 lg:flex-row lg:items-center">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending || resendingReceipt}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 lg:w-auto lg:py-2"
                  >
                    {resending ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>
                        กำลังส่ง...
                      </>
                    ) : (
                      <><Icon name="send" className="h-5 w-5" /> ส่งบิลนี้เข้าไลน์อีกครั้ง</>
                    )}
                  </button>
                  {billIsPaid && (
                    <button
                      type="button"
                      onClick={handleResendReceipt}
                      disabled={resending || resendingReceipt}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-0 lg:w-auto lg:py-2"
                    >
                      {resendingReceipt ? (
                        <>
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" /></svg>
                          กำลังส่ง...
                        </>
                      ) : (
                        <><Icon name="receipt" className="h-5 w-5" /> ส่งใบเสร็จอีกครั้ง</>
                      )}
                    </button>
                  )}
                </div>
              </div>
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
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{waterRate} ฿/หน่วย</span></div>
                </div>
                <label htmlFor="water_current" className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์น้ำปัจจุบัน</label>
                <input id="water_current" type="number" min="0" step="1" value={waterCurrent} onChange={(e) => setWaterCurrent(e.target.value)} placeholder="เช่น 150" className={inputClass} />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">ใช้ไป {waterUnits} หน่วย = {formatCurrency(waterCost)}</p>
              </div>

              <div className="rounded-2xl border border-amber-100 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/30 p-4">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">ค่าไฟ</p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastElec}</span></div>
                  <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{elecRate} ฿/หน่วย</span></div>
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
            <Icon name="send" className="h-5 w-5" /> ส่งบิลเข้าไลน์อัตโนมัติ
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className={`${BTN.secondary} w-full sm:w-auto`}>ยกเลิก</button>
            <button type="button" onClick={handleConfirm} disabled={saving || periodHasBill} className={`${BTN.primary} w-full sm:w-auto`}>
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
          <CloseButton onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <label htmlFor="renew_lease_end" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันสิ้นสุดสัญญาใหม่</label>
          <input id="renew_lease_end" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} disabled={saving} className={`${BTN.secondary} w-full sm:w-auto`}>ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={saving} className={`${BTN.primary} w-full sm:w-auto`}>
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
          <button type="button" onClick={onClose} disabled={saving} className={`${BTN.secondary} w-full sm:w-auto`}>ยกเลิก</button>
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
  const [showEdit, setShowEdit] = useState(false)

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
    } catch (err) {
      console.error('Copy error:', err)
    }
  }

  const handleSaveEdit = async (patch) => {
    try {
      const { applyAll, ...changes } = patch
      const { error } = await supabase
        .from('rentals')
        .update(changes)
        .eq('id', rental.id)

      if (error) throw error

      // Audit log
      const auditFields = ['bill_day', 'penalty_day', 'min_water_charge', 'min_elec_charge']
      for (const field of auditFields) {
        if (changes[field] !== undefined && changes[field] !== rental[field]) {
          await supabase.from('rental_audit_log').insert({
            rental_id: rental.id,
            field_name: field,
            old_value: String(rental[field] ?? ''),
            new_value: String(changes[field] ?? ''),
          })
        }
      }

      // "ใช้กับทุกห้อง" — เอาค่าเดียวกันไปใส่ทุกสินทรัพย์ของเจ้าของรายนี้
      // (ห้องปัจจุบันอัปเดตไปแล้วจึง neq ออก; RLS กันไม่ให้แตะของคนอื่นอยู่แล้ว)
      if (applyAll) {
        const { count, error: bulkError } = await supabase
          .from('rentals')
          .update(changes, { count: 'exact' })
          .eq('landlord_id', rental.landlord_id)
          .neq('id', rental.id)
        if (bulkError) throw bulkError
        onToast?.({ type: 'success', message: `บันทึกแล้ว — ใช้กับอีก ${count ?? 0} รายการ` })
      } else {
        onToast?.({ type: 'success', message: 'บันทึกแล้ว' })
      }
      onClose()
    } catch (err) {
      console.error('Save rental edit:', err)
      onToast?.({ type: 'error', message: err.message || 'บันทึกไม่สำเร็จ' })
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Icon name="document" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ข้อมูลสินทรัพย์เพิ่มเติม</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
            >
              <Icon name="edit" className="h-4 w-4" /> แก้ไข
            </button>
            <CloseButton onClose={onClose} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-4">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">เชื่อมต่อ LINE</p>
            {rental.group_id ? (
              <span className="mt-2 inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                <Icon name="link" className="h-4 w-4" /> ผูกกลุ่มแล้ว
              </span>
            ) : (
              <div className="mt-2">
                <p className="font-mono text-2xl font-bold tracking-[0.2em] text-gray-900 dark:text-gray-100">{rental.binding_code || '—'}</p>
                <button
                  type="button"
                  onClick={copyBindingCode}
                  className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
                >
                  {copied ? (<><Icon name="check" className="h-4 w-4" /> คัดลอกแล้ว</>) : 'คัดลอกรหัส'}
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
                  const icon = r.kind === 'due_soon' ? 'clock' : r.kind === 'chase' ? 'warning' : r.kind === 'receipt' ? 'receipt' : 'megaphone'
                  const expanded = expandedReminder === i
                  const at = r.sent_at
                    ? new Date(r.sent_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.'
                    : '—'
                  return (
                    <li key={`${r.sent_at ?? ''}-${i}`} className="relative pb-4 last:pb-0">
                      <span className="absolute -left-[35px] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base shadow-sm">
                        <Icon name={icon} className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{at}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedReminder(expanded ? null : i)}
                        className={`mt-0.5 w-full text-left text-sm leading-relaxed text-gray-600 dark:text-gray-400 transition-colors hover:text-gray-800 dark:hover:text-gray-200 ${expanded ? '' : 'line-clamp-2'}`}
                      >
                        {r.message_text || '—'}
                      </button>
                      <span className="mt-0.5 inline-block text-xs font-medium text-emerald-500 dark:text-emerald-400">
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
            className={`${BTN.primary} w-full`}
          >
            ปิด
          </button>
        </div>
      </div>

      {showEdit && (
        <EditRentalModal
          rental={rental}
          onClose={() => setShowEdit(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}

function EditRentalModal({ rental, onClose, onSave }) {
  const [form, setForm] = useState({
    bill_day: rental.bill_day ?? rental.due_date ?? 1,
    penalty_day: rental.penalty_day ?? rental.due_date ?? 1,
    min_water_charge: rental.min_water_charge ?? 0,
    min_elec_charge: rental.min_elec_charge ?? 0,
  })
  const [applyAll, setApplyAll] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSave({ ...form, applyAll })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">แก้ไขรายละเอียดห้อง</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{rental.cust_name} · {displayAssetName(rental)}</p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">รอบบิล & ค่าปรับ</p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              วันส่งบิล (bill_day) = วันที่ส่งบิลเข้าไลน์ · วันเริ่มคิดค่าปรับ (penalty_day) = วันที่เกินแล้วเริ่มปรับ
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันส่งบิล (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.bill_day}
              onChange={(e) => setForm({ ...form, bill_day: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันเริ่มคิดค่าปรับ (1-31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.penalty_day}
              onChange={(e) => setForm({ ...form, penalty_day: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-4 py-3">
            <p className="text-sm font-bold text-sky-800 dark:text-sky-200">ค่าขั้นต่ำน้ำไฟ</p>
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
              ถ้าคำนวณแล้วยอดต่ำกว่าขั้นต่ำ = ใช้ยอดขั้นต่ำ (ใช้ได้ทั้งบิลรวมและบิลแยก)
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าน้ำขั้นต่ำ (฿)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.min_water_charge}
              onChange={(e) => setForm({ ...form, min_water_charge: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าไฟขั้นต่ำ (฿)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.min_elec_charge}
              onChange={(e) => setForm({ ...form, min_elec_charge: Number(e.target.value) })}
              className={inputClass}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-4 py-3">
            <input
              type="checkbox"
              checked={applyAll}
              onChange={(e) => setApplyAll(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm">
              <span className="font-semibold text-gray-900 dark:text-gray-100">ใช้ค่านี้กับทุกห้อง/สินทรัพย์</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                อัปเดตวันส่งบิล วันเริ่มค่าปรับ และค่าขั้นต่ำน้ำไฟให้ทุกรายการของคุณเหมือนกันหมด
              </span>
            </span>
          </label>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4">
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className={`${BTN.secondary} flex-1`}>
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={`${BTN.primary} flex-1`}
            >
              {saving ? 'กำลังบันทึก...' : applyAll ? 'บันทึก + ใช้กับทุกห้อง' : 'บันทึก'}
            </button>
          </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
              <Icon name="cog" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ตั้งค่าบัญชีรับเงิน</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">กำหนดช่องทางที่ผู้เช่าใช้โอนเงินให้คุณ</p>
            </div>
          </div>
          <CloseButton onClose={onClose} />
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
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${!isBank ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-500'}`}
                    >
                      <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">พร้อมเพย์ (PromptPay)</span>
                      <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">เบอร์โทร / เลขบัตรประชาชน</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, payment_type: 'bank' }))}
                      className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${isBank ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-500'}`}
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
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
                      className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
              className={`${BTN.secondary} w-full sm:w-auto`}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className={`${BTN.primary} w-full sm:w-auto`}
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
        <div className="relative bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-6 text-white">
          <p className="text-sm font-medium text-emerald-100">ใบแจ้งหนี้ / INVOICE</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">PayRentPro</h2>
          <CloseButton variant="floating" onClose={onClose} />
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
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
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
              <Icon name="pencil" className="h-4 w-4" /> แก้ยอดแล้ว — ลิงก์บิลเดิมที่ผู้เช่าเปิดอยู่จะแสดงยอดใหม่อัตโนมัติ
            </div>
          )}
          <div className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${isPaid ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800/70' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-800/70'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isPaid ? 'ชำระแล้ว' : 'รอการชำระเงิน'}
          </div>

          {invoice.sent && (
            <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-200 dark:ring-emerald-800/70">
              <Icon name="check" className="h-4 w-4" /> ส่งบิลเข้าไลน์สำเร็จแล้ว
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
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                  <Icon name="banknotes" className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">โอนเข้าบัญชีธนาคาร</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{invoice.paymentText}</p>
              </div>
            ) : !invoice.promptpayNumber ? (
              <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm dark:border-amber-800/50 dark:bg-amber-950/30">
                <Icon name="warning" className="mx-auto h-10 w-10 text-amber-500 dark:text-amber-400" />
                <p className="mt-2 text-sm font-semibold text-amber-800 dark:text-amber-200">ยังไม่ได้ตั้งค่าพร้อมเพย์รับเงิน</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  บิลนี้ยังไม่มี QR ให้ผู้เช่าสแกนจ่าย — ไปตั้งค่าเบอร์พร้อมเพย์ได้ที่หน้า "ตั้งค่าบัญชี" (เมนูที่มุมขวาบน)
                </p>
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
                <p className="font-mono text-sm text-gray-500 dark:text-gray-400">{invoice.promptpayNumber}</p>
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-4 text-base font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-800/50 lg:py-2.5 lg:text-sm"
            >
              <Icon name="pencil" className="h-5 w-5" /> แก้ไขยอดบิล
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
                <Icon name="receipt" className="h-5 w-5" />
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
              (<><Icon name="check" className="h-4 w-4" /> ส่งสำเร็จแล้ว</>)
            ) : justEdited ? (
              (<><Icon name="send" className="h-4 w-4" /> ส่งบิลฉบับแก้ไขเข้าไลน์</>)
            ) : (
              (<><Icon name="send" className="h-4 w-4" /> ส่งบิลเข้าไลน์</>)
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-4 text-base font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-800/50 lg:py-2.5 lg:text-sm"
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
              isPaid ? 'bg-emerald-500' : 'bg-emerald-600 hover:bg-emerald-500'
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
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function TrialWelcomeScreen({ starting, notice, onStart, onSignOut }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 dark:from-emerald-950/30 via-white to-white px-4 py-10 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-xl shadow-emerald-100/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
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
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-600/30 transition-colors hover:bg-emerald-500"
        >
          <Icon name="gem" className="h-5 w-5" /> ต่ออายุออนไลน์ (สแกน QR + อัปโหลดสลิป)
        </button>
        <button
          type="button"
          onClick={() => setShowRenew((prev) => !prev)}
          className="mt-3 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {showRenew ? 'ซ่อนวิธีต่ออายุแบบแจ้งโอน' : 'ต่ออายุด้วยการแจ้งโอนผ่าน LINE'}
        </button>
        {showRenew && (
          <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-4 text-sm leading-relaxed text-emerald-900 dark:text-emerald-200">
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
    // จอขาวตอน F5: getSession() ใช้ Web Locks ตีความหมด (แท็บอื่นถือ lock อยู่ /
    // refresh token ล้ม) แล้ว reject — ถ้าไม่ .catch ค่า authLoading จะค้างเป็น
    // true ตลอดไป หน้าเลยติดที่ "กำลังโหลด..." บนพื้นขาวเฉย ๆ ต้องปิด loading เสมอ
    const finishLoading = (sessionOrNull) => {
      if (!active) return
      setSession(sessionOrNull)
      setAuthLoading(false)
    }
    // เบาะหลัง: getSession ค้างโดยไม่ resolve สักที (lock ตาย) — ปล่อยผ่านหน้ารอ
    // ไปเรื่อย ๆ ไม่ได้ ให้ตัดสินใจแทนที่ 15 วิ โดย session จริงยังมาทีหลังได้
    // ผ่าน onAuthStateChange ด้านล่าง
    let settled = false
    const settle = () => { settled = true }
    supabase.auth.getSession().then(({ data }) => { settle(); finishLoading(data.session) },
      (err) => { settle(); console.warn('getSession failed:', err?.message || err); finishLoading(null) })
    const hangFallback = setTimeout(() => {
      if (active && !settled) finishLoading(null)
    }, 15000)

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      // INITIAL_SESSION ยิงเสมอหลัง subscribe — ใช้เป็นสัญญาณปิด loading อีกทาง
      // (เผื่อ getSession ค้างแต่ event มาถึงก่อน)
      if (event === 'INITIAL_SESSION') setAuthLoading(false)

      // บันทึกการเข้าสู่ระบบ — fire-and-forget ไม่ให้ล้มแล้วบล็อกการใช้งาน
      // SIGNED_IN ยิงซ้ำทุกครั้งที่ token refresh และทุกแท็บที่เปิดอยู่
      // ตัวกันซ้ำจริงคือ unique index (session_id, action) ฝั่ง DB
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user
        const provider = String(user.email ?? '').toLowerCase() === DEMO_ACCOUNT_EMAIL
          ? 'demo'
          : (user.app_metadata?.provider || 'email')
        supabase.rpc('log_activity', { p_action: 'login', p_detail: provider })
          .then(({ error }) => { if (error) console.warn('Log login failed:', error.message) })
          .catch((err) => console.warn('Log login failed:', err?.message))
      }
    })

    return () => {
      active = false
      clearTimeout(hangFallback)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const user = session?.user
    if (!user) return
    // ต้องใช้ .is() ไม่ใช่ .eq() กับ null — .eq('user_id', null) ส่งไปเป็น
    // user_id=eq.null แล้ว Postgres cast สตริง "null" เป็น uuid ไม่ได้
    // (error 22P02) ทำให้การผูกแถว admins กับ user_id ไม่เคยสำเร็จ
    supabase.from('admins')
      .update({ user_id: user.id })
      .is('user_id', null)
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

  return (
    <ErrorBoundary>
      <Dashboard userEmail={session.user?.email ?? ''} />
    </ErrorBoundary>
  )
}

function Dashboard({ userEmail = '' }) {
  const { theme, toggleTheme, largeText, toggleLargeText } = useTheme()
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false)
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false)
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
  const [pendingUtilityBills, setPendingUtilityBills] = useState([])
  // snapshot รายชื่อห้องตอนเปิดหน้ากรอกมิเตอร์ — list สดจะถูก refresh หลังบันทึกแต่ละห้อง
  // ทำให้ index ใน wizard ชี้ข้ามห้อง จึงต้องแช่แข็งรายชื่อไว้ตอนเข้าหน้า
  const [utilitySnapshot, setUtilitySnapshot] = useState([])
  const [utilityModal, setUtilityModal] = useState(null)
  const [utilityListModal, setUtilityListModal] = useState(false)
  const [mobileView, setMobileView] = useState(null) // 'slips' | 'overdue' | 'urgent' | 'utility' | 'more' | null
  const [repairTickets, setRepairTickets] = useState([])
  const [repairLoading, setRepairLoading] = useState(true)
  const [repairError, setRepairError] = useState(null)
  const [allPayments, setAllPayments] = useState([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsError, setPaymentsError] = useState(null)
  const [completingRepairId, setCompletingRepairId] = useState(null)
  const [startingRepairId, setStartingRepairId] = useState(null)
  const [closingRepair, setClosingRepair] = useState(null) // ticket ที่เปิด modal ปิดงานอยู่
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
      // embed บิลของแต่ละห้องมาด้วย — หน้ามือถือ (ค้างชำระ/การ์ดแดง/จ่ายสด)
      // อ่าน r.transactions ถ้าไม่ embed รายการค้างชำระจะว่างตลอด
      // (transactions ไม่มี due_date — วันครบกำหนดคำนวณจาก period+bill_day ด้วย billDueDate)
      const { data, error: supabaseError } = await supabase
        .from('rentals')
        .select('*, transactions(id, period, status, total_amount, paid_amount, base_amount, water_cost, elec_cost, water_units, elec_units, extra_charges, penalty_amount, penalty_days, created_at)')
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
        .select('id, description, status, photo_url, created_at, started_at, done_at, outcome, done_note, rentals(cust_name, item_details, sub_label)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRepairTickets(Array.isArray(data) ? data : [])
    } catch (err) {
      if (!silent) setRepairError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      if (!silent) setRepairLoading(false)
    }
  }, [])

  // หน้า /finance/recent — บิลที่ยืนยันชำระแล้ว เรียงใหม่สุดก่อน
  // (แยกจาก txInsights ซึ่งดึงทุกสถานะไว้คำนวณกราฟแดชบอร์ด ไม่เหมาะป้อนหน้ารายการ)
  const fetchAllPayments = useCallback(async () => {
    setPaymentsLoading(true)
    setPaymentsError(null)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, status, total_amount, base_amount, period, created_at, rentals(cust_name, item_details, sub_label)')
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setAllPayments(Array.isArray(data) ? data : [])
    } catch (err) {
      setPaymentsError(err?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  // เริ่มซ่อม — เปลี่ยน open → in_progress และจดเวลาไว้ทำประวัติ
  const handleStartRepair = useCallback(async (ticket) => {
    if (!ticket?.id) return
    setStartingRepairId(ticket.id)
    try {
      const { error } = await supabase
        .from('repair_tickets')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', ticket.id)
      if (error) throw error
      setToast({ type: 'success', message: 'เริ่มซ่อมแล้ว — สถานะเปลี่ยนเป็นกำลังซ่อม' })
      await fetchRepairTickets(true)
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'อัปเดตสถานะไม่สำเร็จ' })
    } finally {
      setStartingRepairId(null)
    }
  }, [fetchRepairTickets])

  // ปิดงานซ่อม — บันทึกผล (สำเร็จ/ไม่สำเร็จ) + หมายเหตุเป็นประวัติ
  // ผล "สำเร็จ" เท่านั้นที่ push แจ้งกลุ่ม LINE (ข้อความของ RPC คือ "ซ่อมเสร็จเรียบร้อย"
  // การส่งข้อความนี้ให้งานที่ซ่อมไม่สำเร็จจะสับสน)
  const handleCompleteRepair = useCallback(async (ticket, outcome, note) => {
    if (!ticket?.id) return
    setCompletingRepairId(ticket.id)
    try {
      const { error } = await supabase
        .from('repair_tickets')
        .update({
          status: 'done',
          done_at: new Date().toISOString(),
          outcome,
          done_note: note?.trim() ? note.trim() : null,
        })
        .eq('id', ticket.id)
      if (error) throw error

      if (outcome === 'success') {
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
      } else {
        setToast({ type: 'warning', message: 'บันทึกปิดงานแล้ว — ซ่อมไม่สำเร็จ (ไม่ส่งข้อความเข้า LINE)' })
      }
      setClosingRepair(null)
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

  // ห้องที่ส่งบิลค่าเช่าไปแล้ว (ไม่มีน้ำไฟ) แต่ยังไม่ได้ส่งบิลน้ำไฟแยก
  // เงื่อนไข: มี tx ล่าสุดที่ water_units=0 และ elec_units=0 และ utility_enabled=true
  const fetchPendingUtilityBills = useCallback(async () => {
    try {
      // ดึงห้องที่เปิด utility_enabled
      const { data: rentalsData, error: rentalsError } = await supabase
        .from('rentals')
        .select('id, cust_name, item_details, sub_label, utility_enabled, biz_type, last_water_meter, last_elec_meter, water_rate, elec_rate, min_water_charge, min_elec_charge')
        .eq('utility_enabled', true)
      if (rentalsError) throw rentalsError
      const utilityRentals = (rentalsData || []).filter((r) => normalizeBizType(r.biz_type) === 'property')

      if (utilityRentals.length === 0) {
        setPendingUtilityBills([])
        return
      }

      // ดึงบิลล่าสุดของแต่ละห้อง
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('rental_id, period, water_units, elec_units, created_at')
        .in('rental_id', utilityRentals.map((r) => r.id))
        .order('created_at', { ascending: false })
      if (txError) throw txError

      // กรองเฉพาะห้องที่บิลล่าสุดไม่มีน้ำไฟ
      const pending = []
      for (const rental of utilityRentals) {
        // ข้ามร่างบิล — draft ยังไม่ได้ออกจริง ต้องไม่ถูกนับเป็น "บิลล่าสุด" ของห้อง
        const lastTx = (txData || []).find((t) => t.rental_id === rental.id && String(t.status ?? '').toLowerCase() !== 'draft')
        if (lastTx && Number(lastTx.water_units || 0) === 0 && Number(lastTx.elec_units || 0) === 0) {
          pending.push({ ...rental, lastPeriod: lastTx.period })
        }
      }
      setPendingUtilityBills(pending)
    } catch (err) {
      console.error('Pending utility bills fetch error:', err)
      setPendingUtilityBills([])
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
    fetchPendingUtilityBills()
    fetchTxInsights()
    fetchRepairTickets()
  }, [fetchPendingReviews, fetchSummary, fetchOverdue, fetchPendingUtilityBills, fetchTxInsights, fetchRepairTickets])

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

  // ออกใบเสร็จ → อัปโหลด bucket receipts → ส่งรูปเข้ากลุ่ม LINE
  // failPrefix: คำนำหน้าเมื่อพัง (คนละ flow ใช้คนละคำ) — ต่อท้ายด้วยสาเหตุจริงเสมอ
  // แยกข้อความตามขั้นที่พัง — เดิมขึ้น "ส่งใบเสร็จไม่สำเร็จ" เหมือนกันหมดจนหาสาเหตุไม่ได้
  //
  // อัปทั้ง PNG และ PDF: LINE รับ originalContentUrl เป็น JPEG/PNG เท่านั้น
  // (ส่ง .pdf ไปจะเห็นแต่ข้อความ รูปไม่ขึ้น) ส่วน PDF เก็บไว้เป็นไฟล์สำหรับพิมพ์
  const issueReceiptAndSend = async ({ txId, custName, itemDetails, period, totalAmount, paidAmount, paidAt, items, failPrefix }) => {
    let step = 'สร้างไฟล์ใบเสร็จ'
    try {
      const receiptData = {
        custName,
        itemDetails,
        period,
        totalAmount,
        paidAmount,
        txId,
        paidAt,
        items,
        businessName: paymentInfo.business_name,
        ownerName: paymentInfo.owner_name,
        address: paymentInfo.address,
      }
      const pngBlob = await createReceiptPng(receiptData)

      step = 'อัปโหลดใบเสร็จ'
      const pngPath = `${txId}.png`
      const { error: pngError } = await supabase.storage
        .from('receipts')
        .upload(pngPath, pngBlob, { contentType: 'image/png', upsert: true })
      if (pngError) throw pngError

      // PDF เป็นของแถมสำหรับเก็บ/พิมพ์ — พังก็ไม่ควรขวางการส่งรูปเข้าไลน์
      try {
        const pdfBlob = await createReceiptPdf(receiptData)
        await supabase.storage
          .from('receipts')
          .upload(`${txId}.pdf`, pdfBlob, { contentType: 'application/pdf', upsert: true })
      } catch (pdfErr) {
        console.error('Receipt PDF upload failed (ไม่กระทบการส่งเข้าไลน์):', pdfErr)
      }

      step = 'ส่งเข้าไลน์'
      const { data: publicData } = supabase.storage.from('receipts').getPublicUrl(pngPath)
      const { data, error } = await supabase.rpc('send_receipt_to_line', { p_tx_id: txId, p_public_url: publicData?.publicUrl })
      if (error) throw error
      if (data?.ok === false && data?.error === 'no_group') {
        setToast({ type: 'warning', message: 'บิลนี้ยังไม่ได้ผูกกลุ่ม LINE — ใบเสร็จถูกบันทึกแล้ว' })
        return
      }
      if (data?.ok === false) throw new Error(data?.error || 'send_receipt_to_line failed')
      setToast({ type: 'success', message: 'ส่งใบเสร็จเข้า LINE แล้ว' })
    } catch (err) {
      console.error(`Issue receipt failed (${step}):`, err)
      const raw = String(err?.message || '')
      // สิทธิ์ storage หาย (policy ยังไม่ได้ apply) — บอกตรง ๆ ว่าต้องแก้ที่ฐานข้อมูล
      const reason = /row-level security|Unauthorized|AccessDenied/i.test(raw)
        ? 'ยังไม่ได้เปิดสิทธิ์อัปโหลดใบเสร็จในฐานข้อมูล (storage policy)'
        : raw || 'ไม่ทราบสาเหตุ'
      setToast(failPrefix
        ? { type: 'warning', message: `${failPrefix} (${step}: ${reason})` }
        : { type: 'error', message: `ออกใบเสร็จไม่สำเร็จ (${step}): ${reason}` })
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
      items: receiptItemsFromTx(item),
      failPrefix: 'อนุมัติสำเร็จ แต่ส่งใบเสร็จไม่ได้',
    })
  }

  const handleCreateBill = async (rental, meters, sendToLine = true, periodArg, isUtilityOnly = false) => {
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
      const minWater = Number(rental.min_water_charge) || 0
      const minElec = Number(rental.min_elec_charge) || 0
      const waterCost = utilityEnabled ? Math.max(waterUnits * (Number(rental.water_rate) || 0), minWater) : 0
      const elecUnits = utilityEnabled ? Math.max(0, elecCurrent - lastElec) : 0
      const elecCost = utilityEnabled ? Math.max(elecUnits * (Number(rental.elec_rate) || 0), minElec) : 0
      // บิลน้ำไฟแยก (isUtilityOnly=true) ไม่มีค่าเช่า
      const baseAmount = isUtilityOnly ? 0 : amount
      const totalAmount = baseAmount + waterCost + elecCost

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
          base_amount: baseAmount,
          water_units: waterUnits,
          water_cost: waterCost,
          elec_units: elecUnits,
          elec_cost: elecCost,
          total_amount: totalAmount,
          status: 'unpaid',
          secure_token: secureToken,
          is_utility_only: isUtilityOnly,
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
        promptpayNumber: paymentInfo.promptpay || '',
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

  // สร้างบิลน้ำไฟแยก (ไม่มีค่าเช่า base_amount=0)
  const handleCreateUtilityBill = async (data) => {
    const { rental, waterCurrent, elecCurrent, period } = data
    setToast(null)
    try {
      const secureToken = generateSecureToken()
      const custName = getValue(rental, ['cust_name', 'tenant_name', 'customer', 'customer_name', 'name']) ?? 'ไม่ระบุ'
      const itemDetails = displayAssetName({ sub_label: rental?.sub_label, item_details: getValue(rental, ['item_details', 'property_name', 'property', 'unit', 'room']) })
      const { data: rentalGroup } = await supabase
        .from('rentals')
        .select('group_id')
        .eq('id', rental.id)
        .maybeSingle()
      const lineGroupId = rentalGroup?.group_id || ''

      // คำนวณน้ำไฟ (ใช้ค่าขั้นต่ำถ้ามี)
      const lastWater = Number(rental.last_water_meter) || 0
      const lastElec = Number(rental.last_elec_meter) || 0
      const waterUnits = Math.max(0, Number(waterCurrent) - lastWater)
      const elecUnits = Math.max(0, Number(elecCurrent) - lastElec)
      const minWater = Number(rental.min_water_charge) || 0
      const minElec = Number(rental.min_elec_charge) || 0
      const waterCost = Math.max(waterUnits * (Number(rental.water_rate) || 0), minWater)
      const elecCost = Math.max(elecUnits * (Number(rental.elec_rate) || 0), minElec)
      const totalAmount = waterCost + elecCost

      if (totalAmount === 0) {
        setToast({ type: 'warning', message: 'ยอดน้ำไฟเป็น 0 ไม่สามารถสร้างบิลได้' })
        return false
      }

      // guard: กันสร้างบิลซ้ำงวดเดิม
      const periodLabel = formatPeriod(period)
      const { data: existingTxs } = await supabase
        .from('transactions')
        .select('id, period')
        .eq('rental_id', rental.id)
      if ((existingTxs || []).some((t) => t.period === period || t.period === periodLabel)) {
        setToast({ type: 'warning', message: `งวดนี้มีบิลอยู่แล้ว (${periodLabel}) — ไม่สามารถสร้างบิลซ้ำได้` })
        return false
      }

      const { data: tx, error: insertError } = await supabase
        .from('transactions')
        .insert([{
          rental_id: rental.id,
          period,
          base_amount: 0, // บิลน้ำไฟแยก ไม่มีค่าเช่า
          water_units: waterUnits,
          water_cost: waterCost,
          elec_units: elecUnits,
          elec_cost: elecCost,
          total_amount: totalAmount,
          status: 'unpaid',
          secure_token: secureToken,
          is_utility_only: true, // ธงบิลน้ำไฟแยก
        }])
        .select()
        .single()
      if (insertError) {
        if (insertError.code === '23505' || /uniq_tx_rental_period/i.test(insertError.message || '')) {
          setToast({ type: 'warning', message: `งวดนี้มีบิลอยู่แล้ว (${periodLabel}) — ไม่สามารถสร้างบิลซ้ำได้` })
          return false
        }
        throw insertError
      }

      // อัปเดตเลขมิเตอร์
      const { error: updateError } = await supabase
        .from('rentals')
        .update({ last_water_meter: Number(waterCurrent), last_elec_meter: Number(elecCurrent) })
        .eq('id', rental.id)
      if (updateError) throw updateError
      fetchRentals()

      // ส่งเข้าไลน์
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('send_bill_to_line', { p_tx_id: tx.id })
        if (rpcError) throw rpcError
        if (rpcData?.ok === false && rpcData?.error === 'no_group') {
          setToast({ type: 'warning', message: 'สร้างบิลน้ำไฟแล้ว แต่ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE — ส่งไม่ได้' })
        } else if (rpcData?.ok === false) {
          setToast({ type: 'error', message: 'ส่งบิลน้ำไฟเข้าไลน์ไม่สำเร็จ' })
        } else {
          setToast({ type: 'success', message: 'ส่งบิลน้ำไฟเข้า LINE แล้ว' })
        }
      } catch (err) {
        console.error('Send utility bill to LINE failed:', err)
        setToast({ type: 'error', message: 'ส่งบิลน้ำไฟเข้าไลน์ไม่สำเร็จ' })
      }

      fetchSummary()
      fetchPendingUtilityBills()
      setUtilityModal(null)
      setUtilityListModal(false)
      return true
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'สร้างบิลน้ำไฟไม่สำเร็จ' })
      return false
    }
  }

  // Mobile handlers
  const handleMobileApprove = async (item) => {
    await handleApproveWithReceipt(item)
  }

  const handleMobileReject = async (item) => {
    if (!item?.id) return
    await handleReviewTransaction(item.id, 'unpaid')
  }

  // จ่ายสด — รับได้ 2 แบบ:
  //  · rental จากหน้า "ค้างชำระ" (fetchRentals embed .transactions) → ปิดบิลค้างรายแรก
  //  · transaction จากหน้า "รอตรวจสลิป" (pending_review, join rentals) → ปิดบิลนั้นตรง ๆ
  // cashAmount มาจากช่องกรอกในหน้าสลิป — ไม่ได้กรอก = ใช้ยอดบิลเต็ม
  const handleMobileMarkCash = async (source, cashAmount) => {
    let tx = null
    let rental = null
    if (Array.isArray(source?.transactions)) {
      rental = source
      tx = rental.transactions.filter((t) => isBillOpen(t))[0]
    } else if (source?.id) {
      tx = source
      rental = Array.isArray(source.rentals) ? source.rentals[0] : source.rentals
    }

    if (!tx) {
      setToast({ type: 'warning', message: 'ไม่มีบิลค้างชำระ' })
      return
    }

    const amount = Number(cashAmount) > 0 ? Number(cashAmount) : Number(tx.total_amount || 0)
    const custName = rental?.cust_name || tx.cust_name || '—'

    // หน้าสลิปกรอกยอดไปแล้ว — ยืนยันซ้ำเฉพาะ flow หน้าค้างชำระ (กดปุ่มแล้วไม่ได้กรอกยอด)
    if (!(Number(cashAmount) > 0) && !window.confirm(`รับเงินสดจาก ${custName} จำนวน ${formatCurrency(amount)} ใช่หรือไม่?`)) {
      return
    }

    try {
      // อัปเดตสถานะเป็น paid
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'paid',
          paid_amount: amount,
          remaining_balance: 0,
          slip_verified: true,
          verified_at: new Date().toISOString(),
          payment_method: 'cash'
        })
        .eq('id', tx.id)

      if (error) throw error

      // บันทึก audit log (คอลัมน์ตาม schema จริง: transaction_id/old_amount/new_amount/reason)
      // พังก็ไม่ขวาง — บิลปิดไปแล้ว
      try {
        await supabase.from('audit_logs').insert([{
          transaction_id: tx.id,
          old_amount: Number(tx.total_amount || 0),
          new_amount: amount,
          reason: 'จ่ายเงินสด',
        }])
      } catch (auditErr) {
        console.warn('Cash payment audit log failed:', auditErr)
      }

      // ออกใบเสร็จ + ส่งเข้ากลุ่ม LINE
      await issueReceiptAndSend({
        txId: tx.id,
        custName,
        itemDetails: displayAssetName(rental || tx),
        period: tx.period ? formatPeriod(tx.period) : '—',
        totalAmount: amount,
        paidAmount: amount,
        paidAt: new Date().toISOString(),
        items: receiptItemsFromTx(tx),
        failPrefix: 'บันทึกชำระเงินสดแล้ว แต่ส่งใบเสร็จไม่ได้',
      })

      setToast({ type: 'success', message: 'บันทึกชำระเงินสดเรียบร้อย' })
      fetchRentals()
      fetchSummary()
      setMobileView(null)
    } catch (err) {
      console.error('Mark cash payment failed:', err)
      setToast({ type: 'error', message: err?.message || 'บันทึกชำระเงินสดไม่สำเร็จ' })
    }
  }

  // บันทึกมิเตอร์จากหน้ามือถือ — ใช้ handler เดียวกับ desktop (สร้างบิลน้ำไฟแยก งวดปัจจุบัน)
  // คืน true/false ให้ MobileUtilityInput ใช้ตัดสินว่าจะไปห้องถัดไปหรืออยู่ห้องเดิม
  const handleMobileUtilitySubmit = async (rental, waterCurrent, elecCurrent) => {
    try {
      return await handleCreateUtilityBill({ rental, waterCurrent, elecCurrent, period: currentPeriod() })
    } catch (err) {
      console.error('Mobile utility submit failed:', err)
      setToast({ type: 'error', message: 'บันทึกมิเตอร์น้ำไฟไม่สำเร็จ' })
      return false
    }
  }

  const handleMobileContactTenant = (rental) => {
    // Open LINE chat or show contact info
    if (rental.group_id) {
      window.open(`https://line.me/R/ti/g/${rental.group_id}`, '_blank')
    } else {
      setToast({ type: 'warning', message: 'ห้องนี้ยังไม่ได้ผูกกลุ่ม LINE' })
    }
  }

  const handleConfirmAction = async (rental, repairCost) => {
    try {
      if (confirmAction?.type === 'delete') {
        const { error } = await supabase.from('rentals').delete().eq('id', rental.id)
        if (error) throw error
        setToast({ type: 'success', message: 'ลบข้อมูลเรียบร้อยแล้ว' })
      } else {
        // moveout: ล้างผู้เช่า + บันทึกประวัติลง notes
        const patch = buildMoveOutPatch()
        const { error } = await supabase.from('rentals').update(patch).eq('id', rental.id)
        if (error) throw error

        const refund = Math.max(0, (Number(rental.deposit_amount) || 0) - (repairCost || 0))
        setToast({ type: 'success', message: `ย้ายออกเรียบร้อย (เงินประกันคืน ${formatCurrency(refund)})` })

        // บันทึกประวัติสัญญาเก่าลง notes
        try {
          const { data: landlordId } = await supabase.rpc('get_my_admin_id')
          if (landlordId) {
            const notePayload = buildMoveOutNote(rental, {
              repairCost: repairCost || 0,
              refund,
              assetName: displayAssetName(rental),
            })
            await supabase.from('notes').insert([{ landlord_id: landlordId, ...notePayload }])
          }
        } catch (noteErr) {
          console.warn('Failed to log moveout history:', noteErr)
        }
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
  // เปิด modal "เพิ่มสินทรัพย์" — เช็คจำนวนห้องตาม membership ก่อนเปิด
  const handleOpenAddAsset = () => {
    const used = rentals.length
    const limit = Number(membership?.room_limit)
    if (membership?.ok && Number.isFinite(limit) && limit > 0 && used >= limit) {
      setToast({ type: 'warning', message: `ครบจำนวนห้องของแพ็กเกจแล้ว (ใช้ ${used}/${limit} ห้อง) — อัปเกรดเพื่อเพิ่มห้อง` })
      return
    }
    setIsAddAssetOpen(true)
  }

  // เปิด modal "เพิ่มผู้เช่า" — ไม่เช็คจำนวนห้อง เพราะไม่ได้ insert แถวใหม่
  const handleOpenAddTenant = () => {
    setIsAddTenantOpen(true)
  }

  // callback หลัง AddAssetModal insert สำเร็จ — รีเฟรช + ไม่เปิด LineBindingModal
  // เพราะห้องยังว่าง (binding code เก็บไว้ใช้ตอนเพิ่มผู้เช่าในภายหลัง)
  const handleAssetCreated = async () => {
    await fetchRentals()
    fetchSummary()
  }

  // callback หลัง AddTenantModal update สำเร็จ — รีเฟรช + เปิด LineBindingModal
  const handleTenantAssigned = async ({ rental, custName }) => {
    await fetchRentals()
    fetchSummary()
    // แสดง LineBindingModal ให้ bind กลุ่ม LINE (ถ้ามี binding_code)
    if (rental?.binding_code) {
      setBindingModal({ code: rental.binding_code, custName })
    }
  }

  const location = useLocation()
  const isAssets = location.pathname === '/assets'
  const isProfit = location.pathname === '/profit'
  const isSettings = location.pathname === '/settings'
  const isAudit = location.pathname === '/audit'
  const isActivity = location.pathname === '/activity'
  const isMembership = location.pathname === '/membership'
  const isAdmin = location.pathname === '/admin'

  // Finance group
  const isPending = location.pathname === '/finance/pending'
  const isOverdue = location.pathname === '/finance/overdue'
  const isRecentPayments = location.pathname === '/finance/recent'

  // Repairs group
  const isRepairsActive = location.pathname === '/repairs/active'
  const isRecentRepairs = location.pathname === '/repairs/recent'

  // Leases group
  const isLeasesExpired = location.pathname === '/leases/expired'
  const isLeasesExpiring = location.pathname === '/leases/expiring'

  // Docs group
  const isDocsAnnouncements = location.pathname === '/docs/announcements'
  const isDocsNotes = location.pathname === '/docs/notes'
  const isDocsFiles = location.pathname === '/docs/files'

  // หน้า "ล่าสุด" 2 หน้าต้องอยู่ใน isTaskPage ด้วย ไม่งั้นตกไป branch แดชบอร์ด
  const isTaskPage =
    isPending || isOverdue || isRecentPayments || isRepairsActive || isRecentRepairs || isLeasesExpired || isLeasesExpiring

  // โหลดรายการชำระเฉพาะตอนเข้าหน้า "ชำระเงินทั้งหมด" — ไม่ต้องดึงทุกครั้งที่เปิดแอป
  useEffect(() => {
    if (isRecentPayments) fetchAllPayments()
  }, [isRecentPayments, fetchAllPayments])
  const stats = useMemo(() => computeStats(rentals), [rentals])
  const expiringLeases = useMemo(() => {
    return (rentals || []).filter((r) => r?.lease_end_date && String(r?.room_status ?? '').toLowerCase() !== 'vacant' && isExpiringSoon(r.lease_end_date))
  }, [rentals])
  // หน้า /leases ใช้กรอบ 90 วัน (กว้างกว่ากระดิ่งแจ้งเตือนที่ใช้ 30 วัน) — ให้ตรงกับ LeaseExpiryBand
  // ที่หน้านั้นเรนเดอร์ ไม่งั้นจะขึ้น "ไม่มีสัญญาใกล้หมดอายุ" ทั้งที่แถบมีรายการ
  const expiringLeases90 = useMemo(() => {
    return (rentals || []).filter((r) => {
      if (!r?.lease_end_date || String(r?.room_status ?? '').toLowerCase() === 'vacant') return false
      const days = daysUntil(r.lease_end_date)
      return days !== null && days <= 90  // รวมหมดแล้ว (days < 0) + ใกล้หมด (0-90)
    })
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

  // แถว KPI บนสุด — เงิน/อัตราเก็บได้ (แถวสถานะห้องแยกไปอีกชุดด้านล่าง)
  const kpiCards = [
    { icon: 'banknotes', label: 'รายรับเดือนนี้', value: formatCurrency(summary.paidThisMonth), hint: 'แตะเพื่อดูแยกรายเดือน', tone: 'green', onClick: () => setShowMonthly(true) },
    { icon: 'chart', label: 'อัตราเก็บเงินได้', value: collectionRate === null ? '—' : `${Math.round(collectionRate)}%`, hint: 'ยอดชำระ ÷ ยอดบิลเดือนนี้', tone: collectionRate === null ? 'emerald' : collectionRate >= 90 ? 'green' : collectionRate >= 70 ? 'yellow' : 'red' },
    { icon: 'warning', label: 'ยอดค้างชำระรวม', value: formatCurrency(summary.outstanding), hint: 'บิลที่ยังไม่ได้รับชำระ', tone: 'red' },
    { icon: 'building', label: 'สินทรัพย์ทั้งหมด', value: stats.total, hint: `มีผู้เช่า ${stats.occupied} · ว่าง ${stats.vacant}`, tone: 'emerald' },
  ]

  // แถวสถานะห้อง — การ์ดไล่สีทึบ
  const roomCards = [
    { icon: 'home', label: 'ห้องว่าง', value: stats.vacant, hint: 'พร้อมปล่อยเช่า', tone: 'green' },
    { icon: 'warning', label: 'ค้างชำระเกิน 15 วัน', value: overdueBills.length, hint: 'ต้องติดตามทวง', tone: 'red' },
    { icon: 'document', label: 'สัญญาใกล้หมดอายุ', value: stats.expiringSoon, hint: 'ภายใน 30 วัน', tone: 'orange' },
    { icon: 'check', label: 'มีผู้เช่า', value: stats.occupied, hint: 'สัญญาที่ยังใช้งาน', tone: 'slate' },
  ]

  // Task counts สำหรับ sidebar badges
  const activeRepairCount = repairTickets.filter((t) => t.status !== 'done').length
  const expiredLeasesCount = expiringLeases90.filter((r) => {
    const days = daysUntil(r.lease_end_date)
    return days !== null && days < 0
  }).length
  const expiringLeasesCount = expiringLeases90.filter((r) => {
    const days = daysUntil(r.lease_end_date)
    return days !== null && days >= 0 && days <= 90
  }).length

  const taskCounts = {
    pending: pendingReviews.length,
    overdue: overdueBills.length,
    repairs: activeRepairCount,
    expired: expiredLeasesCount,
    expiring: expiringLeasesCount,
    leases: stats.expiringSoon, // backward compatibility
  }
  const quickItems = [
    { icon: 'check', label: 'รอตรวจสลิป', hint: 'ผู้เช่าส่งหลักฐานการโอน', value: pendingReviews.length, tone: 'amber', to: '/finance/pending' },
    { icon: 'warning', label: 'ค้างชำระเกินกำหนด', hint: 'ส่งบิล/แจ้งเตือนซ้ำ', value: overdueBills.length, tone: 'rose', to: '/finance/overdue' },
    { icon: 'banknotes', label: 'ยังไม่ได้ส่งบิลน้ำไฟ', hint: 'ส่งบิลค่าเช่าแล้ว แต่น้ำไฟยังไม่ส่ง', value: pendingUtilityBills.length, tone: 'amber', to: pendingUtilityBills.length > 0 ? '#' : '/assets', onClick: pendingUtilityBills.length > 0 ? (e) => { e.preventDefault(); setUtilityListModal(true) } : undefined },
    { icon: 'cog', label: 'งานซ่อมค้าง', hint: 'คำขอที่ยังไม่ปิดงาน', value: activeRepairCount, tone: 'sky', to: '/repairs/active' },
    { icon: 'document', label: 'สัญญาใกล้หมดอายุ', hint: 'ต่อสัญญาหรือแจ้งย้ายออก', value: stats.expiringSoon, tone: 'emerald', to: '/leases/expiring' },
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
          onSignOut={signOutWithLog}
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
          onSignOut={signOutWithLog}
        />
        <Toast toast={toast} onClose={closeToast} />
      </>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Sidebar businessName={paymentInfo.business_name} membership={membership} taskCounts={taskCounts} email={userEmail} />

        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 lg:hidden">
                  <Icon name="building" className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  {/* มือถือ/แท็บเล็ต: โชว์ชื่อธุรกิจ — เดสก์ท็อปคงหัวข้อหน้าเดิมไว้ */}
                  <h1 className="truncate text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl lg:hidden">
                    {paymentInfo.business_name || 'PayRentPro'}
                  </h1>
                  <h1 className="hidden text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl lg:block">
                    {PAGE_TITLES[location.pathname]?.[0] ?? (isAudit ? 'ประวัติแก้ไข' : isActivity ? 'ประวัติเข้าใช้งาน' : isSettings ? 'ตั้งค่าบัญชี' : isAssets ? 'รายการสินทรัพย์' : isProfit ? 'กำไรสุทธิ' : isDocsAnnouncements ? 'ประกาศและเอกสาร' : isMembership ? 'สมาชิกของฉัน' : isAdmin ? 'ผู้ดูแลระบบ' : 'แดชบอร์ด')}
                  </h1>
                  <p className="hidden text-sm text-gray-500 dark:text-gray-400 lg:block">
                    {PAGE_TITLES[location.pathname]?.[1] ?? (isAudit ? 'บันทึกการแก้ไขยอดและเหตุผล' : isActivity ? 'ใครเข้า-ออกระบบ เมื่อไหร่ จาก IP ไหน' : isSettings ? 'ตั้งค่าเลขพร้อมเพย์ / บัญชีธนาคารสำหรับรับเงิน' : isAssets ? 'จัดการสัญญาเช่าและสินทรัพย์ทั้งหมด' : isProfit ? 'รายรับ รายจ่าย และกำไรสุทธิของแต่ละเดือน' : isDocsAnnouncements ? 'แจ้งข่าวผู้เช่า จดบันทึก และเก็บไฟล์เอกสาร' : isMembership ? 'แพ็กเกจ การใช้งาน และการต่ออายุ' : isAdmin ? 'จัดการสมาชิกและค่าสมาชิกรอตรวจทั้งหมด' : 'ภาพรวมการเก็บค่าเช่าและการติดตามหนี้')}
                  </p>
                </div>
              </div>

              {/* whitespace-nowrap กันข้อความปุ่มตัดบรรทัด (ทำให้ header สูงขึ้น)
                  แต่ไม่ใส่ shrink-0 เพื่อให้ช่องค้นหาหน้า Assets ย่อได้ ไม่ดันจนล้นที่ 1280 */}
              <div className="flex min-w-0 items-center gap-2 whitespace-nowrap sm:gap-3">
                <NotificationsBell pendingReviews={pendingReviews} expiringLeases={expiringLeases} />

                {/* มือถือ/แท็บเล็ต: ปุ่มรองทั้งหมดยุบเข้าเมนู ⋯ (เหลือ ชื่อ + กระดิ่ง + โปรไฟล์ + ⋯) */}
                <HeaderOverflowMenu
                  onExportCsv={!isAssets && !isSettings && !isAudit && !isActivity && !isMembership && !isAdmin && !isProfit && !isDocsAnnouncements && !isTaskPage ? handleExportCsv : null}
                  onRefresh={() => { fetchRentals(); fetchSummary(); fetchPendingReviews(); fetchTxInsights(); fetchRepairTickets() }}
                  loading={loading}
                  lastUpdated={lastUpdated}
                  largeText={largeText}
                  onToggleLargeText={toggleLargeText}
                  theme={theme}
                onToggleTheme={toggleTheme}
              />

              {/* เดสก์ท็อป (lg+): แถวปุ่มเดิมทั้งหมด ไม่แตะ */}
              {!isAssets && !isSettings && !isAudit && !isActivity && !isMembership && !isAdmin && !isTaskPage && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="hidden items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 lg:inline-flex"
                >
                  <Icon name="download" className="h-4 w-4" /> Export CSV
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
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-2.5 pl-11 pr-4 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              )}
              {isAssets && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenAddAsset}
                    className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 lg:inline-flex"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    เพิ่มสินทรัพย์
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddTenant}
                    className="hidden shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-base font-semibold text-white shadow-sm shadow-emerald-600/30 transition-colors hover:bg-emerald-500 lg:inline-flex"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                    </svg>
                    เพิ่มผู้เช่า
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => { fetchRentals(); fetchSummary(); fetchPendingReviews(); fetchTxInsights(); fetchRepairTickets() }}
                disabled={loading}
                className="hidden items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
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
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 underline decoration-2 underline-offset-4'
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
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-5 w-5" />
              </button>

              {/* เมนูโปรไฟล์ — ตัวเดียวใช้ทั้ง desktop และมือถือ (แทนปุ่มออกจากระบบเดิมของ header
                  และแทนรายการ สมาชิก/ตั้งค่า ที่ถอดออกจาก sidebar) */}
              <ProfileMenu email={userEmail} membership={membership} />
            </div>
          </div>
        </header>

        {/* ปุ่มเพิ่มสินทรัพย์/เพิ่มผู้เช่าของหน้า Assets — มือถือ/แท็บเล็ตวางเป็นแถวเต็มความกว้างใต้ header */}
        {isAssets && (
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:hidden">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleOpenAddAsset}
                className={`${BTN.primary} w-full`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                เพิ่มสินทรัพย์
              </button>
              <button
                type="button"
                onClick={handleOpenAddTenant}
                className={`${BTN.primary} w-full`}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                เพิ่มผู้เช่า
              </button>
            </div>
          </div>
        )}

        {/* pb-24 เผื่อที่ให้ BottomNav (สูง ~57px) — ต้องย้ำที่ sm ด้วย เพราะ sm:py-8
            เขียนทับ padding-bottom ทั้งคู่ ทำให้แท็บเล็ตเหลือ 32px แล้วแถบล่างทับเนื้อหา */}
        <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 sm:py-8 sm:pb-24 lg:px-8 lg:pb-8">
          {isAudit ? (
            <AuditLogPage />
          ) : isActivity ? (
            <ActivityLogPage />
          ) : isSettings ? (
            <SettingsPage onSaved={fetchPaymentInfo} membership={membership} />
          ) : isMembership ? (
            <ErrorBoundary>
              <MembershipPage membership={membership} onToast={setToast} onRefreshMembership={fetchMembership} />
            </ErrorBoundary>
          ) : isAdmin ? (
            <AdminPage onToast={setToast} />
          ) : isProfit ? (
            <FinancePage onToast={setToast} />
          ) : isDocsAnnouncements ? (
            <AnnouncementsPage onToast={setToast} />
          ) : isDocsNotes ? (
            <NotesPage onToast={setToast} />
          ) : isDocsFiles ? (
            <DocumentsPage onToast={setToast} />
          ) : isTaskPage ? (
            <>
              {isPending ? (
                <div className="space-y-4">
                  <PendingReviewSection
                    items={pendingReviews}
                    loading={pendingLoading}
                    error={pendingError}
                    reviewing={reviewing}
                    onApprove={(id) => handleApproveWithReceipt(pendingReviews.find((t) => t.id === id))}
                    onReject={(id) => handleReviewTransaction(id, 'unpaid')}
                    onRetry={fetchPendingReviews}
                  />
                </div>
              ) : isOverdue ? (
                <div className="space-y-4">
                  {overdueBills.length === 0 ? (
                    <TaskEmptyCard
                      icon="check"
                      title="ไม่มีรายการค้างชำระเกินกำหนด"
                      hint="บิลที่ค้างเกิน 15 วันจะขึ้นที่นี่ พร้อมปุ่มส่งบิลเข้าไลน์"
                    />
                  ) : (
                    <UrgentChaseSection
                      overdue={overdueBills}
                      sendingId={sendingBillId}
                      onSendBill={handleSendOverdueBill}
                      sendingReminder={sendingReminder}
                      onSendReminders={handleSendDueSoonReminders}
                    />
                  )}
                  {/* ทางเข้าไปหน้า "ชำระเงินล่าสุด" — เทียบว่าใครจ่ายแล้วกับใครยังค้าง (แทนการ์ดย่อเดิม) */}
                  <SeeAllLinkBar to="/finance/recent" tone="emerald">ดูชำระเงินทั้งหมด</SeeAllLinkBar>
                </div>
              ) : isRecentPayments ? (
                <div className="space-y-4">
                  <AllPaymentsSection items={allPayments} loading={paymentsLoading} error={paymentsError} onRetry={fetchAllPayments} />
                </div>
              ) : isRepairsActive ? (
                <div className="space-y-4">
                  <RepairSection
                    items={repairTickets}
                    loading={repairLoading}
                    error={repairError}
                    completingId={completingRepairId}
                    startingId={startingRepairId}
                    onStart={handleStartRepair}
                    onComplete={setClosingRepair}
                    onRetry={fetchRepairTickets}
                  />
                  <SeeAllLinkBar to="/repairs/recent" tone="sky">ดูคำขอซ่อมทั้งหมด</SeeAllLinkBar>
                </div>
              ) : isRecentRepairs ? (
                <div className="space-y-4">
                  {/* fetchRepairTickets ดึงทุกสถานะอยู่แล้ว (ไม่มี filter) — ใช้ตัวเดียวกับหน้าค้างดำเนินการ */}
                  <AllRepairsSection items={repairTickets} loading={repairLoading} error={repairError} onRetry={fetchRepairTickets} />
                </div>
              ) : isLeasesExpired ? (
                <div className="space-y-4">
                  <ExpiredLeasesSection
                    rentals={rentals}
                    onViewDetails={setDetailRental}
                    onRenew={setRenewRental}
                    onMoveOut={(rental) => setConfirmAction({ type: 'moveout', rental })}
                  />
                </div>
              ) : isLeasesExpiring ? (
                <div className="space-y-4">
                  <ExpiringSoonLeasesSection
                    rentals={rentals}
                    onViewDetails={setDetailRental}
                    onRenew={setRenewRental}
                    onMoveOut={(rental) => setConfirmAction({ type: 'moveout', rental })}
                  />
                </div>
              ) : null}
            </>
          ) : isAssets ? (
            <ErrorBoundary>
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
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-11 pr-4 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                {/* "สัญญาใกล้หมดอายุ" ย้ายไปหน้า /leases แล้ว (เดิมซ้ำอยู่ที่นี่ด้วย กรอบ 30 วัน
                    ส่วนแดชบอร์ดใช้ 90 วัน — คนละเกณฑ์ คนละโค้ด) หน้านั้นครอบของเดิมทั้งหมด */}

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
            </ErrorBoundary>
          ) : (
            <>
              {/* Mobile Dashboard: 4 ฟังก์ชันหลัก */}
              {mobileView === 'slips' ? (
                <MobileSlipReview
                  items={pendingReviews}
                  onApprove={handleMobileApprove}
                  onReject={handleMobileReject}
                  onMarkCash={handleMobileMarkCash}
                  onBack={() => setMobileView(null)}
                />
              ) : mobileView === 'overdue' || mobileView === 'urgent' ? (
                <MobileOverdueList
                  rentals={rentals.filter((r) => {
                    const txs = r.transactions || []
                    const hasUnpaid = txs.some((tx) => isBillOpen(tx))
                    if (!hasUnpaid) return false
                    if (mobileView === 'urgent') {
                      const oldestDue = txs
                        .filter((tx) => isBillOpen(tx))
                        .map((tx) => { const d = billDueDate(tx, r); return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0 })
                        .filter((t) => t > 0)
                        .sort((a, b) => a - b)[0]
                      if (!oldestDue) return false
                      const daysOverdue = Math.floor((Date.now() - oldestDue) / (1000 * 60 * 60 * 24))
                      return daysOverdue > 3
                    }
                    return true
                  })}
                  onBack={() => setMobileView(null)}
                  onContactTenant={handleMobileContactTenant}
                  onMarkCash={handleMobileMarkCash}
                />
              ) : mobileView === 'utility' ? (
                <MobileUtilityInput
                  rentals={utilitySnapshot}
                  onSubmit={handleMobileUtilitySubmit}
                  onBack={() => setMobileView(null)}
                />
              ) : (
                <>
                  <MobileDashboard
                    summary={summary}
                    pendingReviews={pendingReviews}
                    overdueRentals={rentals.filter((r) => {
                      const txs = r.transactions || []
                      return txs.some((tx) => isBillOpen(tx))
                    })}
                    urgentOverdueRentals={rentals.filter((r) => {
                      const txs = r.transactions || []
                      const unpaid = txs.filter((tx) => isBillOpen(tx))
                      if (unpaid.length === 0) return false
                      const oldestDue = unpaid
                        .map((tx) => { const d = billDueDate(tx, r); return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0 })
                        .filter((t) => t > 0)
                        .sort((a, b) => a - b)[0]
                      if (!oldestDue) return false
                      const daysOverdue = Math.floor((Date.now() - oldestDue) / (1000 * 60 * 60 * 24))
                      return daysOverdue > 3
                    })}
                    pendingUtilityBills={pendingUtilityBills}
                    onViewSummary={() => setShowMonthly(true)}
                    onViewPendingReviews={() => setMobileView('slips')}
                    onViewOverdue={() => setMobileView('overdue')}
                    onViewUrgentOverdue={() => setMobileView('urgent')}
                    onViewUtilityBills={() => {
                      setUtilitySnapshot(pendingUtilityBills)
                      setMobileView('utility')
                    }}
                    onShowMoreMenu={() => {}}
                  />
                </>
              )}

              {/* หัวเรื่องหน้า — เดสก์ท็อปมีหัวเรื่องใน header อยู่แล้ว จึงโชว์เฉพาะบรรทัดข้อมูล ณ เวลา */}
              <div className="mb-5 hidden flex-wrap items-end justify-between gap-3 lg:flex">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">ภาพรวมระบบ</h2>
                  <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                    {lastUpdated ? `ข้อมูล ณ ${lastUpdated.toLocaleString('th-TH')}` : 'กำลังโหลดข้อมูล'}
                    {paymentInfo.business_name ? ` · ${paymentInfo.business_name}` : ''}
                  </p>
                </div>
              </div>

              {/* 1. KPI การ์ดขาว แถบสีซ้าย */}
              <div className="hidden grid-cols-2 gap-3 sm:gap-4 lg:grid lg:grid-cols-4">
                {kpiCards.map((card) => (
                  <KpiCard key={card.label} {...card} />
                ))}
              </div>

              {/* 2. สถานะห้อง การ์ดไล่สีทึบ */}
              <div className="mt-4 hidden grid-cols-2 gap-3 sm:gap-4 lg:grid lg:grid-cols-4">
                {roomCards.map((card) => (
                  <RoomStatusCard key={card.label} {...card} />
                ))}
              </div>

              {/* 3. กราฟ (กว้าง) + สรุปด่วน (ราง) */}
              <div className="mt-6 hidden grid-cols-1 gap-4 lg:grid lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RevenueBar monthly={monthlyByType} />
                </div>
                <QuickSummaryCard items={quickItems} />
              </div>

              {/* 4. กราฟรองสองคอลัมน์ — ซ่อนไว้ชั่วคราว (feature flag คืนหลังเสาร์) */}
              {false && (
                <div className="mt-4 hidden grid-cols-1 gap-4 lg:grid lg:grid-cols-2">
                  <AgingBarChart buckets={agingBuckets} />
                  <OccupancyDonut occupied={stats.occupied} vacant={stats.vacant} />
                </div>
              )}

              {/* งานค้างทั้ง 4 เรื่อง (รอตรวจสลิป / ทวงหนี้ / แจ้งซ่อม / สัญญา) ย้ายไปหน้าของตัวเองแล้ว
                  — เข้าถึงผ่านการ์ด "สรุปด่วน" ด้านบน หรือเมนู "งานค้าง" */}
            </>
          )}
        </main>
      </div>

      <BottomNav membership={membership} />

      {!pdpAccepted && <PDPAConsentModal onAccept={handleAcceptPDPA} />}

      <AddAssetModal
        open={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        onCreated={handleAssetCreated}
        onToast={setToast}
      />

      <AddTenantModal
        open={isAddTenantOpen}
        rentals={rentals}
        onClose={() => setIsAddTenantOpen(false)}
        onAssigned={handleTenantAssigned}
        onToast={setToast}
      />

      {closingRepair ? (
        <RepairOutcomeModal
          ticket={closingRepair}
          saving={completingRepairId === closingRepair.id}
          onClose={() => setClosingRepair(null)}
          onConfirm={handleCompleteRepair}
        />
      ) : null}

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
            // invoice ใช้ชื่อคีย์แบบ camelCase — แปลงให้ตรงกับคอลัมน์ที่ helper อ่าน
            items: receiptItemsFromTx({
              base_amount: invoice.baseAmount,
              water_units: invoice.waterUnits,
              water_cost: invoice.waterCost,
              elec_units: invoice.elecUnits,
              elec_cost: invoice.elecCost,
              extra_charges: invoice.extraCharges,
            }),
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
        onResendBill={handleSendOverdueBill}
        onResendReceipt={async ({ txId, custName, itemDetails, period, totalAmount, paidAmount, items }) => {
          await issueReceiptAndSend({
            txId,
            custName,
            itemDetails,
            period: period ? formatPeriod(period) : '',
            totalAmount,
            paidAmount,
            paidAt: new Date().toISOString(),
            items,
          })
        }}
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

      {utilityModal && (
        <UtilityBillModal
          rental={utilityModal}
          onClose={() => setUtilityModal(null)}
          onConfirm={async (data) => {
            await handleCreateUtilityBill(data)
          }}
          onToast={setToast}
        />
      )}

      {utilityListModal && (
        <UtilityListModal
          rentals={pendingUtilityBills}
          onClose={() => setUtilityListModal(false)}
          onSelect={(rental) => {
            setUtilityListModal(false)
            setUtilityModal(rental)
          }}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </div>
    </ErrorBoundary>
  )
}

export default App
