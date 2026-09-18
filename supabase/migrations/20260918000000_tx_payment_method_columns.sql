-- ═══════════════════════════════════════════════════════════════════
-- คอลัมน์รองรับ "จ่ายสด + ตรวจสลิปอัตโนมัติ" บนตาราง transactions
--
-- ที่มา: โค้ด 3 จุดเขียนคอลัมน์พวกนี้แต่สคีมายังไม่มี — ไม่ migrate จะพังทั้งชุด
--   1) line-webhook autoVerifyTenantSlip → slip_verified / verified_at
--   2) ปุ่ม "จ่ายสด" ในแอป → payment_method='cash' + slip_verified / verified_at
--   3) seed เดโม 3 ธุรกิจ → slip_verified / verified_at บนบิลที่จ่ายแล้ว
-- ═══════════════════════════════════════════════════════════════════

alter table public.transactions
  add column if not exists slip_verified boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists payment_method text;
