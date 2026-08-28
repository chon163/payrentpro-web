export const BANKS = [
  { code: '014', short: 'SCB', name: 'ไทยพาณิชย์' },
  { code: '004', short: 'KBANK', name: 'กสิกรไทย' },
  { code: '002', short: 'BBL', name: 'กรุงเทพ' },
  { code: '006', short: 'KTB', name: 'กรุงไทย' },
  { code: '025', short: 'BAY', name: 'กรุงศรีอยุธยา' },
]

export function bankName(code) {
  const found = BANKS.find((b) => b.code === code)
  return found ? `ธนาคาร${found.name}` : code || 'ไม่ระบุ'
}
