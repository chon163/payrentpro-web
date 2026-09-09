-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : Phase 2b — ประกาศ / บันทึก / เอกสาร
--
-- ที่มา: ผสานจาก PropertyHub (RESEARCH.md — announcements / notes / documents)
--
-- 1) announcements — ประกาศถึงผู้เช่า (draft/published/archived)
-- 2) notes         — บันทึกช่วยจำแบบ sticky note (มีสี + ปักหมุด)
-- 3) documents     — เอกสารแนบ (ใช้ Supabase Storage bucket 'documents')
--
-- ผูกกับ admins (landlord) ตรง ๆ ไม่พึ่งโครงอาคาร — ทำได้เลย (DECISIONS.md D8)
-- ใช้ helper public.is_my_landlord() ที่สร้างไว้แล้วใน migration 20260909100000
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) ประกาศ ───────────────────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  title text not null,
  content text not null default '',
  publish_date date not null default current_date,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  -- ประกาศถูกส่งเข้ากลุ่ม LINE แล้วเมื่อไร (null = ยังไม่ส่ง)
  -- ระบบต้นทางไม่มีส่วนนี้ — ของเรามี LINE อยู่แล้วจึงต่อยอดได้
  sent_to_line_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists announcements_landlord_idx
  on public.announcements (landlord_id, publish_date desc);
create index if not exists announcements_status_idx
  on public.announcements (landlord_id, status);

-- ── 2) บันทึกช่วยจำ ─────────────────────────────────────────────────
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  title text not null,
  content text not null default '',
  -- สีพื้นการ์ด (hex) — ต้นทางใช้ <input type="color"> ค่าเริ่ม #fff7ed
  color text not null default '#fff7ed',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- โน้ตที่ปักหมุดขึ้นก่อนเสมอ แล้วเรียงตามเวลาแก้ล่าสุด
create index if not exists notes_landlord_pinned_idx
  on public.notes (landlord_id, pinned desc, updated_at desc);

-- แก้โน้ตแล้วต้องเด้งขึ้นบน — ตั้ง updated_at เองใน trigger กันฝั่งเว็บลืมส่ง
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- ── 3) เอกสารแนบ ────────────────────────────────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  -- ผูกเอกสารกับสินทรัพย์ได้ (สำเนาสัญญาห้อง 101) หรือเว้นว่าง = เอกสารกลาง
  rental_id uuid references public.rentals(id) on delete set null,
  title text not null,
  -- path ใน storage bucket 'documents' (ไม่เก็บ public URL เพราะ bucket เป็น private)
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists documents_landlord_idx
  on public.documents (landlord_id, created_at desc);
create index if not exists documents_rental_idx
  on public.documents (rental_id);

-- ── 4) RLS ──────────────────────────────────────────────────────────
alter table public.announcements enable row level security;
alter table public.notes enable row level security;
alter table public.documents enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['announcements', 'notes', 'documents'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_my_landlord(landlord_id))',
      t || '_own_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_my_landlord(landlord_id))',
      t || '_own_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_my_landlord(landlord_id))
         with check (public.is_my_landlord(landlord_id))',
      t || '_own_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_my_landlord(landlord_id))',
      t || '_own_delete', t);
  end loop;
end;
$$;

-- ── 5) Storage bucket สำหรับเอกสาร ──────────────────────────────────
-- private (ต่างจาก 'receipts' ที่เป็น public) เพราะเอกสารมักมีสำเนาบัตร/สัญญา
-- ที่เป็นข้อมูลส่วนบุคคล — ต้องเปิดดูผ่าน signed URL เท่านั้น (PDPA)
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- เจ้าของเข้าถึงได้เฉพาะไฟล์ในโฟลเดอร์ของ landlord_id ตัวเอง
-- โครงพาธที่ฝั่งเว็บใช้: <landlord_id>/<uuid>-<filename>
drop policy if exists "documents_own_all" on storage.objects;
create policy "documents_own_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and public.is_my_landlord(nullif(split_part(name, '/', 1), '')::uuid)
  )
  with check (
    bucket_id = 'documents'
    and public.is_my_landlord(nullif(split_part(name, '/', 1), '')::uuid)
  );

-- ── 6) RPC ส่งประกาศเข้ากลุ่ม LINE ของผู้เช่าทุกห้อง ────────────────
-- ของแถมที่ระบบต้นทางไม่มี — เรามี LINE binding อยู่แล้ว ประกาศที่ส่งไม่ถึง
-- ผู้เช่าก็แค่บันทึกในระบบ ไม่ได้แจ้งใครจริง
create or replace function public.broadcast_announcement(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'net', 'extensions'
as $function$
declare
  v_token text;
  v_ann record;
  v_group record;
  v_sent int := 0;
  v_req bigint;
begin
  v_token := public.get_line_token();
  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'no_line_token');
  end if;

  select a.id, a.title, a.content, a.landlord_id
    into v_ann
    from public.announcements a
   where a.id = p_id
     and public.is_my_landlord(a.landlord_id);

  if v_ann is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ส่งครั้งเดียวต่อกลุ่ม แม้เจ้าของมีหลายห้องในกลุ่มเดียวกัน
  for v_group in
    select distinct r.group_id
      from public.rentals r
     where r.landlord_id = v_ann.landlord_id
       and coalesce(r.group_id, '') <> ''
  loop
    select net.http_post(
      url := 'https://api.line.me/v2/bot/message/push',
      body := jsonb_build_object(
        'to', v_group.group_id,
        'messages', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text',
            '📣 ' || v_ann.title || chr(10) || chr(10) || coalesce(v_ann.content, ''))
        )),
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_token)
    ) into v_req;
    v_sent := v_sent + 1;
  end loop;

  update public.announcements
     set sent_to_line_at = now(),
         status = 'published'
   where id = p_id;

  return jsonb_build_object('ok', true, 'groups', v_sent);
end;
$function$;

revoke all on function public.broadcast_announcement(uuid) from public;
grant execute on function public.broadcast_announcement(uuid) to authenticated;
