-- ═══════════════════════════════════════════════════════════════════
-- PayRentPro : เพิ่มสินทรัพย์เดโม่ประเภท ยานพาหนะ + อุปกรณ์/อื่นๆ
--
-- เดโม่เดิมมีแต่ห้องเช่า (biz_type='property') ทำให้แท็บ "ยานพาหนะ" และ
-- "อุปกรณ์/อื่นๆ" ในหน้ารายการสินทรัพย์ว่างเปล่า ทั้งที่ระบบรองรับอยู่แล้ว
-- — นี่คือจุดขายที่ระบบต้นทาง (PropertyHub) ทำไม่ได้เลย ควรโชว์ให้เห็น
--
-- กฎสำคัญ (ตามตรรกะฝั่งเว็บที่ src/App.jsx:3459):
--   vehicle/other **ไม่มีค่าน้ำไฟ** → utility_enabled=false และ
--   last_water_meter/water_rate/last_elec_meter/elec_rate = 0 ทั้งหมด
--   ถ้าใส่ค่าไว้ บิลจะคิดค่าน้ำไฟให้รถ ซึ่งผิด
--
-- เพิ่มแบบ additive · รันซ้ำได้ (เช็คจาก item_details ที่มีอยู่)
-- transactions ใส่ landlord_id ตรง ๆ เพราะ policy txs_owner กรองจาก
-- คอลัมน์นั้นโดยตรง ไม่ได้ join rentals (ดู DECISIONS.md D22)
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_admin uuid;
  v_n int;
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;
  if v_admin is null then
    raise exception 'ไม่พบ admins ของเดโม่ — รัน 20260909150000_demo_account.sql ก่อน';
  end if;

  -- ── 1) ยานพาหนะ 5 คัน + อุปกรณ์ 5 รายการ ────────────────────
  select count(*) into v_n
    from public.rentals
   where landlord_id = v_admin
     and biz_type in ('vehicle', 'other');

  if v_n = 0 then
    insert into public.rentals (
      landlord_id, biz_type, cust_name, tenant_phone, tenant_id_card,
      item_details, sub_label, room_status, amount, cycle, due_date,
      penalty_per_day, penalty_enabled, chase_frequency, stop_chase,
      credit_balance, deposit_amount, move_in_date, lease_end_date,
      last_water_meter, water_rate, last_elec_meter, elec_rate,
      utility_enabled, binding_code
    )
    select
      v_admin,
      s.biz,
      s.cust,
      s.phone,
      case when s.cust <> 'ว่าง' then '1' || lpad((s.i * 3141592)::text, 12, '0') end,
      s.item,
      s.sub,
      s.status,
      s.amount,
      'monthly',
      s.due,
      case when s.biz = 'vehicle' then 200 else 100 end,  -- รถปรับแพงกว่า
      true, 3, 0, 0,
      case when s.cust <> 'ว่าง' then s.deposit else 0 end,
      case when s.cust <> 'ว่าง' then current_date - 200 - (s.i * 13) end,
      case when s.cust <> 'ว่าง' then current_date + s.lease_left end,
      -- vehicle/other ไม่มีค่าน้ำไฟ — ต้องเป็น 0 ทั้งหมด
      0, 0, 0, 0, false,
      (920000000 + s.i)::text
    from (values
      -- ── ยานพาหนะ (itemLabel = ทะเบียนรถ, subLabel = ยี่ห้อรถ) ──
      (1, 'vehicle', 'กก 1234 ขอนแก่น', 'Toyota Fortuner 2.8 (ดำ)',
          'ธนวัฒน์ ขับดี',    '0820000001', 'occupied', 25000, 25000, 10, 45),
      (2, 'vehicle', 'ขข 5678 ขอนแก่น', 'Honda Civic RS (ขาว)',
          'พิมพ์ชนก เดินทาง',  '0820000002', 'occupied', 18000, 18000, 15, 120),
      (3, 'vehicle', 'คค 9012 ขอนแก่น', 'Isuzu D-Max กระบะตอนเดียว',
          'สมพงษ์ ขนของ',      '0820000003', 'occupied', 15000, 15000, 5, 20),
      (4, 'vehicle', 'งง 3456 ขอนแก่น', 'Toyota Hiace รถตู้ 12 ที่นั่ง',
          'บริษัท ทัวร์ดี จำกัด', '0820000004', 'occupied', 32000, 32000, 1, 300),
      (5, 'vehicle', 'จจ 7890 ขอนแก่น', 'Yamaha NMAX 155 (น้ำเงิน)',
          'ว่าง',              null,         'vacant',   3500, 0, 5, 0),

      -- ── อุปกรณ์/อื่นๆ (itemLabel = รายการ, ไม่มี subLabel ในฟอร์ม) ──
      (6, 'other', 'กล้อง Sony A7 IV + เลนส์ 24-70mm', 'ชุดถ่ายวิดีโอ',
          'สตูดิโอ ภาพสวย',    '0830000006', 'occupied', 8500, 20000, 5, 60),
      (7, 'other', 'เครื่องจักร CNC-01 (Haas VF-2)', 'เครื่องกัดโลหะ',
          'โรงกลึงพี่ชาย',      '0830000007', 'occupied', 45000, 90000, 10, 250),
      (8, 'other', 'นั่งร้าน 200 ชุด + ผ้าคลุม', 'อุปกรณ์ก่อสร้าง',
          'รับเหมาก่อสร้างไทย',  '0830000008', 'occupied', 12000, 24000, 20, 90),
      (9, 'other', 'เต็นท์ + โต๊ะเก้าอี้ 300 ที่', 'อุปกรณ์จัดงาน',
          'ร้านจัดเลี้ยงสมหวัง', '0830000009', 'occupied', 6000, 10000, 15, 12),
      (10, 'other', 'เครื่องเสียง JBL + ไฟเวที', 'ชุดเครื่องเสียงงานอีเวนต์',
          'ว่าง',              null,          'vacant',   9000, 0, 5, 0)
    ) as s(i, biz, item, sub, cust, phone, status, amount, deposit, due, lease_left);

    raise notice 'เพิ่มยานพาหนะ 5 + อุปกรณ์ 5 รายการ';
  else
    raise notice 'เดโม่มี vehicle/other อยู่แล้ว % รายการ — ข้าม', v_n;
  end if;

  -- ── 2) บิล 6 เดือนของ vehicle/other ─────────────────────────
  -- ไม่มีค่าน้ำไฟ → water_units/elec_units = 0, total = base เท่านั้น
  select count(*) into v_n
    from public.transactions t
    join public.rentals r on r.id = t.rental_id
   where r.landlord_id = v_admin
     and r.biz_type in ('vehicle', 'other');

  if v_n = 0 then
    insert into public.transactions (
      landlord_id, rental_id, period, base_amount,
      water_units, water_cost, elec_units, elec_cost,
      total_amount, status, secure_token, paid_amount, created_at
    )
    select
      v_admin,
      o.id,
      to_char(mo.month_start, 'YYYY-MM'),
      o.amount,
      0, 0, 0, 0,                       -- ไม่มีค่าน้ำไฟ
      o.amount,                          -- ยอดรวม = ค่าเช่าเท่านั้น
      case
        when gs.offs >= 3 then 'paid'
        when gs.offs = 2 and o.seq % 3 = 0 then 'unpaid'
        when gs.offs = 1 and o.seq % 4 = 1 then 'pending_review'
        when gs.offs = 0 and o.seq % 3 = 1 then 'unpaid'
        else 'paid'
      end,
      md5(o.id::text || gs.offs::text || 'demovehicle')::uuid,
      case when gs.offs = 1 and o.seq % 4 = 1 then o.amount end,
      case
        when gs.offs = 0 then now() - interval '2 days'
        else mo.month_start + ((o.seq % 18) * interval '1 day')
      end
    from (
      select id, amount, row_number() over (order by biz_type, item_details) as seq
        from public.rentals
       where landlord_id = v_admin
         and biz_type in ('vehicle', 'other')
         and lower(coalesce(room_status, '')) = 'occupied'
    ) o
    cross join generate_series(0, 5) as gs(offs)
    cross join lateral (
      select (date_trunc('month', current_date) - ((5 - gs.offs) * interval '1 month')) as month_start
    ) mo
    on conflict do nothing;

    raise notice 'เพิ่มบิลของ vehicle/other';
  else
    raise notice 'มีบิล vehicle/other อยู่แล้ว % ใบ — ข้าม', v_n;
  end if;

  -- ── 3) รายจ่ายที่เกี่ยวกับรถ/อุปกรณ์ ────────────────────────
  -- ให้หน้ากำไรสุทธิ์สะท้อนว่าธุรกิจเช่ารถมีต้นทุนของตัวเอง
  select count(*) into v_n
    from public.expenses
   where landlord_id = v_admin
     and description like '%[ยานพาหนะ]%';

  if v_n = 0 then
    insert into public.expenses (landlord_id, category_id, rental_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    select v_admin,
           (select id from public.expense_categories
             where landlord_id = v_admin and name = 'ค่าซ่อมแซม' limit 1),
           (select id from public.rentals
             where landlord_id = v_admin and item_details = s.item limit 1),
           s.d, s.descr, s.amt, s.vendor, s.ref, s.pm, s.note
      from (values
        ('กก 1234 ขอนแก่น', (current_date - 7),  '[ยานพาหนะ] เปลี่ยนถ่ายน้ำมันเครื่อง + กรอง Fortuner', 3200, 'ศูนย์บริการโตโยต้า', 'TY-8821', 'transfer', 'ครบ 20,000 กม.'),
        ('ขข 5678 ขอนแก่น', (current_date - 22), '[ยานพาหนะ] เปลี่ยนยาง 4 เส้น Civic', 16800, 'ร้านยางพี่โต', 'TR-442', 'credit_card', 'Michelin ประกัน 2 ปี'),
        ('คค 9012 ขอนแก่น', (current_date - 35), '[ยานพาหนะ] ซ่อมช่วงล่าง + โช้คอัพ D-Max', 8500, 'อู่ช่างหนึ่ง', null, 'cash', null),
        ('งง 3456 ขอนแก่น', (current_date - 50), '[ยานพาหนะ] ต่อ พ.ร.บ. + ประกันชั้น 1 รถตู้', 24000, 'วิริยะประกันภัย', 'INS-9931', 'transfer', 'คุ้มครองถึง ก.ย. 2570'),
        ('เครื่องจักร CNC-01 (Haas VF-2)', (current_date - 14), '[อุปกรณ์] ตรวจเช็คระบบ + เปลี่ยนดอกกัด CNC', 18500, 'บ.แมชชีนโปร', 'MP-1102', 'transfer', 'สัญญาบำรุงรักษารายปี'),
        ('กล้อง Sony A7 IV + เลนส์ 24-70mm', (current_date - 28), '[อุปกรณ์] ทำความสะอาดเซนเซอร์ + คาลิเบรตเลนส์', 2500, 'ศูนย์ Sony', null, 'cash', null)
      ) as s(item, d, descr, amt, vendor, ref, pm, note);

    -- ค่าใช้จ่ายรวมที่ไม่ผูกรายการเดียว
    insert into public.expenses (landlord_id, category_id, expense_date, description, amount, vendor_name, reference_no, payment_method, notes)
    values
      (v_admin,
       (select id from public.expense_categories where landlord_id = v_admin and name like 'ภาษี%' limit 1),
       (current_date - 60), '[ยานพาหนะ] ต่อภาษีรถประจำปี 5 คัน', 12400, 'กรมการขนส่งทางบก', 'DLT-2569', 'transfer', null),
      (v_admin,
       (select id from public.expense_categories where landlord_id = v_admin and name = 'ค่าทำความสะอาด' limit 1),
       (current_date - 3), '[ยานพาหนะ] ล้าง+ดูดฝุ่นรถทุกคันก่อนส่งมอบ', 1500, 'คาร์แคร์ริมถนน', null, 'cash', null);

    raise notice 'เพิ่มรายจ่ายของ vehicle/other';
  else
    raise notice 'มีรายจ่าย vehicle/other อยู่แล้ว — ข้าม';
  end if;

  -- ── 4) รายรับอื่นที่เกี่ยวกับรถ/อุปกรณ์ ─────────────────────
  select count(*) into v_n
    from public.other_income
   where landlord_id = v_admin
     and description like '%[ยานพาหนะ]%';

  if v_n = 0 then
    insert into public.other_income (landlord_id, rental_id, income_date, description, amount, source, notes)
    select v_admin,
           (select id from public.rentals where landlord_id = v_admin and item_details = s.item limit 1),
           s.d, s.descr, s.amt, s.src, s.note
      from (values
        ('กก 1234 ขอนแก่น', (current_date - 9),  '[ยานพาหนะ] ค่าคืนรถเกินเวลา 4 ชม.', 1200, 'ค่าปรับ', 'คิดชั่วโมงละ 300'),
        ('ขข 5678 ขอนแก่น', (current_date - 24), '[ยานพาหนะ] ค่าน้ำมันไม่เต็มถังตอนคืนรถ', 900, 'ค่าปรับ', null),
        ('เต็นท์ + โต๊ะเก้าอี้ 300 ที่', (current_date - 11), '[อุปกรณ์] ค่าขนส่ง+ติดตั้งนอกพื้นที่', 3500, 'บริการเสริม', 'งานนอกเมือง 40 กม.'),
        ('นั่งร้าน 200 ชุด + ผ้าคลุม', (current_date - 38), '[อุปกรณ์] ค่าเสียหาย นั่งร้านงอ 6 ชุด', 4800, 'ค่าเสียหาย', 'หักจากมัดจำ')
      ) as s(item, d, descr, amt, src, note);

    raise notice 'เพิ่มรายรับอื่นของ vehicle/other';
  else
    raise notice 'มีรายรับอื่น vehicle/other อยู่แล้ว — ข้าม';
  end if;

  -- ── 5) แจ้งซ่อมของรถ/อุปกรณ์ ────────────────────────────────
  select count(*) into v_n
    from public.repair_tickets rt
    join public.rentals r on r.id = rt.rental_id
   where r.landlord_id = v_admin
     and r.biz_type in ('vehicle', 'other');

  if v_n = 0 then
    insert into public.repair_tickets (rental_id, description, status, created_at, done_at)
    select (select id from public.rentals where landlord_id = v_admin and item_details = s.item limit 1),
           s.descr, s.st, s.created, s.done
      from (values
        ('กก 1234 ขอนแก่น', 'แอร์รถไม่เย็น เปิดสุดแล้วยังร้อน สงสัยน้ำยาหมด', 'open', now() - interval '8 hours', null::timestamptz),
        ('คค 9012 ขอนแก่น', 'ไฟท้ายด้านซ้ายไม่ติด', 'open', now() - interval '3 days', null),
        ('เครื่องจักร CNC-01 (Haas VF-2)', 'เครื่องมีเสียงดังผิดปกติตอนกัดชิ้นงานหนา', 'in_progress', now() - interval '5 days', null),
        ('งง 3456 ขอนแก่น', 'ประตูเลื่อนรถตู้ฝืด เปิดยาก', 'done', now() - interval '18 days', now() - interval '16 days'),
        ('กล้อง Sony A7 IV + เลนส์ 24-70mm', 'จอหลังมีรอยขีดข่วน ผู้เช่าแจ้งก่อนคืน', 'done', now() - interval '30 days', now() - interval '28 days')
      ) as s(item, descr, st, created, done);

    raise notice 'เพิ่มแจ้งซ่อมของ vehicle/other';
  else
    raise notice 'มีแจ้งซ่อม vehicle/other อยู่แล้ว — ข้าม';
  end if;

  raise notice '── เพิ่มสินทรัพย์ 3 ประเภทให้เดโม่เสร็จ ──';
end;
$$;

-- ── ตรวจว่าครบทั้ง 3 ประเภท + ไม่มีค่าน้ำไฟติดมากับรถ/อุปกรณ์ ────
do $$
declare
  v_admin uuid;
  v_prop int; v_veh int; v_oth int;
  v_bad_utility int;
  v_tx_null int;
begin
  select id into v_admin from public.admins where email = 'demo@payrentpro.app' limit 1;

  select count(*) into v_prop from public.rentals where landlord_id = v_admin and biz_type = 'property';
  select count(*) into v_veh  from public.rentals where landlord_id = v_admin and biz_type = 'vehicle';
  select count(*) into v_oth  from public.rentals where landlord_id = v_admin and biz_type = 'other';

  if v_veh = 0 or v_oth = 0 then
    raise exception 'สินทรัพย์ไม่ครบ 3 ประเภท (property=% vehicle=% other=%)', v_prop, v_veh, v_oth;
  end if;

  -- vehicle/other ต้องไม่มีค่าน้ำไฟ ไม่งั้นบิลจะคิดค่าน้ำไฟให้รถ
  select count(*) into v_bad_utility
    from public.rentals
   where landlord_id = v_admin
     and biz_type in ('vehicle', 'other')
     and (utility_enabled is true
       or coalesce(water_rate, 0) <> 0
       or coalesce(elec_rate, 0) <> 0);

  if v_bad_utility > 0 then
    raise exception '% รายการของ vehicle/other ยังมีค่าน้ำไฟติดอยู่', v_bad_utility;
  end if;

  -- บิลต้องมี landlord_id ไม่งั้น RLS ซ่อน (ดู D22)
  select count(*) into v_tx_null
    from public.transactions t
    join public.rentals r on r.id = t.rental_id
   where r.landlord_id = v_admin
     and t.landlord_id is null;

  if v_tx_null > 0 then
    raise exception '% ใบยังไม่มี landlord_id จะถูก RLS ซ่อน', v_tx_null;
  end if;

  raise notice 'ครบ 3 ประเภท: อสังหา=% ยานพาหนะ=% อุปกรณ์=%', v_prop, v_veh, v_oth;
end;
$$;
