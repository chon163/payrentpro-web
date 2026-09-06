-- ============================================================
-- PayRentPro : RPC ส่งรูปใบเสร็จเข้ากลุ่ม LINE + bucket receipts
--
-- ใช้คู่กับการอัปโหลดใบเสร็จ (PDF/รูป) จากเว็บแอดมิน:
--   1) เว็บสร้างรูปใบเสร็จแล้วอัปโหลดเข้า bucket "receipts" (public)
--   2) เรียก rpc('send_receipt_to_line', { p_tx_id, p_public_url })
--
-- ต้องมีอยู่ก่อน: ฟังก์ชัน public.get_line_token(), ตาราง reminders,
-- extension pg_net (schema net) — ตาม setup ข้อ 1-4 ที่รันไปแล้ว
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- 5) RPC: ส่งรูปใบเสร็จเข้ากลุ่ม (รับรูป PDF ที่เว็บสร้างแล้วอัปโหลด)
create or replace function public.send_receipt_to_line(p_tx_id uuid, p_public_url text)
returns jsonb language plpgsql security definer
set search_path = public, net, extensions
as $$ declare v_token text; v_group text; v_req bigint;
  v_tx record; v_landlord uuid;
begin
  v_token := public.get_line_token();
  if v_token is null then return jsonb_build_object('ok',false,'error','no line_token'); end if;

  select t.id, t.total_amount, t.paid_amount, t.secure_token, r.group_id, r.cust_name, r.id as rid
    into v_tx from transactions t join rentals r on r.id = t.rental_id
   where t.id = p_tx_id;
  if v_tx is null then return jsonb_build_object('ok',false,'error','not_found'); end if;
  if coalesce(v_tx.group_id,'') = '' then return jsonb_build_object('ok',false,'error','no_group'); end if;

  select landlord_id into v_landlord from rentals where id = v_tx.rid;

  select net.http_post(
    url := 'https://api.line.me/v2/bot/message/push',
    body := jsonb_build_object('to', v_tx.group_id,
      'messages', jsonb_build_array(
        jsonb_build_object('type','image','originalContentUrl', p_public_url,
                           'previewImageUrl', p_public_url),
        jsonb_build_object('type','text','text',
          '🧾 ใบเสร็จรับเงิน — ' || coalesce(v_tx.cust_name,'-') || chr(10) ||
          'ยอดที่ชำระ: ฿' || to_char(coalesce(v_tx.paid_amount,v_tx.total_amount,0),'FM999,999,990') || chr(10) ||
          'สถานะ: ✅ ชำระเรียบร้อย ขอบคุณครับ 🙏')
      )),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
  ) into v_req;

  insert into reminders (transaction_id, landlord_id, kind, message_text)
  values (p_tx_id, v_landlord, 'receipt', 'ส่งใบเสร็จเข้ากลุ่ม');
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.send_receipt_to_line(uuid, text) to authenticated;

-- 6) bucket ใบเสร็จ (public เพราะ LINE ต้องโหลดรูปจาก URL ตรง)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;
create policy "receipts_public_read" on storage.objects for select
  to anon using (bucket_id = 'receipts');
