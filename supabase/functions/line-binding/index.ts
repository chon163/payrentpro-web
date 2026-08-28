// Supabase Edge Function: line-binding
// รับ Webhook จาก Make.com เพื่อผูก group_id กับ binding_code ในตาราง rentals
//
// Deploy:
//   supabase functions deploy line-binding
// แล้วให้ Make.com เรียก:
//   POST https://<PROJECT_REF>.supabase.co/functions/v1/line-binding
//   Body: { "binding_code": "123456789", "group_id": "Cxxxxxxxx..." }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const bindingCode = String(body.binding_code ?? '').trim()
    const groupId = String(body.group_id ?? '').trim()

    if (!bindingCode || !groupId) {
      return json({ ok: false, error: 'ต้องส่ง binding_code และ group_id' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'Missing env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500)
    }

    const authHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    // 1) หา rental จาก binding_code
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/rentals?select=id,binding_code&binding_code=eq.${encodeURIComponent(bindingCode)}&limit=1`,
      { headers: authHeaders },
    )
    const rows = await findRes.json()
    if (!findRes.ok) {
      return json({ ok: false, error: rows.message || 'Supabase find error', detail: rows }, findRes.status)
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ ok: false, error: 'ไม่พบรหัสผูกนี้ (binding_code ไม่ตรง)' }, 404)
    }

    // 2) update group_id ลงในแถวนั้น
    const rentalId = rows[0].id
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/rentals?id=eq.${rentalId}`,
      {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({ group_id: groupId }),
      },
    )
    const updated = await updateRes.json()
    if (!updateRes.ok) {
      return json({ ok: false, error: updated.message || 'Supabase update error', detail: updated }, updateRes.status)
    }

    return json({ ok: true, message: 'ผูกกลุ่มสำเร็จ', rental_id: rentalId, updated })
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
