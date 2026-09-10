import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatCurrency, formatDate, monthRange } from '../utils/format'
import {
  Field, Icon, Modal, PanelCard, PanelEmpty, PeriodPicker, TableSkeleton,
} from '../components/ui'
import { BTN, INPUT_CLS } from '../components/styles'

// ── หน้ารายจ่าย / รายรับอื่น / กำไรสุทธิ ────────────────────────────
// ที่มา: ผสานจาก PropertyHub (RESEARCH.md — expenses / income / profit)
// "กำไรสุทธิครบวงจร" เป็นจุดขายที่ระบบต้นทางโฆษณาไว้ และของเรายังไม่มี
//
// ใช้ตาราง expenses / other_income / expense_categories
// (migration 20260909100000_finance_expenses_income.sql)
// ไม่แตะ rentals / transactions เดิม — รายรับค่าเช่าอ่านผ่าน RPC get_profit_summary

const PAYMENT_METHODS = [
  { value: 'transfer', label: 'โอนเงิน' },
  { value: 'cash', label: 'เงินสด' },
  { value: 'credit_card', label: 'บัตรเครดิต' },
  { value: 'other', label: 'อื่น ๆ' },
]

function methodLabel(value) {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label || 'อื่น ๆ'
}

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── modal เพิ่ม/แก้รายจ่าย ───────────────────────────────────────────
function ExpenseModal({ row, categories, landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    expense_date: row?.expense_date || todayISO(),
    category_id: row?.category_id || '',
    description: row?.description || '',
    amount: row?.amount != null ? String(row.amount) : '',
    vendor_name: row?.vendor_name || '',
    reference_no: row?.reference_no || '',
    payment_method: row?.payment_method || 'transfer',
    notes: row?.notes || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const amount = Number(form.amount)
    if (!form.description.trim()) return setError('กรุณากรอกรายการ')
    if (!Number.isFinite(amount) || amount < 0) return setError('จำนวนเงินไม่ถูกต้อง')
    if (!form.expense_date) return setError('กรุณาเลือกวันที่')

    setSaving(true)
    try {
      const payload = {
        landlord_id: landlordId,
        expense_date: form.expense_date,
        category_id: form.category_id || null,
        description: form.description.trim(),
        amount,
        vendor_name: form.vendor_name.trim() || null,
        reference_no: form.reference_no.trim() || null,
        payment_method: form.payment_method,
        notes: form.notes.trim() || null,
      }
      const { error: dbError } = row?.id
        ? await supabase.from('expenses').update(payload).eq('id', row.id)
        : await supabase.from('expenses').insert([payload])
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: row?.id ? 'แก้ไขรายจ่ายแล้ว' : 'บันทึกรายจ่ายแล้ว' })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={row?.id ? 'แก้ไขรายจ่าย' : 'เพิ่มรายจ่าย'}
      subtitle="บันทึกค่าใช้จ่ายเพื่อคำนวณกำไรสุทธิ"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="expense-form" disabled={saving} className={BTN.primary}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="รายการ" required>
          <input type="text" value={form.description} onChange={set('description')} className={INPUT_CLS} placeholder="เช่น ค่าไฟบิลกรม เดือน ก.ย." required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="จำนวนเงิน (บาท)" required>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={set('amount')} className={INPUT_CLS} required />
          </Field>
          <Field label="วันที่" required>
            <input type="date" value={form.expense_date} onChange={set('expense_date')} className={INPUT_CLS} required />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="หมวด">
            <select value={form.category_id} onChange={set('category_id')} className={INPUT_CLS}>
              <option value="">ไม่ระบุหมวด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="วิธีจ่าย">
            <select value={form.payment_method} onChange={set('payment_method')} className={INPUT_CLS}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ผู้รับเงิน / ร้าน">
            <input type="text" value={form.vendor_name} onChange={set('vendor_name')} className={INPUT_CLS} placeholder="เช่น ร้านช่างสมชาย" />
          </Field>
          <Field label="เลขที่อ้างอิง" hint="เลขใบเสร็จ/เลขที่โอน">
            <input type="text" value={form.reference_no} onChange={set('reference_no')} className={INPUT_CLS} />
          </Field>
        </div>

        <Field label="หมายเหตุ">
          <textarea value={form.notes} onChange={set('notes')} rows={2} className={INPUT_CLS} />
        </Field>
      </form>
    </Modal>
  )
}

// ── modal เพิ่ม/แก้รายรับอื่น ────────────────────────────────────────
function IncomeModal({ row, landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    income_date: row?.income_date || todayISO(),
    description: row?.description || '',
    amount: row?.amount != null ? String(row.amount) : '',
    source: row?.source || '',
    notes: row?.notes || '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const amount = Number(form.amount)
    if (!form.description.trim()) return setError('กรุณากรอกรายการ')
    if (!Number.isFinite(amount) || amount < 0) return setError('จำนวนเงินไม่ถูกต้อง')

    setSaving(true)
    try {
      const payload = {
        landlord_id: landlordId,
        income_date: form.income_date,
        description: form.description.trim(),
        amount,
        source: form.source.trim() || null,
        notes: form.notes.trim() || null,
      }
      const { error: dbError } = row?.id
        ? await supabase.from('other_income').update(payload).eq('id', row.id)
        : await supabase.from('other_income').insert([payload])
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: row?.id ? 'แก้ไขรายรับแล้ว' : 'บันทึกรายรับแล้ว' })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={row?.id ? 'แก้ไขรายรับอื่น' : 'เพิ่มรายรับอื่น'}
      subtitle="รายรับที่ไม่ใช่ค่าเช่า เช่น ค่าปรับ ค่าที่จอดรถ"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="income-form" disabled={saving} className={BTN.primary}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="income-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="รายการ" required>
          <input type="text" value={form.description} onChange={set('description')} className={INPUT_CLS} placeholder="เช่น ค่าปรับจ่ายช้า ห้อง 101" required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="จำนวนเงิน (บาท)" required>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={set('amount')} className={INPUT_CLS} required />
          </Field>
          <Field label="วันที่" required>
            <input type="date" value={form.income_date} onChange={set('income_date')} className={INPUT_CLS} required />
          </Field>
        </div>

        <Field label="แหล่งที่มา" hint="เช่น ค่าปรับ / ค่าที่จอดรถ / เครื่องซักผ้า">
          <input type="text" value={form.source} onChange={set('source')} className={INPUT_CLS} />
        </Field>

        <Field label="หมายเหตุ">
          <textarea value={form.notes} onChange={set('notes')} rows={2} className={INPUT_CLS} />
        </Field>
      </form>
    </Modal>
  )
}

// ── การ์ดสรุปกำไร ────────────────────────────────────────────────────
function ProfitSummary({ summary, loading }) {
  const cards = [
    { label: 'รายรับค่าเช่า', value: summary?.rent_income, tone: 'emerald', hint: 'บิลที่ชำระแล้วในเดือนนี้' },
    { label: 'รายรับอื่น', value: summary?.other_income, tone: 'sky', hint: 'ค่าปรับ ค่าบริการเสริม' },
    { label: 'รายจ่ายรวม', value: summary?.total_expense, tone: 'rose', hint: 'ค่าน้ำไฟกรม ซ่อม ฯลฯ' },
  ]
  const tones = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    sky: 'text-sky-600 dark:text-sky-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }
  const net = Number(summary?.net_profit ?? 0)
  const isLoss = net < 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <p className="truncate text-xs font-semibold text-gray-500 dark:text-gray-400 sm:text-sm">{c.label}</p>
          <p className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${tones[c.tone]}`}>
            {loading ? '—' : formatCurrency(c.value)}
          </p>
          <p className="mt-1 truncate text-xs text-gray-400 dark:text-gray-500">{c.hint}</p>
        </div>
      ))}

      {/* กำไรสุทธิ — เน้นเป็นการ์ดสีทึบเพราะเป็นตัวเลขที่เจ้าของอยากรู้ที่สุด */}
      <div className={`rounded-2xl bg-gradient-to-br p-4 shadow-lg sm:p-5 ${isLoss ? 'from-rose-500 to-red-600 shadow-rose-500/25' : 'from-emerald-500 to-green-600 shadow-emerald-500/25'}`}>
        <p className="truncate text-xs font-semibold text-white/80 sm:text-sm">
          {isLoss ? 'ขาดทุนสุทธิ' : 'กำไรสุทธิ'}
        </p>
        <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
          {loading ? '—' : formatCurrency(Math.abs(net))}
        </p>
        <p className="mt-1 truncate text-xs text-white/70">
          {loading ? '' : `รายรับ ${formatCurrency(summary?.total_income)} − รายจ่าย ${formatCurrency(summary?.total_expense)}`}
        </p>
      </div>
    </div>
  )
}

// ── กราฟรายจ่ายตามหมวด (แท่งแนวนอน — ไม่ต้องพึ่ง Recharts) ───────────
function ExpenseByCategory({ items, total }) {
  if (!items?.length) {
    return <PanelEmpty>ยังไม่มีรายจ่ายในเดือนนี้</PanelEmpty>
  }
  return (
    <div className="space-y-3 p-4 sm:p-5">
      {items.map((it) => {
        const pct = total > 0 ? (Number(it.total) / total) * 100 : 0
        return (
          <div key={it.category_id || it.name}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-gray-700 dark:text-gray-300">{it.name}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(it.total)}
                <span className="ml-1.5 text-xs font-normal text-gray-400">{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: it.color || '#94a3b8' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── กราฟแนวโน้มกำไร 6 เดือน ─────────────────────────────────────────
function ProfitTrend({ rows }) {
  if (!rows?.length) return <PanelEmpty>ยังไม่มีข้อมูลย้อนหลัง</PanelEmpty>

  const max = Math.max(...rows.map((r) => Math.max(Number(r.income) || 0, Number(r.expense) || 0)), 1)
  const monthShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

  return (
    <div className="p-4 sm:p-5">
      <div className="flex h-44 items-end gap-2 sm:gap-3">
        {rows.map((r) => {
          const inc = Number(r.income) || 0
          const exp = Number(r.expense) || 0
          const m = Number(String(r.period).split('-')[1])
          return (
            <div key={r.period} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                {/* min-height 2px กันแท่งศูนย์หายไปเลย (ยืมวิธีจากต้นทาง) */}
                <div
                  className="w-1/2 max-w-4 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-300"
                  style={{ height: `${Math.max((inc / max) * 100, 1)}%`, minHeight: 2 }}
                  title={`รายรับ ${formatCurrency(inc)}`}
                />
                <div
                  className="w-1/2 max-w-4 rounded-t bg-gradient-to-t from-rose-600 to-rose-300"
                  style={{ height: `${Math.max((exp / max) * 100, 1)}%`, minHeight: 2 }}
                  title={`รายจ่าย ${formatCurrency(exp)}`}
                />
              </div>
              <span className="truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {monthShort[m - 1] || r.period}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> รายรับ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-600" /> รายจ่าย
        </span>
      </div>
    </div>
  )
}

// ── ตารางรายการ (รายจ่าย/รายรับ) — ตาราง sm+ / การ์ด 375px ───────────
function LedgerTable({ rows, loading, kind, onEdit, onDelete }) {
  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>{kind === 'expense' ? 'ยังไม่มีรายจ่ายในเดือนนี้' : 'ยังไม่มีรายรับอื่นในเดือนนี้'}</PanelEmpty>
  }

  const isExpense = kind === 'expense'

  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">วันที่</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                {isExpense ? 'หมวด' : 'แหล่งที่มา'}
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">รายการ</th>
              {isExpense ? (
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ผู้รับ / วิธีจ่าย</th>
              ) : null}
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">จำนวน</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(isExpense ? r.expense_date : r.income_date)}
                </td>
                <td className="px-5 py-3 text-sm">
                  {isExpense ? (
                    r.expense_categories?.name ? (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          background: `${r.expense_categories.color}1f`,
                          color: r.expense_categories.color,
                        }}
                      >
                        {r.expense_categories.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">ไม่ระบุ</span>
                    )
                  ) : (
                    <span className="text-gray-600 dark:text-gray-400">{r.source || '—'}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-100">{r.description}</td>
                {isExpense ? (
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {r.vendor_name || '—'}
                    <span className="ml-1.5 text-xs text-gray-400">· {methodLabel(r.payment_method)}</span>
                  </td>
                ) : null}
                <td className={`whitespace-nowrap px-5 py-3 text-right text-sm font-bold tabular-nums ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {isExpense ? '−' : '+'}{formatCurrency(r.amount)}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  {/* 44px ที่ touch (768) — ย่อเป็น compact เฉพาะ lg+ ตามเกณฑ์ tap target ของโปรเจกต์ */}
                  <div className="inline-flex gap-1">
                    <button type="button" onClick={() => onEdit(r)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 lg:h-8 lg:w-8" aria-label="แก้ไข">
                      <Icon name="pencil" className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onDelete(r)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 lg:h-8 lg:w-8" aria-label="ลบ">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* การ์ดที่ 375px — ปุ่มจัดการสูง 44px ตามเกณฑ์ tap target */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="space-y-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 flex-1 text-base font-semibold text-gray-900 dark:text-gray-100">{r.description}</p>
              <p className={`shrink-0 text-lg font-bold tabular-nums ${isExpense ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isExpense ? '−' : '+'}{formatCurrency(r.amount)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatDate(isExpense ? r.expense_date : r.income_date)}</span>
              {isExpense && r.expense_categories?.name ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span style={{ color: r.expense_categories.color }}>{r.expense_categories.name}</span>
                </>
              ) : null}
              {isExpense && r.vendor_name ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{r.vendor_name}</span>
                </>
              ) : null}
              {!isExpense && r.source ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{r.source}</span>
                </>
              ) : null}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => onEdit(r)} className={`${BTN.secondary} flex-1`}>
                <Icon name="pencil" className="h-4 w-4" /> แก้ไข
              </button>
              <button type="button" onClick={() => onDelete(r)} className={`${BTN.secondary} flex-1 text-rose-600 dark:text-rose-400`}>
                <Icon name="trash" className="h-4 w-4" /> ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── หน้าหลัก ─────────────────────────────────────────────────────────
export default function FinancePage({ onToast }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState('overview') // overview | expenses | income

  const [landlordId, setLandlordId] = useState(null)
  const [categories, setCategories] = useState([])
  const [expenses, setExpenses] = useState([])
  const [income, setIncome] = useState([])
  const [summary, setSummary] = useState(null)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expenseModal, setExpenseModal] = useState(null) // null | {} | row
  const [incomeModal, setIncomeModal] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: adminId, error: adminError } = await supabase.rpc('get_my_admin_id')
      if (adminError) throw adminError
      if (!adminId) throw new Error('ไม่พบบัญชีเจ้าของของผู้ใช้นี้ — ลองออกจากระบบแล้วเข้าใหม่')
      setLandlordId(adminId)

      const { from, to } = monthRange(year, month)

      const [catRes, expRes, incRes, sumRes, trendRes] = await Promise.all([
        supabase.from('expense_categories').select('*').order('sort_order'),
        supabase
          .from('expenses')
          .select('*, expense_categories(name, color)')
          .gte('expense_date', from)
          .lt('expense_date', to)
          .order('expense_date', { ascending: false }),
        supabase
          .from('other_income')
          .select('*')
          .gte('income_date', from)
          .lt('income_date', to)
          .order('income_date', { ascending: false }),
        supabase.rpc('get_profit_summary', { p_year: year, p_month: month }),
        supabase.rpc('get_profit_trend', { p_months: 6 }),
      ])

      if (catRes.error) throw catRes.error
      if (expRes.error) throw expRes.error
      if (incRes.error) throw incRes.error
      if (sumRes.error) throw sumRes.error
      if (trendRes.error) throw trendRes.error

      let cats = Array.isArray(catRes.data) ? catRes.data : []
      // ผู้ใช้ใหม่ยังไม่มีหมวด — เติมชุดเริ่มต้นให้ ไม่ต้องเจอ dropdown ว่าง
      if (cats.length === 0) {
        const { error: seedError } = await supabase.rpc('seed_expense_categories', { p_landlord_id: adminId })
        if (!seedError) {
          const { data: seeded } = await supabase.from('expense_categories').select('*').order('sort_order')
          cats = Array.isArray(seeded) ? seeded : []
        }
      }

      setCategories(cats)
      setExpenses(Array.isArray(expRes.data) ? expRes.data : [])
      setIncome(Array.isArray(incRes.data) ? incRes.data : [])
      setSummary(sumRes.data?.ok ? sumRes.data : null)
      setTrend(Array.isArray(trendRes.data) ? trendRes.data : [])
    } catch (err) {
      setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    load()
  }, [load])

  const handlePeriod = (y, m) => {
    setYear(y)
    setMonth(m)
  }

  async function confirmDelete() {
    if (!deleting) return
    const { row, kind } = deleting
    try {
      const table = kind === 'expense' ? 'expenses' : 'other_income'
      const { error: dbError } = await supabase.from(table).delete().eq('id', row.id)
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: 'ลบรายการแล้ว' })
      setDeleting(null)
      await load()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'ลบไม่สำเร็จ' })
      setDeleting(null)
    }
  }

  const categoryTotal = useMemo(
    () => (summary?.expense_by_category || []).reduce((s, x) => s + (Number(x.total) || 0), 0),
    [summary],
  )

  const TABS = [
    { key: 'overview', label: 'ภาพรวมกำไร', icon: 'chart' },
    { key: 'expenses', label: 'รายจ่าย', icon: 'arrowUp' },
    { key: 'income', label: 'รายรับอื่น', icon: 'arrowDown' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">กำไรสุทธิ</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">รายรับ − รายจ่าย ของแต่ละเดือน</p>
        </div>
        <PeriodPicker year={year} month={month} onChange={handlePeriod} />
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={load} className={BTN.secondary}>ลองใหม่</button>
        </div>
      ) : null}

      <ProfitSummary summary={summary} loading={loading} />

      {/* แท็บ — ปุ่มสูง 44px ที่ touch */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
        {TABS.map((t) => (
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
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelCard title="แนวโน้ม 6 เดือน" subtitle="รายรับเทียบรายจ่ายรายเดือน">
            <ProfitTrend rows={trend} />
          </PanelCard>
          <PanelCard title="รายจ่ายตามหมวด" subtitle="สัดส่วนค่าใช้จ่ายเดือนนี้">
            <ExpenseByCategory items={summary?.expense_by_category} total={categoryTotal} />
          </PanelCard>
        </div>
      ) : tab === 'expenses' ? (
        <PanelCard
          title="รายจ่าย"
          subtitle={`${expenses.length} รายการในเดือนนี้`}
          action={
            <button type="button" onClick={() => setExpenseModal({})} className={BTN.primary}>
              <Icon name="plus" className="h-4 w-4" /> เพิ่มรายจ่าย
            </button>
          }
        >
          <LedgerTable
            rows={expenses}
            loading={loading}
            kind="expense"
            onEdit={(row) => setExpenseModal(row)}
            onDelete={(row) => setDeleting({ row, kind: 'expense' })}
          />
        </PanelCard>
      ) : (
        <PanelCard
          title="รายรับอื่น"
          subtitle={`${income.length} รายการในเดือนนี้`}
          action={
            <button type="button" onClick={() => setIncomeModal({})} className={BTN.primary}>
              <Icon name="plus" className="h-4 w-4" /> เพิ่มรายรับ
            </button>
          }
        >
          <LedgerTable
            rows={income}
            loading={loading}
            kind="income"
            onEdit={(row) => setIncomeModal(row)}
            onDelete={(row) => setDeleting({ row, kind: 'income' })}
          />
        </PanelCard>
      )}

      {expenseModal ? (
        <ExpenseModal
          row={expenseModal.id ? expenseModal : null}
          categories={categories}
          landlordId={landlordId}
          onClose={() => setExpenseModal(null)}
          onSaved={load}
          onToast={onToast}
        />
      ) : null}

      {incomeModal ? (
        <IncomeModal
          row={incomeModal.id ? incomeModal : null}
          landlordId={landlordId}
          onClose={() => setIncomeModal(null)}
          onSaved={load}
          onToast={onToast}
        />
      ) : null}

      {deleting ? (
        <Modal
          title="ยืนยันการลบ"
          onClose={() => setDeleting(null)}
          maxWidth="sm:max-w-sm"
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={BTN.secondary}>ยกเลิก</button>
              <button type="button" onClick={confirmDelete} className={BTN.danger}>ลบรายการ</button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ลบ <span className="font-semibold text-gray-900 dark:text-gray-100">{deleting.row.description}</span>{' '}
            ยอด {formatCurrency(deleting.row.amount)} ออกจากระบบ — การลบไม่สามารถย้อนกลับได้
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
