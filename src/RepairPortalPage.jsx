import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

// ═══════════════════════════════════════════════════════════════════
// หน้าแจ้งซ่อมสำหรับผู้เช่า — เข้าด้วยเบอร์โทร ไม่ต้องสมัคร ไม่ต้องจำรหัส
//
// ที่มา: ผสานจาก PropertyHub /repaircustomer/ (RESEARCH.md)
// ต่างจากต้นทาง: เขาใช้เลขบัตร 13 หลัก เราใช้เบอร์โทรตามที่เจ้าของเลือก
//
// เป็นหน้า public (ไม่มี session ของ Supabase auth) — คุมสิทธิ์ที่ RPC
// ทั้งหมดผ่าน token ที่ได้ตอนล็อกอิน เก็บใน sessionStorage (ปิดแท็บแล้วหาย)
//
// สไตล์: ตาม BillPage.jsx — มือถือก่อน max-w-md ปุ่มสูง 44px
// ═══════════════════════════════════════════════════════════════════

const TOKEN_KEY = 'payrentpro-tenant-token'

// สถานะเดียวกับที่เว็บเจ้าของใช้ (App.jsx REPAIR_TONES)
const STATUS_META = {
  open: { label: 'รอดำเนินการ', cls: 'bg-orange-100 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  in_progress: { label: 'กำลังซ่อม', cls: 'bg-amber-100 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  done: { label: 'เสร็จแล้ว', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
}

// ข้อความ error จาก RPC → ภาษาที่ผู้เช่าอ่านรู้เรื่อง
const ERROR_TH = {
  bad_phone: 'เบอร์โทรไม่ถูกต้อง กรอกเบอร์ 10 หลักที่แจ้งไว้ตอนทำสัญญา',
  not_found: 'ไม่พบเบอร์นี้ในระบบ ลองตรวจดูอีกครั้ง หรือติดต่อเจ้าของที่พัก',
  too_many_attempts: 'กรอกผิดหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่',
  session_expired: 'หมดเวลาใช้งาน กรุณากรอกเบอร์เข้าระบบใหม่',
  rental_not_yours: 'ไม่พบห้องนี้ กรุณาเข้าระบบใหม่',
  empty_description: 'กรุณาอธิบายอาการที่ต้องซ่อม',
  description_too_long: 'ข้อความยาวเกินไป (ไม่เกิน 1,000 ตัวอักษร)',
  too_many_open: 'ห้องนี้มีเรื่องแจ้งค้างอยู่หลายรายการแล้ว รอช่างมาดูก่อนนะครับ',
}

function errorText(code, fallback = 'เกิดข้อผิดพลาด ลองอีกครั้ง') {
  return ERROR_TH[code] || fallback
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d)
}

// ── หน้าล็อกอิน ────────────────────────────────────────────────────
function LoginCard({ onLoggedIn }) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('tenant_portal_login', { p_phone: phone.trim() })
      if (rpcError) throw rpcError
      if (!data?.ok) {
        setError(errorText(data?.error))
        return
      }
      try {
        sessionStorage.setItem(TOKEN_KEY, data.token)
      } catch {
        // sessionStorage ใช้ไม่ได้ (โหมดส่วนตัว) — ใช้ต่อได้ในหน้านี้ แต่รีเฟรชแล้วต้องกรอกใหม่
      }
      onLoggedIn(data.token, data.rentals || [])
    } catch (err) {
      setError(err?.message || 'เข้าระบบไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-500 px-6 py-7 text-center text-white shadow-lg shadow-sky-200/70">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">
            🔧
          </div>
          <h1 className="mt-3 text-xl font-bold">แจ้งซ่อม</h1>
          <p className="mt-1 text-sm text-sky-50">แจ้งปัญหาในห้องพัก · ดูสถานะได้ทุกเมื่อ</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-gray-100 bg-white px-6 py-6 shadow-sm">
          <label htmlFor="phone" className="block text-sm font-bold text-gray-900">
            เบอร์โทรของคุณ
          </label>
          <p className="mt-1 text-xs text-gray-500">ใช้เบอร์ที่แจ้งไว้ตอนทำสัญญาเช่า</p>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            required
            autoFocus
            className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-lg tracking-widest text-gray-900 placeholder:tracking-normal placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />

          {error ? (
            <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-4 text-base font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>

          <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
            ไม่ต้องจำรหัสผ่าน · หากเข้าไม่ได้ติดต่อเจ้าของที่พัก
          </p>
        </form>
      </div>
    </div>
  )
}

// ── ฟอร์มแจ้งซ่อม ──────────────────────────────────────────────────
const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function NewRepairForm({ token, rentals, onCreated, onSessionExpired }) {
  const [rentalId, setRentalId] = useState(rentals[0]?.rental_id ?? '')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const pickPhoto = (e) => {
    const f = e.target.files?.[0]
    if (!f) {
      setPhoto(null)
      return
    }
    if (f.size > MAX_PHOTO_BYTES) {
      setError('รูปใหญ่เกิน 5MB — ลองถ่ายใหม่หรือเลือกรูปที่เล็กกว่า')
      e.target.value = ''
      setPhoto(null)
      return
    }
    setError(null)
    setPhoto(f)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      let photoUrl = null

      // อัปโหลดรูปก่อน (ถ้ามี) — ล้มเหลวก็ยังส่งเรื่องได้ ไม่ให้รูปบล็อกการแจ้ง
      if (photo) {
        const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
        const path = `${rentalId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('repair-photos')
          .upload(path, photo, { contentType: photo.type || 'image/jpeg' })
        if (upErr) {
          setError('แนบรูปไม่สำเร็จ — ระบบจะส่งเรื่องโดยไม่มีรูป')
        } else {
          const { data: pub } = supabase.storage.from('repair-photos').getPublicUrl(path)
          photoUrl = pub?.publicUrl ?? null
        }
      }

      const { data, error: rpcError } = await supabase.rpc('tenant_portal_create_repair', {
        p_token: token,
        p_rental_id: rentalId,
        p_description: description.trim(),
        p_photo_url: photoUrl,
      })
      if (rpcError) throw rpcError

      if (!data?.ok) {
        if (data?.error === 'session_expired') {
          onSessionExpired()
          return
        }
        setError(errorText(data?.error))
        return
      }

      setDescription('')
      setPhoto(null)
      if (fileRef.current) fileRef.current.value = ''
      await onCreated()
    } catch (err) {
      setError(err?.message || 'ส่งเรื่องไม่สำเร็จ ลองอีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-gray-100 bg-white px-5 py-5 shadow-sm">
      <p className="text-sm font-bold text-gray-900">แจ้งเรื่องใหม่</p>

      {/* เลือกห้องเฉพาะเมื่อเช่าหลายห้อง — ห้องเดียวไม่ต้องให้เลือก */}
      {rentals.length > 1 ? (
        <div className="mt-3">
          <label htmlFor="rental" className="mb-1.5 block text-sm font-medium text-gray-700">
            ห้อง
          </label>
          <select
            id="rental"
            value={rentalId}
            onChange={(e) => setRentalId(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-base text-gray-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            {rentals.map((r) => (
              <option key={r.rental_id} value={r.rental_id}>{r.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-3">
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-700">
          เรื่องที่ต้องซ่อม
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          required
          placeholder="เช่น แอร์ไม่เย็น / น้ำรั่วใต้อ่างล้างหน้า / หลอดไฟห้องน้ำเสีย"
          className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-base text-gray-900 placeholder:text-gray-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div className="mt-3">
        <label htmlFor="photo" className="mb-1.5 block text-sm font-medium text-gray-700">
          แนบรูป <span className="font-normal text-gray-400">(ไม่บังคับ · ช่วยให้ช่างเตรียมของถูก)</span>
        </label>
        <input
          ref={fileRef}
          id="photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pickPhoto}
          className="block w-full text-sm text-gray-600 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-sky-50 file:px-4 file:text-sm file:font-semibold file:text-sky-700 hover:file:bg-sky-100"
        />
        {photo ? (
          <p className="mt-1.5 truncate text-xs text-gray-500">
            เลือกแล้ว: {photo.name} ({(photo.size / 1024 / 1024).toFixed(1)} MB)
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving || !description.trim() || !rentalId}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-base font-bold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'กำลังส่ง...' : 'ส่งแจ้งซ่อม'}
      </button>
    </form>
  )
}

// ── ประวัติแจ้งซ่อม ────────────────────────────────────────────────
function RepairList({ items, loading }) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white px-5 py-8 text-center shadow-sm">
        <p className="text-sm text-gray-400">กำลังโหลด...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-gray-100 bg-white px-5 py-10 text-center shadow-sm">
        <p className="text-3xl">📋</p>
        <p className="mt-2 text-sm font-semibold text-gray-700">ยังไม่มีประวัติแจ้งซ่อม</p>
        <p className="mt-1 text-xs text-gray-400">เมื่อแจ้งเรื่องแล้ว จะเห็นสถานะที่นี่</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((t) => {
        const meta = STATUS_META[t.status] || STATUS_META.open
        return (
          <div key={t.id} className="rounded-3xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-gray-900">
                {t.description}
              </p>
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${meta.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                {meta.label}
              </span>
            </div>

            {t.photo_url ? (
              <a href={t.photo_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                <img
                  src={t.photo_url}
                  alt="รูปที่แนบมาพร้อมการแจ้งซ่อม"
                  className="h-32 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              </a>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
              <span>แจ้ง {formatDateTime(t.created_at)}</span>
              {t.rental_name ? <span>· {t.rental_name}</span> : null}
              {t.done_at ? <span className="text-emerald-600">· เสร็จ {formatDateTime(t.done_at)}</span> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── หน้าหลัก ───────────────────────────────────────────────────────
export default function RepairPortalPage() {
  const [token, setToken] = useState(null)
  const [rentals, setRentals] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [toast, setToast] = useState(null)

  const signOut = useCallback((message) => {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
    setToken(null)
    setRentals([])
    setTickets([])
    if (message) setToast(message)
  }, [])

  const loadTickets = useCallback(async (activeToken) => {
    const t = activeToken || token
    if (!t) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('tenant_portal_repairs', { p_token: t })
      if (error) throw error
      const rows = Array.isArray(data) ? data : []
      setTickets(rows)
      return rows
    } catch (err) {
      setToast(err?.message || 'โหลดประวัติไม่สำเร็จ')
      return []
    } finally {
      setLoading(false)
    }
  }, [token])

  // คืน session จาก sessionStorage ตอนเปิดหน้า/รีเฟรช
  useEffect(() => {
    let active = true
    let stored = null
    try {
      stored = sessionStorage.getItem(TOKEN_KEY)
    } catch {
      stored = null
    }
    if (!stored) {
      setChecking(false)
      return
    }
    // ตรวจ token + ดึงรายการห้องกลับมาจาก RPC โดยตรง
    // (ไม่เดาจากประวัติแจ้งซ่อม เพราะผู้เช่าที่ยังไม่เคยแจ้งจะได้รายการว่าง
    //  แล้วต้องกรอกเบอร์ใหม่ทุกครั้งที่รีเฟรช)
    supabase.rpc('tenant_portal_session', { p_token: stored }).then(({ data, error }) => {
      if (!active) return
      if (error || !data?.ok) {
        signOut()
        setChecking(false)
        return
      }
      setToken(stored)
      setRentals(Array.isArray(data.rentals) ? data.rentals : [])
      setChecking(false)
      loadTickets(stored)
    })
    return () => { active = false }
    // loadTickets ตั้งใจไม่ใส่ใน deps — ต้องรันครั้งเดียวตอน mount เท่านั้น
    // ถ้าใส่จะวนซ้ำเพราะ loadTickets เปลี่ยนตาม token ที่ effect นี้เป็นคนตั้ง
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signOut])

  const handleLoggedIn = (newToken, newRentals) => {
    setToken(newToken)
    setRentals(newRentals)
    setToast(null)
    loadTickets(newToken)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-cyan-50">
        <p className="text-sm text-gray-500">กำลังโหลด...</p>
      </div>
    )
  }

  if (!token) {
    return (
      <>
        {toast ? (
          <div className="fixed inset-x-0 top-0 z-50 px-4 pt-4">
            <p className="mx-auto max-w-md rounded-xl bg-gray-900/90 px-4 py-3 text-center text-sm text-white shadow-lg">
              {toast}
            </p>
          </div>
        ) : null}
        <LoginCard onLoggedIn={handleLoggedIn} />
      </>
    )
  }

  // เข้าระบบแล้วแต่ยังไม่รู้ว่ามีห้องไหน (คืน session จากประวัติที่ว่าง)
  // ให้กรอกเบอร์ใหม่ เพราะแจ้งซ่อมต้องรู้ rental_id
  const canReport = rentals.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-emerald-50 text-gray-900">
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-500 px-6 py-5 text-white shadow-lg shadow-sky-200/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-sky-100">แจ้งซ่อม 🔧</p>
              <p className="mt-0.5 truncate text-lg font-bold">
                {rentals.length === 1 ? rentals[0].name : `${rentals.length || ''} ห้องของคุณ`.trim() || 'ห้องของคุณ'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="min-h-11 shrink-0 rounded-xl bg-white/20 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/30"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>

        {toast ? (
          <p className="rounded-xl bg-gray-900/90 px-4 py-3 text-center text-sm text-white shadow-lg">
            {toast}
          </p>
        ) : null}

        {canReport ? (
          <NewRepairForm
            token={token}
            rentals={rentals}
            onCreated={async () => {
              setToast('ส่งเรื่องแล้ว เจ้าของที่พักได้รับแจ้งเรียบร้อย')
              await loadTickets()
            }}
            onSessionExpired={() => signOut(errorText('session_expired'))}
          />
        ) : (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            กรุณากรอกเบอร์โทรเข้าระบบใหม่เพื่อแจ้งซ่อม
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-bold text-white hover:bg-amber-700"
            >
              กรอกเบอร์ใหม่
            </button>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-bold text-gray-900">ประวัติการแจ้ง</p>
            <button
              type="button"
              onClick={() => loadTickets()}
              disabled={loading}
              className="min-h-11 rounded-xl px-3 text-xs font-semibold text-sky-700 hover:bg-white/60 disabled:opacity-50"
            >
              รีเฟรช
            </button>
          </div>
          <RepairList items={tickets} loading={loading} />
        </div>

        <p className="pb-4 text-center text-xs text-gray-400">
          PayRentPro · แจ้งซ่อมออนไลน์
        </p>
      </div>
    </div>
  )
}
