-- ═══════════════════════════════════════════════════════════════════
-- Fix: รายรับค่าเช่าในหน้ากำไรสุทธิแสดง ฿0
--
-- ปัญหา: get_profit_summary และ get_profit_trend ใช้ transactions.created_at
--        แต่ seed data มี created_at = ปัจจุบันทั้งหมด ในขณะที่ period ย้อนหลัง
--        ทำให้ตัวกรอง t.created_at >= v_from ไม่เจอบิลเดือนก่อนๆ
--
-- แก้ไข: เปลี่ยนจาก created_at เป็น period (YYYY-MM) ซึ่งเป็นเดือนที่บิลเป็นของจริงๆ
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.get_profit_summary(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_landlord uuid;
  v_period text;
  v_rent numeric;
  v_other numeric;
  v_expense numeric;
  v_by_category jsonb;
  v_from date;
  v_to date;
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

  v_period := to_char(make_date(p_year, p_month, 1), 'YYYY-MM');
  v_from := make_date(p_year, p_month, 1);
  v_to   := (v_from + interval '1 month')::date;

  -- รายรับค่าเช่า: ยอดที่ชำระแล้วจริงในเดือนนั้น (กรองตาม period ไม่ใช่ created_at)
  select coalesce(sum(t.paid_amount), 0)
    into v_rent
    from public.transactions t
    join public.rentals r on r.id = t.rental_id
   where r.landlord_id = v_landlord
     and lower(coalesce(t.status, '')) = 'paid'
     and t.period = v_period;

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

  select coalesce(jsonb_agg(x order by total_num desc), '[]'::jsonb)
    into v_by_category
    from (
      select jsonb_build_object(
               'category_id', c.id,
               'name',  coalesce(c.name, 'ไม่ระบุหมวด'),
               'color', coalesce(c.color, '#94a3b8'),
               'total', sum(e.amount)
             ) as x,
             sum(e.amount) as total_num
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

  v_n := least(greatest(coalesce(p_months, 6), 1), 36);

  return query
  with months as (
    select to_char(date_trunc('month', current_date) - (i || ' month')::interval, 'YYYY-MM') as period,
           date_trunc('month', current_date) - (i || ' month')::interval as m
      from generate_series(v_n - 1, 0, -1) as i
  )
  select mo.period,
         coalesce(inc.total, 0) + coalesce(oth.total, 0) as income,
         coalesce(exp.total, 0) as expense,
         coalesce(inc.total, 0) + coalesce(oth.total, 0) - coalesce(exp.total, 0) as profit
    from months mo
    left join (
      select t.period, sum(t.paid_amount) as total
        from public.transactions t
        join public.rentals r on r.id = t.rental_id
       where r.landlord_id = v_landlord
         and lower(coalesce(t.status, '')) = 'paid'
       group by 1
    ) inc on inc.period = mo.period
    left join (
      select to_char(date_trunc('month', income_date), 'YYYY-MM') as period, sum(amount) as total
        from public.other_income
       where landlord_id = v_landlord
       group by 1
    ) oth on oth.period = mo.period
    left join (
      select to_char(date_trunc('month', expense_date), 'YYYY-MM') as period, sum(amount) as total
        from public.expenses
       where landlord_id = v_landlord
       group by 1
    ) exp on exp.period = mo.period
   order by mo.period;
end;
$function$;
