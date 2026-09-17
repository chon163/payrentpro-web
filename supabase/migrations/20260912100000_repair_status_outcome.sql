-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : งานซ่อม — สถานะ "กำลังซ่อม" + ประวัติผลการซ่อม
--
-- 1) คอลัมน์ใหม่บน repair_tickets:
--    started_at — เวลากด "เริ่มซ่อม" (open → in_progress)
--    outcome    — ผลการซ่อมตอนปิดงาน: 'success' | 'failed' (null = ยังไม่ปิด)
--    done_note  — หมายเหตุผล/สิ่งที่แก้ ตอนปิดงาน
--
-- หมายเหตุ: RLS update policy เดิม (repair_tickets_own_update) เป็นระดับ
-- แถว ไม่ใช่ระดับคอลัมน์ จึงครอบคอลัมน์ใหม่อัตโนมัติ — เจ้าของแก้ได้เหมือนเดิม
-- งานที่ปิดไปแล้ว (แถวเดิม) outcome เป็น null → หน้าเว็บแสดง "เสร็จแล้ว" เฉยๆ
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ═══════════════════════════════════════════════════════════════════

alter table public.repair_tickets
  add column if not exists started_at timestamptz,
  add column if not exists outcome text,
  add column if not exists done_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'repair_tickets_outcome_chk'
  ) then
    alter table public.repair_tickets
      add constraint repair_tickets_outcome_chk
      check (outcome is null or outcome in ('success', 'failed'));
  end if;
end $$;

-- ดูประวัติล่าสุดเร็วขึ้น — เรียงตามวันปิดงาน
create index if not exists repair_tickets_done_at_idx
  on public.repair_tickets (done_at desc nulls last);
