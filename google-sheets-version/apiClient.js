const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * เรียก Google Apps Script API (Web App)
 * ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight
 * เพราะ Apps Script ไม่รองรับ OPTIONS request
 */
async function call(action, payload = {}) {
  if (!API_URL) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_API_URL (URL ของ Google Apps Script Web App)')
  }

  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch (err) {
    throw new Error('ไม่สามารถเชื่อมต่อ Google Apps Script ได้: ' + (err?.message || err))
  }

  const json = await res.json().catch(() => null)
  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || `API error (HTTP ${res.status})`)
  }
  return json.data
}

export const api = {
  // อ่าน
  getRentals: () => call('get_rentals'),
  getTransactions: (filters = {}) => call('get_transactions', filters),
  getAdmins: () => call('get_admins'),
  getAuditLogs: () => call('get_audit_logs'),

  // เขียน
  saveAdmin: (payload) => call('save_admin', { ...payload }),
  insertRental: (payload) => call('insert_rental', { ...payload }),
  updateRental: (id, payload) => call('update_rental', { id, payload }),
  deleteRental: (id) => call('delete_rental', { id }),
  insertTransaction: (payload) => call('insert_transaction', { ...payload }),
  updateTransaction: (id, payload) => call('update_transaction', { id, payload }),

  // LINE
  sendLineBill: (payload) => call('send_line_bill', { ...payload }),
  sendChase: () => call('send_chase'),
}

export default api
