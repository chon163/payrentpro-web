-- ═══════════════════════════════════════════════════════════════════
-- sub_label: ชื่อสินทรัพย์แบบรวม "sub_label · item_details"
-- (เช่น "บ้านสวย · 101", "Fortuner · กก 1234")
--
-- 1) rentals.sub_label (คอลัมน์สร้างไว้แล้ว — add if not exists เป็นแค่ guard)
-- 2) get_bill_by_token: คืน field เพิ่ม 'sub_label' (item_details ยังคง raw)
--    ให้หน้าบิล (BillPage) รวมชื่อฝั่ง frontend ผ่าน displayAssetName()
-- 3) send_bill_to_line / run_chase: ข้อความ LINE แสดง "โครงการ · ห้อง"
--    โดย || coalesce(sub_label,'') เป็นส่วนหน้า item_details (มีเฉพาะเมื่อมีค่า)
-- ═══════════════════════════════════════════════════════════════════

alter table public.rentals
  add column if not exists sub_label text;

-- ── get_bill_by_token: เพิ่ม sub_label ในผลลัพธ์ ────────────────────
create or replace function public.get_bill_by_token(p_token text)
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$   select json_build_object(
    'id', t.id, 'period', t.period, 'created_at', t.created_at,
    'base_amount', t.base_amount,
    'water_units', t.water_units, 'water_cost', t.water_cost,
    'elec_units', t.elec_units, 'elec_cost', t.elec_cost,
    'extra_charges', t.extra_charges,
    'penalty_days', t.penalty_days, 'penalty_amount', t.penalty_amount,
    'total_amount', t.total_amount, 'paid_amount', t.paid_amount,
    'remaining_balance', t.remaining_balance, 'status', t.status,
    'cust_name', r.cust_name, 'item_details', r.item_details,
    'sub_label', r.sub_label,
    'payment_type', a.payment_type, 'promptpay_name', a.promptpay_name,
    'promptpay', a.promptpay, 'bank_code', a.bank_code, 'bank_account', a.bank_account
  )
   from transactions t
   join rentals r on r.id = t.rental_id
   left join admins a on a.id = (select id from admins order by created_at limit 1)
   where t.secure_token::text = trim(p_token)
   limit 1;
 $function$

-- ── send_bill_to_line: ข้อความบิลแสดง "โครงการ · ห้อง" ───────────────
create or replace function public.send_bill_to_line(p_tx_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'extensions'
as $function$ declare
  v_token text; v_base text; v_text text; v_req bigint;
  v_tx record; v_due date;
begin
  v_token := public.get_line_token();
  select value into v_base from app_settings where key='bill_base_url';
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'ยังไม่ได้ใส่ line_token');
  end if;

  select t.id, t.period, t.total_amount, t.secure_token, t.paid_amount,
         r.id as rid, r.cust_name, r.group_id, r.due_date,
         case
           when coalesce(trim(r.sub_label),'') <> '' and coalesce(trim(r.item_details),'') <> ''
             then trim(r.sub_label) || ' · ' || r.item_details
           else coalesce(nullif(trim(r.item_details),''), nullif(trim(r.sub_label),''), '-')
         end as item_name
    into v_tx
    from transactions t
    join rentals r on r.id = t.rental_id
   where t.id = p_tx_id;

  if v_tx is null or v_tx.secure_token is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce(v_tx.group_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_group');
  end if;

  v_due := public.bill_due_date(v_tx.period, v_tx.due_date);

  v_text := '🏠 PayRentPro แจ้งใบแจ้งหนี้' || chr(10)
         || '━━━━━━━━━━━━━━━' || chr(10)
         || '👤 ผู้เช่า: ' || coalesce(v_tx.cust_name,'-') || chr(10)
         || '📋 รายการ: ' || coalesce(v_tx.item_name,'-') || chr(10)
         || '📅 งวด: ' || coalesce(v_tx.period,'-') || chr(10)
         || '💰 ยอดชำระ: ฿' || to_char(coalesce(v_tx.total_amount,0),'FM999,999,990') || chr(10)
         || '📅 ครบกำหนด: ' || coalesce(to_char(v_due,'DD/MM/YYYY'),'-') || chr(10)
         || '━━━━━━━━━━━━━━━' || chr(10)
         || '🔗 ชำระเงิน/ดูบิล: ' || coalesce(v_base,'') || '/' || v_tx.secure_token || chr(10)
         || 'ชำระแล้วส่งสลิปในกลุ่มนี้ได้เลยครับ 🙏';

  select net.http_post(
    url := 'https://api.line.me/v2/bot/message/push',
    body := jsonb_build_object('to', v_tx.group_id,
      'messages', jsonb_build_array(jsonb_build_object('type','text','text',v_text))),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
  ) into v_req;

  return jsonb_build_object('ok', true, 'sent', true);
end; $function$

-- ── run_chase: ข้อความทวงหนี้แสดง "โครงการ · ห้อง" ────────────────────
create or replace function public.run_chase()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'extensions'
as $function$ declare
  v_token text; v_base text; v_today date := current_date;
  v_sent int := 0; v_skipped int := 0; v_escalated int := 0;
  v_count int := 0; v_rows int := 0; v_sum numeric := 0;
  rec record; b record;
  v_pen numeric; v_new_total numeric; v_text text; v_req bigint;
begin
  v_token := public.get_line_token();
  select value into v_base from app_settings where key='bill_base_url';
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'ยังไม่ได้ใส่ line_token ใน app_settings');
  end if;

  for rec in
    select r.id as rid, r.landlord_id, r.group_id, r.cust_name,
           case
             when coalesce(trim(r.sub_label),'') <> '' and coalesce(trim(r.item_details),'') <> ''
               then trim(r.sub_label) || ' · ' || r.item_details
             else coalesce(nullif(trim(r.item_details),''), nullif(trim(r.sub_label),''), '-')
           end as item_name,
           least(greatest(coalesce(r.chase_frequency,3),3),7) as freq,
           coalesce(r.penalty_enabled,false) as pen_on,
           coalesce(r.penalty_per_day,0) as per_day,
           coalesce(r.penalty_cap,0) as cap,
           r.last_chase_at, r.due_date as due_day
      from rentals r
      where coalesce(r.stop_chase,0) = 0
        and exists (select 1 from transactions t
                     where t.rental_id = r.id and t.status = 'unpaid'
                       and t.escalated_at is null
                       and public.bill_due_date(t.period, r.due_date) < v_today)
  loop
    if rec.last_chase_at is not null and (v_today - rec.last_chase_at::date) < rec.freq then
      v_skipped := v_skipped + 1; continue;
    end if;

    update transactions t set escalated_at = now()
      where t.rental_id = rec.rid and t.status = 'unpaid' and t.escalated_at is null
        and public.bill_due_date(t.period, rec.due_day) < v_today - 15;
    get diagnostics v_rows = row_count;
    v_escalated := v_escalated + v_rows;

    v_count := 0; v_sum := 0;
    v_text := '⚠️ PayRentPro แจ้งเตือนค่าเช่า' || chr(10) || '━━━━━━━━━━━━━━━' || chr(10)
           || '👤 ' || coalesce(rec.cust_name,'-') || chr(10)
           || '📋 ' || coalesce(rec.item_name,'-') || chr(10);
    for b in
      select t.id, t.period, t.secure_token, t.total_amount, coalesce(t.paid_amount,0) as paid,
             (coalesce(t.base_amount,0)+coalesce(t.water_cost,0)
              +coalesce(t.elec_cost,0)+coalesce(t.extra_charges,0)) as subtotal,
             (v_today - public.bill_due_date(t.period, rec.due_day)) as days
        from transactions t
       where t.rental_id = rec.rid and t.status = 'unpaid' and t.escalated_at is null
         and public.bill_due_date(t.period, rec.due_day) < v_today
       order by t.period
    loop
      v_count := v_count + 1;
      v_pen := 0;
      if rec.pen_on and b.days >= 1 and rec.per_day > 0 then
        v_pen := rec.per_day * b.days;
        if rec.cap > 0 and v_pen > rec.cap then v_pen := rec.cap; end if;
      end if;
      v_new_total := b.subtotal + v_pen;
      if coalesce(b.total_amount,0) <> v_new_total then
        update transactions set penalty_amount = v_pen, penalty_days = b.days,
               total_amount = v_new_total, remaining_balance = v_new_total - b.paid
         where id = b.id;
        insert into audit_logs (transaction_id, landlord_id, old_amount, new_amount, reason, created_at)
        values (b.id, rec.landlord_id, b.total_amount, v_new_total,
                'ค่าปรับอัตโนมัติ ค้าง ' || b.days || ' วัน', now());
      end if;
      v_sum := v_sum + v_new_total;
      v_text := v_text || '📅 ' || b.period || ' — ฿' || to_char(v_new_total,'FM999,999,990')
             || ' (ค้าง ' || b.days || ' วัน)' || chr(10)
             || '🔗 ' || coalesce(v_base,'') || '/' || b.secure_token || chr(10);
    end loop;
    if v_count = 0 then continue; end if;
    v_text := v_text || '━━━━━━━━━━━━━━━' || chr(10)
           || '💰 ยอดรวมที่ค้าง: ฿' || to_char(v_sum,'FM999,999,990') || chr(10)
           || 'ชำระแล้วส่งสลิปในกลุ่มนี้ได้เลยครับ 🙏';

    if coalesce(rec.group_id,'') = '' then v_skipped := v_skipped + 1; continue; end if;
    select net.http_post(
      url := 'https://api.line.me/v2/bot/message/push',
      body := jsonb_build_object('to', rec.group_id,
        'messages', jsonb_build_array(jsonb_build_object('type','text','text',v_text))),
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
    ) into v_req;
    update rentals set last_chase_at = now() where id = rec.rid;
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', v_sent, 'skipped', v_skipped, 'escalated', v_escalated);
end; $function$
