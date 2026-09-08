-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : ระบบแจ้งซ่อมฝั่งผู้เช่า (LINE) + ประวัติบิลสาธารณะ
--
-- 1) ตาราง repair_tickets + RLS (เจ้าของเห็น/แก้เฉพาะ ticket ของห้องตัวเอง)
-- 2) RPC get_group_bill_summary(group_id) — บอทใช้ตอบคำสั่ง "ยอด" / "ประวัติ"
-- 3) RPC create_repair_ticket(group_id, description) — บอทใช้ตอน "แจ้งซ่อม"
-- 4) RPC get_room_bills(secure_token) — หน้าบิล public ดูประวัติทุกงวด
--    (คืนแค่ งวด/ยอด/สถานะ — ไม่มีชื่อผู้เช่า เลขบัญชี หรือ token อื่น)
-- 5) RPC notify_repair_done(ticket_id) — เว็บกดเสร็จแล้ว → push เข้ากลุ่ม LINE
--
-- ต้องมีอยู่ก่อน: public.get_line_token(), public.bill_due_date(),
--                 extension pg_net (schema net), ตาราง app_settings
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) ตาราง repair_tickets ─────────────────────────────────────────
create table if not exists public.repair_tickets (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals(id) on delete cascade,
  description text not null,
  status text not null default 'open',
  photo_url text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- ดึงรายการค้างของเจ้าของ + หา ticket ล่าสุดที่รอรูป (webhook) ให้เร็ว
create index if not exists repair_tickets_rental_created_idx
  on public.repair_tickets (rental_id, created_at desc);
create index if not exists repair_tickets_status_idx
  on public.repair_tickets (status);

alter table public.repair_tickets enable row level security;

-- เจ้าของเห็นเฉพาะ ticket ของห้องที่ตัวเองเป็น landlord
-- (rentals.landlord_id → admins ที่ match user_id หรือ email ของผู้ login
--  ตามแพทเทิร์นเดียวกับ membership_payments)
drop policy if exists "repair_tickets_own_read" on public.repair_tickets;
create policy "repair_tickets_own_read" on public.repair_tickets
  for select to authenticated
  using (exists (
    select 1
      from public.rentals r
      join public.admins a on a.id = r.landlord_id
     where r.id = repair_tickets.rental_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ));

-- เจ้าของปิดงาน (status='done') ได้เฉพาะ ticket ของห้องตัวเอง
drop policy if exists "repair_tickets_own_update" on public.repair_tickets;
create policy "repair_tickets_own_update" on public.repair_tickets
  for update to authenticated
  using (exists (
    select 1
      from public.rentals r
      join public.admins a on a.id = r.landlord_id
     where r.id = repair_tickets.rental_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ))
  with check (exists (
    select 1
      from public.rentals r
      join public.admins a on a.id = r.landlord_id
     where r.id = repair_tickets.rental_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ));

-- หมายเหตุ: ไม่มี policy insert สำหรับ authenticated — ticket ถูกสร้างจาก
-- LINE webhook ผ่าน service_role (bypass RLS) เท่านั้น

-- ── ชื่อสินทรัพย์แบบรวม "โครงการ · ห้อง" (ใช้ซ้ำหลาย RPC ข้างล่าง) ──
create or replace function public.rental_display_name(p_rental_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
           when coalesce(trim(r.sub_label),'') <> '' and coalesce(trim(r.item_details),'') <> ''
             then trim(r.sub_label) || ' · ' || r.item_details
           else coalesce(nullif(trim(r.item_details),''), nullif(trim(r.sub_label),''), '-')
         end
    from public.rentals r
   where r.id = p_rental_id;
$function$;

-- ── 2) สรุปบิลค้างล่าสุดของกลุ่ม (บอทตอบ "ยอด" / "ประวัติ") ──────────
-- คืน jsonb: found / item_name / period / total_amount / days_overdue /
--            bill_url / status  (bill_url ประกอบจาก app_settings.bill_base_url)
create or replace function public.get_group_bill_summary(p_group_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_rental record;
  v_tx record;
  v_last_token text;
  v_base text;
  v_due date;
begin
  if coalesce(trim(p_group_id), '') = '' then
    return jsonb_build_object('found', false, 'reason', 'no_group');
  end if;

  select r.id, r.cust_name, r.due_date
    into v_rental
    from public.rentals r
   where r.group_id = trim(p_group_id)
   limit 1;

  if v_rental is null then
    return jsonb_build_object('found', false, 'reason', 'not_bound');
  end if;

  select value into v_base from public.app_settings where key = 'bill_base_url';

  -- บิลที่ยังไม่ปิด (unpaid ก่อน แล้วค่อย pending_review) งวดใหม่สุด
  select t.id, t.period, t.total_amount, t.paid_amount, t.status, t.secure_token
    into v_tx
    from public.transactions t
   where t.rental_id = v_rental.id
     and lower(coalesce(t.status, '')) in ('unpaid', 'pending_review', 'pending')
   order by (lower(coalesce(t.status, '')) = 'unpaid') desc, t.period desc nulls last, t.created_at desc
   limit 1;

  if v_tx is null then
    -- ไม่มีบิลค้าง — ยังคืน token ของบิลล่าสุดไว้ให้คำสั่ง "ประวัติ" ใช้
    select t.secure_token::text into v_last_token
      from public.transactions t
     where t.rental_id = v_rental.id
     order by t.period desc nulls last, t.created_at desc
     limit 1;

    return jsonb_build_object(
      'found', true,
      'has_unpaid', false,
      'item_name', public.rental_display_name(v_rental.id),
      'cust_name', coalesce(v_rental.cust_name, '-'),
      'bill_url', case when coalesce(v_base, '') <> '' and v_last_token is not null
                       then v_base || '/' || v_last_token else null end
    );
  end if;

  v_due := public.bill_due_date(v_tx.period, v_rental.due_date);

  return jsonb_build_object(
    'found', true,
    'has_unpaid', true,
    'item_name', public.rental_display_name(v_rental.id),
    'cust_name', coalesce(v_rental.cust_name, '-'),
    'period', coalesce(v_tx.period, '-'),
    'total_amount', coalesce(v_tx.total_amount, 0),
    'paid_amount', coalesce(v_tx.paid_amount, 0),
    'status', lower(coalesce(v_tx.status, '')),
    'due_date', v_due,
    -- ค้างกี่วัน: บวก = เกินกำหนดแล้ว, 0 = ยังไม่เกิน
    'days_overdue', greatest(0, (current_date - v_due)),
    'bill_url', case when coalesce(v_base, '') <> ''
                     then v_base || '/' || v_tx.secure_token else null end
  );
end;
$function$;

revoke all on function public.get_group_bill_summary(text) from public;
grant execute on function public.get_group_bill_summary(text) to service_role;

-- ── 3) สร้าง ticket แจ้งซ่อมจากกลุ่ม LINE ────────────────────────────
create or replace function public.create_repair_ticket(p_group_id text, p_description text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rental record;
  v_id uuid;
begin
  if coalesce(trim(p_description), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_description');
  end if;

  select r.id, r.cust_name
    into v_rental
    from public.rentals r
   where r.group_id = trim(p_group_id)
   limit 1;

  if v_rental is null then
    return jsonb_build_object('ok', false, 'error', 'not_bound');
  end if;

  insert into public.repair_tickets (rental_id, description, status)
  values (v_rental.id, trim(p_description), 'open')
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'ticket_id', v_id,
    'item_name', public.rental_display_name(v_rental.id),
    'cust_name', coalesce(v_rental.cust_name, '-')
  );
end;
$function$;

revoke all on function public.create_repair_ticket(text, text) from public;
grant execute on function public.create_repair_ticket(text, text) to service_role;

-- ── 4) ประวัติบิลทุกงวดของห้อง (หน้าบิล public — ผู้เช่าไม่ได้ login) ──
-- ปลอดภัย: รับ secure_token ของบิลใบใดใบหนึ่ง แล้วคืนเฉพาะ
--   งวด / ยอด / ยอดที่ชำระ / สถานะ / วันที่ออกบิล ของห้องเดียวกัน
-- ไม่คืน id, secure_token, ชื่อผู้เช่า, ข้อมูลบัญชีรับเงิน
create or replace function public.get_room_bills(p_token text)
returns table (
  period text,
  total_amount numeric,
  paid_amount numeric,
  status text,
  created_at timestamptz,
  is_current boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with target as (
    select t.rental_id, t.id
      from public.transactions t
     where t.secure_token::text = trim(p_token)
     limit 1
  )
  select t.period,
         t.total_amount,
         t.paid_amount,
         lower(coalesce(t.status, '')) as status,
         t.created_at,
         (t.id = (select id from target)) as is_current
    from public.transactions t
   where t.rental_id = (select rental_id from target)
   order by t.period desc nulls last, t.created_at desc;
$function$;

grant execute on function public.get_room_bills(text) to anon, authenticated;

-- ── 5) แจ้งกลุ่ม LINE ว่าซ่อมเสร็จแล้ว (เว็บเรียกหลัง update status) ──
create or replace function public.notify_repair_done(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$
declare
  v_token text;
  v_t record;
  v_req bigint;
begin
  v_token := public.get_line_token();
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'no line_token');
  end if;

  select rt.id, rt.description, r.group_id, r.id as rid
    into v_t
    from public.repair_tickets rt
    join public.rentals r on r.id = rt.rental_id
    join public.admins a on a.id = r.landlord_id
   where rt.id = p_ticket_id
     -- กันคนอื่นยิง ticket ที่ไม่ใช่ของตัวเอง (RPC เป็น security definer)
     and ((auth.uid() is not null and a.user_id = auth.uid())
       or (auth.email() is not null and a.email = auth.email()));

  if v_t is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce(v_t.group_id, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_group');
  end if;

  select net.http_post(
    url := 'https://api.line.me/v2/bot/message/push',
    body := jsonb_build_object(
      'to', v_t.group_id,
      'messages', jsonb_build_array(
        jsonb_build_object('type', 'text', 'text',
          '✅ ซ่อมเสร็จเรียบร้อยครับ ห้อง ' || public.rental_display_name(v_t.rid) || chr(10)
          || 'รายการ: ' || coalesce(v_t.description, '-') || chr(10)
          || 'หากยังมีปัญหาแจ้งในกลุ่มนี้ได้เลยครับ 🙏')
      )),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
  ) into v_req;

  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.notify_repair_done(uuid) from public;
grant execute on function public.notify_repair_done(uuid) to authenticated;

-- helper ที่ RPC อื่นเรียกใช้ภายใน — ไม่ต้องเปิดให้ client เรียกตรง
revoke all on function public.rental_display_name(uuid) from public;
