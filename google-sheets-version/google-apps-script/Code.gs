/***************************************************************
 * PayRentPro — Google Apps Script Backend
 * -------------------------------------------------------------
 * ทำหน้าที่เป็น API สำหรับ React (ผ่าน doGet/doPost) และรับ Webhook
 * จาก LINE Messaging API เพื่อเก็บสลิปโอนเงินลง Google Drive
 * แล้วอัปเดต URL สลิป + สถานะ pending_review ลง Google Sheets
 *
 * ตาราง Google Sheets ที่ใช้:
 *   Rentals       = ข้อมูลสัญญาเช่า / สินทรัพย์
 *   Transactions  = บิล / รายการเก็บเงิน
 *   Admins        = ข้อมูลบัญชีรับเงิน (PromptPay / Bank)
 *   AuditLogs     = (ทางเลือก) ประวัติการแก้ไข
 *
 * วิธี Deploy:
 *   1) สร้าง Spreadsheet ใหม่ → เมนู Extensions → Apps Script
 *   2) วางโค้ดนี้ลงใน Code.gs
 *   3) ตั้งค่า CONFIG ด้านล่าง (Spreadsheet ID + LINE token)
 *   4) Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   5) นำ Web App URL ไปใส่ใน .env ของ React เป็น VITE_API_URL
 ***************************************************************/

const CONFIG = {
  // ใส่ Spreadsheet ID (ส่วนระหว่าง /d/ กับ /edit ใน URL) ถ้าว่างจะใช้
  // Spreadsheet ที่ผูกกับสคริปต์นี้ (bound script)
  SPREADSHEET_ID: '',

  // LINE Messaging API (https://developers.line.biz/console/)
  LINE_CHANNEL_ACCESS_TOKEN: '',
  LINE_CHANNEL_SECRET: '',

  // ใช้สร้างลิงก์บิลในข้อความ LINE (เปลี่ยนเป็นโดเมนจริงของเว็บ)
  BILL_BASE_URL: 'http://localhost:5173/bill',

  // โฟลเดอร์ใน Google Drive ที่เก็บรูปสลิป (สร้างอัตโนมัติถ้าไม่มี)
  SLIP_FOLDER_NAME: 'PayRentPro_Slips',

  // ชื่อ Sheet
  SHEETS: {
    rentals: 'Rentals',
    transactions: 'Transactions',
    admins: 'Admins',
    auditLogs: 'AuditLogs',
  },
};

// คอลัมน์ (header) ของแต่ละตาราง — ต้องตรงกับข้อมูลที่ React ส่ง/อ่าน
const HEADERS = {
  rentals: [
    'id', 'biz_type', 'cust_name', 'tenant_phone', 'tenant_id_card',
    'emergency_contact', 'item_details', 'room_status', 'amount', 'cycle',
    'due_date', 'penalty_per_day', 'penalty_enabled', 'chase_frequency',
    'stop_chase', 'credit_balance', 'deposit_amount', 'move_in_date',
    'lease_end_date', 'last_water_meter', 'water_rate', 'last_elec_meter',
    'elec_rate', 'utility_enabled', 'binding_code', 'group_id',
  ],
  transactions: [
    'id', 'rental_id', 'period', 'base_amount', 'water_units', 'water_cost',
    'elec_units', 'elec_cost', 'total_amount', 'status', 'secure_token',
    'created_at', 'paid_amount', 'slip_image_url',
  ],
  admins: [
    'id', 'payment_type', 'promptpay_name', 'promptpay', 'bank_code',
    'bank_account', 'email',
  ],
  auditLogs: [
    'id', 'transaction_id', 'old_amount', 'new_amount', 'reason', 'created_at',
  ],
};

// ============================================================
// Entry points
// ============================================================

function doGet(e) {
  return route_(e);
}

function doPost(e) {
  return route_(e);
}

function route_(e) {
  const body = readBody_(e);

  // ตรวจว่าเป็น LINE Webhook หรือไม่ (body มี events)
  if (body && Array.isArray(body.events)) {
    try {
      handleLineWebhook_(body);
    } catch (err) {
      console.error('LINE webhook error:', err);
    }
    // ตอบ 200 ให้ LINE เสมอ เพื่อไม่ให้ LINE retry ซ้ำ
    return json_({ ok: true });
  }

  const action = (body && body.action) || (e && e.parameter && e.parameter.action);
  const data = body || {};

  try {
    switch (action) {
      case 'get_rentals':
        return json_({ ok: true, data: getRentals_() });
      case 'get_transactions':
        return json_({ ok: true, data: getTransactions_(data) });
      case 'get_admins':
        return json_({ ok: true, data: getAdmins_() });
      case 'get_audit_logs':
        return json_({ ok: true, data: getAuditLogs_() });
      case 'save_admin':
        return json_({ ok: true, data: saveAdmin_(data) });
      case 'insert_rental':
        return json_({ ok: true, data: insertRental_(data) });
      case 'update_rental':
        return json_({ ok: true, data: updateRental_(data) });
      case 'delete_rental':
        return json_({ ok: true, data: deleteRental_(data) });
      case 'insert_transaction':
        return json_({ ok: true, data: insertTransaction_(data) });
      case 'update_transaction':
        return json_({ ok: true, data: updateTransaction_(data) });
      case 'send_line_bill':
        return json_({ ok: true, data: sendLineBill_(data) });
      case 'send_chase':
        return json_({ ok: true, data: sendChaseMessages() });
      default:
        return json_({ ok: false, error: 'Unknown action: ' + action }, 400);
    }
  } catch (err) {
    return json_({ ok: false, error: (err && err.message) || String(err) }, 500);
  }
}

function readBody_(e) {
  try {
    if (e && e.postData && e.postData.contents) {
      return JSON.parse(e.postData.contents);
    }
  } catch (err) {
    // ignore parse error
  }
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Sheet helpers
// ============================================================

function ss_() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('กรุณาตั้งค่า CONFIG.SPREADSHEET_ID หรือผูกสคริปต์กับ Spreadsheet');
}

function sheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headers && headers.length && sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRows_(name, headers) {
  const sh = sheet_(name, headers);
  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, idx) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    obj.__row = idx + 2;
    return obj;
  });
}

function appendRow_(name, headers, obj) {
  const sh = sheet_(name, headers);
  const row = headers.map(function (h) {
    const v = obj[h];
    return v === undefined || v === null ? '' : v;
  });
  sh.appendRow(row);
}

function updateRow_(name, headers, obj, matchKey, matchValue) {
  const rows = readRows_(name, headers);
  const idx = rows.findIndex(function (r) { return String(r[matchKey]) === String(matchValue); });
  if (idx === -1) return false;
  const sheetRow = rows[idx].__row;
  const sh = sheet_(name, headers);
  headers.forEach(function (col, i) {
    if (obj[col] !== undefined) sh.getRange(sheetRow, i + 1).setValue(obj[col]);
  });
  return true;
}

function deleteRow_(name, headers, matchKey, matchValue) {
  const rows = readRows_(name, headers);
  const idx = rows.findIndex(function (r) { return String(r[matchKey]) === String(matchValue); });
  if (idx === -1) return false;
  sheet_(name, headers).deleteRow(rows[idx].__row);
  return true;
}

function nextId_(name, headers) {
  const rows = readRows_(name, headers);
  let max = 0;
  rows.forEach(function (r) {
    const n = Number(r.id);
    if (!isNaN(n) && n > max) max = n;
  });
  return String(max + 1);
}

function cleanRow_(row) {
  const out = {};
  Object.keys(row).forEach(function (k) {
    if (k !== '__row') out[k] = row[k];
  });
  return out;
}

// ============================================================
// CRUD
// ============================================================

function getRentals_() {
  return readRows_('rentals', HEADERS.rentals).map(cleanRow_);
}

function getAdmins_() {
  const rows = readRows_('admins', HEADERS.admins);
  return rows.length ? cleanRow_(rows[0]) : null;
}

function getAuditLogs_() {
  try {
    return readRows_('auditLogs', HEADERS.auditLogs).map(cleanRow_);
  } catch (err) {
    return [];
  }
}

function saveAdmin_(data) {
  const payload = {
    payment_type: data.payment_type || 'promptpay',
    promptpay_name: data.promptpay_name || '',
    promptpay: data.promptpay || '',
    bank_code: data.bank_code || '',
    bank_account: data.bank_account || '',
    email: data.email || 'admin@payrentpro.com',
  };
  const existing = getAdmins_();
  if (existing && existing.id) {
    updateRow_('admins', HEADERS.admins, payload, 'id', existing.id);
  } else {
    payload.id = nextId_('admins', HEADERS.admins);
    appendRow_('admins', HEADERS.admins, payload);
  }
  return getAdmins_();
}

function insertRental_(data) {
  const id = nextId_('rentals', HEADERS.rentals);
  const payload = {
    biz_type: data.biz_type || '',
    cust_name: data.cust_name || '',
    tenant_phone: data.tenant_phone || '',
    tenant_id_card: data.tenant_id_card || '',
    emergency_contact: data.emergency_contact || '',
    item_details: data.item_details || '',
    room_status: data.room_status || 'occupied',
    amount: Number(data.amount) || 0,
    cycle: data.cycle || 'monthly',
    due_date: data.due_date || '',
    penalty_per_day: Number(data.penalty_per_day) || 0,
    penalty_enabled: Boolean(data.penalty_enabled),
    chase_frequency: Number(data.chase_frequency) || 3,
    stop_chase: Boolean(data.stop_chase),
    credit_balance: 0,
    deposit_amount: Number(data.deposit_amount) || 0,
    move_in_date: data.move_in_date || '',
    lease_end_date: data.lease_end_date || '',
    last_water_meter: Number(data.last_water_meter) || 0,
    water_rate: Number(data.water_rate) || 0,
    last_elec_meter: Number(data.last_elec_meter) || 0,
    elec_rate: Number(data.elec_rate) || 0,
    utility_enabled: Boolean(data.utility_enabled),
    binding_code: data.binding_code || '',
    group_id: data.group_id || '',
    id: id,
  };
  appendRow_('rentals', HEADERS.rentals, payload);
  return { id: id, binding_code: payload.binding_code, cust_name: payload.cust_name };
}

function updateRental_(data) {
  const id = data.id;
  const payload = data.payload || {};
  if (!id) throw new Error('ต้องส่ง id ของ rental');
  delete payload.id;
  updateRow_('rentals', HEADERS.rentals, payload, 'id', id);
  return { ok: true };
}

function deleteRental_(data) {
  if (!data.id) throw new Error('ต้องส่ง id ของ rental');
  deleteRow_('rentals', HEADERS.rentals, 'id', data.id);
  return { ok: true };
}

function insertTransaction_(data) {
  const id = nextId_('transactions', HEADERS.transactions);
  const payload = {
    rental_id: data.rental_id || '',
    period: data.period || '',
    base_amount: Number(data.base_amount) || 0,
    water_units: Number(data.water_units) || 0,
    water_cost: Number(data.water_cost) || 0,
    elec_units: Number(data.elec_units) || 0,
    elec_cost: Number(data.elec_cost) || 0,
    total_amount: Number(data.total_amount) || 0,
    status: data.status || 'unpaid',
    secure_token: data.secure_token || '',
    created_at: new Date().toISOString(),
    paid_amount: Number(data.paid_amount) || 0,
    slip_image_url: data.slip_image_url || '',
    id: id,
  };
  appendRow_('transactions', HEADERS.transactions, payload);
  return cleanRow_(payload);
}

function updateTransaction_(data) {
  const payload = data.payload || {};
  delete payload.id;
  let matched = false;
  if (data.id) {
    matched = updateRow_('transactions', HEADERS.transactions, payload, 'id', data.id);
  } else if (data.secure_token) {
    matched = updateRow_('transactions', HEADERS.transactions, payload, 'secure_token', data.secure_token);
  }
  if (!matched) throw new Error('ไม่พบรายการ transactions ที่ต้องการอัปเดต');
  return { ok: true };
}

function getTransactions_(data) {
  let rows = readRows_('transactions', HEADERS.transactions);
  const rentals = readRows_('rentals', HEADERS.rentals);
  const rentalMap = {};
  rentals.forEach(function (r) { rentalMap[String(r.id)] = r; });

  rows = rows.map(function (t) {
    const cleaned = cleanRow_(t);
    const r = rentalMap[String(t.rental_id)];
    cleaned.rentals = r ? [{ cust_name: r.cust_name, item_details: r.item_details }] : null;
    return cleaned;
  });

  if (data.status) {
    rows = rows.filter(function (t) { return String(t.status).toLowerCase() === String(data.status).toLowerCase(); });
  }
  if (data.secure_token) {
    rows = rows.filter(function (t) { return String(t.secure_token) === String(data.secure_token); });
  }
  return rows;
}

// ============================================================
// LINE Messaging API
// ============================================================

function getLineToken_() {
  const props = PropertiesService.getScriptProperties();
  const token = CONFIG.LINE_CHANNEL_ACCESS_TOKEN || props.getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
  if (!token) throw new Error('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
  return token;
}

function sendLineBill_(data) {
  const groupId = data.line_group_id || '';
  if (!groupId) throw new Error('ไม่พบ line_group_id ของห้องนี้');
  const total = Number(data.total_amount) || 0;
  const billLink = data.bill_link || '';
  const text = [
    '🏠 PayRentPro แจ้งเรียกเก็บ',
    '━━━━━━━━━━━━━━━',
    '👤 ผู้เช่า: ' + (data.cust_name || '-'),
    '📋 รายการ: ' + (data.item_details || '-'),
    '📅 งวด: ' + (data.period || '-'),
    '💰 ยอดรวม: ฿' + total.toLocaleString('th-TH'),
    '🔗 ดูบิล/ชำระเงิน: ' + billLink,
  ].join('\n');

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + getLineToken_(),
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: text }],
    }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) {
    throw new Error('LINE push failed: ' + code + ' ' + res.getContentText());
  }
  return { sent: true };
}

function handleLineWebhook_(body) {
  const events = body.events || [];
  events.forEach(function (ev) {
    if (ev.type !== 'message' || !ev.message) return;
    const source = ev.source || {};
    const groupId = source.groupId || source.roomId || '';

    if (ev.message.type === 'image') {
      const messageId = ev.message.id;
      if (!messageId || !groupId) return;
      const url = downloadImageToDrive_(messageId);
      if (url) attachSlipToBill_(groupId, url);
    } else if (ev.message.type === 'text' && groupId) {
      const code = String(ev.message.text || '').trim();
      // ผูกกลุ่ม LINE กับ rental ผ่าน binding_code (9 หลัก)
      if (/^\d{9}$/.test(code)) bindLineGroup_(groupId, code, ev.replyToken);
    }
  });
}

function bindLineGroup_(groupId, bindingCode, replyToken) {
  const rentals = readRows_('rentals', HEADERS.rentals);
  const rental = rentals.find(function (r) { return String(r.binding_code) === bindingCode; });
  if (!rental) {
    replyLine_(replyToken, '❌ ไม่พบรหัสผูกนี้ กรุณาตรวจสอบรหัสผูกกลุ่มอีกครั้ง');
    return;
  }
  updateRow_('rentals', HEADERS.rentals, { group_id: groupId }, 'id', rental.id);
  const label = rental.cust_name || rental.item_details || '';
  replyLine_(replyToken, '✅ ผูกกลุ่มสำเร็จแล้ว' + (label ? ' (' + label + ')' : ''));
}

function replyLine_(replyToken, text) {
  if (!replyToken) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + getLineToken_(),
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }],
    }),
    muteHttpExceptions: true,
  });
}

// ============================================================
// Google Drive (เก็บสลิป)
// ============================================================

function getSlipFolder_() {
  const root = DriveApp;
  const folders = root.getFoldersByName(CONFIG.SLIP_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return root.createFolder(CONFIG.SLIP_FOLDER_NAME);
}

function downloadImageToDrive_(messageId) {
  const res = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', {
    method: 'get',
    headers: { Authorization: 'Bearer ' + getLineToken_() },
  });
  const blob = res.getBlob();
  const folder = getSlipFolder_();
  const file = folder.createFile(blob.setName('slip_' + messageId + '.jpg'));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function attachSlipToBill_(groupId, url) {
  const rentals = readRows_('rentals', HEADERS.rentals);
  const rental = rentals.find(function (r) { return String(r.group_id) === String(groupId); });
  if (!rental) return;

  const txs = readRows_('transactions', HEADERS.transactions)
    .filter(function (t) { return String(t.rental_id) === String(rental.id); })
    .sort(function (a, b) {
      const da = new Date(a.created_at);
      const db = new Date(b.created_at);
      return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
    })
    .reverse();

  // เลือกบิลล่าสุดที่ยังไม่ชำระ (ถ้าไม่มี ให้ใช้บิลล่าสุด)
  const target = txs.find(function (t) { return String(t.status).toLowerCase() !== 'paid'; }) || txs[0];
  if (!target) return;

  updateRow_('transactions', HEADERS.transactions, {
    slip_image_url: url,
    status: 'pending_review',
  }, 'id', target.id);
}

// ============================================================
// ระบบทวงเงิน (Chase) — แบบ Manual + แบบตั้งเวลา (Trigger)
// ============================================================

/**
 * ส่งข้อความทวงเงินเข้า LINE ของผู้เช่าทุกคนที่มีบิลสถานะ "unpaid"
 *
 * เรียกใช้งานได้ 2 ทาง:
 *   1) Manual จากเว็บ → action = 'send_chase' (ผ่าน API)
 *   2) ตั้งเวลา (Trigger) → เรียก installDailyChaseTrigger() ครั้งเดียว
 *      เพื่อให้ฟังก์ชันนี้ทำงานอัตโนมัติทุกวัน 08:00 น.
 *
 * @returns {{sent:number, skipped:number, failed:number, details:Array}}
 */
function sendChaseMessages() {
  const txs = readRows_('transactions', HEADERS.transactions).filter(function (t) {
    return String(t.status).toLowerCase() === 'unpaid';
  });
  const rentals = readRows_('rentals', HEADERS.rentals);
  const rentalMap = {};
  rentals.forEach(function (r) { rentalMap[String(r.id)] = r; });

  const result = { sent: 0, skipped: 0, failed: 0, details: [] };
  if (txs.length === 0) return result;

  // ตรวจ token ล่วงหน้า ถ้ายังไม่ตั้งค่า จะ throw ให้เห็น error ชัดเจน
  getLineToken_();

  txs.forEach(function (t) {
    const rental = rentalMap[String(t.rental_id)];
    const groupId = rental ? String(rental.group_id || '') : '';
    if (!groupId) {
      result.skipped += 1;
      result.details.push({ transaction_id: t.id, status: 'skipped', reason: 'ยังไม่ผูก LINE Group' });
      return;
    }
    try {
      pushLineMessage_(groupId, buildChaseText_(t, rental));
      result.sent += 1;
      result.details.push({ transaction_id: t.id, status: 'sent', group_id: groupId });
    } catch (err) {
      result.failed += 1;
      result.details.push({ transaction_id: t.id, status: 'failed', reason: (err && err.message) || String(err) });
    }
  });

  return result;
}

function buildChaseText_(t, rental) {
  const total = Number(t.total_amount ?? t.base_amount ?? 0) || 0;
  const billLink = CONFIG.BILL_BASE_URL + '/' + (t.secure_token || '');
  return [
    '⚠️ PayRentPro แจ้งเตือนค่าเช่า',
    '━━━━━━━━━━━━━━━',
    '👤 ผู้เช่า: ' + ((rental && rental.cust_name) || '-'),
    '📋 รายการ: ' + ((rental && rental.item_details) || '-'),
    '📅 งวด: ' + (t.period || '-'),
    '💰 ยอดค้างชำระ: ฿' + total.toLocaleString('th-TH'),
    'กรุณาชำระเงินตามลิงก์บิลด้านล่าง 🙏',
    '🔗 ' + billLink,
  ].join('\n');
}

function pushLineMessage_(groupId, text) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + getLineToken_(),
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify({
      to: groupId,
      messages: [{ type: 'text', text: text }],
    }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) {
    throw new Error('LINE push failed: ' + code + ' ' + res.getContentText());
  }
  return { sent: true };
}

/**
 * ติดตั้ง Trigger ให้ sendChaseMessages() ทำงานอัตโนมัติทุกวัน 08:00 น.
 * เรียกครั้งเดียวจาก Apps Script Editor (เลือกฟังก์ชันนี้แล้วกด Run)
 *
 * หมายเหตุ: เวลาจะอิงตาม Timezone ของสคริปต์ (ตั้งได้ใน appsscript.json
 *           เช่น "timeZone": "Asia/Bangkok")
 */
function installDailyChaseTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === 'sendChaseMessages') {
      ScriptApp.deleteTrigger(tr);
    }
  });
  ScriptApp.newTrigger('sendChaseMessages')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  return 'ติดตั้ง Trigger สำเร็จ: sendChaseMessages ทุกวัน 08:00 น.';
}
