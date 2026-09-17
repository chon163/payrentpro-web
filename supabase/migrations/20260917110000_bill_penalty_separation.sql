-- ═══════════════════════════════════════════════════════════════════
-- bill_day / penalty_day: แยกวันส่งบิลออกจากวันเริ่มคิดค่าปรับ
--
-- เป้าหมาย:
--   - bill_day = วันที่ส่งบิลเข้าไลน์ (เดิมคือ due_date)
--   - penalty_day = วันที่เกินแล้วเริ่มคิดค่าปรับ (อาจต่างจาก bill_day)
--   - min_water_charge / min_elec_charge = ค่าขั้นต่ำน้ำไฟ
--     (คำนวณแล้วถ้ายอดต่ำกว่าขั้นต่ำ = ใช้ยอดขั้นต่ำ)
--
-- Migration นี้:
--   1) เพิ่มคอลัมน์ bill_day, penalty_day, min_water_charge, min_elec_charge
--   2) สร้างฟังก์ชัน bill_due_date(period, day) และ penalty_start_date(period, day)
--   3) แก้ send_bill_to_line / run_chase ให้ใช้ bill_day แยกจาก penalty_day
--   4) เพิ่ม rental_audit_log สำหรับบันทึกการแก้ไขห้อง
-- ═══════════════════════════════════════════════════════════════════

-- 1) เพิ่มคอลัมน์ใหม่ (default จาก due_date เดิม)
alter table public.rentals
  add column if not exists bill_day integer,
  add column if not exists penalty_day integer,
  add column if not exists min_water_charge numeric not null default 0,
  add column if not exists min_elec_charge numeric not null default 0;

-- กำหนดค่าเริ่มต้นจาก due_date สำหรับห้องเดิม
update public.rentals
   set bill_day = coalesce(bill_day, due_date, 1),
       penalty_day = coalesce(penalty_day, due_date, 1)
 where bill_day is null or penalty_day is null;

-- เพิ่ม flag สำหรับระบุว่าบิลนั้นเป็นบิลน้ำไฟแยก (ไม่มีค่าเช่า)
alter table public.transactions
  add column if not exists is_utility_only boolean not null default false;

-- 2) ตาราง audit log สำหรับการแก้ไขห้อง
create table if not exists public.rental_audit_log (
  id bigint generated always as identity primary key,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  field_name text not null,
  old_value text not null default '',
  new_value text not null default '',
  created_at timestamptz not null default now()
);

alter table public.rental_audit_log enable row level security;

drop policy if exists "rental_audit_log_read" on public.rental_audit_log;
create policy "rental_audit_log_read" on public.rental_audit_log
  for select to authenticated using (true);

-- 3) ฟังก์ชัน bill_due_date: คำนวณวันครบกำหนดจากงวด + วันส่งบิล
drop function if exists public.bill_due_date(text, integer);
create function public.bill_due_date(p_period text, p_bill_day integer)
 returns date
 language plpgsql
 immutable
as $function$
declare
  v_year int; v_month int; v_day int;
begin
  -- period = 'YYYY-MM' หรือ 'ธันวาคม 2567' (เดิม)
  if p_period ~ '^\d{4}-\d{2}$' then
    v_year := substring(p_period from 1 for 4)::int;
    v_month := substring(p_period from 6 for 2)::int;
  elsif p_period ~* '^\S+ \d{4}$' then
    -- legacy format (ไทย) — ใช้ได้ต่อ
    v_year := (regexp_match(p_period, '(\d{4})$'))[1]::int - 543;
    case split_part(p_period, ' ', 1)
      when 'มกราคม' then v_month := 1;
      when 'กุมภาพันธ์' then v_month := 2;
      when 'มีนาคม' then v_month := 3;
      when 'เมษายน' then v_month := 4;
      when 'พฤษภาคม' then v_month := 5;
      when 'มิถุนายน' then v_month := 6;
      when 'กรกฎาคม' then v_month := 7;
      when 'สิงหาคม' then v_month := 8;
      when 'กันยายน' then v_month := 9;
      when 'ตุลาคม' then v_month := 10;
      when 'พฤศจิกายน' then v_month := 11;
      when 'ธันวาคม' then v_month := 12;
      else v_month := 1;
    end case;
  else
    return null;
  end if;

  v_day := least(greatest(coalesce(p_bill_day, 1), 1), 31);
  -- จำกัดวันสุดท้ายของเดือน
  return least(
    make_date(v_year, v_month, v_day),
    make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day'
  )::date;
end;
$function$;

-- 4) ฟังก์ชัน penalty_start_date: คำนวณวันเริ่มคิดค่าปรับ
drop function if exists public.penalty_start_date(text, integer);
create function public.penalty_start_date(p_period text, p_penalty_day integer)
 returns date
 language plpgsql
 immutable
as $function$
begin
  -- ใช้ logic เดียวกับ bill_due_date แต่รับ penalty_day แทน
  return public.bill_due_date(p_period, p_penalty_day);
end;
$function$;

-- 5) แก้ send_bill_to_line: ใช้ bill_day (ไม่ใช้ due_date)
drop function if exists public.send_bill_to_line(uuid);
create function public.send_bill_to_line(p_tx_id uuid)
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
         r.id as rid, r.cust_name, r.group_id, coalesce(r.bill_day, r.due_date, 1) as bill_day,
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

  v_due := public.bill_due_date(v_tx.period, v_tx.bill_day);

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
    'https://api.line.me/v2/bot/message/push',
    jsonb_build_object('to', v_tx.group_id,
      'messages', jsonb_build_array(jsonb_build_object('type','text','text',v_text))),
    jsonb_build_object('Authorization', 'Bearer ' || v_token)
  ) into v_req;

  return jsonb_build_object('ok', true, 'sent', true);
end;
$function$;

-- 6) แก้ run_chase: ใช้ penalty_day คิดค่าปรับ, bill_day แสดงวันครบกำหนด
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
           r.last_chase_at,
           coalesce(r.bill_day, r.due_date, 1) as bill_day,
           coalesce(r.penalty_day, r.due_date, 1) as penalty_day
      from rentals r
      where coalesce(r.stop_chase,0) = 0
        and exists (select 1 from transactions t
                     where t.rental_id = r.id and t.status = 'unpaid'
                       and t.escalated_at is null
                       and public.penalty_start_date(t.period, coalesce(r.penalty_day, r.due_date, 1)) < v_today)
  loop
    if rec.last_chase_at is not null and (v_today - rec.last_chase_at::date) < rec.freq then
      v_skipped := v_skipped + 1; continue;
    end if;

    update transactions t set escalated_at = now()
      where t.rental_id = rec.rid and t.status = 'unpaid' and t.escalated_at is null
        and public.penalty_start_date(t.period, rec.penalty_day) < v_today - 15;
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
             (v_today - public.penalty_start_date(t.period, rec.penalty_day)) as days
        from transactions t
       where t.rental_id = rec.rid and t.status = 'unpaid' and t.escalated_at is null
         and public.penalty_start_date(t.period, rec.penalty_day) < v_today
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
      'https://api.line.me/v2/bot/message/push',
      jsonb_build_object('to', rec.group_id,
        'messages', jsonb_build_array(jsonb_build_object('type','text','text',v_text))),
      jsonb_build_object('Authorization', 'Bearer ' || v_token)
    ) into v_req;
    update rentals set last_chase_at = now() where id = rec.rid;
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('ok', true, 'sent', v_sent, 'skipped', v_skipped, 'escalated', v_escalated);
end; $function$
