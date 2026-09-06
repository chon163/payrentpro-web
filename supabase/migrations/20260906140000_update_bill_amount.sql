-- ============================================================
-- PayRentPro : RPC แก้ยอดบิล (เฉพาะสถานะ unpaid)
--
-- ใช้กับปุ่ม "✏️ แก้ไขยอดบิล" ใน InvoiceModal ของเว็บแอดมิน:
--   supabase.rpc('update_bill_amount', {
--     p_tx_id, p_water_cost, p_elec_cost, p_extra_charges, p_reason })
--
-- กติกา:
--   - แก้ได้เฉพาะบิล status = 'unpaid' (paid / pending_review ห้ามแก้)
--   - total_amount ใหม่ = base_amount + water + elec + extra
--     (base_amount คงเดิมเสมอ — frontend แสดงเป็น read-only)
--   - บันทึกทุกครั้งลง audit_logs พร้อมเหตุผล (ดูได้ที่หน้า "ประวัติแก้ไข")
--   - BillPage ดึงบิลสดทุกครั้ง ลิงก์เดิมจึงเห็นยอดใหม่อัตโนมัติ
--
-- รันผ่าน Supabase SQL Editor หรือ supabase db push
-- ============================================================

-- 1) คอลัมน์ค่าใช้จ่ายอื่นๆ/ซ่อมแซม (idempotent — รันซ้ำได้)
alter table public.transactions
  add column if not exists extra_charges numeric not null default 0;

-- 2) ตารางประวัติการแก้ยอด (หน้า /audit อ่านตารางนี้)
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  old_amount numeric not null,
  new_amount numeric not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_authenticated_read" on public.audit_logs;
create policy "audit_logs_authenticated_read" on public.audit_logs
  for select to authenticated using (true);

-- 3) RPC แก้ยอดบิล (security definer — คุมสิทธิ์ที่ตัวฟังก์ชัน ไม่พึ่ง RLS ของ authenticated)
create or replace function public.update_bill_amount(
  p_tx_id uuid,
  p_water_cost numeric,
  p_elec_cost numeric,
  p_extra_charges numeric,
  p_reason text
)
returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  v_tx record;
  v_old_total numeric;
  v_new_total numeric;
begin
  if coalesce(trim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select id, base_amount, total_amount, status
    into v_tx from public.transactions
   where id = p_tx_id
   for update;
  if v_tx is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ห้ามแก้บิลที่ชำระแล้วหรือกำลังรอตรวจสลิป (frontend ก็ซ่อนปุ่มไว้ นี่คือเกราะชั้นสอง)
  if v_tx.status <> 'unpaid' then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  v_old_total := coalesce(v_tx.total_amount, 0);
  v_new_total := coalesce(v_tx.base_amount, 0)
               + coalesce(p_water_cost, 0)
               + coalesce(p_elec_cost, 0)
               + coalesce(p_extra_charges, 0);

  update public.transactions set
    water_cost = coalesce(p_water_cost, 0),
    elec_cost = coalesce(p_elec_cost, 0),
    extra_charges = coalesce(p_extra_charges, 0),
    total_amount = v_new_total
  where id = p_tx_id;

  insert into public.audit_logs (transaction_id, old_amount, new_amount, reason)
  values (p_tx_id, v_old_total, v_new_total, trim(p_reason));

  return jsonb_build_object('ok', true, 'old_total', v_old_total, 'new_total', v_new_total);
end;
$$;

grant execute on function public.update_bill_amount(uuid, numeric, numeric, numeric, text) to authenticated;
