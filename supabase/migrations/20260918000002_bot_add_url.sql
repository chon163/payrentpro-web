-- ลิงก์ "เพิ่มเพื่อนบอท" สำหรับหน้าผูกกลุ่ม LINE (LineBindingModal ดึงจาก app_settings)
-- รันแยกได้เลย ไม่ต้องรัน seed เดโม — ถ้ามีค่าอยู่แล้วจะไม่ทับ (on conflict do nothing)
-- (ตาราง app_settings มีแค่คอลัมน์ key/value — ไม่มี description)
insert into public.app_settings (key, value)
values ('bot_add_url', 'https://line.me/R/ti/p/@881gcbgc')
on conflict (key) do nothing;
