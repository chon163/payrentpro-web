-- ปรับสถานะบิลที่เคยถูกปฏิเสธจากหน้ามือถือ ('rejected') ให้กลับเป็น 'unpaid'
-- เดิมปุ่มปฏิเสธบนมือถือตั้ง 'rejected' ซึ่งไม่ถูกนับเป็นค้างชำระใน KPI และไม่มี label ไทย
-- ปัจจุบันฝั่งเว็บใช้ 'unpaid' ทั้ง desktop และ mobile แล้ว — migration นี้เก็บกวาดข้อมูลเดิม
update public.transactions
set status = 'unpaid'
where status = 'rejected';
