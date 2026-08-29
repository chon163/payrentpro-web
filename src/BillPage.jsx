import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { bankName } from './payment'

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

function statusInfo(status) {
  const s = String(status ?? '').toLowerCase()
  if (s === 'paid') return { label: 'ชำระแล้ว', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  if (s === 'pending_review' || s === 'pending') return { label: 'รอการตรวจสอบ', cls: 'bg-amber-50 text-amber-700 ring-amber-200' }
  return { label: 'รอการชำระเงิน', cls: 'bg-rose-50 text-rose-700 ring-rose-200' }
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
  const [qrError, setQrError] = useState(false)
  const [marking, setMarking] = useState(false)
  const [customAmount, setCustomAmount] = useState('')
  const [paymentInfo, setPaymentInfo] = useState({
    payment_type: 'promptpay',
    promptpay: '',
    promptpay_name: '',
    bank_code: '',
    bank_account: '',
  })

  const fetchBill = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, rentals(cust_name, item_details)')
        .eq('secure_token', secure_token)
        .maybeSingle()
      if (error) throw error
      if (!data) {
        setNotFound(true)
      } else {
        setBill(data)
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

  const fetchPayment = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admins')
        .select('payment_type, promptpay_name, promptpay, bank_code, bank_account')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (data) {
        setPaymentInfo({
          payment_type: data.payment_type || 'promptpay',
          promptpay: data.promptpay ?? '',
          promptpay_name: data.promptpay_name ?? '',
          bank_code: data.bank_code ?? '',
          bank_account: data.bank_account ?? '',
        })
      }
    } catch (err) {
      console.error('Fetch payment error:', err)
      try {
        const { data, error } = await supabase
          .from('admins')
          .select('promptpay_name, promptpay')
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (data) {
          setPaymentInfo((prev) => ({
            ...prev,
            promptpay: data.promptpay ?? '',
            promptpay_name: data.promptpay_name ?? '',
          }))
        }
      } catch (err2) {
        console.error('Fetch payment fallback error:', err2)
      }
    }
  }, [])

  useEffect(() => {
    fetchPayment()
  }, [fetchPayment])

  useEffect(() => {
    if (bill) {
      setCustomAmount(String(Number(bill.total_amount || bill.base_amount) || 0))
    }
  }, [bill])

  const handleMarkPaid = async () => {
    if (!bill) return
    setMarking(true)
    try {
      const v = Number(customAmount)
      const paidAmount = customAmount !== '' && Number.isFinite(v) && v > 0 ? v : total
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'pending_review', paid_amount: paidAmount })
        .eq('id', bill.id)
      if (error) throw error
      setBill((prev) => ({ ...prev, status: 'pending_review', paid_amount: paidAmount }))

      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'payment_review',
              transaction_id: bill.id,
              secure_token: bill.secure_token,
              cust_name: custName,
              item_details: itemDetails,
              total_amount: total,
              paid_amount: paidAmount,
              bill_link: `http://localhost:5173/bill/${bill.secure_token}`,
            }),
          })
        } catch (webhookErr) {
          console.error('Payment webhook failed:', webhookErr)
        }
      }
    } catch (err) {
      console.error('Update status error:', err)
    } finally {
      setMarking(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-md animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-gray-200" />
          <div className="h-64 rounded-2xl bg-gray-200" />
        </div>
      </div>
    )
  }

  if (notFound || !bill) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-bold text-gray-900">ไม่พบข้อมูลบิล</h1>
          <p className="mt-2 text-sm text-gray-500">ลิงก์บิลไม่ถูกต้อง หรือบิลนี้ไม่มีอยู่ในระบบ</p>
        </div>
      </div>
    )
  }

  const rental = Array.isArray(bill.rentals) ? bill.rentals[0] : bill.rentals
  const custName = rental?.cust_name ?? 'ไม่ระบุ'
  const itemDetails = rental?.item_details ?? 'ไม่ระบุ'
  const total = Number(bill.total_amount || bill.base_amount)
  const customVal = Number(customAmount)
  const paidAmount = customAmount !== '' && Number.isFinite(customVal) && customVal > 0 ? customVal : total
  const isBank = paymentInfo.payment_type === 'bank'
  const ppNumber = (paymentInfo.promptpay || '0812345678').replace(/[^0-9]/g, '')
  const qrUrl = isBank ? '' : `https://promptpay.io/${ppNumber}/${paidAmount}.png`
  const accountName = paymentInfo.promptpay_name || ''
  const paymentText = isBank
    ? `โอนเข้าบัญชี ${bankName(paymentInfo.bank_code)} เลขที่ ${paymentInfo.bank_account} ชื่อบัญชี ${accountName}`
    : ''
  const info = statusInfo(bill.status)
  const settled = isSettled(bill.status)

  return (
    <div className="min-h-screen bg-gray-100 py-6 text-gray-900">
      <div className="mx-auto max-w-2xl px-4">
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xl font-bold text-indigo-600">PayRentPro</p>
              <p className="mt-0.5 text-sm text-gray-600">{paymentInfo.promptpay_name || 'เจ้าของห้อง'}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">ใบแจ้งหนี้ / INVOICE</p>
              <p className="mt-0.5 text-sm text-gray-500">เลขที่บิล: INV-{(bill.id || '').slice(0, 8).toUpperCase()}</p>
              <p className="text-sm text-gray-500">วันที่ออกบิล: {formatDate(bill.created_at)}</p>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">ลูกค้า</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{custName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">รายการ</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{itemDetails}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">รอบบิล: {bill.period || '—'}</p>
          </div>

          <div className="px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-2.5 pr-2 font-medium">รายการ</th>
                  <th className="py-2.5 pr-2 text-right font-medium">จำนวน</th>
                  <th className="py-2.5 pr-2 text-right font-medium">ราคา/หน่วย</th>
                  <th className="py-2.5 text-right font-medium">ยอดรวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-2.5 text-gray-700">ค่าเช่าห้องพัก</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-600">1</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-600">{formatCurrency(bill.base_amount)}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(bill.base_amount)}</td>
                </tr>
                {Number(bill.water_units) > 0 && (
                  <tr>
                    <td className="py-2.5 text-gray-700">ค่าน้ำประปา</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{bill.water_units} หน่วย</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{formatCurrency(Number(bill.water_cost) / Math.max(1, Number(bill.water_units)))}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(bill.water_cost)}</td>
                  </tr>
                )}
                {Number(bill.elec_units) > 0 && (
                  <tr>
                    <td className="py-2.5 text-gray-700">ค่าไฟฟ้า</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{bill.elec_units} หน่วย</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{formatCurrency(Number(bill.elec_cost) / Math.max(1, Number(bill.elec_units)))}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(bill.elec_cost)}</td>
                  </tr>
                )}
                {Number(bill.penalty_amount) > 0 && (
                  <tr>
                    <td className="py-2.5 text-gray-700">ค่าปรับชำระล่าช้า</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{bill.penalty_days || 0} วัน</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">{formatCurrency(Number(bill.penalty_amount) / Math.max(1, Number(bill.penalty_days)))}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(bill.penalty_amount)}</td>
                  </tr>
                )}
                {Number(bill.extra_charges) > 0 && (
                  <tr>
                    <td className="py-2.5 text-gray-700">ค่าอื่นๆ</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">—</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-600">—</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatCurrency(bill.extra_charges)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-6 py-5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${info.cls}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {info.label}
            </span>
            <div className="text-right">
              <p className="text-xs text-gray-500">ยอดรวมทั้งสิ้น</p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight text-rose-600">{formatCurrency(total)}</p>
            </div>
          </div>

          {bill.status === 'paid' && (
            <div className="pointer-events-none absolute right-6 top-32 rotate-12 rounded-lg border-4 border-emerald-500 px-4 py-1 text-3xl font-black tracking-widest text-emerald-500/60">
              PAID
            </div>
          )}

          {!settled && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-5">
              <div className="rounded-xl border border-indigo-100 bg-white p-4">
                <label htmlFor="custom_amount" className="mb-1.5 block text-sm font-medium text-gray-700">ระบุยอดที่ต้องการชำระ (บาท)</label>
                <input
                  id="custom_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-right text-lg font-semibold tabular-nums text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1.5 text-xs text-gray-500">QR Code จะอัปเดตตามยอดที่คุณกรอกทันที</p>
              </div>

              <div className="mt-4 flex flex-col items-center">
                {isBank ? (
                  <div className="w-full rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 p-5 text-center shadow-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-900">โอนเข้าบัญชีธนาคาร</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{paymentText}</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                      {qrError ? (
                        <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-gray-100 p-4 text-center text-xs text-gray-400">
                          ไม่สามารถโหลด QR Code ได้
                        </div>
                      ) : (
                        <img
                          src={qrUrl}
                          alt="QR Code พร้อมเพย์"
                          width={208}
                          height={208}
                          className="h-52 w-52 object-contain"
                          onError={() => setQrError(true)}
                        />
                      )}
                    </div>
                    <p className="mt-3 text-sm text-gray-600">
                      สแกนจ่ายผ่าน <span className="font-semibold text-gray-900">พร้อมเพย์</span>
                    </p>
                    <p className="font-mono text-sm text-gray-500">{paymentInfo.promptpay || '0812345678'}</p>
                    {accountName && (
                      <p className="mt-1 text-sm font-semibold text-gray-700">โอนเข้าบัญชี: {accountName}</p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {!isBank && (
                  <a
                    href={qrUrl}
                    download="promptpay-qr.png"
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    ⬇️ บันทึกรูป QR Code
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={settled || marking}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                    settled ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {marking ? 'กำลังส่งข้อมูล...' : settled ? 'ส่งหลักฐานการชำระเงินแล้ว' : '✅ ฉันจ่ายเงินแล้ว'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillPage
