import { useState } from 'react'
import { Icon } from './ui'
import { formatCurrency } from '../utils/format'

// Mobile-optimized Utility Meter Input: คีย์บอร์ดตัวเลขใหญ่ + ฟอร์มกรอกทีละห้อง
export function MobileUtilityInput({ rentals, onSubmit, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [waterMeter, setWaterMeter] = useState('')
  const [elecMeter, setElecMeter] = useState('')
  const [activeInput, setActiveInput] = useState('water') // 'water' or 'elec'
  const [submitting, setSubmitting] = useState(false)

  if (!rentals || rentals.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 lg:hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Icon name="arrow-left" className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">บิลน้ำไฟ</h1>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Icon name="check" className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">ไม่มีบิลค้าง</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">ทุกห้องส่งบิลน้ำไฟแล้ว</p>
          </div>
        </div>
      </div>
    )
  }

  const rental = rentals[currentIndex]
  const lastWater = Number(rental.last_water_meter) || 0
  const lastElec = Number(rental.last_elec_meter) || 0
  const waterRate = Number(rental.water_rate) || 0
  const elecRate = Number(rental.elec_rate) || 0
  const minWater = Number(rental.min_water_charge) || 0
  const minElec = Number(rental.min_elec_charge) || 0

  const waterCurrent = parseFloat(waterMeter) || 0
  const elecCurrent = parseFloat(elecMeter) || 0
  const waterUnits = Math.max(0, waterCurrent - lastWater)
  const elecUnits = Math.max(0, elecCurrent - lastElec)
  const waterCost = Math.max(waterUnits * waterRate, waterUnits > 0 ? minWater : 0)
  const elecCost = Math.max(elecUnits * elecRate, elecUnits > 0 ? minElec : 0)
  const totalAmount = waterCost + elecCost

  const handleNumberClick = (num) => {
    if (activeInput === 'water') {
      setWaterMeter((prev) => prev + num)
    } else {
      setElecMeter((prev) => prev + num)
    }
  }

  const handleBackspace = () => {
    if (activeInput === 'water') {
      setWaterMeter((prev) => prev.slice(0, -1))
    } else {
      setElecMeter((prev) => prev.slice(0, -1))
    }
  }

  const handleClear = () => {
    if (activeInput === 'water') {
      setWaterMeter('')
    } else {
      setElecMeter('')
    }
  }

  const handleSubmit = async () => {
    if (totalAmount === 0) return
    setSubmitting(true)
    await onSubmit(rental, waterCurrent, elecCurrent)
    setSubmitting(false)
    setWaterMeter('')
    setElecMeter('')
    setActiveInput('water')
    if (currentIndex < rentals.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onBack()
    }
  }

  const handleSkip = () => {
    setWaterMeter('')
    setElecMeter('')
    setActiveInput('water')
    if (currentIndex < rentals.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onBack()
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 lg:hidden">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Icon name="arrow-left" className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">กรอกมิเตอร์น้ำไฟ</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentIndex + 1} / {rentals.length}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-0">
        {/* ข้อมูลห้อง */}
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">ห้อง</p>
          <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-gray-100">
            {rental.cust_name || '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {rental.item_details || rental.sub_label || '—'}
          </p>
        </div>

        {/* มิเตอร์น้ำ */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setActiveInput('water')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              activeInput === 'water'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">มิเตอร์น้ำ</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  เดิม: {lastWater.toLocaleString()} หน่วย
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {waterMeter || '—'}
                </p>
                {waterUnits > 0 && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    ใช้ {waterUnits} หน่วย · {formatCurrency(waterCost)}
                  </p>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* มิเตอร์ไฟ */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setActiveInput('elec')}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              activeInput === 'elec'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">มิเตอร์ไฟ</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  เดิม: {lastElec.toLocaleString()} หน่วย
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {elecMeter || '—'}
                </p>
                {elecUnits > 0 && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    ใช้ {elecUnits} หน่วย · {formatCurrency(elecCost)}
                  </p>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* ยอดรวม */}
        <div className="mt-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">ยอดรวม</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Number Pad */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberClick(String(num))}
              className="flex h-16 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-2xl font-bold text-gray-900 dark:text-gray-100 transition-transform active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-16 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/40 text-sm font-bold text-red-600 dark:text-red-400 transition-transform active:scale-95"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleNumberClick('0')}
            className="flex h-16 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-2xl font-bold text-gray-900 dark:text-gray-100 transition-transform active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-16 items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700 transition-transform active:scale-95"
          >
            <Icon name="arrow-left" className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 transition-transform active:scale-95 disabled:opacity-50"
          >
            ข้าม
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || totalAmount === 0}
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}
