-- ═══════════════════════════════════════════════════════════════════
-- Fix: บิล status='paid' ที่มี paid_amount = NULL
--
-- ปัญหา: seed data กำหนด paid_amount เฉพาะ pending_review เท่านั้น
--        บิลที่ status='paid' จึงมี paid_amount = NULL ทำให้ RPC ไม่นับ
--
-- แก้ไข: UPDATE บิลที่ status='paid' แต่ paid_amount เป็น NULL
--        ให้ paid_amount = total_amount
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.transactions
   SET paid_amount = total_amount
 WHERE lower(coalesce(status, '')) = 'paid'
   AND paid_amount IS NULL;
