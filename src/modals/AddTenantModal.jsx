// โหมด 2: "เพิ่มผู้เช่า" — เลือกห้องว่างก่อน แล้วกรอกข้อมูลผู้เช่า
// update ตาราง rentals ด้วย room_status='occupied' + ฟิลด์ผู้เช่า
// (ไม่ insert แถวใหม่ — แก้แถวเดิมที่สร้างไว้ใน AddAssetModal)

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../components/ui'
import { MODAL_INPUT_CLS } from '../components/styles'
import { BIZ_TYPES, TENANT_FORM_EMPTY, normalizeBizType, bizTypeMeta, isVacant, buildTenantUpdate } from '../utils/asset'
import { buildMockTenantForm } from '../utils/mockForm'
import { displayAssetName } from '../utils/assetName'
import { formatCurrency } from '../utils/format'

export function AddTenantModal({ open, rentals, onClose, onAssigned, onToast }) {
  const [step, setStep] = useState(1) // 1=เลือกห้อง, 2=กรอกผู้เช่า
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [form, setForm] = useState(TENANT_FORM_EMPTY)
  const [search, setSearch] = useState('')
  const [bizFilter, setBizFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setStep(1)
      setSelectedAsset(null)
      setForm({ ...TENANT_FORM_EMPTY })
      setSearch('')
      setBizFilter('all')
      setError(null)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (step === 2) setStep(1)
        else onClose()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, step, onClose])

  // ห้องว่าง + กรอง
  const vacantAssets = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return (rentals || []).filter((r) => {
      if (!isVacant(r)) return false
      const matchBiz = bizFilter === 'all' || normalizeBizType(r.biz_type) === bizFilter
      const matchKeyword = !keyword
        || String(r.item_details ?? '').toLowerCase().includes(keyword)
        || String(r.sub_label ?? '').toLowerCase().includes(keyword)
      return matchBiz && matchKeyword
    })
  }, [rentals, search, bizFilter])

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const selectAsset = (asset) => {
    setSelectedAsset(asset)
    // ค่าเริ่มต้น: เงินประกัน + วันเข้า/หมดสัญญา
    const today = new Date()
    const oneYearLater = new Date(today)
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
    const pad = (n) => String(n).padStart(2, '0')
    const toLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    setForm({
      ...TENANT_FORM_EMPTY,
      deposit_amount: String(asset.deposit_amount || asset.amount || ''),
      move_in_date: toLocal(today),
      lease_end_date: toLocal(oneYearLater),
    })
    setError(null)
    setStep(2)
  }

  const fillMock = () => {
    setForm((prev) => ({ ...prev, ...buildMockTenantForm() }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedAsset?.id) return
    setSaving(true)
    setError(null)
    try {
      const payload = buildTenantUpdate(form)
      const { error: updateError } = await supabase.from('rentals').update(payload).eq('id', selectedAsset.id)
      if (updateError) throw updateError

      onToast?.({ type: 'success', message: 'เพิ่มผู้เช่าเรียบร้อยแล้ว' })
      await onAssigned?.({ rental: selectedAsset, custName: form.cust_name.trim() })
      onClose()
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      onToast?.({ type: 'error', message: err?.message || 'บันทึกข้อมูลไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {step === 1 ? 'เลือกสินทรัพย์ว่าง' : 'เพิ่มผู้เช่า'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {step === 1 ? `ห้องว่าง ${vacantAssets.length} รายการ` : displayAssetName(selectedAsset)}
            </p>
          </div>
          <button
            type="button"
            onClick={step === 2 ? () => setStep(1) : onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label={step === 2 ? 'กลับ' : 'ปิด'}
          >
            {step === 2 ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>

        {step === 1 ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-3 px-6 py-4">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาห้อง/ทะเบียน"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 py-3 pl-11 pr-4 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBizFilter('all')}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    bizFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  ทั้งหมด
                </button>
                {BIZ_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setBizFilter(t.value)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      bizFilter === t.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {t.icon} {t.tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              {vacantAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
                    <Icon name="home" className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">ไม่พบห้องว่าง</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {search ? 'ลองเปลี่ยนคำค้นหา' : 'เพิ่มสินทรัพย์ใหม่ก่อนเพื่อเพิ่มผู้เช่า'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {vacantAssets.map((asset) => {
                    const meta = bizTypeMeta(asset.biz_type)
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => selectAsset(asset)}
                        className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-left shadow-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xl leading-none">{meta.icon}</span>
                          <div className="min-w-0 flex-1">
                            {asset.sub_label && (
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{asset.sub_label}</p>
                            )}
                            <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{asset.item_details || '—'}</p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          ค่าเช่า <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(asset.amount)}</span>
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-4">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">สรุปข้อมูลห้อง</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-600 dark:text-gray-400">ค่าเช่า</dt>
                    <dd className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(selectedAsset?.amount)}</dd>
                  </div>
                  {selectedAsset?.penalty_enabled && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-gray-600 dark:text-gray-400">ค่าปรับต่อวัน</dt>
                      <dd className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(selectedAsset?.penalty_per_day)}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <label htmlFor="cust_name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  ชื่อผู้เช่า <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input id="cust_name" type="text" value={form.cust_name} onChange={updateField('cust_name')} placeholder="เช่น นายสมชาย ใจดี" required className={MODAL_INPUT_CLS} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="tenant_phone" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เบอร์โทรผู้เช่า</label>
                  <input id="tenant_phone" type="text" value={form.tenant_phone} onChange={updateField('tenant_phone')} placeholder="08x-xxx-xxxx" className={MODAL_INPUT_CLS} />
                </div>
                <div>
                  <label htmlFor="tenant_id_card" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขบัตรประชาชน</label>
                  <input id="tenant_id_card" type="text" value={form.tenant_id_card} onChange={updateField('tenant_id_card')} placeholder="x-xxxx-xxxxx-xx-x" className={MODAL_INPUT_CLS} />
                </div>
              </div>

              <div>
                <label htmlFor="emergency_contact" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เบอร์ติดต่อฉุกเฉิน</label>
                <input id="emergency_contact" type="text" value={form.emergency_contact} onChange={updateField('emergency_contact')} placeholder="08x-xxx-xxxx" className={MODAL_INPUT_CLS} />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="move_in_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันที่ย้ายเข้า</label>
                  <input id="move_in_date" type="date" value={form.move_in_date} onChange={updateField('move_in_date')} className={MODAL_INPUT_CLS} />
                </div>
                <div>
                  <label htmlFor="lease_end_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">วันสิ้นสุดสัญญา</label>
                  <input id="lease_end_date" type="date" value={form.lease_end_date} onChange={updateField('lease_end_date')} className={MODAL_INPUT_CLS} />
                </div>
              </div>

              <div>
                <label htmlFor="deposit_amount" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เงินมัดจำ (บาท)</label>
                <input id="deposit_amount" type="number" min="0" step="0.01" value={form.deposit_amount} onChange={updateField('deposit_amount')} placeholder="0.00" className={MODAL_INPUT_CLS} />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เติมค่าประกันของห้องไว้แล้ว — แก้เป็นยอดที่เก็บจริงได้</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={fillMock}
                disabled={saving}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60"
              >
                เติมข้อมูลตัวอย่าง
              </button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
                >
                  กลับ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
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
                    'บันทึกข้อมูล'
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
