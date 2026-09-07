import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// โหมดเทสชั่วคราว (คืนก่อนขายจริง): ทำงานเฉพาะเมื่อ VITE_DEV_LOGIN=true ใน env ท้องถิ่น
const DEV_LOGIN = import.meta.env.VITE_DEV_LOGIN === 'true'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resendIn, setResendIn] = useState(0)

  // นับถอยหลังปุ่มส่งอีเมลซ้ำ 60 วินาที
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setInterval(() => setResendIn((v) => v - 1), 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  const sendMagicLink = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (sendError) throw sendError
      // โหมดเทส: ถ้าปิด confirm email ใน Supabase จะได้ session กลับมาใน response → เข้าเว็บได้ทันที
      if (DEV_LOGIN && data?.session) {
        await supabase.auth.setSession(data.session)
        return
      }
      setStep('sent')
      setResendIn(60)
    } catch (err) {
      setError(err?.message || 'ส่งอีเมลไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    sendMagicLink()
  }

  const handleResend = () => {
    if (resendIn > 0) return
    sendMagicLink()
  }

  const handleReset = () => {
    setStep('email')
    setError(null)
    setResendIn(0)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">PayRentPro</h1>
          <p className="mt-1 text-sm text-gray-500">เข้าสู่ระบบด้วย Magic Link</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">อีเมล</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@payrentpro.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="mt-2 text-center text-xs text-gray-400">เราจะส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณ</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าสู่ระบบ'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
              <p className="text-3xl">📧</p>
              <p className="mt-2 text-base font-bold text-gray-900">ตรวจสอบอีเมลของคุณ</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                เราได้ส่งลิงก์เข้าสู่ระบบไปที่ <span className="font-semibold text-gray-900">{email}</span> แล้ว
                กดปุ่ม Sign in ในอีเมลเพื่อเข้าสู่ระบบ (ลิงก์ใช้ได้ครั้งเดียว)
              </p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendIn > 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังส่ง...' : resendIn > 0 ? `ส่งอีเมลอีกครั้ง (${resendIn} วิ)` : 'ส่งอีเมลอีกครั้ง'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full text-center text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500"
            >
              ใช้อีเมลอื่น
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
