import { useState } from 'react'
import { Icon } from './ui'
import { formatCurrency } from '../utils/format'

// Mobile-optimized Slip Review: รูปใหญ่ + ปุ่มใหญ่ 2 ปุ่ม
export function MobileSlipReview({ items, onApprove, onReject, onMarkCash, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [showCashInput, setShowCashInput] = useState(false)
  const [cashAmount, setCashAmount] = useState('')

  if (!items || items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 lg:hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Icon name="arrow-left" className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">อนุมัติสลิป</h1>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Icon name="check" className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">ไม่มีสลิปรอตรวจ</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">ทุกรายการผ่านการตรวจสอบแล้ว</p>
          </div>
        </div>
      </div>
    )
  }

  const item = items[currentIndex]

  const handleApprove = async () => {
    setProcessing(true)
    await onApprove(item)
    setProcessing(false)
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onBack()
    }
  }

  const handleReject = async () => {
    setProcessing(true)
    await onReject(item)
    setProcessing(false)
    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onBack()
    }
  }

  const handleCashSubmit = async () => {
    const amount = parseFloat(cashAmount)
    if (!amount || amount <= 0) return
    setProcessing(true)
    await onMarkCash(item, amount)
    setProcessing(false)
    setShowCashInput(false)
    setCashAmount('')
    if (currentIndex < items.length - 1) {
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
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">อนุมัติสลิป</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {currentIndex + 1} / {items.length}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ข้อมูลผู้เช่า */}
        <div className="rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">ผู้เช่า</p>
              <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                {item.tenant_name || '—'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">ยอดเงิน</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(item.amount)}
              </p>
            </div>
          </div>

          {item.note && (
            <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 px-3 py-2">
              <p className="text-sm text-amber-800 dark:text-amber-200">{item.note}</p>
            </div>
          )}
        </div>

        {/* รูปสลิป */}
        {item.slip_url ? (
          <div className="mt-4">
            <img
              src={item.slip_url}
              alt="สลิปโอนเงิน"
              className="w-full rounded-xl shadow-lg"
              style={{ maxHeight: '60vh', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-12">
            <div className="text-center">
              <Icon name="document" className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">ไม่มีรูปสลิปแนบมา</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {!showCashInput ? (
        <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={processing}
              className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-4 text-base font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              <Icon name="close" className="h-5 w-5" />
              ปฏิเสธ
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={processing}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-4 text-base font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              <Icon name="check" className="h-5 w-5" />
              อนุมัติ
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowCashInput(true)}
            disabled={processing}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-4 text-base font-bold text-gray-700 dark:text-gray-300 shadow-sm transition-transform active:scale-95 disabled:opacity-50"
          >
            💵 จ่ายเงินสด
          </button>
        </div>
      ) : (
        <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ระบุยอดเงินสดที่รับ</p>
          <input
            type="number"
            inputMode="decimal"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-2xl font-bold text-center text-gray-900 dark:text-gray-100 focus:border-emerald-500 focus:outline-none"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setShowCashInput(false)
                setCashAmount('')
              }}
              disabled={processing}
              className="rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-3 text-sm font-bold text-gray-700 dark:text-gray-300 transition-transform active:scale-95"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleCashSubmit}
              disabled={processing || !cashAmount || parseFloat(cashAmount) <= 0}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              บันทึก
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
