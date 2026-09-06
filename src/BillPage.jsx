import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { bankName } from './payment'
import { createPromptpayQR } from './utils/promptpay'
import { formatPeriod } from './utils/period'
import { displayAssetName } from './utils/assetName'

function formatCurrency(value) {
  const n = Number(value)
  if (value === undefined || value === null || value === '' || Number.isNaN(n)) return '—'
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
}

// badge สถานะบนหัวการ์ด
function statusBadge(status) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'paid') return { label: 'ชำระแล้ว', cls: 'bg-green-100 text-green-700 ring-green-300' }
  if (s === 'pending_review' || s === 'pending') return { label: 'รอตรวจสอบ', cls: 'bg-sky-100 text-sky-700 ring-sky-300' }
  return { label: 'รอชำระ', cls: 'bg-orange-100 text-orange-700 ring-orange-300' }
}

function isSettled(status) {
  const s = String(status ?? '').toLowerCase()
  return s === 'paid' || s === 'pending_review' || s === 'pending'
}

function BillPage() {
  const { secure_token } = useParams()
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [qrFailed, setQrFailed] = useState(false)
  const [marking, setMarking] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [toast, setToast] = useState(null)
  const [business, setBusiness] = useState(null)
  const paySectionRef = useRef(null)

  const fetchBill = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const { data, error } = await supabase.rpc('get_bill_by_token', { p_token: secure_token })
      if (error) throw error
      const billData = Array.isArray(data) ? data[0] : data
      if (!billData) {
        setNotFound(true)
      } else {
        setBill(billData)
      }
    } catch (err) {
      console.error('Bill fetch error:', err)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [secure_token])

  useEffect(() => {
    fetchBill()
  }, [fetchBill])

  useEffect(() => {
    if (bill) {
      setCustomAmount(String(Number(bill.total_amount || bill.base_amount) || 0))
    }
  }, [bill])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // โปรไฟล์ธุรกิจของเจ้าของ (ชื่อธุรกิจ) สำหรับหน้าบิล public
  useEffect(() => {
    let active = true
    supabase
      .rpc('get_business_profile')
      .then((data) => { if (active && data && typeof data === 'object') setBusiness(data) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // สร้าง QR พร้อมเพย์ในเครื่อง อัปเดตตามยอดที่ผู้เช่ากรอกแบบ realtime
  useEffect(() => {
    let active = true
    const isBank = bill?.payment_type === 'bank'
    const ppNumber = String(bill?.promptpay || '').replace(/[^0-9]/g, '')
    if (!bill || isBank || !ppNumber) {
      setQrDataUrl(null)
      setQrFailed(false)
      return
    }
    const customVal = Number(customAmount)
    const total = Number(bill.total_amount || bill.base_amount)
    const paidAmount = customAmount !== '' && Number.isFinite(customVal) && customVal > 0 ? customVal : total
    createPromptpayQR(ppNumber, paidAmount)
      .then((dataUrl) => {
        if (!active) return
        setQrDataUrl(dataUrl)
        setQrFailed(false)
      })
      .catch(() => {
        if (!active) return
        setQrDataUrl(null)
        setQrFailed(true)
      })
    return () => { active = false }
  }, [bill, customAmount])

  const handleMarkPaid = async () => {
    if (!bill) return
    setMarking(true)
    try {
      const v = Number(customAmount)
      const paidAmount = customAmount !== '' && Number.isFinite(v) && v > 0 ? v : total
      const { data: result, error } = await supabase.rpc('submit_payment_claim', {
        p_token: secure_token,
        p_amount: paidAmount,
      })
      if (error) throw error
      if (result && result.ok === true) {
        setBill((prev) => ({ ...prev, status: 'pending_review', paid_amount: paidAmount }))
      } else {
        setToast('บิลนี้ถูกแจ้งชำระแล้ว')
      }
    } catch (err) {
      console.error('Submit payment claim error:', err)
      setToast(err?.message || 'ส่งข้อมูลไม่สำเร็จ')
    } finally {
      setMarking(false)
    }
  }

  const scrollToPay = () => {
    paySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-rose-50 p-4">
        <div className="mx-auto max-w-md animate-pulse space-y-4 pt-6">
          <div className="h-36 rounded-3xl bg-indigo-200/60" />
          <div className="h-32 rounded-3xl bg-white/70" />
          <div className="h-64 rounded-3xl bg-white/70" />
        </div>
      </div>
    )
  }

  if (notFound || !bill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-violet-50 p-4">
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-lg shadow-indigo-100/60">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl">
            📭
          </div>
          <h1 className="mt-4 text-lg font-bold text-gray-900">ไม่พบข้อมูลบิลค่ะ</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">ลิงก์บิลไม่ถูกต้อง หรือบิลนี้ไม่มีอยู่ในระบบ<br />ลองตรวจสอบลิงก์อีกครั้งนะคะ 🙏</p>
        </div>
      </div>
    )
  }

  const custName = bill.cust_name ?? 'ไม่ระบุ'
  const itemDetails = displayAssetName(bill)
  const total = Number(bill.total_amount || bill.base_amount)
  const isBank = bill.payment_type === 'bank'
  const hasPromptpay = Boolean(bill.promptpay && String(bill.promptpay).trim())
  // ชื่อที่แสดงตอน "โอนเข้าบัญชี/จ่ายให้": ใช้ชื่อบัญชี ถ้าไม่มีใช้ชื่อธุรกิจ
  const accountName = bill.promptpay_name || business?.business_name || ''
  const isPaid = String(bill.status ?? '').toLowerCase() === 'paid'
  const isPending = String(bill.status ?? '').toLowerCase() === 'pending_review' || String(bill.status ?? '').toLowerCase() === 'pending'
  const badge = statusBadge(bill.status)

  const detailLines = [
    { label: 'ค่าเช่าห้องพัก', value: formatCurrency(bill.base_amount) },
    ...(Number(bill.water_units) > 0 ? [{ label: `ค่าน้ำประปา (${bill.water_units} หน่วย)`, value: formatCurrency(bill.water_cost) }] : []),
    ...(Number(bill.elec_units) > 0 ? [{ label: `ค่าไฟฟ้า (${bill.elec_units} หน่วย)`, value: formatCurrency(bill.elec_cost) }] : []),
    ...(Number(bill.penalty_amount) > 0 ? [{ label: `ค่าปรับชำระล่าช้า (${bill.penalty_days || 0} วัน)`, value: formatCurrency(bill.penalty_amount) }] : []),
    ...(Number(bill.extra_charges) > 0 ? [{ label: 'ค่าใช้จ่ายอื่นๆ', value: formatCurrency(bill.extra_charges) }] : []),
  ]

  // ── ชำระแล้ว: หน้าขอบคุณ ─────────────────────────────────
  if (isPaid) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-teal-50 px-4 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-green-600 px-6 py-10 text-center text-white shadow-xl shadow-emerald-200/70">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
              <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold">ขอบคุณที่ชำระเงินนะคะ 🙏</h1>
            <p className="mt-2 text-sm text-emerald-50">คุณ{custName}</p>
            <div className="mx-auto mt-6 w-fit rounded-2xl bg-white/15 px-6 py-3">
              <p className="text-xs text-emerald-50">ยอดที่ชำระ</p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums">{formatCurrency(bill.paid_amount > 0 ? bill.paid_amount : total)}</p>
            </div>
            <p className="mt-5 text-xs text-emerald-50/80">เลขที่บิล INV-{(bill.id || '').slice(0, 8).toUpperCase()} · งวด {formatPeriod(bill.period)}</p>
          </div>
          <p className="mt-6 text-center text-xs text-gray-400">จัดการโดย PayRentPro 🏠</p>
        </div>
      </div>
    )
  }

  // ── ยังไม่ชำระ / รอตรวจสอบ ────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-violet-50 to-rose-50 text-gray-900">
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        {/* 1) หัว: ทักทาย + สถานะ */}
        <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 px-6 py-6 text-white shadow-lg shadow-indigo-200/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-medium text-indigo-100">สวัสดีค่ะ 🏠</p>
              <p className="mt-1 text-xl font-bold">{custName}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-3 text-sm text-indigo-100">{itemDetails} · งวด {formatPeriod(bill.period)}</p>
        </div>

        {/* 2) ฮีโร่ยอดเงิน */}
        <div className="rounded-3xl border border-gray-100 bg-white px-6 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-500">ยอดที่ต้องชำระ</p>
          <p className="mt-1 text-4xl font-bold tracking-tight text-gray-900 tabular-nums">{formatCurrency(total)}</p>
          <p className="mt-2 text-xs text-gray-400">ออกบิลเมื่อ {formatDate(bill.created_at)} · เลขที่ INV-{(bill.id || '').slice(0, 8).toUpperCase()}</p>
        </div>

        {/* 3) รายละเอียด */}
        <div className="rounded-3xl border border-gray-100 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm font-bold text-gray-900">รายละเอียดค่าใช้จ่าย 🧾</p>
          <ul className="mt-3 divide-y divide-gray-50">
            {detailLines.map((line) => (
              <li key={line.label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm text-gray-600">{line.label}</span>
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{line.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm font-bold text-gray-900">รวมทั้งสิ้น</span>
            <span className="text-base font-bold text-gray-900 tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* 4) ปุ่มหลัก → เลื่อนไปส่วนชำระเงิน */}
        {!isSettled(bill.status) && (
          <button
            type="button"
            onClick={scrollToPay}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-lg font-bold text-white shadow-lg shadow-green-300/60 transition-colors hover:bg-green-500 active:bg-green-700"
          >
            ชำระเงินเลย 💰
          </button>
        )}

        {/* 8) pending_review: รอตรวจสอบสลิป */}
        {isPending && (
          <div className="rounded-3xl border border-sky-100 bg-sky-50 px-6 py-6 text-center shadow-sm">
            <p className="text-3xl">⏳</p>
            <p className="mt-2 text-base font-bold text-sky-800">ได้รับแจ้งการชำระแล้ว กำลังตรวจสอบ</p>
            <p className="mt-1 text-sm leading-relaxed text-sky-700">
              {bill.paid_amount > 0 ? `แจ้งชำระยอด ${formatCurrency(bill.paid_amount)} · ` : ''}เจ้าของห้องจะยืนยันให้เร็วที่สุดนะคะ 🙏
            </p>
          </div>
        )}

        {/* 5) ส่วนชำระเงิน (QR / ธนาคาร) — เฉพาะยังไม่แจ้งชำระ */}
        {!isSettled(bill.status) && (
          <div ref={paySectionRef} className="scroll-mt-4 rounded-3xl border border-gray-100 bg-white px-6 py-6 shadow-sm">
            {isBank ? (
              hasBankAccount(bill) ? (
                <div className="text-center">
                  <p className="text-3xl">🏦</p>
                  <p className="mt-2 text-base font-bold text-gray-900">โอนเข้าบัญชีธนาคาร</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{bankPaymentText(bill, accountName)}</p>
                </div>
              ) : (
                <div className="rounded-2xl bg-amber-50 px-5 py-5 text-center">
                  <p className="text-3xl">💛</p>
                  <p className="mt-2 text-sm font-semibold text-amber-700">ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาติดต่อเจ้าของห้องนะคะ</p>
                </div>
              )
            ) : hasPromptpay ? (
              <>
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                    {qrFailed ? (
                      <div className="flex h-[260px] w-[260px] items-center justify-center rounded-xl bg-gray-100 p-4 text-center text-sm text-gray-400">
                        ไม่สามารถสร้าง QR ได้<br />ลองรีเฟรชหน้าอีกครั้งนะคะ
                      </div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Code พร้อมเพย์"
                        width={260}
                        height={260}
                        className="h-[260px] w-[260px] object-contain"
                      />
                    ) : (
                      <div className="h-[260px] w-[260px] animate-pulse rounded-xl bg-gray-100" />
                    )}
                  </div>
                  <p className="mt-4 text-base font-bold text-gray-900">สแกนจ่ายผ่านแอปธนาคาร 📱</p>
                  {accountName && (
                    <p className="mt-1 text-sm text-gray-600">บัญชี: <span className="font-semibold">{accountName}</span></p>
                  )}
                  <p className="mt-0.5 font-mono text-sm text-gray-500">{bill.promptpay}</p>
                </div>

                <div className="mt-5">
                  <label htmlFor="custom_amount" className="mb-1.5 block text-sm font-medium text-gray-700">อยากปรับยอดที่จะชำระไหมคะ? (บาท)</label>
                  <input
                    id="custom_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right text-lg font-bold tabular-nums text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">QR Code จะอัปเดตตามยอดที่พิมพ์ทันทีเลยค่ะ ✨</p>
                </div>

                <button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={marking}
                  className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-300/60 transition-colors hover:bg-blue-500 active:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {marking ? (
                    <>
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                      </svg>
                      กำลังส่งข้อมูล...
                    </>
                  ) : (
                    '✅ แจ้งการชำระเงิน'
                  )}
                </button>

                {qrDataUrl && (
                  <a
                    href={qrDataUrl}
                    download="promptpay-qr.png"
                    className="mt-3 block text-center text-xs font-medium text-indigo-500 underline underline-offset-2"
                  >
                    บันทึกรูป QR Code
                  </a>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-amber-50 px-5 py-5 text-center">
                <p className="text-3xl">💛</p>
                <p className="mt-2 text-sm font-semibold text-amber-700">ยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาติดต่อเจ้าของห้องนะคะ</p>
              </div>
            )}
          </div>
        )}

        {/* 6) ท้ายหน้า */}
        <div className="pt-2 text-center">
          <p className="text-sm text-gray-500">ชำระแล้วส่งสลิปในกลุ่ม LINE ได้เลยนะคะ 🙏</p>
          <p className="mt-1 text-xs text-gray-400">จัดการโดย PayRentPro 🏠</p>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function hasBankAccount(bill) {
  return Boolean(bill.payment_type === 'bank' && bill.bank_account && String(bill.bank_account).trim())
}

function bankPaymentText(bill, accountName) {
  return `โอนเข้าบัญชี ${bankName(bill.bank_code)} เลขที่ ${bill.bank_account}${accountName ? ` ชื่อบัญชี ${accountName}` : ''}`
}

export default BillPage
