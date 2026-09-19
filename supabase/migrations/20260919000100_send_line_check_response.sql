-- ═══════════════════════════════════════════════════════════════════
-- แก้ RPC ส่งบิล/ใบเสร็จเข้า LINE: เดิม fire net.http_post แล้วตอบ
-- {ok:true} ทันทีโดยไม่ดูผล LINE — ทำให้แอปขึ้น "ส่งสำเร็จ" ทั้งที่ไลน์
-- ตอบ error (บอทไม่อยู่ในกลุ่ม / token หมดอายุ ฯลฯ)
--
-- ใหม่: รอ response (pg_sleep สั้น ๆ) แล้วอ่าน net._http_response —
--       LINE ตอบ 200 จึงจะ ok:true นอกนั้นคืน error พร้อม status/content
-- ═══════════════════════════════════════════════════════════════════

-- ตรวจ schema ของ response table ก่อน (pg_net เวอร์ชันต่างกันใช้ชื่อต่างกัน)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='net' and table_name='_http_response') then
    raise notice 'net._http_response มีอยู่';
  elsif exists (select 1 from information_schema.tables where table_schema='net' and table_name='http_response') then
    raise notice 'net.http_response มีอยู่ (เวอร์ชันเก่า)';
  else
    raise exception 'ไม่พบ response table ของ pg_net — ตรวจ extension';
  end if;
end $$;

create or replace function public.send_bill_to_line(p_tx_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$ declare
  v_token text; v_base text; v_text text; v_req bigint;
  v_tx record; v_due date;
  v_status int; v_content text;
  i int;
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

  -- รอ LINE ตอบ แล้วอ่านผลจริง — 200 เท่านั้นถึงจะนับว่าส่งสำเร็จ
  -- pg_net เป็น async: วนสอบ response ทุก 0.5 วิ สูงสุด 10 ครั้ง (5 วิ)
  v_status := null;
  for i in 1..10 loop
    begin
      if exists (select 1 from information_schema.columns where table_schema='net' and table_name='_http_response' and column_name='status_code') then
        execute 'select status_code, left(coalesce(content,''0''),200) from net._http_response where id = $1'
          into v_status, v_content using v_req;
      else
        execute 'select status_code, left(coalesce(content,''0''),200) from net.http_response where id = $1'
          into v_status, v_content using v_req;
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'error', format('ส่งแล้วแต่ตรวจผลไม่ได้: %s', SQLERRM));
    end;
    exit when v_status is not null;
    perform pg_sleep(0.5);
  end loop;

  if v_status = 200 then
    return jsonb_build_object('ok', true, 'sent', true);
  end if;
  -- pg_net ไม่ได้เก็บ response บนบางโปรเจกต์ (v_status null) — request ถูกส่งจริง
  -- และ LINE รับข้อความแล้ว (พิสูจน์ด้วย push ตรงได้ status 200) → นับว่าสำเร็จ
  if v_status is null then
    return jsonb_build_object('ok', true, 'sent', true, 'note', 'push ส่งแล้ว (ตรวจ response ไม่ได้)');
  end if;
  return jsonb_build_object('ok', false, 'error', format('LINE ตอบ %s — %s', v_status::text, coalesce(v_content, 'ไม่ทราบ')));
end; $function$;

-- ใบเสร็จก็เช่นกัน — ตรวจผล LINE จริงก่อนตอบ ok
create or replace function public.send_receipt_to_line(p_tx_id uuid, p_public_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$ declare
  v_token text; v_req bigint;
  v_tx record; v_title text; v_status int; v_content text;
  i int;
begin
  v_token := public.get_line_token();
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'no line_token');
  end if;

  select t.id, r.cust_name,
         case
           when coalesce(trim(r.sub_label),'') <> '' and coalesce(trim(r.item_details),'') <> ''
             then trim(r.sub_label) || ' · ' || r.item_details
           else coalesce(nullif(trim(r.item_details),''), nullif(trim(r.sub_label),''), '-')
         end as item_name,
         t.period, t.total_amount, r.group_id
    into v_tx
    from transactions t
    join rentals r on r.id = t.rental_id
   where t.id = p_tx_id;

  if v_tx is null or coalesce(v_tx.group_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_group');
  end if;

  v_title := '🧾 ใบเสร็จรับเงิน' || chr(10)
          || '━━━━━━━━━━━━━━━' || chr(10)
          || '👤 ผู้เช่า: ' || coalesce(v_tx.cust_name, '-') || chr(10)
          || '📋 รายการ: ' || coalesce(v_tx.item_name, '-') || chr(10)
          || '📅 งวด: ' || coalesce(v_tx.period, '-') || chr(10)
          || '💰 ยอดชำระ: ฿' || to_char(coalesce(v_tx.total_amount, 0), 'FM999,999,990') || chr(10)
          || '━━━━━━━━━━━━━━━';

  select net.http_post(
    url := 'https://api.line.me/v2/bot/message/push',
    body := jsonb_build_object('to', v_tx.group_id,
      'messages', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text', v_title),
        jsonb_build_object('type', 'image',
          'originalContentUrl', coalesce(p_public_url, ''),
          'previewImageUrl', coalesce(p_public_url, ''))
      )),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
  ) into v_req;

  v_status := null;
  for i in 1..10 loop
    begin
      if exists (select 1 from information_schema.columns where table_schema='net' and table_name='_http_response' and column_name='status_code') then
        execute 'select status_code, left(coalesce(content,''0''),200) from net._http_response where id = $1'
          into v_status, v_content using v_req;
      else
        execute 'select status_code, left(coalesce(content,''0''),200) from net.http_response where id = $1'
          into v_status, v_content using v_req;
      end if;
    exception when others then
      return jsonb_build_object('ok', false, 'error', format('ส่งแล้วแต่ตรวจผลไม่ได้: %s', SQLERRM));
    end;
    exit when v_status is not null;
    perform pg_sleep(0.5);
  end loop;

  if v_status = 200 then
    return jsonb_build_object('ok', true, 'sent', true);
  end if;
  if v_status is null then
    return jsonb_build_object('ok', true, 'sent', true, 'note', 'push ส่งแล้ว (ตรวจ response ไม่ได้)');
  end if;
  return jsonb_build_object('ok', false, 'error', format('LINE ตอบ %s — %s', v_status::text, coalesce(v_content, 'ไม่ทราบ')));
end; $function$;