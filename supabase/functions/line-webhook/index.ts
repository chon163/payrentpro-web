import { createClient } from 'npm:@supabase/supabase-js@2'

const LINE_API_BASE = 'https://api.line.me/v2'
const LINE_DATA_BASE = 'https://api-data.line.me/v2'

// Supabase client (service_role) — สร้างครั้งเดียวแบบ global
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

Deno.serve(async (req: Request) => {
  // 1) อ่าน raw body เป็น text ดิบก่อน (ห้าม parse ก่อน hash)
  const rawBody = await req.text()

  // ตรวจ signature (x-line-signature)
  const signature = req.headers.get('x-line-signature') ?? ''
  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET') ?? ''
  if (!channelSecret || !(await isValidSignature(rawBody, channelSecret, signature))) {
    return json({ ok: false, error: 'invalid signature' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error('JSON parse error:', err)
    return json({ ok: true }, 200)
  }

  const events = Array.isArray(body.events) ? body.events : []
  for (const event of events) {
    try {
      await handleEvent(event)
    } catch (err) {
      // event พังแค่ log ไม่ throw — ยังตอบ 200 เสมอ
      console.error('Event handling error:', err)
    }
  }

  return json({ ok: true }, 200)
})

async function handleEvent(event: any) {
  const webhookEventId = event?.webhookEventId
  if (!webhookEventId) return

  // กัน event ซ้ำ: insert ลง line_events (unique บน webhook_event_id)
  const { error: dedupError } = await supabase
    .from('line_events')
    .insert({ webhook_event_id: webhookEventId })

  if (dedupError) {
    if (dedupError.code === '23505') {
      console.log(`Duplicate event skipped: ${webhookEventId}`)
      return
    }
    console.error('line_events insert error:', dedupError)
    return
  }

  // จัดการเฉพาะ event ประเภท message
  if (event?.type !== 'message' || !event?.message) return

  const groupId = event.source?.groupId ?? event.source?.roomId ?? ''
  const message = event.message

  if (message.type === 'text' && groupId) {
    await handleText(event, groupId, String(message.text ?? ''))
  } else if (message.type === 'image' && groupId) {
    await handleImage(groupId, String(message.id ?? ''))
  }
}

async function handleText(event: any, groupId: string, text: string) {
  const code = text.trim()
  if (!/^\d{9}$/.test(code)) return

  const { data: rentals, error } = await supabase
    .from('rentals')
    .select('id, cust_name, binding_code')
    .eq('binding_code', code)
    .limit(1)

  if (error) {
    console.error('find rental error:', error)
    return
  }

  const replyToken = event?.replyToken

  if (rentals && rentals.length > 0) {
    const rental = rentals[0]
    const { error: updateError } = await supabase
      .from('rentals')
      .update({ group_id: groupId })
      .eq('id', rental.id)
    if (updateError) {
      console.error('update rentals.group_id error:', updateError)
      return
    }
    await replyLine(replyToken, `✅ ผูกกลุ่มสำเร็จแล้ว (${rental.cust_name ?? ''})`)
  } else {
    await replyLine(replyToken, '❌ ไม่พบรหัสผูกนี้ กรุณาตรวจสอบอีกครั้ง')
  }
}

async function handleImage(groupId: string, messageId: string) {
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set')
    return
  }

  // ดาวน์โหลดรูปจาก LINE
  const contentRes = await fetch(`${LINE_DATA_BASE}/bot/message/${messageId}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!contentRes.ok) {
    console.error('LINE content download failed:', contentRes.status, await contentRes.text())
    return
  }
  const imageBytes = new Uint8Array(await contentRes.arrayBuffer())
  const path = `${messageId}.jpg`

  // อัปโหลดลง Storage bucket "slips"
  const { error: uploadError } = await supabase.storage
    .from('slips')
    .upload(path, imageBytes, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) {
    console.error('slips upload error:', uploadError)
    return
  }

  // สร้าง signed URL อายุ 1 ปี
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('slips')
    .createSignedUrl(path, 60 * 60 * 24 * 365)
  if (signedError || !signedUrlData?.signedUrl) {
    console.error('createSignedUrl error:', signedError)
    return
  }
  const slipImageUrl = signedUrlData.signedUrl

  // หา rental จาก group_id
  const { data: rentals, error: rentalError } = await supabase
    .from('rentals')
    .select('id')
    .eq('group_id', groupId)
    .limit(1)
  if (rentalError) {
    console.error('find rental by group_id error:', rentalError)
    return
  }
  if (!rentals || rentals.length === 0) {
    console.log(`no rental bound to group_id: ${groupId}`)
    return
  }
  const rentalId = rentals[0].id

  // หาบิลของห้อง เรียงจาก created_at ล่าสุด
  const { data: bills, error: billsError } = await supabase
    .from('transactions')
    .select('id, status, slip_image_url, created_at')
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false })
  if (billsError) {
    console.error('find bills error:', billsError)
    return
  }
  if (!bills || bills.length === 0) {
    console.log(`no bills for rental: ${rentalId}`)
    return
  }

  // เลือกบิล: unpaid ก่อน → ถ้าไม่มี pending_review ที่ slip ยังว่าง
  const target =
    bills.find((b: any) => b.status === 'unpaid') ??
    bills.find((b: any) => b.status === 'pending_review' && !b.slip_image_url)

  if (!target) {
    console.log(`no suitable bill to attach slip for rental: ${rentalId}`)
    return
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({ slip_image_url: slipImageUrl, status: 'pending_review' })
    .eq('id', target.id)
  if (updateError) {
    console.error('update transactions slip error:', updateError)
  }
}

async function replyLine(replyToken: string, text: string) {
  if (!replyToken) return
  const token = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
  try {
    const res = await fetch(`${LINE_API_BASE}/bot/message/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text }],
      }),
    })
    if (!res.ok) {
      // reply token อาจหมดอายุ/ใช้แล้ว — log แล้วไปต่อ
      console.error('LINE reply failed:', res.status, await res.text())
    }
  } catch (err) {
    console.error('LINE reply error:', err)
  }
}

async function isValidSignature(body: string, secret: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
    const expected = bytesToBase64(new Uint8Array(sig))
    return expected === signature
  } catch (err) {
    console.error('signature verify error:', err)
    return false
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}