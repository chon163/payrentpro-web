import { Icon } from './ui'
import { formatCurrency } from '../utils/format'
import { displayAssetName } from '../utils/assetName'

// Mobile-optimized Overdue List
export function MobileOverdueList({ rentals, onBack, onContactTenant }) {
  if (!rentals || rentals.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 lg:hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Icon name="arrow-left" className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">ค้างชำระ</h1>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Icon name="check" className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">ไม่มีบิลค้าง</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">ทุกห้องชำระเงินครบแล้ว</p>
          </div>
        </div>
      </div>
    )
  }

  const totalOverdue = rentals.reduce((sum, r) => {
    const amount = Number(r.outstanding_amount || r.total_amount || 0)
    return sum + amount
  }, 0)

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
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">ค้างชำระ</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{rentals.length} ห้อง</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">ยอดรวม</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(totalOverdue)}</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {rentals.map((rental, index) => {
            const assetName = displayAssetName({
              sub_label: rental.sub_label,
              item_details: rental.item_details,
            })
            const amount = Number(rental.outstanding_amount || rental.total_amount || 0)
            const daysOverdue = rental.days_overdue || 0

            return (
              <div
                key={rental.id || index}
                className="overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {rental.cust_name || '—'}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{assetName}</p>
                      {daysOverdue > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                          <Icon name="warning" className="h-3.5 w-3.5" />
                          เกิน {daysOverdue} วัน
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(amount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact Button */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-3">
                  <button
                    type="button"
                    onClick={() => onContactTenant(rental)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    <Icon name="message" className="h-4 w-4" />
                    ติดต่อผู้เช่า
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
