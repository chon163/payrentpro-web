import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDate } from '../utils/format'
import { useTheme } from '../theme.jsx'
import { Field, Icon, Modal, PanelCard, PanelEmpty, TableSkeleton } from '../components/ui'
import { BTN, INPUT_CLS } from '../components/styles'

const NOTE_COLORS = [
  { value: '#fff7ed', label: 'ส้มอ่อน' },
  { value: '#fef3c7', label: 'เหลืองอ่อน' },
  { value: '#d1fae5', label: 'เขียวอ่อน' },
  { value: '#dbeafe', label: 'น้ำเงินอ่อน' },
  { value: '#fce7f3', label: 'ชมพูอ่อน' },
  { value: '#f3e8ff', label: 'ม่วงอ่อน' },
  { value: '#f5f5f5', label: 'เทาอ่อน' },
]

function NoteModal({ row, landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    title: row?.title || '',
    content: row?.content || '',
    color: row?.color || NOTE_COLORS[0].value,
    pinned: row?.pinned || false,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((p) => ({ ...p, [k]: val }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) return setError('กรุณากรอกหัวข้อ')

    setSaving(true)
    try {
      const payload = {
        landlord_id: landlordId,
        title: form.title.trim(),
        content: form.content.trim(),
        color: form.color,
        pinned: form.pinned,
      }
      const { error: dbError } = row?.id
        ? await supabase.from('notes').update(payload).eq('id', row.id)
        : await supabase.from('notes').insert([payload])
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: row?.id ? 'แก้ไขบันทึกแล้ว' : 'บันทึกแล้ว' })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={row?.id ? 'แก้ไขบันทึก' : 'บันทึกใหม่'}
      subtitle="จดสิ่งที่ต้องทำ ไอเดียที่นึกได้"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="note-form" disabled={saving} className={BTN.primary}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="note-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="หัวข้อ" required>
          <input type="text" value={form.title} onChange={set('title')} className={INPUT_CLS} placeholder="เช่น ต้องซ่อมท่อห้อง 205" required />
        </Field>

        <Field label="เนื้อหา">
          <textarea value={form.content} onChange={set('content')} rows={5} className={INPUT_CLS} placeholder="รายละเอียดที่ต้องจำ" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="สีการ์ด">
            <select value={form.color} onChange={set('color')} className={INPUT_CLS}>
              {NOTE_COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="ปักหมุด">
            <label className="flex h-11 items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
              <input type="checkbox" checked={form.pinned} onChange={set('pinned')} className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-gray-700 dark:text-gray-300">แสดงบนสุด</span>
            </label>
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function NoteGrid({ rows, loading, onEdit, onDelete }) {
  // ธีมมืด: หรี่สีพาสเทลที่ผู้ใช้เลือกลงด้วย color-mix กับ slate-900 — ยังแยกโทนได้แต่ไม่จ้าตัดธีม
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const noteBg = (color) => (isDark ? `color-mix(in srgb, ${color || '#fff7ed'} 28%, #0f172a)` : color || '#fff7ed')

  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>ยังไม่มีบันทึก — กด "บันทึกใหม่" เพื่อจดสิ่งที่ต้องทำ</PanelEmpty>
  }
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex flex-col rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
          style={{ background: noteBg(r.color) }}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 flex-1 font-semibold text-gray-900 dark:text-gray-100">{r.title}</h4>
            {r.pinned ? (
              <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-900/60 dark:text-gray-300">
                ปักหมุด
              </span>
            ) : null}
          </div>
          {r.content ? (
            <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{r.content}</p>
          ) : (
            <div className="flex-1" />
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{formatDate(r.updated_at || r.created_at)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onEdit(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-white dark:bg-gray-900/60 dark:text-gray-200 dark:hover:bg-gray-900">
              <Icon name="pencil" className="h-4 w-4" /> แก้ไข
            </button>
            <button type="button" onClick={() => onDelete(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-white dark:bg-gray-900/60 dark:text-rose-400 dark:hover:bg-gray-900">
              <Icon name="trash" className="h-4 w-4" /> ลบ
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NotesPage({ onToast }) {
  const [landlordId, setLandlordId] = useState(null)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [noteModal, setNoteModal] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    if (!landlordId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('notes')
        .select('*')
        .eq('landlord_id', landlordId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      if (dbError) throw dbError
      setNotes(data || [])
    } catch (err) {
      setError(err?.message || 'โหลดไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [landlordId])

  // landlord_id ในตารางคือ admins.id (ไม่ใช่ auth uid) — map ผ่าน RPC เดียวกับหน้าอื่นๆ
  useEffect(() => {
    supabase.rpc('get_my_admin_id').then(({ data, error: rpcError }) => {
      if (rpcError || !data) {
        setError(rpcError?.message || 'ไม่พบบัญชีเจ้าของของผู้ใช้นี้ — ลองออกจากระบบแล้วเข้าใหม่')
        setLoading(false)
        return
      }
      setLandlordId(data)
    })
  }, [])

  useEffect(() => {
    if (landlordId) load()
  }, [landlordId, load])

  async function confirmDelete() {
    if (!deleting) return
    try {
      const { error: dbError } = await supabase.from('notes').delete().eq('id', deleting.id)
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: 'ลบแล้ว' })
      setDeleting(null)
      await load()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'ลบไม่สำเร็จ' })
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={load} className={BTN.secondary}>ลองใหม่</button>
        </div>
      ) : null}

      <PanelCard
        title="บันทึก"
        subtitle="โน้ตส่วนตัว จดสิ่งที่ต้องทำ ไอเดียที่นึกได้"
        action={
          <button type="button" onClick={() => setNoteModal({})} className={BTN.primary}>
            <Icon name="plus" className="h-4 w-4" /> บันทึกใหม่
          </button>
        }
      >
        <NoteGrid
          rows={notes}
          loading={loading}
          onEdit={(row) => setNoteModal(row)}
          onDelete={(row) => setDeleting(row)}
        />
      </PanelCard>

      {noteModal ? (
        <NoteModal
          row={noteModal.id ? noteModal : null}
          landlordId={landlordId}
          onClose={() => setNoteModal(null)}
          onSaved={load}
          onToast={onToast}
        />
      ) : null}

      {deleting ? (
        <Modal
          title="ยืนยันการลบ"
          onClose={() => setDeleting(null)}
          maxWidth="sm:max-w-sm"
          footer={
            <>
              <button type="button" onClick={() => setDeleting(null)} className={BTN.secondary}>ยกเลิก</button>
              <button type="button" onClick={confirmDelete} className={BTN.danger}>ลบ</button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ลบ <span className="font-semibold text-gray-900 dark:text-gray-100">{deleting.title}</span> ออกจากระบบ — การลบไม่สามารถย้อนกลับได้
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
