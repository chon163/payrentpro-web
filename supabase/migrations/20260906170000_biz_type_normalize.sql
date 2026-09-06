-- ============================================================
-- PayRentPro : แบ่งประเภทสินทรัพย์ 3 กลุ่ม (property/vehicle/other)
--
-- คอลัมน์ rentals.biz_type มีอยู่แล้ว แต่ข้อมูลเดิมเก็บเป็นค่าไทย
-- ('อสังหาริมทรัพย์'/'ยานพาหนะ'/'อุปกรณ์') หรือ null
-- migration นี้ normalize ทุกแถวเป็นค่ามาตรฐาน:
--   'property' | 'vehicle' | 'other'
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

update public.rentals set biz_type = 'vehicle' where biz_type = 'ยานพาหนะ';
update public.rentals set biz_type = 'other'   where biz_type = 'อุปกรณ์';
update public.rentals set biz_type = 'property'
 where biz_type is null or biz_type = '' or biz_type = 'อสังหาริมทรัพย์';
