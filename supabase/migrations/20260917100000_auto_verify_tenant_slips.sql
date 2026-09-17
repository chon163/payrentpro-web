-- ============================================================
-- PayRentPro : ตรวจสลิปผู้เช่าอัตโนมัติด้วย EasySlip
--
-- ขยายระบบตรวจสลิปอัตโนมัติจาก flow สมาชิก (membership_payments)
-- มาที่ flow ผู้เช่า (transactions / line-webhook)
--
-- ผู้เช่าส่งสลิปโอนเงินในกลุ่มไลน์ → ระบบอ่านยอด → ตรงบิล =
-- ปิดบิลเอง + ส่งใบเสร็จ PDF เข้ากลุ่มทันที (ไม่ต้องรอเจ้าของอนุมัติ)
--
-- ของใหม่ในไฟล์นี้:
--   1) slip_verifications รองรับ kind='tenant' (เดิมรับเฉพาะ 'membership')
--   2) ไม่ต้องเพิ่ม column ใหม่ — transactions มี slip_image_url, status,
--      paid_amount, total_amount อยู่แล้ว (ใช้ flow เดิมที่มีต่อ)
--
-- Logic ใน line-webhook/index.ts (handleImage):
--   1) ดาวน์โหลดรูป → เก็บ bucket slips (เหมือนเดิม)
--   2) ยิง EasySlip API (pattern เดียวกับ verify-slip)
--   3) เช็ค 3 อย่าง:
--      - amount >= total_amount ของบิลล่าสุด (unpaid/pending_review)
--      - txnRef ไม่ซ้ำ (slip_verifications + kind='tenant')
--      - EasySlip อ่านออก (rawSlip.transRef + amount มีค่า)
--   4) ผ่านทั้งหมด →
--      update transactions set status='paid', paid_amount=total_amount
--      → เรียก send_receipt_to_line(tx_id, receipt_url)
--      → reply ในไลน์ "รับการชำระเงินแล้ว ✅ ยอด ฿X — ใบเสร็จส่งให้แล้วครับ"
--   5) ยอดไม่ตรง / อ่านไม่ออก / ซ้ำ →
--      flow เดิม (pending_review รอเจ้าของ)
--      + reply "ได้รับสลิปแล้ว กำลังตรวจสอบ ⏳"
--   6) เงื่อนไขพิเศษ ticket ซ่อม (10 นาที) ทำงานก่อน EasySlip ตามเดิม
--
-- รันผ่าน supabase db push หรือ Supabase SQL Editor
-- ============================================================

-- ── 1) ขยาย slip_verifications ให้รองรับ kind='tenant' ─────────────
-- ตาราง slip_verifications มีอยู่แล้วจาก 20260911110000_slip_verifications.sql
-- (สร้างด้วย unique(txn_ref) — สลิปใบเดิมใช้ได้ครั้งเดียวในระบบทั้ง membership + tenant)
--
-- ไม่ต้องเพิ่มคอลัมน์ใหม่ — ใช้ kind + ref_id (ref_id = transactions.id สำหรับ tenant)

-- เพิ่ม policy ให้ผู้เช่าอ่านผลตรวจของตัวเองได้ (เหมือน membership)
drop policy if exists "slip_verifications_tenant_read" on public.slip_verifications;
create policy "slip_verifications_tenant_read" on public.slip_verifications
  for select to authenticated
  using (
    kind = 'tenant'
    and exists (
      select 1
        from public.transactions t
        join public.rentals r on r.id = t.rental_id
        join public.admins a on a.id = r.landlord_id
       where t.id = slip_verifications.ref_id
         and ((auth.uid() is not null and a.user_id = auth.uid())
           or (auth.email() is not null and a.email = auth.email()))
    )
  );

-- ── 2) หมายเหตุ: transactions มีคอลัมน์ครบแล้ว ─────────────────────
-- ไม่ต้องเพิ่ม column ใหม่:
--   - slip_image_url    : เก็บ URL รูปสลิป (มีอยู่แล้ว)
--   - status            : unpaid / pending_review / paid (มีอยู่แล้ว)
--   - paid_amount       : ยอดที่ชำระจริง (มีอยู่แล้ว)
--   - total_amount      : ยอดที่ต้องชำระ (มีอยู่แล้ว)
--
-- Edge Function (line-webhook) จะใช้ service_role update ตรง ๆ
-- ไม่ต้องสร้าง RPC แยก (ต่างจาก membership ที่ต้อง grant execute)

-- ── 3) index เพิ่มประสิทธิภาพ ─────────────────────────────────────
-- หา slip_verifications ของ tenant รวดเร็วขึ้น
create index if not exists slip_verifications_tenant_idx
  on public.slip_verifications (kind, ref_id)
  where kind = 'tenant';

-- หาบิลล่าสุดของห้องรวดเร็วขึ้น (line-webhook ใช้ตอนจับคู่สลิป)
create index if not exists transactions_rental_status_created_idx
  on public.transactions (rental_id, status, created_at desc);
