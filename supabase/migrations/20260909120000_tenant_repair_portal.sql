-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : Portal แจ้งซ่อมฝั่งผู้เช่า (เข้าด้วยเบอร์โทร)
--
-- ที่มา: ผสานจาก PropertyHub /repaircustomer/ (RESEARCH.md)
-- ต่างจากต้นทาง: เขาใช้เลขบัตรประชาชน 13 หลัก เราใช้เบอร์โทรตามที่เจ้าของเลือก
--
-- 1) normalize_phone()            — ตัดขีด/เว้นวรรค/+66 ให้เทียบกันได้
-- 2) tenant_portal_sessions       — token อายุสั้นแทนการส่งเบอร์ทุก request
-- 3) tenant_portal_attempts       — นับครั้งที่กรอกผิด (rate limit)
-- 4) RPC tenant_portal_login      — เบอร์ → token + รายการห้องของเบอร์นั้น
-- 5) RPC tenant_portal_repairs    — ประวัติแจ้งซ่อมของห้องตัวเอง
-- 6) RPC tenant_portal_create_repair — แจ้งซ่อมใหม่ + แนบรูป
-- 7) bucket repair-photos         — รูปที่ผู้เช่าแนบ (จำกัดขนาด/ชนิดไฟล์)
--
-- ⚠️ ข้อจำกัดที่ต้องรู้: เบอร์มือถือไทยมี 10 หลักและขึ้นต้น 06/08/09
--    เหลือให้เดาจริง ~7 หลัก การเข้าด้วยเบอร์อย่างเดียวจึงกันคนเดาไม่ได้ 100%
--    มาตรการที่ใส่ไว้ทดแทน:
--      · คืนข้อมูลน้อยที่สุด — ชื่อห้อง + ชื่อต้นผู้เช่า ไม่มียอดเงิน ไม่มีเลขบัตร
--      · rate limit ต่อเบอร์ 5 ครั้ง/15 นาที (กันยิงซ้ำเบอร์เดิม)
--      · ผู้เช่าเห็นได้แค่ ticket ของห้องตัวเอง แก้/ลบไม่ได้
--    ถ้าต้องการกันแน่นกว่านี้ ให้เพิ่ม OTP ผ่าน LINE ทีหลัง (ดู DECISIONS.md D9)
--
-- ต้องมีอยู่ก่อน: public.rentals, public.repair_tickets, public.get_line_token()
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) ทำเบอร์ให้เป็นรูปเดียวกันก่อนเทียบ ───────────────────────────
-- '081-234-5678', '0812345678', '+66812345678', '66812345678' → '0812345678'
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
as $function$
declare
  v text;
begin
  -- เก็บแต่ตัวเลข
  v := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if v = '' then
    return null;
  end if;
  -- +66 / 66 นำหน้า → แปลงกลับเป็น 0 (66812345678 → 0812345678)
  if length(v) = 11 and left(v, 2) = '66' then
    v := '0' || substr(v, 3);
  end if;
  return v;
end;
$function$;

-- ── 2) session ของ portal ───────────────────────────────────────────
-- เก็บ phone ไม่เก็บ rental_id เดียว เพราะผู้เช่าคนเดียวอาจเช่าหลายห้อง
create table if not exists public.tenant_portal_sessions (
  token text primary key,
  phone_norm text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_portal_sessions_expires_idx
  on public.tenant_portal_sessions (expires_at);

alter table public.tenant_portal_sessions enable row level security;
-- ไม่มี policy = ไม่มีใครอ่านตรงได้ เข้าถึงผ่าน RPC (security definer) เท่านั้น

-- ── 3) นับครั้งที่กรอกเบอร์ผิด ──────────────────────────────────────
create table if not exists public.tenant_portal_attempts (
  id bigint generated always as identity primary key,
  phone_norm text not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists tenant_portal_attempts_phone_time_idx
  on public.tenant_portal_attempts (phone_norm, created_at desc);

alter table public.tenant_portal_attempts enable row level security;

-- ── 4) เข้าสู่ระบบด้วยเบอร์โทร ──────────────────────────────────────
create or replace function public.tenant_portal_login(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text;
  v_fails int;
  v_token text;
  v_rentals jsonb;
  v_count int;
begin
  v_phone := public.normalize_phone(p_phone);

  -- เบอร์มือถือไทย 10 หลัก / เบอร์บ้าน 9 หลัก
  if v_phone is null or length(v_phone) < 9 or length(v_phone) > 10 then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  -- rate limit: กรอกผิดเกิน 5 ครั้งใน 15 นาที → พักก่อน
  select count(*) into v_fails
    from public.tenant_portal_attempts
   where phone_norm = v_phone
     and ok = false
     and created_at > now() - interval '15 minutes';

  if v_fails >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  -- หาห้องที่ผูกกับเบอร์นี้ (ยังไม่ย้ายออก)
  select count(*) into v_count
    from public.rentals r
   where public.normalize_phone(r.tenant_phone) = v_phone
     and lower(coalesce(r.room_status, '')) <> 'vacant';

  if v_count = 0 then
    insert into public.tenant_portal_attempts (phone_norm, ok) values (v_phone, false);
    -- ข้อความเดียวกับกรณีเบอร์ผิดรูป ไม่บอกว่า "เบอร์นี้ไม่มีในระบบ"
    -- เพื่อไม่ให้ใช้หน้านี้ไล่เช็คว่าเบอร์ไหนเป็นผู้เช่า
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.tenant_portal_attempts (phone_norm, ok) values (v_phone, true);

  -- เก็บกวาด session หมดอายุ (ทำตอนนี้เลย ไม่ต้องตั้ง cron)
  delete from public.tenant_portal_sessions where expires_at < now();

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.tenant_portal_sessions (token, phone_norm, expires_at)
  values (v_token, v_phone, now() + interval '8 hours');

  -- คืนข้อมูลน้อยที่สุดที่พอให้ผู้เช่ารู้ว่าเข้าถูกห้อง
  -- ไม่คืน: ยอดค้าง เลขบัตร นามสกุลเต็ม secure_token binding_code
  select coalesce(jsonb_agg(jsonb_build_object(
           'rental_id', r.id,
           'name', public.rental_display_name(r.id)
         ) order by r.created_at), '[]'::jsonb)
    into v_rentals
    from public.rentals r
   where public.normalize_phone(r.tenant_phone) = v_phone
     and lower(coalesce(r.room_status, '')) <> 'vacant';

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'expires_at', now() + interval '8 hours',
    'rentals', v_rentals
  );
end;
$function$;

revoke all on function public.tenant_portal_login(text) from public;
grant execute on function public.tenant_portal_login(text) to anon, authenticated;

-- ── helper: token → เบอร์ (null ถ้าหมดอายุ/ไม่มี) ───────────────────
create or replace function public.tenant_portal_phone(p_token text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.phone_norm
    from public.tenant_portal_sessions s
   where s.token = trim(coalesce(p_token, ''))
     and s.expires_at > now()
   limit 1;
$function$;

revoke all on function public.tenant_portal_phone(text) from public, anon, authenticated;

-- ── 4b) ตรวจ token + คืนรายการห้อง (ใช้ตอนรีเฟรชหน้า) ───────────────
-- ถ้าไม่มี RPC นี้ ฝั่งเว็บต้องเดารายการห้องจากประวัติแจ้งซ่อม ซึ่งทำให้
-- ผู้เช่าที่ยังไม่เคยแจ้งซ่อมต้องกรอกเบอร์ใหม่ทุกครั้งที่รีเฟรช
create or replace function public.tenant_portal_session(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_phone text;
  v_rentals jsonb;
begin
  v_phone := public.tenant_portal_phone(p_token);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'session_expired');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rental_id', r.id,
           'name', public.rental_display_name(r.id)
         ) order by r.created_at), '[]'::jsonb)
    into v_rentals
    from public.rentals r
   where public.normalize_phone(r.tenant_phone) = v_phone
     and lower(coalesce(r.room_status, '')) <> 'vacant';

  return jsonb_build_object('ok', true, 'rentals', v_rentals);
end;
$function$;

revoke all on function public.tenant_portal_session(text) from public;
grant execute on function public.tenant_portal_session(text) to anon, authenticated;

-- ── 5) ประวัติแจ้งซ่อมของห้องตัวเอง ─────────────────────────────────
create or replace function public.tenant_portal_repairs(p_token text)
returns table (
  id uuid,
  rental_id uuid,
  rental_name text,
  description text,
  status text,
  photo_url text,
  created_at timestamptz,
  done_at timestamptz
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select rt.id,
         rt.rental_id,
         public.rental_display_name(rt.rental_id) as rental_name,
         rt.description,
         rt.status,
         rt.photo_url,
         rt.created_at,
         rt.done_at
    from public.repair_tickets rt
    join public.rentals r on r.id = rt.rental_id
   where public.tenant_portal_phone(p_token) is not null
     and public.normalize_phone(r.tenant_phone) = public.tenant_portal_phone(p_token)
   order by rt.created_at desc
   limit 50;
$function$;

revoke all on function public.tenant_portal_repairs(text) from public;
grant execute on function public.tenant_portal_repairs(text) to anon, authenticated;

-- ── 6) แจ้งซ่อมใหม่ ─────────────────────────────────────────────────
create or replace function public.tenant_portal_create_repair(
  p_token text,
  p_rental_id uuid,
  p_description text,
  p_photo_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$
declare
  v_phone text;
  v_rental record;
  v_open int;
  v_id uuid;
  v_token_line text;
  v_req bigint;
begin
  v_phone := public.tenant_portal_phone(p_token);
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'session_expired');
  end if;

  if coalesce(trim(p_description), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'empty_description');
  end if;
  if length(trim(p_description)) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'description_too_long');
  end if;

  -- ห้องต้องเป็นของเบอร์ที่ล็อกอินอยู่ (กันส่ง rental_id ของคนอื่นมา)
  select r.id, r.group_id, r.landlord_id
    into v_rental
    from public.rentals r
   where r.id = p_rental_id
     and public.normalize_phone(r.tenant_phone) = v_phone
     and lower(coalesce(r.room_status, '')) <> 'vacant';

  if v_rental is null then
    return jsonb_build_object('ok', false, 'error', 'rental_not_yours');
  end if;

  -- กันสแปม: ห้องเดียวเปิดค้างได้ไม่เกิน 10 เรื่อง
  select count(*) into v_open
    from public.repair_tickets
   where rental_id = p_rental_id
     and status <> 'done';

  if v_open >= 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many_open');
  end if;

  insert into public.repair_tickets (rental_id, description, status, photo_url)
  values (p_rental_id, trim(p_description), 'open', nullif(trim(coalesce(p_photo_url, '')), ''))
  returning id into v_id;

  -- แจ้งเข้ากลุ่ม LINE ให้เจ้าของรู้ทันที (ถ้าห้องนี้ผูกกลุ่มไว้)
  -- ส่งไม่ได้ก็ไม่ถือว่า fail — ticket บันทึกแล้ว เจ้าของเห็นในเว็บอยู่ดี
  if coalesce(v_rental.group_id, '') <> '' then
    begin
      v_token_line := public.get_line_token();
      if v_token_line is not null then
        select net.http_post(
          url := 'https://api.line.me/v2/bot/message/push',
          body := jsonb_build_object(
            'to', v_rental.group_id,
            'messages', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text',
                '🔧 มีแจ้งซ่อมใหม่' || chr(10)
                || 'ห้อง: ' || public.rental_display_name(p_rental_id) || chr(10)
                || 'เรื่อง: ' || trim(p_description))
            )),
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_token_line)
        ) into v_req;
      end if;
    exception when others then
      raise notice 'push LINE ไม่สำเร็จ: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object('ok', true, 'ticket_id', v_id);
end;
$function$;

revoke all on function public.tenant_portal_create_repair(text, uuid, text, text) from public;
grant execute on function public.tenant_portal_create_repair(text, uuid, text, text) to anon, authenticated;

-- ── 7) bucket รูปแจ้งซ่อม ───────────────────────────────────────────
-- public read เพราะ repair_tickets.photo_url เก็บ public URL แบบเดียวกับ
-- bucket 'receipts' ที่ใช้อยู่ (เจ้าของเปิดดูรูปในเว็บได้ทันที)
-- จำกัดขนาด 5MB + เฉพาะไฟล์รูป เพื่อไม่ให้ใช้เป็นที่ฝากไฟล์
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('repair-photos', 'repair-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists "repair_photos_public_read" on storage.objects;
create policy "repair_photos_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'repair-photos');

-- ผู้เช่าไม่ได้ login (anon) จึงต้องเปิด insert ให้ anon
-- ยอมรับความเสี่ยงว่ามีคนอัปโหลดขยะได้ — คุมด้วย file_size_limit +
-- allowed_mime_types ข้างบน และรูปที่ไม่ได้ผูก ticket ก็ลบทิ้งได้ภายหลัง
drop policy if exists "repair_photos_anon_insert" on storage.objects;
create policy "repair_photos_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'repair-photos');
