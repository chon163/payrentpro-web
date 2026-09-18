import { Icon } from './ui'
import { formatCurrency, isBillOpen } from '../utils/format'
import { displayAssetName } from '../utils/assetName'
import { billDueDate } from '../utils/period'

// คำนวณจำนวนวันที่ค้าง — วันครบกำหนดมาจาก งวด + วันส่งบิลของห้อง (billDueDate)
// transactions ไม่มี due_date ถ้าคำนวณไม่ได้จะ fallback เป็น created_at ของบิล
function calculateDaysOverdue(rental) {
  const txs = rental.transactions || []
  const unpaid = txs.filter((tx) => isBillOpen(tx))
  if (unpaid.length === 0) return 0

  const oldestDue = unpaid
    .map((tx) => billDueDate(tx.period, rental.bill_day ?? rental.due_date) ?? (tx.created_at ? new Date(tx.created_at).getTime() : 0))
    .filter((t) => t > 0)
    .sort((a, b) => a - b)[0]

  if (!oldestDue) return 0
  const diff = Date.now() - oldestDue
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

// Mobile-optimized Overdue List
export function MobileOverdueList({ rentals, onBack, onContactTenant, onMarkCash }) {
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

  // คำนวณวันค้างของแต่ละ rental แล้วเรียงจากมากไปน้อย
  const rentalsWithDays = rentals.map((r) => ({
    ...r,
    daysOverdue: calculateDaysOverdue(r),
  })).sort((a, b) => b.daysOverdue - a.daysOverdue)

  const totalOverdue = rentalsWithDays.reduce((sum, r) => {
    const txs = r.transactions || []
    const unpaidAmount = txs
      .filter((tx) => isBillOpen(tx))
      .reduce((s, tx) => s + Number(tx.total_amount || 0), 0)
    return sum + unpaidAmount
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
          {rentalsWithDays.map((rental, index) => {
            const assetName = displayAssetName({
              sub_label: rental.sub_label,
              item_details: rental.item_details,
            })
            const txs = rental.transactions || []
            const unpaidTxs = txs.filter((tx) => isBillOpen(tx))
            const amount = unpaidTxs.reduce((s, tx) => s + Number(tx.total_amount || 0), 0)
            const daysOverdue = rental.daysOverdue || 0

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
                        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          daysOverdue > 3
                            ? 'bg-red-600 dark:bg-red-700 text-white'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                        }`}>
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

                {/* Action Buttons */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onContactTenant(rental)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      <Icon name="message" className="h-4 w-4" />
                      ติดต่อ
                    </button>
                    <button
                      type="button"
                      onClick={() => onMarkCash && onMarkCash(rental)}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                      💵 จ่ายสด
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
