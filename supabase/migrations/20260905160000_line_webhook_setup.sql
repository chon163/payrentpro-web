-- ============================================================
-- PayRentPro : SQL setup สำหรับ line-webhook Edge Function
-- ใช้คู่กับ supabase/functions/line-webhook/index.ts
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- 1) ตารางกัน webhook event ซ้ำ (dedup)
--    ใช้ webhookEventId เป็น primary key → ถ้า insert ซ้ำจะชน unique
create table if not exists public.line_events (
  webhook_event_id text primary key,
  created_at timestamptz not null default now()
);

-- 2) Storage bucket "slips" สำหรับเก็บรูปสลิป (private → ใช้ signed URL)
insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;
