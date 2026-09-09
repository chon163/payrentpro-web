-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : Phase 2a — รายจ่าย / รายรับอื่น / หมวดรายจ่าย
--
-- ที่มา: ผสานฟีเจอร์จาก PropertyHub (ดู RESEARCH.md หัวข้อ expenses/income/profit)
-- "กำไรสุทธิ์ครบวงจร" เป็น 1 ใน 4 จุดขายที่ระบบต้นทางโฆษณาบนหน้า login
-- และของเรายังไม่มีเลย — บันทึกได้แต่รายรับค่าเช่า ไม่มีฝั่งรายจ่าย
--
-- 1) expense_categories — หมวดรายจ่าย (ต้นทางอ้างด้วย category_id)
-- 2) expenses          — รายจ่าย
-- 3) other_income       — รายรับอื่นที่ไม่ใช่ค่าเช่า
-- 4) RPC get_profit_summary(year, month) — รายรับ/รายจ่าย/กำไรของงวด
--
-- ผูกกับ admins (landlord) ตรง ๆ ไม่พึ่งโครงอาคาร — ทำได้เลยไม่ต้องรออะไร
-- ตาราง rentals/transactions เดิมไม่ถูกแตะ (ดู DECISIONS.md D7)
--
-- แพทเทิร์น RLS: ตามรอย repair_tickets — เทียบทั้ง user_id และ email
-- เพราะบัญชีที่สมัครก่อนมี auth.uid() ผูกไว้ไม่ครบทุกแถว
-- ═══════════════════════════════════════════════════════════════════

-- ── 1) หมวดรายจ่าย ──────────────────────────────────────────────────
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  name text not null,
  -- ระบายสีในกราฟ/ป้าย ให้ผู้ใช้เลือกได้เอง (ต้นทางมี color ใน room_types)
  color text not null default '#94a3b8',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ห้ามหมวดชื่อซ้ำในเจ้าของคนเดียวกัน (ต่างเจ้าของชื่อซ้ำได้)
create unique index if not exists expense_categories_landlord_name_key
  on public.expense_categories (landlord_id, lower(trim(name)));

create index if not exists expense_categories_landlord_idx
  on public.expense_categories (landlord_id, sort_order);

-- ── 2) รายจ่าย ──────────────────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  -- ลบหมวดแล้วรายจ่ายต้องไม่หาย → set null ไม่ใช่ cascade
  category_id uuid references public.expense_categories(id) on delete set null,
  -- ผูกรายจ่ายกับสินทรัพย์ได้ (ค่าซ่อมห้อง 101) หรือเว้นว่าง = ค่าใช้จ่ายส่วนกลาง
  rental_id uuid references public.rentals(id) on delete set null,
  expense_date date not null default current_date,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  -- ผู้รับเงิน: ต้นทางใช้ vendor_id อ้างตาราง vendors ซึ่งจะมาใน Phase 2c
  -- ตอนนี้เก็บเป็นข้อความไปก่อน แล้ว 2c จะเพิ่มคอลัมน์ vendor_id ทับ
  vendor_name text,
  reference_no text,
  payment_method text not null default 'transfer'
    check (payment_method in ('transfer', 'cash', 'credit_card', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

-- หน้ารายจ่ายกรองตามเดือน+ปีเสมอ (ต้นทางมี ?pm=&py=)
create index if not exists expenses_landlord_date_idx
  on public.expenses (landlord_id, expense_date desc);
create index if not exists expenses_category_idx
  on public.expenses (category_id);
create index if not exists expenses_rental_idx
  on public.expenses (rental_id);

-- ── 3) รายรับอื่น (ไม่ใช่ค่าเช่า) ───────────────────────────────────
create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null references public.admins(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete set null,
  income_date date not null default current_date,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  -- แหล่งที่มา เช่น ค่าปรับ ค่าที่จอดรถ ค่าเครื่องซักผ้า ริบมัดจำ
  source text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists other_income_landlord_date_idx
  on public.other_income (landlord_id, income_date desc);
create index if not exists other_income_rental_idx
  on public.other_income (rental_id);

-- ── 4) RLS — เจ้าของเห็น/แก้เฉพาะข้อมูลตัวเอง ───────────────────────
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.other_income enable row level security;

-- helper: แถวนี้เป็นของ landlord ที่กำลัง login อยู่หรือไม่
-- (แยกออกมาเพราะต้องใช้ซ้ำ 12 policy — เขียนซ้ำแล้วพลาดง่าย)
create or replace function public.is_my_landlord(p_landlord_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
      from public.admins a
     where a.id = p_landlord_id
       and ((auth.uid() is not null and a.user_id = auth.uid())
         or (auth.email() is not null and a.email = auth.email()))
  );
$function$;

revoke all on function public.is_my_landlord(uuid) from public;
grant execute on function public.is_my_landlord(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['expense_categories', 'expenses', 'other_income'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.is_my_landlord(landlord_id))',
      t || '_own_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.is_my_landlord(landlord_id))',
      t || '_own_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.is_my_landlord(landlord_id))
         with check (public.is_my_landlord(landlord_id))',
      t || '_own_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_own_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.is_my_landlord(landlord_id))',
      t || '_own_delete', t);
  end loop;
end;
$$;

-- ── 5) หมวดรายจ่ายเริ่มต้น ให้ผู้ใช้ใหม่ไม่เจอ dropdown ว่าง ─────────
-- ต้นทางไม่มีส่วนนี้ (ผู้ใช้ต้องสร้างหมวดเองก่อนบันทึกรายจ่ายได้)
-- ซึ่งเป็น dead end ที่ผู้ใช้ใหม่ต้องเจอ — เราเติมให้ล่วงหน้า
create or replace function public.seed_expense_categories(p_landlord_id uuid)
returns int
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count int;
begin
  if not public.is_my_landlord(p_landlord_id) then
    return 0;
  end if;

  select count(*) into v_count
    from public.expense_categories
   where landlord_id = p_landlord_id;
  if v_count > 0 then
    return 0;  -- มีหมวดอยู่แล้ว ไม่เติมทับ
  end if;

  insert into public.expense_categories (landlord_id, name, color, sort_order)
  values
    (p_landlord_id, 'ค่าไฟ (บิลกรม)',  '#f59e0b', 1),
    (p_landlord_id, 'ค่าน้ำ (บิลกรม)', '#0ea5e9', 2),
    (p_landlord_id, 'ค่าซ่อมแซม',       '#ef4444', 3),
    (p_landlord_id, 'ค่าทำความสะอาด',   '#22c55e', 4),
    (p_landlord_id, 'ค่าอินเทอร์เน็ต',  '#8b5cf6', 5),
    (p_landlord_id, 'เงินเดือน/ค่าแรง', '#ec4899', 6),
    (p_landlord_id, 'ภาษี/ค่าธรรมเนียม', '#64748b', 7),
    (p_landlord_id, 'อื่น ๆ',            '#94a3b8', 99);

  return 8;
end;
$function$;

revoke all on function public.seed_expense_categories(uuid) from public;
grant execute on function public.seed_expense_categories(uuid) to authenticated;

-- ── 6) RPC สรุปกำไรของงวด ───────────────────────────────────────────
-- คืน: รายรับค่าเช่า (จาก transactions ที่ชำระแล้ว) + รายรับอื่น
--      − รายจ่าย = กำไรสุทธิ์  พร้อมแยกรายจ่ายตามหมวด
--
-- นับรายรับจาก paid_amount ของบิลที่ปิดแล้ว ไม่ใช่ total_amount ของบิลที่ออก
-- เพราะบิลที่ยังไม่จ่ายไม่ใช่เงินที่ได้จริง — งบกำไรขาดทุนต้องดูเงินสดที่เข้า
create or replace function public.get_profit_summary(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_landlord uuid;
  v_from date;
  v_to date;
  v_rent numeric;
  v_other numeric;
  v_expense numeric;
  v_by_category jsonb;
begin
  select id into v_landlord
    from public.admins a
   where (auth.uid() is not null and a.user_id = auth.uid())
      or (auth.email() is not null and a.email = auth.email())
   limit 1;

  if v_landlord is null then
    return jsonb_build_object('ok', false, 'error', 'no_admin');
  end if;

  if p_year is null or p_month is null or p_month < 1 or p_month > 12 then
    return jsonb_build_object('ok', false, 'error', 'bad_period');
  end if;

  v_from := make_date(p_year, p_month, 1);
  v_to   := (v_from + interval '1 month')::date;

  -- รายรับค่าเช่า: ยอดที่ชำระแล้วจริงในเดือนนั้น
  select coalesce(sum(t.paid_amount), 0)
    into v_rent
    from public.transactions t
    join public.rentals r on r.id = t.rental_id
   where r.landlord_id = v_landlord
     and lower(coalesce(t.status, '')) = 'paid'
     and t.created_at >= v_from
     and t.created_at <  v_to;

  select coalesce(sum(amount), 0)
    into v_other
    from public.other_income
   where landlord_id = v_landlord
     and income_date >= v_from
     and income_date <  v_to;

  select coalesce(sum(amount), 0)
    into v_expense
    from public.expenses
   where landlord_id = v_landlord
     and expense_date >= v_from
     and expense_date <  v_to;

  select coalesce(jsonb_agg(x order by x->>'total' desc), '[]'::jsonb)
    into v_by_category
    from (
      select jsonb_build_object(
               'category_id', c.id,
               'name',  coalesce(c.name, 'ไม่ระบุหมวด'),
               'color', coalesce(c.color, '#94a3b8'),
               'total', sum(e.amount)
             ) as x
        from public.expenses e
        left join public.expense_categories c on c.id = e.category_id
       where e.landlord_id = v_landlord
         and e.expense_date >= v_from
         and e.expense_date <  v_to
       group by c.id, c.name, c.color
    ) s;

  return jsonb_build_object(
    'ok', true,
    'year', p_year,
    'month', p_month,
    'rent_income', v_rent,
    'other_income', v_other,
    'total_income', v_rent + v_other,
    'total_expense', v_expense,
    'net_profit', v_rent + v_other - v_expense,
    'expense_by_category', v_by_category
  );
end;
$function$;

revoke all on function public.get_profit_summary(int, int) from public;
grant execute on function public.get_profit_summary(int, int) to authenticated;

-- ── 7) RPC กราฟกำไร 6 เดือนล่าสุด (แดชบอร์ด/หน้ากำไร) ───────────────
create or replace function public.get_profit_trend(p_months int default 6)
returns table (
  period text,
  income numeric,
  expense numeric,
  profit numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_landlord uuid;
  v_n int;
begin
  select id into v_landlord
    from public.admins a
   where (auth.uid() is not null and a.user_id = auth.uid())
      or (auth.email() is not null and a.email = auth.email())
   limit 1;

  if v_landlord is null then
    return;
  end if;

  -- กันขอย้อนหลังเป็นพันเดือนแล้วตารางบวมจนหน้าค้าง
  v_n := least(greatest(coalesce(p_months, 6), 1), 36);

  return query
  with months as (
    select date_trunc('month', current_date) - (i || ' month')::interval as m
      from generate_series(v_n - 1, 0, -1) as i
  )
  select to_char(mo.m, 'YYYY-MM') as period,
         coalesce(inc.total, 0) + coalesce(oth.total, 0) as income,
         coalesce(exp.total, 0) as expense,
         coalesce(inc.total, 0) + coalesce(oth.total, 0) - coalesce(exp.total, 0) as profit
    from months mo
    left join (
      select date_trunc('month', t.created_at) as m, sum(t.paid_amount) as total
        from public.transactions t
        join public.rentals r on r.id = t.rental_id
       where r.landlord_id = v_landlord
         and lower(coalesce(t.status, '')) = 'paid'
       group by 1
    ) inc on inc.m = mo.m
    left join (
      select date_trunc('month', income_date) as m, sum(amount) as total
        from public.other_income
       where landlord_id = v_landlord
       group by 1
    ) oth on oth.m = mo.m
    left join (
      select date_trunc('month', expense_date) as m, sum(amount) as total
        from public.expenses
       where landlord_id = v_landlord
       group by 1
    ) exp on exp.m = mo.m
   order by mo.m;
end;
$function$;

revoke all on function public.get_profit_trend(int) from public;
grant execute on function public.get_profit_trend(int) to authenticated;
