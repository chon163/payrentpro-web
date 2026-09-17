-- Add is_utility_only flag to transactions table
alter table public.transactions
  add column if not exists is_utility_only boolean default false;

comment on column public.transactions.is_utility_only is 'บิลน้ำไฟแยก (ไม่มีค่าเช่า base_amount=0) ส่งเป็นบิลเสริมหลังส่งบิลหลักแล้ว';

-- Index for querying utility-only bills
create index if not exists idx_transactions_utility_only
  on public.transactions (rental_id, is_utility_only)
  where is_utility_only = true;
