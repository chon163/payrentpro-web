import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { currentPeriod } from '../utils/period'
import { formatCurrency } from '../utils/format'

function generateSecureToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function UtilityBillModal({ rental, onClose, onConfirm, onToast }) {
  const [waterCurrent, setWaterCurrent] = useState('')
  const [elecCurrent, setElecCurrent] = useState('')
  const [period, setPeriod] = useState(currentPeriod())
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (rental) {
      setWaterCurrent('')
      setElecCurrent('')
      setPeriod(currentPeriod())
      setSubmitting(false)
    }
  }, [rental])

  if (!rental) return null

  const lastWater = Number(rental.last_water_meter) || 0
  const lastElec = Number(rental.last_elec_meter) || 0
  const waterUnits = Math.max(0, Number(waterCurrent || 0) - lastWater)
  const elecUnits = Math.max(0, Number(elecCurrent || 0) - lastElec)
  const waterRate = Number(rental.water_rate) || 0
  const elecRate = Number(rental.elec_rate) || 0
  const minWater = Number(rental.min_water_charge) || 0
  const minElec = Number(rental.min_elec_charge) || 0
  const waterCost = Math.max(waterUnits * waterRate, minWater)
  const elecCost = Math.max(elecUnits * elecRate, minElec)
  const totalAmount = waterCost + elecCost

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onConfirm({ rental, waterCurrent, elecCurrent, period })
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">ส่งบิลน้ำไฟแยก</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {rental.cust_name || '—'} · {rental.item_details || '—'}{rental.sub_label ? ` (${rental.sub_label})` : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            บิลน้ำไฟแยก = เฉพาะค่าน้ำไฟ (ไม่มีค่าเช่า) — ใช้เมื่อส่งบิลค่าเช่าไปแล้วแต่ลืมคิดน้ำไฟ
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">รอบบิล</label>
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 px-4 py-3">
            <p className="text-sm font-bold text-sky-800 dark:text-sky-200">ค่าน้ำ</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">
                มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastWater}</span>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">
                อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{waterRate} บาท/หน่วย</span>
              </div>
            </div>
            {minWater > 0 && (
              <p className="mt-2 text-xs text-sky-700 dark:text-sky-300">ค่าขั้นต่ำ: {formatCurrency(minWater)}</p>
            )}
            <label htmlFor="water_current" className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
              เลขมิเตอร์น้ำปัจจุบัน
            </label>
            <input
              id="water_current"
              type="number"
              min="0"
              step="1"
              value={waterCurrent}
              onChange={(e) => setWaterCurrent(e.target.value)}
              placeholder="เช่น 150"
              className={inputClass}
              required
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ใช้ไป {waterUnits} หน่วย = {formatCurrency(waterCost)}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200">ค่าไฟ</p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">
                มิเตอร์เดือนก่อน: <span className="font-semibold text-gray-900 dark:text-gray-100">{lastElec}</span>
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-900 p-2.5">
                อัตรา: <span className="font-semibold text-gray-900 dark:text-gray-100">{elecRate} บาท/หน่วย</span>
              </div>
            </div>
            {minElec > 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">ค่าขั้นต่ำ: {formatCurrency(minElec)}</p>
            )}
            <label htmlFor="elec_current" className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
              เลขมิเตอร์ไฟปัจจุบัน
            </label>
            <input
              id="elec_current"
              type="number"
              min="0"
              step="1"
              value={elecCurrent}
              onChange={(e) => setElecCurrent(e.target.value)}
              placeholder="เช่น 2500"
              className={inputClass}
              required
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ใช้ไป {elecUnits} หน่วย = {formatCurrency(elecCost)}
            </p>
          </div>

          <div className="rounded-2xl bg-gray-900 px-4 py-4 text-center text-white">
            <p className="text-xs text-gray-300">ยอดรวมที่ต้องชำระ</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{formatCurrency(totalAmount)}</p>
          </div>
        </form>

        <div className="flex gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || totalAmount === 0}
            className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'กำลังสร้างบิล...' : 'สร้างบิลน้ำไฟ'}
          </button>
        </div>
      </div>
    </div>
  )
}
