import { useState } from 'react'
import { Icon } from './ui'
import { formatCurrency } from '../utils/format'

// Mobile-first Dashboard: 4 ฟังก์ชันหลักบนสุด
export function MobileDashboard({
  summary,
  pendingReviews,
  overdueRentals,
  pendingUtilityBills,
  onViewSummary,
  onViewPendingReviews,
  onViewOverdue,
  onViewUtilityBills,
  onShowMoreMenu,
}) {
  return (
    <div className="space-y-3 p-4 lg:hidden">
      {/* 1. ดูยอดวันนี้ — การ์ดใหญ่บนสุด */}
      <button
        type="button"
        onClick={onViewSummary}
        className="group w-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-lg transition-transform active:scale-[0.98]"
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-50">รายรับเดือนนี้</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">
              {formatCurrency(summary?.paidThisMonth || 0)}
            </p>
            <p className="mt-1 text-xs text-emerald-100">
              ค้างชำระ {formatCurrency(summary?.outstanding || 0)}
            </p>
          </div>
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Icon name="chart" className="h-7 w-7 text-white" />
          </div>
        </div>
      </button>

      {/* 2. อนุมัติสลิป / จ่ายเงินสด */}
      <button
        type="button"
        onClick={onViewPendingReviews}
        className="group w-full overflow-hidden rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/70 p-5 text-left shadow-sm transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <Icon name="document" className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">อนุมัติสลิป</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">รอตรวจ {pendingReviews?.length || 0} รายการ</p>
              </div>
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 dark:bg-amber-600">
            <span className="text-sm font-bold text-white">{pendingReviews?.length || 0}</span>
          </div>
        </div>
      </button>

      {/* 3. ดูคนค้าง */}
      <button
        type="button"
        onClick={onViewOverdue}
        className="group w-full overflow-hidden rounded-2xl bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800/70 p-5 text-left shadow-sm transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <Icon name="warning" className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900 dark:text-red-100">ค้างชำระ</p>
                <p className="text-xs text-red-600 dark:text-red-400">{overdueRentals?.length || 0} ห้อง</p>
              </div>
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 dark:bg-red-600">
            <span className="text-sm font-bold text-white">{overdueRentals?.length || 0}</span>
          </div>
        </div>
      </button>

      {/* 4. กรอกเลขมิเตอร์น้ำไฟ */}
      <button
        type="button"
        onClick={onViewUtilityBills}
        className="group w-full overflow-hidden rounded-2xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800/70 p-5 text-left shadow-sm transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Icon name="banknotes" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">บิลน้ำไฟค้าง</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{pendingUtilityBills?.length || 0} ห้อง</p>
              </div>
            </div>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 dark:bg-blue-600">
            <span className="text-sm font-bold text-white">{pendingUtilityBills?.length || 0}</span>
          </div>
        </div>
      </button>

      {/* เมนูเพิ่มเติม */}
      <button
        type="button"
        onClick={onShowMoreMenu}
        className="group w-full overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-center shadow-sm transition-all active:scale-[0.98]"
      >
        <div className="flex items-center justify-center gap-2">
          <Icon name="menu" className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">เมนูเพิ่มเติม</span>
        </div>
      </button>
    </div>
  )
}
