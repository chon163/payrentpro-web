// คอมโพเนนต์ที่ใช้ร่วมกันระหว่าง App.jsx และหน้าใหม่ใน src/pages/
//
// ย้ายออกมาจาก App.jsx เพื่อให้หน้าใหม่ import ได้โดยไม่เกิด circular import
// (หน้าใน src/pages/ ถูก App.jsx import — ถ้าหน้าไปดึง export จาก App.jsx กลับ
//  จะวนเป็นวงกลม) ตัว App.jsx import จากไฟล์นี้แทนของเดิมที่ประกาศในไฟล์ตัวเอง
//
// ค่าคงที่ (ICONS / BTN / INPUT_CLS) อยู่ใน components/styles.js — แยกไว้เพราะ
// ไฟล์ที่ export ทั้ง component และ constant ทำให้ Vite fast refresh ใช้ไม่ได้

import { ICONS } from './styles'

export function Icon({ name, className = 'h-6 w-6' }) {
  const d = ICONS[name]
  if (!d) return null
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

// กรอบการ์ดมาตรฐาน — หัวเรื่อง + คำอธิบาย + ปุ่ม/ลิงก์มุมขวา
export function PanelCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PanelEmpty({ children }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10">
      <p className="text-center text-sm text-gray-400 dark:text-gray-500">{children}</p>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 rounded-lg bg-gray-100 dark:bg-gray-800" />
      ))}
    </div>
  )
}

export function Field({ label, hint, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-400 dark:text-gray-500">{hint}</span> : null}
    </label>
  )
}

// ปุ่มปิด (X) กลางศูนย์ — ใช้ร่วมทุก modal/lightbox/toast แทนการคัดลอก svg ซ้ำ
// variant: modal = มุมขวาบนหัว modal · floating = ลอยมุม lightbox · toast = ในแถบ toast
// สูง 44px ที่ touch แล้วย่อ compact ที่ lg ตามเกณฑ์ tap target ของโปรเจกต์
export function CloseButton({ variant = 'modal', onClose, label = 'ปิด' }) {
  const sizeCls = {
    modal: 'h-11 w-11 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:h-auto lg:w-auto lg:p-1.5',
    floating: 'absolute -right-3 -top-3 z-10 h-11 w-11 rounded-full bg-white dark:bg-gray-900 shadow-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
    toast: 'h-11 w-11 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:h-auto lg:w-auto lg:p-1.5',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClose}
      className={`flex shrink-0 items-center justify-center text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300 ${sizeCls}`}
      aria-label={label}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.close} />
      </svg>
    </button>
  )
}

// สถานะว่าง/ผิดพลาดกลางศูนย์ — ใช้ร่วมทั้งแอปแทน div มือที่เขียนซ้ำทีละจุด
// tone: gray = ไม่มีข้อมูล · emerald = "จบงานหมด" โทนบวก · rose = โหลดไม่ได้/error
export function EmptyState({ icon = 'document', tone = 'gray', title, hint, action }) {
  const tones = {
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-500 dark:text-amber-400',
  }
  return (
    <div className="p-8 text-center sm:p-10">
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${tones[tone] || tones.gray}`}>
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

// เปลือก modal — bottom sheet ที่มือถือ / กล่องกลางจอที่ sm ขึ้นไป (ตามแพทเทิร์นเดิมของแอป)
export function Modal({ title, subtitle, onClose, children, footer, maxWidth = 'sm:max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-h-[90vh] sm:rounded-2xl ${maxWidth}`}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
          </div>
          <CloseButton onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800 sm:flex-row sm:justify-end">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ตัวเลือกเดือน/ปี — ทุกหน้าการเงินกรองตามงวดเหมือนกันหมด
export function PeriodPicker({ year, month, onChange }) {
  const now = new Date()
  const years = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) years.push(y)
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ]
  const sel =
    'min-h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-emerald-900'
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={month} onChange={(e) => onChange(year, Number(e.target.value))} className={sel} aria-label="เดือน">
        {months.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select value={year} onChange={(e) => onChange(Number(e.target.value), month)} className={sel} aria-label="ปี">
        {years.map((y) => (
          <option key={y} value={y}>{y + 543}</option>
        ))}
      </select>
    </div>
  )
}
