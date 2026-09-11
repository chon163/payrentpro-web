// โหมด 1: "เพิ่มสินทรัพย์" — กรอกเฉพาะข้อมูลของห้อง ไม่มีฟิลด์ผู้เช่าเลย
// insert ลงตาราง rentals ด้วย room_status='vacant' + cust_name='ว่าง'
// (แตกจาก AddRentalModal เดิมที่กรอกทั้งห้องและผู้เช่าพร้อมกัน)

import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Icon } from '../components/ui'
import { MODAL_INPUT_CLS } from '../components/styles'
import { CollapsibleSection, Toggle } from '../components/formControls'
import { BIZ_TYPES, CYCLE_LABELS, ASSET_FORM_EMPTY, normalizeBizType, bizTypeMeta, buildAssetInsert } from '../utils/asset'
import { buildMockAssetForm } from '../utils/mockForm'

export function AddAssetModal({ open, onClose, onCreated, onToast }) {
  const [form, setForm] = useState(ASSET_FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (open) {
      setForm({ ...ASSET_FORM_EMPTY })
      setError(null)
      setSaving(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const isProperty = normalizeBizType(form.biz_type) === 'property'
  const typeMeta = bizTypeMeta(form.biz_type)

  // กดเลือกการ์ดประเภท → เปิดฟอร์มเปล่า ให้พิมพ์ทับ placeholder ได้เลย
  // (เดิมเติม mock ลงทุกช่องเป็นค่าจริง ผู้ใช้ต้องลบทิ้งก่อนกรอกทุกครั้ง —
  //  ย้ายไปเป็นปุ่ม "เติมข้อมูลตัวอย่าง" ตรงฟุตเตอร์ เหมือน AddTenantModal)
  const selectBizType = (value) => {
    setForm({ ...ASSET_FORM_EMPTY, biz_type: value })
    setError(null)
  }

  const fillMock = () => {
    setForm(buildMockAssetForm(normalizeBizType(form.biz_type)))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { data: landlordId, error: adminError } = await supabase.rpc('get_my_admin_id')
      if (adminError) throw adminError
      if (!landlordId) throw new Error('ไม่พบบัญชีเจ้าของของผู้ใช้นี้ — ลองออกจากระบบแล้วเข้าใหม่')

      const payload = buildAssetInsert(form, landlordId)
      const { error: insertError } = await supabase.from('rentals').insert([payload])
      if (insertError) throw insertError

      onToast?.({ type: 'success', message: 'เพิ่มสินทรัพย์แล้ว — ห้องว่าง พร้อมรับผู้เช่า' })
      await onCreated?.()
      onClose()
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      onToast?.({ type: 'error', message: err?.message || 'บันทึกข้อมูลไม่สำเร็จ' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white dark:bg-gray-900 shadow-2xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">เพิ่มสินทรัพย์ใหม่</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">กรอกข้อมูลของห้อง/รถ/อุปกรณ์ — ยังไม่มีผู้เช่า</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 lg:mr-0 lg:h-auto lg:w-auto lg:p-1.5"
            aria-label="ปิด"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                <Icon name="warning" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!form.biz_type ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  เลือกประเภทสินทรัพย์ <span className="text-rose-500 dark:text-rose-400">*</span>
                </p>
                {BIZ_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => selectBizType(t.value)}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-4 text-left shadow-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/30"
                  >
                    <span className="text-3xl leading-none">{t.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-gray-900 dark:text-gray-100">{t.label}</span>
                      <span className="mt-0.5 block truncate text-sm text-gray-500 dark:text-gray-400">{t.examples}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <CollapsibleSection title="ข้อมูลสินทรัพย์" subtitle="ประเภท ห้อง/ทะเบียน และค่าเช่า" icon="document" defaultOpen>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-3">
                      <p className="text-sm font-bold text-indigo-900 dark:text-indigo-200">{typeMeta.icon} {typeMeta.label}</p>
                      <button
                        type="button"
                        onClick={() => setField('biz_type', '')}
                        disabled={saving}
                        className="shrink-0 rounded-lg bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 shadow-sm transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-800/50"
                      >
                        เปลี่ยนประเภท
                      </button>
                    </div>

                    {typeMeta.subLabel && (
                      <div>
                        <label htmlFor="sub_label" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {typeMeta.subLabel}
                        </label>
                        <input id="sub_label" type="text" value={form.sub_label} onChange={updateField('sub_label')} placeholder={typeMeta.subPlaceholder} className={MODAL_INPUT_CLS} />
                      </div>
                    )}

                    <div>
                      <label htmlFor="item_details" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {typeMeta.itemLabel}
                      </label>
                      <input id="item_details" type="text" value={form.item_details} onChange={updateField('item_details')} placeholder={typeMeta.placeholder} className={MODAL_INPUT_CLS} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          ค่าเช่า / ค่างวด <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <input id="amount" type="number" min="0" step="0.01" value={form.amount} onChange={updateField('amount')} placeholder={typeMeta.amountPlaceholder} required className={MODAL_INPUT_CLS} />
                      </div>
                      <div>
                        <label htmlFor="cycle" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          รอบการเก็บเงิน <span className="text-rose-500 dark:text-rose-400">*</span>
                        </label>
                        <select id="cycle" value={form.cycle} onChange={updateField('cycle')} required className={MODAL_INPUT_CLS}>
                          {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="due_date" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        วันครบกำหนดชำระ (1-31) <span className="text-rose-500 dark:text-rose-400">*</span>
                      </label>
                      <input id="due_date" type="number" min="1" max="31" step="1" value={form.due_date} onChange={updateField('due_date')} placeholder="เช่น 5" required className={MODAL_INPUT_CLS} />
                    </div>

                    <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/70 bg-amber-50/60 dark:bg-amber-950/30 p-4">
                      <label htmlFor="deposit_amount" className="mb-1.5 block text-sm font-bold text-amber-800 dark:text-amber-200">
                        ค่าประกันห้อง (บาท)
                      </label>
                      <input
                        id="deposit_amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.deposit_amount}
                        onChange={updateField('deposit_amount')}
                        placeholder={typeMeta.amountPlaceholder}
                        className={MODAL_INPUT_CLS}
                      />
                      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">ค่าเริ่มต้นของห้องนี้ — ตอนเพิ่มผู้เช่าจะปรับเป็นยอดที่เก็บจริงได้</p>
                    </div>
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="ค่าปรับและการทวงหนี้" subtitle="ตั้งค่าเมื่อผู้เช่าชำระช้า" icon="banknotes">
                  <div className="space-y-4">
                    <Toggle checked={form.penalty_enabled} onChange={(v) => setField('penalty_enabled', v)} label="เปิดใช้ค่าปรับ" />

                    {form.penalty_enabled && (
                      <div>
                        <label htmlFor="penalty_per_day" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าปรับต่อวัน (บาท)</label>
                        <input id="penalty_per_day" type="number" min="0" step="0.01" value={form.penalty_per_day} onChange={updateField('penalty_per_day')} placeholder="เช่น 50" className={MODAL_INPUT_CLS} />
                      </div>
                    )}

                    <div>
                      <label htmlFor="chase_frequency" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ความถี่ทวงหนี้</label>
                      <select id="chase_frequency" value={form.chase_frequency} onChange={updateField('chase_frequency')} className={MODAL_INPUT_CLS}>
                        <option value={3}>ทุก 3 วัน</option>
                        <option value={7}>ทุก 7 วัน</option>
                      </select>
                    </div>

                    <Toggle checked={form.penalty_stop} onChange={(v) => setField('penalty_stop', v)} label="หยุดทวงหนี้อัตโนมัติเมื่อค้างนาน" />
                  </div>
                </CollapsibleSection>

                {isProperty && (
                  <CollapsibleSection title="ค่าน้ำไฟ" subtitle="มิเตอร์และอัตราต่อหน่วย" icon="home">
                    <div className="space-y-4">
                      <Toggle checked={form.utility_enabled} onChange={(v) => setField('utility_enabled', v)} label="คิดค่าน้ำไฟ" />

                      {form.utility_enabled && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="last_water_meter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์น้ำเริ่มต้น</label>
                              <input id="last_water_meter" type="number" min="0" step="1" value={form.last_water_meter} onChange={updateField('last_water_meter')} placeholder="เช่น 120" className={MODAL_INPUT_CLS} />
                            </div>
                            <div>
                              <label htmlFor="water_rate" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าน้ำ/หน่วย (บาท)</label>
                              <input id="water_rate" type="number" min="0" step="0.01" value={form.water_rate} onChange={updateField('water_rate')} placeholder="เช่น 18" className={MODAL_INPUT_CLS} />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="last_elec_meter" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">เลขมิเตอร์ไฟเริ่มต้น</label>
                              <input id="last_elec_meter" type="number" min="0" step="1" value={form.last_elec_meter} onChange={updateField('last_elec_meter')} placeholder="เช่น 2500" className={MODAL_INPUT_CLS} />
                            </div>
                            <div>
                              <label htmlFor="elec_rate" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">ค่าไฟ/หน่วย (บาท)</label>
                              <input id="elec_rate" type="number" min="0" step="0.01" value={form.elec_rate} onChange={updateField('elec_rate')} placeholder="เช่น 5" className={MODAL_INPUT_CLS} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {form.biz_type ? (
              <button
                type="button"
                onClick={fillMock}
                disabled={saving}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60"
              >
                เติมข้อมูลตัวอย่าง
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-4 py-4 text-base font-semibold text-gray-700 dark:text-gray-300 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 sm:w-auto lg:py-2.5 lg:text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={saving || !form.biz_type}
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
      </div>
    </div>
  )
}
