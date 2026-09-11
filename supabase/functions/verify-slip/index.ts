// ============================================================
// PayRentPro : verify-slip — ตรวจสลิปค่าสมาชิกอัตโนมัติด้วย EasySlip
//
// ใช้เฉพาะ flow สมัคร/ต่ออายุสมาชิก (kind = 'membership') เท่านั้น
// flow ผู้เช่า (transactions / line-webhook) ไม่ถูกแตะจากไฟล์นี้
//
// รับ POST (ต้อง login): { image_base64, kind: 'membership', ref_id }
//   ref_id = id ของแถว membership_payments ที่เพิ่งสร้าง (สถานะ pending_review)
//
// ตอบกลับ (HTTP 200 เสมอ เว้นกรณี auth/รูปแบบ request ผิด):
//   { ok: true,  amount, bank, txnRef, matched, approved, expire_date? }
//   { ok: false, error: 'read_failed' | 'duplicate' | 'quota' | ... }
//
// อ้างอิง EasySlip API v2 (document.easyslip.com):
//   - POST https://api.easyslip.com/v2/verify/bank
//     · /en/v2/            → base URL + header `Authorization: Bearer <key>`
//     · /en/v2/verify/bank/image → multipart/form-data ช่อง `image` (File)
//     · /en/v2/verify/bank/      → โครง RawSlip (transRef / amount.amount /
//                                   sender.bank.short ฯลฯ)
//     · /en/reference/error-codes → ตารางรหัสข้อผิดพลาด
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2'

const EASYSLIP_VERIFY_URL = 'https://api.easyslip.com/v2/verify/bank'

// ขนาดรูปสูงสุดที่ EasySlip รับ = 4 MB (4,194,304 ไบต์) ตามหน้า image upload
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

// client service_role — ข้าม RLS สำหรับเขียน slip_verifications / อ่านเจ้าของแถว
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405)

  // ── 1) ต้อง login (ตรวจ JWT ที่แนบมากับ request) ────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ ok: false, error: 'unauthorized' }, 401)

  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  )
  const user = userData?.user
  if (userError || !user) return json({ ok: false, error: 'unauthorized' }, 401)

  // ── 2) อ่าน body ────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400)
  }

  const kind = String(body.kind ?? '')
  const refId = String(body.ref_id ?? '')
  const imageBase64 = String(body.image_base64 ?? '')

  // ฟังก์ชันนี้รองรับเฉพาะค่าสมาชิก — ไม่รับ kind อื่นเพื่อไม่ให้ไปโดน flow ผู้เช่า
  if (kind !== 'membership') return json({ ok: false, error: 'unsupported_kind' }, 400)
  if (!refId || !imageBase64) return json({ ok: false, error: 'invalid_body' }, 400)

  // ── 3) ตรวจสิทธิ์: ผู้เรียกต้องเป็นเจ้าของแถว membership_payments นั้น ──
  const { data: payment, error: paymentError } = await admin
    .from('membership_payments')
    .select('id, admin_id, amount, status, admins!inner(id, user_id, email)')
    .eq('id', refId)
    .maybeSingle()

  if (paymentError) {
    console.error('load membership_payment error:', paymentError)
    return json({ ok: false, error: 'lookup_failed' }, 500)
  }
  if (!payment) return json({ ok: false, error: 'not_found' }, 404)

  const owner = payment.admins as { user_id?: string | null; email?: string | null } | null
  const ownsRow =
    (owner?.user_id && owner.user_id === user.id) ||
    (owner?.email && user.email && owner.email.toLowerCase() === user.email.toLowerCase())
  if (!ownsRow) return json({ ok: false, error: 'forbidden' }, 403)

  // ── 4) แปลง base64 → ไบต์ ───────────────────────────────────────────
  let imageBytes: Uint8Array
  try {
    imageBytes = base64ToBytes(imageBase64)
  } catch (err) {
    console.error('base64 decode error:', err)
    return json({ ok: false, error: 'read_failed' })
  }
  if (imageBytes.byteLength === 0) return json({ ok: false, error: 'read_failed' })
  if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
    // ใหญ่เกินโควตา EasySlip → ไม่ต้องเปลืองเครดิตยิงไป
    return json({ ok: false, error: 'read_failed', reason: 'image_too_large' })
  }

  // ── 5) เก็บรูปที่ส่งมาตรวจไว้เป็นหลักฐาน (ล้มเหลวก็ไม่หยุด flow) ────────
  const storagePath = `membership/verify-${refId}.jpg`
  const { error: uploadError } = await admin.storage
    .from('receipts')
    .upload(storagePath, imageBytes, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) console.error('verify slip upload error:', uploadError)

  // ── 6) ยิง EasySlip ─────────────────────────────────────────────────
  const apiKey = Deno.env.get('EASYSLIP_API_KEY') ?? ''
  if (!apiKey) {
    console.error('EASYSLIP_API_KEY is not set')
    return json({ ok: false, error: 'quota', reason: 'no_api_key' })
  }

  let slip: RawSlip | null = null
  try {
    const form = new FormData()
    // ชื่อช่องตาม docs /en/v2/verify/bank/image : `image` (File)
    form.append('image', new Blob([imageBytes], { type: 'image/jpeg' }), 'slip.jpg')
    // ขอให้ EasySlip เช็คสลิปซ้ำฝั่งเขาด้วย (ไม่งั้น data.isDuplicate ไม่ถูกเติมมา)
    // เรายังกันซ้ำเองที่ตาราง slip_verifications อีกชั้นเป็นหลัก
    form.append('checkDuplicate', 'true')

    const res = await fetch(EASYSLIP_VERIFY_URL, {
      method: 'POST',
      // ห้ามตั้ง Content-Type เอง — ปล่อยให้ fetch ใส่ boundary ของ multipart
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    const payload = await res.json().catch(() => null)

    if (!res.ok || payload?.success !== true) {
      const code = String(payload?.error?.code ?? payload?.message ?? '')
      const mapped = mapEasyslipError(res.status, code)
      console.error('EasySlip verify failed:', res.status, code)
      return json({ ok: false, error: mapped })
    }

    // EasySlip เองก็บอกได้ว่าสลิปนี้เคยส่งมาแล้ว (ต้องเปิด checkDuplicate)
    if (payload?.data?.isDuplicate === true) {
      return json({ ok: false, error: 'duplicate' })
    }

    slip = (payload?.data?.rawSlip ?? null) as RawSlip | null
  } catch (err) {
    // network / timeout / JSON เพี้ยน — ห้าม crash ให้ตกไป flow อนุมัติมือ
    console.error('EasySlip request error:', err)
    return json({ ok: false, error: 'read_failed' })
  }

  const txnRef = String(slip?.transRef ?? '').trim()
  // ยอดที่อ่านได้: rawSlip.amount.amount (ตาม RawSlip ใน docs)
  const slipAmount = Number(slip?.amount?.amount ?? slip?.amount?.local?.amount ?? NaN)
  // ธนาคารผู้โอน: sender.bank.short เช่น "KBANK" (fallback ชื่อไทย)
  const bank = String(slip?.sender?.bank?.short ?? slip?.sender?.bank?.name ?? '').trim() || null

  if (!txnRef || !Number.isFinite(slipAmount)) {
    // อ่าน QR ไม่ได้/ธนาคารไม่รองรับ → ให้ founder ตรวจมือ
    return json({ ok: false, error: 'read_failed' })
  }

  // ── 7) กันสลิปซ้ำ: unique(txn_ref) ชน = สลิปใบนี้ถูกใช้ไปแล้ว ─────────
  const { error: dedupError } = await admin
    .from('slip_verifications')
    .insert({ txn_ref: txnRef, kind, ref_id: refId, amount: slipAmount, bank })

  if (dedupError) {
    if (dedupError.code === '23505') {
      console.log(`duplicate slip blocked: ${txnRef}`)
      return json({ ok: false, error: 'duplicate' })
    }
    console.error('slip_verifications insert error:', dedupError)
    return json({ ok: false, error: 'read_failed' })
  }

  // ── 8) ยอดตรงกับแพ็กไหม ─────────────────────────────────────────────
  const expected = Number(payment.amount ?? NaN)
  // ปัดเป็นสตางค์ก่อนเทียบ กันปัญหา floating point (399 vs 398.99999)
  const matched = Number.isFinite(expected) && Math.round(slipAmount * 100) === Math.round(expected * 100)

  if (!matched) {
    // ยอดไม่ตรง → คงสถานะรอตรวจมือ + เขียนหมายเหตุให้ founder ตัดสิน
    const note = `ยอดสลิป ${formatBaht(slipAmount)} ≠ ยอดแพ็ก ${formatBaht(expected)}`
    const { error: noteError } = await admin
      .from('membership_payments')
      .update({ status: 'pending_review', note })
      .eq('id', refId)
    if (noteError) console.error('update note error:', noteError)

    return json({ ok: true, amount: slipAmount, bank, txnRef, matched: false, approved: false, note })
  }

  // ── 9) ยอดตรง → auto_verified แล้วให้ RPC ต่ออายุทันที ───────────────
  // .eq('status','pending_review') = กันสองรีเควสต์แข่งกันอนุมัติแถวเดียวกัน
  // ต้องดูจาก "จำนวนแถวที่เปลี่ยนจริง" ไม่ใช่ error เพราะ update ที่ไม่ match
  // แถวไหนเลยถือว่าสำเร็จ (error เป็น null) → ใช้ .select() นับแถวที่ได้
  const { data: marked, error: markError } = await admin
    .from('membership_payments')
    .update({ status: 'auto_verified', note: `ตรวจอัตโนมัติผ่าน (EasySlip ${txnRef})` })
    .eq('id', refId)
    .eq('status', 'pending_review')
    .select('id')

  if (markError || !marked || marked.length === 0) {
    // แถวถูกอนุมัติ/ปฏิเสธไปแล้วโดยคนอื่น — ไม่ต่ออายุซ้ำ
    console.error('mark auto_verified skipped:', markError ?? 'row no longer pending_review')
    return json({ ok: true, amount: slipAmount, bank, txnRef, matched: true, approved: false })
  }

  const { data: approveData, error: approveError } = await admin
    .rpc('auto_approve_membership_payment', { p_id: refId })

  if (approveError || approveData?.ok === false) {
    console.error('auto_approve_membership_payment failed:', approveError ?? approveData)
    return json({ ok: true, amount: slipAmount, bank, txnRef, matched: true, approved: false })
  }

  return json({
    ok: true,
    amount: slipAmount,
    bank,
    txnRef,
    matched: true,
    approved: true,
    expire_date: approveData?.expire_date ?? null,
  })
})

// โครง rawSlip ที่ใช้จริง (ตัดเฉพาะฟิลด์ที่อ่าน — ดู RawSlip เต็มใน docs)
interface RawSlip {
  transRef?: string
  date?: string
  amount?: { amount?: number; local?: { amount?: number; currency?: string } }
  sender?: { bank?: { id?: string; name?: string; short?: string } }
  receiver?: { bank?: { id?: string; name?: string; short?: string } }
}

// แปลงรหัสข้อผิดพลาด EasySlip → เหตุผลที่เว็บเข้าใจ
// (ตาราง /en/reference/error-codes — รองรับทั้งรหัส v2 ตัวใหญ่และ v1 ตัวเล็ก)
function mapEasyslipError(status: number, code: string): 'quota' | 'duplicate' | 'read_failed' {
  const c = code.toUpperCase()

  // โควตาหมด / ยิงถี่เกิน — ทั้ง 403 QUOTA_EXCEEDED, 429 RATE_LIMIT_EXCEEDED
  // และ 402 (payment required ถ้าเครดิตหมด) ให้ถือเป็น 'quota' เหมือนกัน
  if (status === 402 || status === 429) return 'quota'
  if (c.includes('QUOTA_EXCEEDED') || c.includes('RATE_LIMIT')) return 'quota'
  // คีย์/สิทธิ์มีปัญหา = ระบบตรวจใช้ไม่ได้ชั่วคราว ไม่ใช่ความผิดของผู้ใช้
  if (status === 401 || c.includes('API_KEY') || c.includes('IP_NOT_ALLOWED')) return 'quota'
  if (c.includes('BANNED') || c.includes('BRANCH_INACTIVE') || c.includes('SERVICE_DELETED')) return 'quota'

  if (c.includes('DUPLICATE_SLIP')) return 'duplicate'

  // ที่เหลือ (SLIP_NOT_FOUND / SLIP_PENDING / QRCODE_NOT_FOUND /
  // INVALID_IMAGE_* / IMAGE_SIZE_TOO_LARGE / VALIDATION_ERROR / 500)
  // = อ่านสลิปไม่ได้ → ตกไปรออนุมัติมือ
  return 'read_failed'
}

function base64ToBytes(input: string): Uint8Array {
  // รับได้ทั้ง data URL ("data:image/jpeg;base64,....") และ base64 เปล่า
  const comma = input.indexOf(',')
  const raw = input.startsWith('data:') && comma >= 0 ? input.slice(comma + 1) : input
  const binary = atob(raw.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function formatBaht(value: unknown): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
