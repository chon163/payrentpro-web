import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDate } from '../utils/format'
import { Field, Icon, Modal, PanelCard, PanelEmpty, TableSkeleton } from '../components/ui'
import { BTN, INPUT_CLS } from '../components/styles'

const ANN_STATUS = {
  draft: { label: 'ฉบับร่าง', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  published: { label: 'เผยแพร่', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
  archived: { label: 'เก็บถาวร', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
}

function todayISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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
    return <PanelEmpty>ยังไม่มีประกาศ — กด "ประกาศใหม่" เพื่อแจ้งข่าวถึงผู้เช่า</PanelEmpty>
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
                  <span className="text-emerald-600 dark:text-emerald-400">ส่ง LINE แล้ว {formatDate(r.sent_to_line_at)}</span>
                </>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => onEdit(r)} className={BTN.secondary}>
                <Icon name="pencil" className="h-4 w-4" /> แก้ไข
              </button>
              <button
                type="button"
                onClick={() => onBroadcast(r)}
                disabled={broadcasting === r.id}
                className={BTN.secondary}
              >
                <Icon name="send" className="h-4 w-4" />
                {broadcasting === r.id ? 'กำลังส่ง…' : 'ส่ง LINE'}
              </button>
              <button type="button" onClick={() => onDelete(r)} className={BTN.danger}>
                <Icon name="trash" className="h-4 w-4" /> ลบ
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnnouncementsPage({ onToast }) {
  const [landlordId, setLandlordId] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [annModal, setAnnModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [broadcasting, setBroadcasting] = useState(null)

  const load = useCallback(async () => {
    if (!landlordId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('announcements')
        .select('*')
        .eq('landlord_id', landlordId)
        .order('publish_date', { ascending: false })
      if (dbError) throw dbError
      setAnnouncements(data || [])
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

  async function handleBroadcast(row) {
    setBroadcasting(row.id)
    try {
      // signature จริงของ RPC คือ broadcast_announcement(p_id uuid)
      const { error: rpcError } = await supabase.rpc('broadcast_announcement', { p_id: row.id })
      if (rpcError) throw rpcError
      onToast?.({ type: 'success', message: 'ส่งประกาศเข้ากลุ่ม LINE แล้ว' })
      await load()
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'ส่งไม่สำเร็จ' })
    } finally {
      setBroadcasting(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      const { error: dbError } = await supabase.from('announcements').delete().eq('id', deleting.id)
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
          onDelete={(row) => setDeleting(row)}
          onBroadcast={handleBroadcast}
          broadcasting={broadcasting}
        />
      </PanelCard>

      {annModal ? (
        <AnnouncementModal
          row={annModal.id ? annModal : null}
          landlordId={landlordId}
          onClose={() => setAnnModal(null)}
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
