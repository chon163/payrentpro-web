import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDate } from '../utils/format'
import {
  Field, Icon, Modal, PanelCard, PanelEmpty, TableSkeleton,
} from '../components/ui'
import { BTN, INPUT_CLS } from '../components/styles'

// ── หน้าประกาศ / บันทึก / เอกสาร ─────────────────────────────────────
// ที่มา: ผสานจาก PropertyHub (RESEARCH.md — announcements / notes / documents)
// ตาราง: announcements / notes / documents
// (migration 20260909110000_announcements_notes_documents.sql)
//
// ของแถมที่ต้นทางไม่มี: ปุ่มส่งประกาศเข้ากลุ่ม LINE ของผู้เช่าทุกห้อง
// (เรามี LINE binding อยู่แล้ว — ประกาศที่ส่งไม่ถึงใครก็แค่บันทึกลอย ๆ)

const ANN_STATUS = {
  draft: { label: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  published: { label: 'เผยแพร่', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  archived: { label: 'เก็บถาวร', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
}

// สีโน้ตให้เลือก — คุมเป็นชุดแทน <input type="color"> ของต้นทาง
// เพราะผู้ใช้เลือกสีเข้มแล้วตัวอักษรดำอ่านไม่ออก (ต้นทางปล่อยให้เลือกอะไรก็ได้)
const NOTE_COLORS = [
  { value: '#fff7ed', label: 'ส้มอ่อน' },
  { value: '#fef9c3', label: 'เหลืองอ่อน' },
  { value: '#dcfce7', label: 'เขียวอ่อน' },
  { value: '#e0f2fe', label: 'ฟ้าอ่อน' },
  { value: '#fae8ff', label: 'ม่วงอ่อน' },
  { value: '#fee2e2', label: 'แดงอ่อน' },
]

const MAX_FILE_MB = 10

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatBytes(n) {
  const b = Number(n)
  if (!Number.isFinite(b) || b <= 0) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ── ประกาศ ───────────────────────────────────────────────────────────
function AnnouncementModal({ row, landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    title: row?.title || '',
    content: row?.content || '',
    publish_date: row?.publish_date || todayISO(),
    status: row?.status || 'draft',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

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
        publish_date: form.publish_date,
        status: form.status,
      }
      const { error: dbError } = row?.id
        ? await supabase.from('announcements').update(payload).eq('id', row.id)
        : await supabase.from('announcements').insert([payload])
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: row?.id ? 'แก้ไขประกาศแล้ว' : 'บันทึกประกาศแล้ว' })
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
      title={row?.id ? 'แก้ไขประกาศ' : 'ประกาศใหม่'}
      subtitle="แจ้งข่าวถึงผู้เช่า เช่น ประกาศดับน้ำดับไฟ"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="ann-form" disabled={saving} className={BTN.primary}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </>
      }
    >
      <form id="ann-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="หัวข้อ" required>
          <input type="text" value={form.title} onChange={set('title')} className={INPUT_CLS} placeholder="เช่น แจ้งดับน้ำ วันเสาร์ 9-12 น." required />
        </Field>

        <Field label="เนื้อหา">
          <textarea value={form.content} onChange={set('content')} rows={5} className={INPUT_CLS} placeholder="รายละเอียดที่ต้องการแจ้งผู้เช่า" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="วันที่ประกาศ" required>
            <input type="date" value={form.publish_date} onChange={set('publish_date')} className={INPUT_CLS} required />
          </Field>
          <Field label="สถานะ">
            <select value={form.status} onChange={set('status')} className={INPUT_CLS}>
              {Object.entries(ANN_STATUS).map(([v, m]) => (
                <option key={v} value={v}>{m.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function AnnouncementList({ rows, loading, onEdit, onDelete, onBroadcast, broadcasting }) {
  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>ยังไม่มีประกาศ — กด “ประกาศใหม่” เพื่อแจ้งข่าวถึงผู้เช่า</PanelEmpty>
  }
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map((r) => {
        const st = ANN_STATUS[r.status] || ANN_STATUS.draft
        return (
          <div key={r.id} className="space-y-2 p-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 className="min-w-0 flex-1 text-base font-semibold text-gray-900 dark:text-gray-100">{r.title}</h4>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
            </div>
            {r.content ? (
              <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{r.content}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
              <span>{formatDate(r.publish_date)}</span>
              {r.sent_to_line_at ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400">ส่งเข้า LINE แล้ว {formatDate(r.sent_to_line_at)}</span>
                </>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onBroadcast(r)}
                disabled={broadcasting === r.id}
                className={BTN.primary}
              >
                <Icon name="megaphone" className="h-4 w-4" />
                {broadcasting === r.id ? 'กำลังส่ง…' : r.sent_to_line_at ? 'ส่งเข้า LINE อีกครั้ง' : 'ส่งเข้า LINE'}
              </button>
              <button type="button" onClick={() => onEdit(r)} className={BTN.secondary}>
                <Icon name="pencil" className="h-4 w-4" /> แก้ไข
              </button>
              <button type="button" onClick={() => onDelete(r)} className={`${BTN.secondary} text-rose-600 dark:text-rose-400`}>
                <Icon name="trash" className="h-4 w-4" /> ลบ
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── บันทึกช่วยจำ ─────────────────────────────────────────────────────
function NoteModal({ row, landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState(() => ({
    title: row?.title || '',
    content: row?.content || '',
    color: row?.color || NOTE_COLORS[0].value,
    pinned: Boolean(row?.pinned),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

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
      subtitle="โน้ตช่วยจำส่วนตัว ผู้เช่าไม่เห็น"
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
          <input type="text" value={form.title} onChange={set('title')} className={INPUT_CLS} placeholder="เช่น นัดช่างแอร์" required />
        </Field>

        <Field label="เนื้อหา">
          <textarea value={form.content} onChange={set('content')} rows={4} className={INPUT_CLS} />
        </Field>

        <Field label="สีการ์ด">
          <div className="flex flex-wrap gap-2">
            {NOTE_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, color: c.value }))}
                aria-label={c.label}
                aria-pressed={form.color === c.value}
                className={`h-11 w-11 rounded-xl border-2 transition-transform hover:-translate-y-0.5 ${
                  form.color === c.value ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900' : 'border-gray-200 dark:border-gray-700'
                }`}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </Field>

        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => setForm((p) => ({ ...p, pinned: e.target.checked }))}
            className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-gray-600"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ปักหมุดขึ้นบนสุด</span>
        </label>
      </form>
    </Modal>
  )
}

function NoteGrid({ rows, loading, onEdit, onDelete }) {
  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>ยังไม่มีบันทึก — กด “บันทึกใหม่” เพื่อจดสิ่งที่ต้องทำ</PanelEmpty>
  }
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-3">
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex flex-col rounded-2xl border border-gray-200 p-4 dark:border-gray-700"
          // สีพื้นเป็นค่าจากผู้ใช้ จึงคุมด้วย inline style — ชุดสีทั้งหมดเป็นโทนอ่อน
          // ตัวอักษรจึงคงเป็นสีเข้มได้ทั้งโหมดสว่างและมืด
          style={{ background: r.color || '#fff7ed' }}
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 flex-1 font-semibold text-gray-900">{r.title}</h4>
            {r.pinned ? <span className="shrink-0 text-gray-500" title="ปักหมุด" aria-label="ปักหมุด">📌</span> : null}
          </div>
          {r.content ? (
            <p className="mt-2 flex-1 whitespace-pre-wrap text-sm text-gray-700">{r.content}</p>
          ) : (
            <div className="flex-1" />
          )}
          <p className="mt-2 text-xs text-gray-500">{formatDate(r.updated_at || r.created_at)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => onEdit(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-white">
              <Icon name="pencil" className="h-4 w-4" /> แก้ไข
            </button>
            <button type="button" onClick={() => onDelete(r)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/70 px-3 text-sm font-semibold text-rose-600 transition-colors hover:bg-white">
              <Icon name="trash" className="h-4 w-4" /> ลบ
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── เอกสาร ───────────────────────────────────────────────────────────
function DocumentModal({ landlordId, rentals, onClose, onSaved, onToast }) {
  const [title, setTitle] = useState('')
  const [rentalId, setRentalId] = useState('')
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!file) return setError('กรุณาเลือกไฟล์')
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      return setError(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`)
    }

    setSaving(true)
    try {
      // path เริ่มด้วย landlord_id เพราะ storage policy กรองจากส่วนแรกของพาธ
      const safeName = file.name.replace(/[^\w.\-ก-๙]/g, '_')
      const path = `${landlordId}/${crypto.randomUUID()}-${safeName}`

      const { error: upError } = await supabase.storage
        .from('documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upError) throw upError

      const { error: dbError } = await supabase.from('documents').insert([{
        landlord_id: landlordId,
        rental_id: rentalId || null,
        title: title.trim() || file.name,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
      }])
      if (dbError) {
        // insert พลาดแล้วต้องเก็บไฟล์กำพร้าใน storage ทิ้ง ไม่ให้ค้างกินพื้นที่
        await supabase.storage.from('documents').remove([path])
        throw dbError
      }

      onToast?.({ type: 'success', message: 'อัปโหลดเอกสารแล้ว' })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="อัปโหลดเอกสาร"
      subtitle={`ไฟล์ไม่เกิน ${MAX_FILE_MB} MB · เก็บแบบส่วนตัว เปิดดูได้เฉพาะคุณ`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="doc-form" disabled={saving} className={BTN.primary}>
            {saving ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
          </button>
        </>
      }
    >
      <form id="doc-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="ไฟล์" required hint="รูป PDF หรือเอกสารทั่วไป">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className={`${INPUT_CLS} file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-emerald-700 dark:file:bg-emerald-950/40 dark:file:text-emerald-300`}
            required
          />
        </Field>

        <Field label="ชื่อเอกสาร" hint="เว้นว่างได้ — จะใช้ชื่อไฟล์">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} placeholder="เช่น สำเนาสัญญา ห้อง 101" />
        </Field>

        <Field label="ผูกกับสินทรัพย์" hint="เว้นว่าง = เอกสารกลาง ไม่ผูกห้องใด">
          <select value={rentalId} onChange={(e) => setRentalId(e.target.value)} className={INPUT_CLS}>
            <option value="">ไม่ผูก (เอกสารกลาง)</option>
            {rentals.map((r) => (
              <option key={r.id} value={r.id}>
                {[r.sub_label, r.item_details].filter(Boolean).join(' · ') || r.cust_name || r.id}
              </option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function DocumentTable({ rows, loading, onOpen, onDelete, opening }) {
  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>ยังไม่มีเอกสาร — เก็บสำเนาสัญญา บัตรประชาชน ใบเสร็จไว้ที่นี่ได้</PanelEmpty>
  }
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ชื่อ</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ไฟล์</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">ขนาด</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">วันที่</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</td>
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{r.file_name}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">{formatBytes(r.file_size)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(r.created_at)}</td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  {/* 44px ที่ touch — ย่อเป็น compact เฉพาะ lg+ ตามเกณฑ์ของโปรเจกต์ */}
                  <div className="inline-flex gap-1">
                    <button type="button" onClick={() => onOpen(r)} disabled={opening === r.id} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 lg:h-8 lg:w-8" aria-label="เปิดไฟล์">
                      <Icon name="download" className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onDelete(r)} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 lg:h-8 lg:w-8" aria-label="ลบ">
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="space-y-2 p-4">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{r.title}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="break-all">{r.file_name}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(r.file_size)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatDate(r.created_at)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => onOpen(r)} disabled={opening === r.id} className={`${BTN.secondary} flex-1`}>
                <Icon name="download" className="h-4 w-4" /> {opening === r.id ? 'กำลังเปิด…' : 'เปิดไฟล์'}
              </button>
              <button type="button" onClick={() => onDelete(r)} className={`${BTN.secondary} flex-1 text-rose-600 dark:text-rose-400`}>
                <Icon name="trash" className="h-4 w-4" /> ลบ
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── หน้าหลัก ─────────────────────────────────────────────────────────
export default function CommsPage({ onToast }) {
  const [tab, setTab] = useState('announcements')
  const [landlordId, setLandlordId] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [notes, setNotes] = useState([])
  const [documents, setDocuments] = useState([])
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [annModal, setAnnModal] = useState(null)
  const [noteModal, setNoteModal] = useState(null)
  const [docModal, setDocModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [broadcasting, setBroadcasting] = useState(null)
  const [opening, setOpening] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: adminId, error: adminError } = await supabase.rpc('get_my_admin_id')
      if (adminError) throw adminError
      if (!adminId) throw new Error('ไม่พบบัญชีเจ้าของของผู้ใช้นี้ — ลองออกจากระบบแล้วเข้าใหม่')
      setLandlordId(adminId)

      const [annRes, noteRes, docRes, rentalRes] = await Promise.all([
        supabase.from('announcements').select('*').order('publish_date', { ascending: false }),
        supabase.from('notes').select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
        supabase.from('rentals').select('id, item_details, sub_label, cust_name'),
      ])

      if (annRes.error) throw annRes.error
      if (noteRes.error) throw noteRes.error
      if (docRes.error) throw docRes.error
      if (rentalRes.error) throw rentalRes.error

      setAnnouncements(Array.isArray(annRes.data) ? annRes.data : [])
      setNotes(Array.isArray(noteRes.data) ? noteRes.data : [])
      setDocuments(Array.isArray(docRes.data) ? docRes.data : [])
      setRentals(Array.isArray(rentalRes.data) ? rentalRes.data : [])
    } catch (err) {
      setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleBroadcast(row) {
    setBroadcasting(row.id)
    try {
      const { data, error: rpcError } = await supabase.rpc('broadcast_announcement', { p_id: row.id })
      if (rpcError) throw rpcError
      if (!data?.ok) {
        const reason = data?.error === 'no_line_token'
          ? 'ยังไม่ได้ตั้งค่า LINE token ในระบบ'
          : data?.error || 'ส่งไม่สำเร็จ'
        throw new Error(reason)
      }
      const n = Number(data.groups) || 0
      onToast?.({
        type: n > 0 ? 'success' : 'error',
        message: n > 0 ? `ส่งเข้ากลุ่ม LINE แล้ว ${n} กลุ่ม` : 'ยังไม่มีห้องใดผูกกลุ่ม LINE ไว้',
      })
      await load()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'ส่งไม่สำเร็จ' })
    } finally {
      setBroadcasting(null)
    }
  }

  async function handleOpenDoc(row) {
    setOpening(row.id)
    try {
      // bucket เป็น private — ต้องขอ signed URL อายุสั้นทุกครั้ง (ไม่มี public URL)
      const { data, error: sErr } = await supabase.storage
        .from('documents')
        .createSignedUrl(row.file_path, 60)
      if (sErr) throw sErr
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'เปิดไฟล์ไม่สำเร็จ' })
    } finally {
      setOpening(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    const { row, kind } = deleting
    try {
      if (kind === 'documents') {
        // ลบไฟล์ใน storage ก่อน แล้วค่อยลบแถว — ถ้าลบแถวก่อนแล้วลบไฟล์พลาด
        // ไฟล์จะค้างใน bucket โดยไม่มีอะไรอ้างถึงและลบทิ้งไม่ได้จากหน้าเว็บ
        const { error: rmError } = await supabase.storage.from('documents').remove([row.file_path])
        if (rmError) throw rmError
      }
      const { error: dbError } = await supabase.from(kind).delete().eq('id', row.id)
      if (dbError) throw dbError
      onToast?.({ type: 'success', message: 'ลบแล้ว' })
      setDeleting(null)
      await load()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'ลบไม่สำเร็จ' })
      setDeleting(null)
    }
  }

  const TABS = [
    { key: 'announcements', label: 'ประกาศ', icon: 'megaphone', count: announcements.length },
    { key: 'notes', label: 'บันทึก', icon: 'document', count: notes.length },
    { key: 'documents', label: 'เอกสาร', icon: 'receipt', count: documents.length },
  ]

  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">ประกาศและเอกสาร</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">แจ้งข่าวผู้เช่า จดบันทึก และเก็บไฟล์เอกสาร</p>
      </div>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          <button type="button" onClick={load} className={BTN.secondary}>ลองใหม่</button>
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
            {t.count > 0 ? <span className="text-xs font-normal opacity-70">({t.count})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'announcements' ? (
        <PanelCard
          title="ประกาศ"
          subtitle="ส่งเข้ากลุ่ม LINE ของผู้เช่าได้ในคลิกเดียว"
          action={
            <button type="button" onClick={() => setAnnModal({})} className={BTN.primary}>
              <Icon name="plus" className="h-4 w-4" /> ประกาศใหม่
            </button>
          }
        >
          <AnnouncementList
            rows={announcements}
            loading={loading}
            onEdit={(row) => setAnnModal(row)}
            onDelete={(row) => setDeleting({ row, kind: 'announcements' })}
            onBroadcast={handleBroadcast}
            broadcasting={broadcasting}
          />
        </PanelCard>
      ) : tab === 'notes' ? (
        <PanelCard
          title="บันทึก"
          subtitle="โน้ตส่วนตัว ผู้เช่าไม่เห็น"
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
            onDelete={(row) => setDeleting({ row, kind: 'notes' })}
          />
        </PanelCard>
      ) : (
        <PanelCard
          title="เอกสาร"
          subtitle="เก็บแบบส่วนตัว เปิดดูผ่านลิงก์ชั่วคราวเท่านั้น"
          action={
            <button type="button" onClick={() => setDocModal(true)} className={BTN.primary}>
              <Icon name="plus" className="h-4 w-4" /> อัปโหลด
            </button>
          }
        >
          <DocumentTable
            rows={documents}
            loading={loading}
            onOpen={handleOpenDoc}
            onDelete={(row) => setDeleting({ row, kind: 'documents' })}
            opening={opening}
          />
        </PanelCard>
      )}

      {annModal ? (
        <AnnouncementModal
          row={annModal.id ? annModal : null}
          landlordId={landlordId}
          onClose={() => setAnnModal(null)}
          onSaved={load}
          onToast={onToast}
        />
      ) : null}

      {noteModal ? (
        <NoteModal
          row={noteModal.id ? noteModal : null}
          landlordId={landlordId}
          onClose={() => setNoteModal(null)}
          onSaved={load}
          onToast={onToast}
        />
      ) : null}

      {docModal ? (
        <DocumentModal
          landlordId={landlordId}
          rentals={rentals}
          onClose={() => setDocModal(false)}
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
            ลบ <span className="font-semibold text-gray-900 dark:text-gray-100">{deleting.row.title}</span>{' '}
            ออกจากระบบ{deleting.kind === 'documents' ? ' พร้อมไฟล์ที่อัปโหลดไว้' : ''} — การลบไม่สามารถย้อนกลับได้
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
