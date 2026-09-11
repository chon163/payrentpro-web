// โดเมนของ "สินทรัพย์" — ค่าคงที่ประเภท + ตัวช่วยแปลงฟอร์มเป็น payload ของตาราง rentals
//
// เหตุที่แยกออกจาก App.jsx: หลังแยกการเพิ่มข้อมูลเป็น 2 โหมด (เพิ่มสินทรัพย์ /
// เพิ่มผู้เช่า) ทั้งสอง modal เขียนลง `rentals` ตารางเดียวกัน ถ้าปล่อยให้แต่ละ
// modal ประกอบ payload เองจะเกิดสองสำนักที่เขียนคอลัมน์ไม่ตรงกัน — รวมไว้ที่นี่
// ที่เดียว แก้กฎครั้งเดียวมีผลทั้งสองโหมด
//
// สำคัญ: ไฟล์นี้ไม่แตะ schema — ใช้คอลัมน์เดิมของ rentals ทั้งหมด
// "ข้อมูลห้อง" = biz_type, sub_label, item_details, amount, cycle, due_date,
//                deposit_amount, penalty_*, chase_*, utility_*, มิเตอร์, binding_code
// "ข้อมูลผู้เช่า" = cust_name, tenant_phone, tenant_id_card, emergency_contact,
//                   move_in_date, lease_end_date, group_id

export const BIZ_TYPES = [
  {
    value: 'property',
    label: 'อสังหาริมทรัพย์',
    tab: 'อสังหา',
    icon: '🏠',
    examples: 'หอพัก/ห้องเช่า',
    itemLabel: 'ห้อง',
    placeholder: 'เช่น 101',
    subLabel: 'ชื่อโครงการ/หมู่บ้าน',
    subPlaceholder: 'เช่น บ้านสวย, คอนโด XYZ',
    amountPlaceholder: 'เช่น 3,500',
  },
  {
    value: 'vehicle',
    label: 'ยานพาหนะ',
    tab: 'ยานพาหนะ',
    icon: '🚗',
    examples: 'รถเช่า/แท็กซี่',
    itemLabel: 'ทะเบียนรถ',
    placeholder: 'กก 1234',
    subLabel: 'ยี่ห้อรถ',
    subPlaceholder: 'เช่น Fortuner, Civic',
    amountPlaceholder: 'เช่น 1,200',
  },
  {
    value: 'other',
    label: 'อุปกรณ์/อื่นๆ',
    tab: 'อุปกรณ์/อื่นๆ',
    icon: '🛠️',
    examples: 'เครื่องจักร/กล้อง/บริการรายเดือน',
    itemLabel: 'รายการ',
    placeholder: 'เช่น กล้อง Sony A7, เครื่องจักร CNC-01',
    amountPlaceholder: 'เช่น 800',
  },
]

export const CYCLE_LABELS = {
  monthly: 'รายเดือน',
  weekly: 'รายสัปดาห์',
  daily: 'รายวัน',
}

// ชื่อผู้เช่าที่ใช้แทน "ยังไม่มีผู้เช่า" — ตรงกับที่ seed ใน supabase/migrations ใช้
// (คอลัมน์ cust_name ของข้อมูลเดิมไม่เคยเป็น null จึงไม่เปลี่ยนธรรมเนียมนี้)
export const VACANT_CUST_NAME = 'ว่าง'

// แปลง biz_type จากทุกฟอร์แมต (ค่าใหม่ property/vehicle/other หรือค่าไทยเดิมสมัยแรก) ให้เป็นค่ามาตรฐาน
export function normalizeBizType(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'vehicle' || raw.includes('ยานพาหนะ')) return 'vehicle'
  if (raw === 'other' || raw.includes('อุปกรณ์')) return 'other'
  return 'property'
}

export function bizTypeMeta(value) {
  const key = normalizeBizType(value)
  return BIZ_TYPES.find((t) => t.value === key) || BIZ_TYPES[0]
}

export function generateBindingCode() {
  return String(Math.floor(100000000 + Math.random() * 900000000))
}

export function isVacant(rental) {
  return String(rental?.room_status ?? '').toLowerCase() === 'vacant'
}

export function isOccupied(rental) {
  return String(rental?.room_status ?? '').toLowerCase() === 'occupied'
}

// นับตามสถานะสำหรับการ์ดสรุป "ทั้งหมด N / ว่าง M / มีผู้เช่า K"
// (สถานะอื่น เช่น maintenance นับรวมใน total แต่ไม่นับเป็นว่าง/มีผู้เช่า)
export function countByStatus(rentals) {
  const rows = Array.isArray(rentals) ? rentals : []
  let vacant = 0
  let occupied = 0
  for (const r of rows) {
    if (isVacant(r)) vacant += 1
    else if (isOccupied(r)) occupied += 1
  }
  return { total: rows.length, vacant, occupied, other: rows.length - vacant - occupied }
}

// ── โหมด 1: ฟอร์ม "เพิ่มสินทรัพย์" — เฉพาะข้อมูลของห้อง ไม่มีฟิลด์ผู้เช่าเลย ──
export const ASSET_FORM_EMPTY = {
  biz_type: '',
  sub_label: '',
  item_details: '',
  amount: '',
  cycle: 'monthly',
  due_date: '',
  deposit_amount: '',
  penalty_enabled: true,
  penalty_per_day: '',
  penalty_stop: false,
  chase_frequency: 3,
  utility_enabled: true,
  water_rate: '',
  last_water_meter: '',
  elec_rate: '',
  last_elec_meter: '',
}

// ── โหมด 2: ฟอร์ม "เพิ่มผู้เช่า" — เฉพาะข้อมูลคน ไม่มีฟิลด์ของห้องเลย ──
export const TENANT_FORM_EMPTY = {
  cust_name: '',
  tenant_phone: '',
  tenant_id_card: '',
  emergency_contact: '',
  move_in_date: '',
  lease_end_date: '',
  deposit_amount: '',
}

const num = (v) => Number(v) || 0
const text = (v) => String(v ?? '').trim()
const textOrNull = (v) => text(v) || null

// insert แถวใหม่: ห้องว่างพร้อมรับผู้เช่า — ฟิลด์ผู้เช่าทุกตัวเป็น null ตั้งแต่ต้น
export function buildAssetInsert(form, landlordId) {
  const bizType = normalizeBizType(form.biz_type)
  const isProperty = bizType === 'property'
  return {
    landlord_id: landlordId,
    biz_type: bizType,
    sub_label: textOrNull(form.sub_label),
    item_details: text(form.item_details),
    amount: num(form.amount),
    cycle: form.cycle || 'monthly',
    due_date: num(form.due_date) || 1,
    deposit_amount: num(form.deposit_amount),
    penalty_enabled: Boolean(form.penalty_enabled),
    penalty_per_day: form.penalty_enabled ? num(form.penalty_per_day) : 0,
    chase_frequency: num(form.chase_frequency) || 3,
    // stop_chase ในฐานข้อมูลเป็นสวิตช์ 0/1 (RPC ทวงหนี้เช็ค `coalesce(stop_chase,0) = 0`)
    // ไม่ใช่จำนวนวัน — จึงผูกกับ toggle ตัวเดียว ไม่ใช่ช่องกรอกเลข
    stop_chase: form.penalty_stop ? 1 : 0,
    credit_balance: 0,
    // ค่าน้ำไฟมีเฉพาะอสังหา — vehicle/other บังคับ 0 กันข้อมูลค้างจากฟอร์ม
    utility_enabled: isProperty ? Boolean(form.utility_enabled) : false,
    water_rate: isProperty ? num(form.water_rate) : 0,
    last_water_meter: isProperty ? num(form.last_water_meter) : 0,
    elec_rate: isProperty ? num(form.elec_rate) : 0,
    last_elec_meter: isProperty ? num(form.last_elec_meter) : 0,
    binding_code: generateBindingCode(),
    // ── ห้องว่าง: ไม่มีผู้เช่า ──
    room_status: 'vacant',
    cust_name: VACANT_CUST_NAME,
    tenant_phone: null,
    tenant_id_card: null,
    emergency_contact: null,
    move_in_date: null,
    lease_end_date: null,
  }
}

// update แถวเดิมให้มีผู้เช่า — ไม่แตะข้อมูลห้อง/ค่าปรับ/มิเตอร์แม้แต่คอลัมน์เดียว
// (deposit_amount แตะได้ เพราะเป็น "เงินมัดจำที่เก็บจริงจากผู้เช่ารายนี้"
//  ตั้งต้นด้วยค่าประกันของห้องแล้วให้เจ้าของแก้เป็นยอดที่เก็บได้จริง)
export function buildTenantUpdate(form) {
  return {
    room_status: 'occupied',
    cust_name: text(form.cust_name),
    tenant_phone: textOrNull(form.tenant_phone),
    tenant_id_card: textOrNull(form.tenant_id_card),
    emergency_contact: textOrNull(form.emergency_contact),
    move_in_date: form.move_in_date || null,
    lease_end_date: form.lease_end_date || null,
    deposit_amount: num(form.deposit_amount),
  }
}

// ผู้เช่าย้ายออก: ล้างเฉพาะฟิลด์คน ข้อมูลห้อง/ค่าเช่า/ค่าปรับ/มิเตอร์ คงเดิมทุกตัว
// group_id ถูกล้างและ binding_code ออกใหม่ด้วย — กลุ่ม LINE ของผู้เช่าเก่าต้อง
// ไม่ได้รับบิลของผู้เช่าคนถัดไป และรหัสเดิมต้องใช้ผูกซ้ำไม่ได้
export function buildMoveOutPatch() {
  return {
    room_status: 'vacant',
    cust_name: VACANT_CUST_NAME,
    tenant_phone: null,
    tenant_id_card: null,
    emergency_contact: null,
    move_in_date: null,
    lease_end_date: null,
    group_id: null,
    binding_code: generateBindingCode(),
  }
}

// สรุปสัญญาเก่าเก็บลงตาราง notes (audit_logs ใช้ไม่ได้ — คอลัมน์ transaction_id
// เป็น NOT NULL อ้าง transactions การย้ายออกไม่มีบิลผูก) เพื่อให้ย้อนดูได้ว่า
// ห้องนี้เคยมีใครเช่า ช่วงไหน คืนเงินประกันเท่าไร
export function buildMoveOutNote(rental, { repairCost = 0, refund = 0, assetName = '' } = {}) {
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
  const fmtBaht = (v) => `${(Number(v) || 0).toLocaleString('th-TH')} บาท`
  const lines = [
    `ผู้เช่า: ${rental?.cust_name || '—'}`,
    `เบอร์โทร: ${rental?.tenant_phone || '—'}`,
    `ผู้ติดต่อฉุกเฉิน: ${rental?.emergency_contact || '—'}`,
    `วันเข้าอยู่: ${fmtDate(rental?.move_in_date)}`,
    `วันสิ้นสุดสัญญา: ${fmtDate(rental?.lease_end_date)}`,
    `เงินมัดจำ: ${fmtBaht(rental?.deposit_amount)}`,
    `หักค่าเสียหาย/ค่าซ่อม: ${fmtBaht(repairCost)}`,
    `คืนเงินประกัน: ${fmtBaht(refund)}`,
    `วันที่ย้ายออก: ${fmtDate(new Date())}`,
  ]
  return {
    title: `ประวัติผู้เช่า — ${assetName || rental?.item_details || 'สินทรัพย์'}`,
    content: lines.join('\n'),
    // เทาอ่อน — เป็นบันทึกอ้างอิง ไม่ใช่โน้ตที่ต้องทำอะไรต่อ
    color: '#f1f5f9',
    pinned: false,
  }
}
