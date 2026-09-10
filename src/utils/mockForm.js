// ข้อมูลจำลองสำหรับกรอกฟอร์มเร็วตอนทดสอบ — แยกออกจาก asset.js เพราะเป็นเพียง
// dev tool ไม่ใช่โดเมนจริง, และแยกจาก App.jsx เพราะทั้ง AddAssetModal และ
// AddTenantModal ต้องการใช้ร่วมกัน (ไม่ให้สองที่ gen mock คนละแบบ)

const MOCK_FIRST_NAMES = ['สมชาย', 'สมหญิง', 'วีรชน', 'อารยา', 'ธนกร', 'กิตติ', 'ณัฐวุฒิ', 'ปิยะ', 'ศิริพร', 'วัชรพล', 'จิราพร', 'อนุชา', 'พรทิพย์', 'สุชาติ', 'รัตนา']
const MOCK_LAST_NAMES = ['ใจดี', 'รุ่งเรือง', 'วงศ์สุวรรณ', 'ศรีสุข', 'มั่นคง', 'ไทยแท้', 'บุญมี', 'แก้วใส', 'ทองคำ', 'พันธ์ดี']

function mockThaiId() {
  let id = String(Math.floor(Math.random() * 9) + 1)
  for (let i = 0; i < 12; i++) id += Math.floor(Math.random() * 10)
  return id
}

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const phone = () => `08${randInt(10000000, 99999999)}`
const pad = (n) => String(n).padStart(2, '0')
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// โหมด 1: ข้อมูลห้อง — กดเลือกประเภทแล้วเติมตัวอย่างให้ครบทุกช่อง (พฤติกรรมเดิม)
export function buildMockAssetForm(bizType) {
  const items = {
    property: ['101', '202', '401', 'C-1205', 'A-05'],
    vehicle: ['กก 1234', 'ทส 5678', '1กข 3456', '70-8899'],
    other: ['กล้อง Sony A7', 'เครื่องจักร CNC-01', 'โดรน DJI Mavic', 'เครื่องเสียงงานแต่ง'],
  }
  const subLabels = {
    property: ['บ้านสวย', 'คอนโดมินิมัล', 'หอพักฟ้าใส', 'บ้านวิลล่ากรีน'],
    vehicle: ['Fortuner', 'Honda Civic', 'Toyota Vios', 'Isuzu D-Max'],
    other: [],
  }
  const amount = bizType === 'property' ? randInt(3000, 15000) : bizType === 'vehicle' ? randInt(800, 5000) : randInt(500, 3000)
  const isProperty = bizType === 'property'

  return {
    biz_type: bizType,
    sub_label: subLabels[bizType].length ? pick(subLabels[bizType]) : '',
    item_details: pick(items[bizType]),
    amount: String(amount),
    cycle: pick(['monthly', 'monthly', 'monthly', 'weekly', 'daily']),
    due_date: String(randInt(1, 28)),
    deposit_amount: String(amount),
    penalty_enabled: true,
    penalty_per_day: String(50 + randInt(0, 5) * 10),
    penalty_stop: false,
    chase_frequency: pick([3, 7]),
    utility_enabled: isProperty,
    water_rate: isProperty ? '18' : '0',
    last_water_meter: isProperty ? String(randInt(0, 500)) : '0',
    elec_rate: isProperty ? '5' : '0',
    last_elec_meter: isProperty ? String(randInt(0, 5000)) : '0',
  }
}

// โหมด 2: ข้อมูลผู้เช่า — กดปุ่ม "เติมตัวอย่าง" ตรงฟุตเตอร์แล้วเติมให้ครบ
// (วันที่สัญญาสุ่มไว้ในอดีต +1 ปี ให้เหมือนจริง ไม่ใช่เริ่มวันนี้)
export function buildMockTenantForm() {
  const now = new Date()
  const moveIn = new Date(now)
  moveIn.setDate(moveIn.getDate() - randInt(0, 365))
  const leaseEnd = new Date(moveIn)
  leaseEnd.setFullYear(leaseEnd.getFullYear() + 1)

  return {
    cust_name: `${pick(MOCK_FIRST_NAMES)} ${pick(MOCK_LAST_NAMES)}`,
    tenant_phone: phone(),
    tenant_id_card: mockThaiId(),
    emergency_contact: phone(),
    move_in_date: localDate(moveIn),
    lease_end_date: localDate(leaseEnd),
    deposit_amount: String(randInt(3000, 8000)),
  }
}
