import { displayAssetName } from '../utils/assetName'

export function UtilityListModal({ rentals, onClose, onSelect }) {
  if (!rentals || rentals.length === 0) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">เลือกห้องที่จะส่งบิลน้ำไฟ</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {rentals.length} ห้องที่ยังไม่ได้ส่งบิลน้ำไฟ
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {rentals.map((rental) => {
            const assetName = displayAssetName(rental)
            return (
              <button
                key={rental.id}
                onClick={() => onSelect(rental)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-left transition-all hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {rental.cust_name || '—'}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {assetName}
                </p>
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
