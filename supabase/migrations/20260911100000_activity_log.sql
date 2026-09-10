-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : Activity Log — บันทึกการเข้า/ออกระบบ (login/logout)
--
-- ให้สองหน้าใช้:
--   · /activity  — เจ้าของที่ (landlord) ดูของบัญชีตัวเอง
--   · /admin แท็บ "ประวัติเข้าใช้งาน" — founder ดูของสมาชิกทุกคน
-- แสดง: วันที่/เวลา · อีเมล · การกระทำ · IP
--
-- ทำไมต้องเก็บเอง ไม่ใช้ของ Supabase:
-- auth.audit_log_entries มี login/logout + ip_address ให้อยู่แล้ว แต่อยู่ใน
-- schema `auth` ซึ่ง PostgREST ไม่ expose (ยิงจากหน้าเว็บได้ 404 PGRST205)
-- และต้องเปิด toggle "Write audit logs to the database" เองใน dashboard
-- อีกทั้ง query ได้จาก dashboard เท่านั้น → พึ่งไม่ได้ ต้องมีตารางของเราเอง
--
-- IP มาจากไหน: เบราว์เซอร์มองไม่เห็น IP ตัวเอง ส่งมาจากหน้าเว็บไม่ได้
-- (และถ้าให้ส่งมา ผู้ใช้ปลอมค่าได้) จึงอ่านจาก header ที่ PostgREST ผูกไว้กับ
-- transaction — current_setting('request.headers') ชื่อ header เป็นตัวเล็กหมด
-- ไม่ต้องมี Edge Function
--
-- ⚠️ ตารางนี้ **ไม่ใช้ RLS แบบ using(true)** ต่างจาก audit_logs เดิม
--    (20260906140000_update_bill_amount.sql บรรทัด 36) ที่ landlord ทุกคน
--    อ่านของกันได้หมด — ตารางนี้ scope ตาม admin_id ของคนที่ login
--
-- retention 90 วัน: ลบในตัว RPC เลย ไม่ตั้ง cron (แพทเทิร์นเดียวกับ
-- tenant_portal_login ที่เก็บกวาด session หมดอายุตอนถูกเรียก)
--
-- ▶ วิธีรัน: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
--   (หรือ supabase db push) — รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) ตารางเก็บ log ────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.admins (id) on delete cascade,
  -- เก็บอีเมลซ้ำไว้ด้วย เพื่อให้ log ยังอ่านได้แม้แถว admins ถูกลบไปแล้ว
  user_email text not null default '',
  action text not null,
  detail text not null default '',
  ip text,
  user_agent text,
  -- session_id จาก JWT — ใช้กันบันทึกซ้ำ (ดู unique index ข้างล่าง)
  session_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_admin_time_idx
  on public.activity_logs (admin_id, created_at desc);

-- ใช้ตอนลบของเก่าเกิน 90 วัน
create index if not exists activity_logs_created_idx
  on public.activity_logs (created_at);

-- กันบันทึกซ้ำ: onAuthStateChange ยิง SIGNED_IN ทุกครั้งที่ token refresh
-- และทุกแท็บที่เปิดอยู่ ถ้าไม่กัน หนึ่งการเข้าใช้งานจะได้หลายสิบแถว
-- (partial — แถวที่ session_id เป็น null ไม่ถูกคุม เพราะ null ไม่ชนกันใน unique)
create unique index if not exists activity_logs_session_action_uniq
  on public.activity_logs (session_id, action)
  where session_id is not null;

alter table public.activity_logs enable row level security;

-- อ่านได้แต่แถวของตัวเอง (เทียบทั้ง user_id และ email เพราะบางบัญชี
-- ยังไม่ได้ผูก user_id — แพทเทิร์นเดียวกับ get_membership_status)
drop policy if exists "activity_logs_own_read" on public.activity_logs;
create policy "activity_logs_own_read" on public.activity_logs
  for select to authenticated
  using (
    admin_id in (
      select a.id from public.admins a
       where (auth.uid() is not null and a.user_id = auth.uid())
          or (auth.email() is not null and a.email = auth.email())
    )
  );

-- ไม่มี policy insert/update/delete โดยเจตนา — เขียนผ่าน RPC security definer
-- เท่านั้น ผู้ใช้จึงปลอมแถว/แก้ IP/ลบประวัติตัวเองไม่ได้
-- (แพทเทิร์นเดียวกับ tenant_portal_sessions)


-- ── 2) ตัวช่วยอ่าน header ที่ PostgREST ผูกกับ transaction ──────────
-- current_setting คืน '' (ไม่ใช่ null) หลัง commit จึงต้อง nullif ก่อนทุกครั้ง
-- x-forwarded-for อาจเป็นลิสต์ "client, proxy1, proxy2" → เอาตัวแรกคือ client
create or replace function public.request_client_ip()
returns text language plpgsql stable
set search_path = public
as $$
declare
  v_headers json;
  v_ip text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    -- ถ้า header ไม่ใช่ JSON ที่ parse ได้ ก็แค่ไม่มี IP ไม่ต้องทำให้ทั้ง RPC ล้ม
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  v_ip := btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1));
  if v_ip = '' then
    v_ip := btrim(coalesce(v_headers->>'x-real-ip', ''));
  end if;

  return nullif(v_ip, '');
end;
$$;

-- session_id ของ JWT ปัจจุบัน (null ถ้าไม่มี/ไม่ใช่ uuid)
create or replace function public.request_session_id()
returns uuid language plpgsql stable
set search_path = public
as $$
declare
  v_claims json;
  v_sid text;
begin
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::json;
  exception when others then
    return null;
  end;

  if v_claims is null then
    return null;
  end if;

  v_sid := nullif(btrim(coalesce(v_claims->>'session_id', '')), '');
  if v_sid is null then
    return null;
  end if;

  begin
    return v_sid::uuid;
  exception when others then
    return null;
  end;
end;
$$;


-- ── 3) บันทึก 1 เหตุการณ์ ───────────────────────────────────────────
-- ฝั่งเว็บเรียกแบบ fire-and-forget: ถ้าล้มก็ไม่ควรกระทบการเข้า/ออกระบบ
-- จึงคืน jsonb {ok:...} เสมอ ไม่ raise (ยกเว้น action ที่ไม่รู้จัก)
create or replace function public.log_activity(
  p_action text,
  p_detail text default ''
)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_admin uuid;
  v_email text;
  v_action text;
  v_headers json;
  v_ua text;
begin
  v_action := lower(btrim(coalesce(p_action, '')));
  if v_action not in ('login', 'logout') then
    return jsonb_build_object('ok', false, 'error', 'invalid_action');
  end if;

  -- หาแถว admins ของคนที่เรียก (เทียบสองทางเหมือน get_membership_status)
  select a.id, a.email into v_admin, v_email
    from public.admins a
   where (auth.uid() is not null and a.user_id = auth.uid())
      or (auth.email() is not null and a.email = auth.email())
   limit 1;

  -- ยังไม่มีแถว admins (เช่นเพิ่งสมัคร ยังไม่เริ่มทดลองใช้) — ไม่ใช่ error
  -- แต่ยังบันทึกอีเมลจาก JWT ไว้ได้ เพื่อไม่ให้ประวัติขาดช่วง
  if v_admin is null then
    v_email := auth.email();
    if v_email is null then
      return jsonb_build_object('ok', false, 'error', 'no_session');
    end if;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
    v_ua := left(btrim(coalesce(v_headers->>'user-agent', '')), 300);
  exception when others then
    v_ua := null;
  end;

  insert into public.activity_logs (admin_id, user_email, action, detail, ip, user_agent, session_id)
  values (
    v_admin,
    coalesce(v_email, ''),
    v_action,
    left(btrim(coalesce(p_detail, '')), 200),
    public.request_client_ip(),
    nullif(v_ua, ''),
    public.request_session_id()
  )
  on conflict do nothing;   -- ชน unique (session_id, action) = บันทึกไปแล้ว

  -- เก็บกวาดของเกิน 90 วันตรงนี้เลย ไม่ต้องตั้ง cron
  -- (แพทเทิร์นเดียวกับ tenant_portal_login ที่ลบ session หมดอายุตอนถูกเรียก)
  delete from public.activity_logs where created_at < now() - interval '90 days';

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.log_activity(text, text) to authenticated;


-- ── 4) ประวัติของบัญชีตัวเอง (หน้า /activity ของ landlord) ──────────
drop function if exists public.get_activity_logs(int);

create function public.get_activity_logs(p_limit int default 200)
returns table (
  id bigint,
  user_email text,
  action text,
  detail text,
  ip text,
  created_at timestamptz
) language plpgsql security definer stable
set search_path = public
as $$
begin
  return query
  select l.id, l.user_email, l.action, l.detail, l.ip, l.created_at
    from public.activity_logs l
   where l.admin_id in (
           select a.id from public.admins a
            where (auth.uid() is not null and a.user_id = auth.uid())
               or (auth.email() is not null and a.email = auth.email())
         )
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 200), 1000));
end;
$$;

grant execute on function public.get_activity_logs(int) to authenticated;


-- ── 5) ประวัติของทุกคน (แท็บใน /admin — founder เท่านั้น) ───────────
drop function if exists public.get_all_activity_logs(int);

create function public.get_all_activity_logs(p_limit int default 500)
returns table (
  id bigint,
  user_email text,
  action text,
  detail text,
  ip text,
  created_at timestamptz
) language plpgsql security definer stable
set search_path = public
as $$
begin
  -- guard: เช็คทั้ง user_id และ email — ถ้าเช็คแค่ user_id แถว founder ที่ยัง
  -- ไม่ผูก user_id จะถูกตีกลับทั้งที่เป็น founder จริง (บั๊กที่เจอกับ /admin)
  if not exists (
    select 1 from public.admins a
     where a.plan_type = 'founder'
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  ) then
    raise exception 'forbidden';
  end if;

  return query
  select l.id, l.user_email, l.action, l.detail, l.ip, l.created_at
    from public.activity_logs l
   order by l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 500), 2000));
end;
$$;

grant execute on function public.get_all_activity_logs(int) to authenticated;
