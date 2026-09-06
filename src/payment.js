// รหัสธนาคารสำหรับพร้อมเพย์/โอนเงิน (รหัสมาตรฐานธนาคารแห่งประเทศไทย)
// เรียงตามรหัส — ครอบคลุมธนาคารที่ร่วมระบบพร้อมเพย์ที่เปิดรับลูกค้าทั่วไป
export const BANKS = [
  { code: '002', short: 'BBL', name: 'กรุงเทพ' },
  { code: '004', short: 'KBANK', name: 'กสิกรไทย' },
  { code: '006', short: 'KTB', name: 'กรุงไทย' },
  { code: '008', short: 'BAAC', name: 'เพื่อการเกษตรและสหกรรมการเกษตร' },
  { code: '011', short: 'TTB', name: 'ทหารไทยธนชาติ' },
  { code: '014', short: 'SCB', name: 'ไทยพาณิชย์' },
  { code: '015', short: 'TCRB', name: 'ไทยเครดิต เพื่อรายย่อย' },
  { code: '017', short: 'CIMBT', name: 'ซีไอเอ็มบี ไทย' },
  { code: '021', short: 'KKP', name: 'เกียรตินาคินภัทร' },
  { code: '024', short: 'TCD', name: 'ธนชาติ (สำหรับบัญชีเดิม)' },
  { code: '025', short: 'BAY', name: 'กรุงศรีอยุธยา' },
  { code: '030', short: 'UOB', name: 'ยูโอบี' },
  { code: '033', short: 'GHB', name: 'อาคารสงเคราะห์' },
  { code: '034', short: 'GSB', name: 'ออมสิน' },
  { code: '053', short: 'MTC', name: 'เมืองไทย' },
  { code: '081', short: 'LHB', name: 'แลนด์ แอนด์ เฮาส์' },
]

export function bankName(code) {
  const found = BANKS.find((b) => b.code === code)
  return found ? `ธนาคาร${found.name}` : code || 'ไม่ระบุ'
}
