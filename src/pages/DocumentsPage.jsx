import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDate } from '../utils/format'
import { Field, Icon, Modal, PanelCard, PanelEmpty, TableSkeleton } from '../components/ui'
import { BTN, INPUT_CLS } from '../components/styles'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

function DocumentModal({ landlordId, onClose, onSaved, onToast }) {
  const [form, setForm] = useState({ title: '', file: null })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))
  const setFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setForm((p) => ({ ...p, file: f, title: p.title || f.name }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.title.trim()) return setError('กรุณากรอกชื่อเอกสาร')
    if (!form.file) return setError('กรุณาเลือกไฟล์')

    setUploading(true)
    try {
      const ext = form.file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const filePath = `${landlordId}/${fileName}`

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, form.file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError

      // schema มี mime_type (ไม่มี file_url/file_type) และ bucket เป็น private จึงไม่เก็บ public URL
      const { error: dbError } = await supabase.from('documents').insert([{
        landlord_id: landlordId,
        title: form.title.trim(),
        file_name: form.file.name,
        file_path: filePath,
        file_size: form.file.size,
        mime_type: form.file.type || 'application/octet-stream',
      }])
      if (dbError) throw dbError

      onToast?.({ type: 'success', message: 'อัปโหลดเอกสารแล้ว' })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err?.message || 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      title="อัปโหลดเอกสาร"
      subtitle="เก็บไฟล์สำคัญไว้ในระบบ เช่น สำเนาบัตรประชาชน สัญญาเช่า"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>ยกเลิก</button>
          <button type="submit" form="doc-form" disabled={uploading} className={BTN.primary}>
            {uploading ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
          </button>
        </>
      }
    >
      <form id="doc-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>
        ) : null}

        <Field label="ชื่อเอกสาร" required>
          <input type="text" value={form.title} onChange={set('title')} className={INPUT_CLS} placeholder="เช่น สัญญาเช่าห้อง 101" required />
        </Field>

        <Field label="ไฟล์" required>
          <input
            type="file"
            onChange={setFile}
            className={INPUT_CLS}
            required
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
          />
          {form.file ? (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              เลือกแล้ว: {form.file.name} ({formatBytes(form.file.size)})
            </p>
          ) : null}
        </Field>
      </form>
    </Modal>
  )
}

function DocumentList({ rows, loading, onOpen, opening, onDelete }) {
  if (loading) return <TableSkeleton />
  if (!rows.length) {
    return <PanelEmpty>ยังไม่มีเอกสาร — กด "อัปโหลด" เพื่อเก็บไฟล์สำคัญไว้ในระบบ</PanelEmpty>
  }
  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map((r) => (
        <div key={r.id} className="space-y-2 p-4 sm:px-5">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h4>
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
  )
}

export default function DocumentsPage({ onToast }) {
  const [landlordId, setLandlordId] = useState(null)
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [docModal, setDocModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [opening, setOpening] = useState(null)

  const load = useCallback(async () => {
    if (!landlordId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: dbError } = await supabase
        .from('documents')
        .select('*')
        .eq('landlord_id', landlordId)
        .order('created_at', { ascending: false })
      if (dbError) throw dbError
      setDocuments(data || [])
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

  // bucket เป็น private (PDPA) — เปิดผ่านลิงก์ชั่วคราว 5 นาทีแทน public URL
  async function handleOpen(row) {
    setOpening(row.id)
    try {
      const { data, error: urlError } = await supabase.storage.from('documents').createSignedUrl(row.file_path, 300)
      if (urlError) throw urlError
      const win = window.open(data.signedUrl, '_blank')
      if (!win) onToast?.({ type: 'error', message: 'เบราว์เซอร์บล็อกป็อปอัป — อนุญาตป็อปอัปแล้วกดเปิดอีกครั้ง' })
    } catch (err) {
      onToast?.({ type: 'error', message: err?.message || 'เปิดไฟล์ไม่สำร็จ' })
    } finally {
      setOpening(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      const { error: storageError } = await supabase.storage.from('documents').remove([deleting.file_path])
      if (storageError) console.warn('Storage delete warning:', storageError)

      const { error: dbError } = await supabase.from('documents').delete().eq('id', deleting.id)
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
        title="ไฟล์เอกสาร"
        subtitle="เก็บไฟล์สำคัญไว้ในระบบ เช่น สำเนาบัตรประชาชน สัญญาเช่า"
        action={
          <button type="button" onClick={() => setDocModal(true)} className={BTN.primary}>
            <Icon name="upload" className="h-4 w-4" /> อัปโหลด
          </button>
        }
      >
        <DocumentList
          rows={documents}
          loading={loading}
          onOpen={handleOpen}
          opening={opening}
          onDelete={(row) => setDeleting(row)}
        />
      </PanelCard>

      {docModal ? (
        <DocumentModal
          landlordId={landlordId}
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
            ลบ <span className="font-semibold text-gray-900 dark:text-gray-100">{deleting.title}</span> ออกจากระบบ พร้อมไฟล์ที่อัปโหลดไว้ — การลบไม่สามารถย้อนกลับได้
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
