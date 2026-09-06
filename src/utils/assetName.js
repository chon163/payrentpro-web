// ชื่อสินทรัพย์ที่ใช้แสดงผลทุกจุด: ถ้ามี sub_label ให้แสดง "sub_label · item_details"
// (เช่น "บ้านสวย · 101", "Fortuner · กก 1234") ถ้าไม่มี sub_label แสดง item_details เดี่ยวตามเดิม
export function displayAssetName(rental, fallback = 'ไม่ระบุ') {
  const sub = String(rental?.sub_label ?? '').trim()
  const item = String(rental?.item_details ?? '').trim()
  if (sub && item) return `${sub} · ${item}`
  return item || sub || fallback
}
