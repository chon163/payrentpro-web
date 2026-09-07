import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// โหมดเทสชั่วคราว (คืนก่อนขายจริง): ทำงานเฉพาะเมื่อ VITE_DEV_LOGIN=true ใน env ท้องถิ่น
const DEV_LOGIN = import.meta.env.VITE_DEV_LOGIN === 'true'

// ปลายทางหลัง Google ส่งกลับ — โปรดักชันคือโดเมนบน Vercel
// (ต้องใส่ URL นี้ใน Supabase → Authentication → URL Configuration → Redirect URLs ด้วย)
const OAUTH_REDIRECT_TO = 'https://payrentpro-web.vercel.app'

// โลโก้ G สี่สีของ Google (ตาม brand guideline — ห้ามเปลี่ยนสี)
function GoogleLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState('email')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resendIn, setResendIn] = useState(0)

  // นับถอยหลังปุ่มส่งอีเมลซ้ำ 60 วินาที
  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setInterval(() => setResendIn((v) => v - 1), 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  // ทางเลือกที่ 1: Google OAuth — เบราว์เซอร์จะถูกพาไปหน้า Google แล้วกลับมาพร้อม session
  // ตอนกลับมา onAuthStateChange (ใน App.jsx / HomeRoutes.jsx) จัดการพาเข้าแอปเอง
  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    setError(null)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: OAUTH_REDIRECT_TO },
      })
      if (oauthError) throw oauthError
      // สำเร็จ = กำลัง redirect ออกไป Google จึงคง googleLoading ไว้จนหน้าเปลี่ยน
    } catch (err) {
      setError(err?.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
      setGoogleLoading(false)
    }
  }

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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100">PayRentPro</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">เข้าสู่ระบบเพื่อจัดการค่าเช่า</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <>
            {/* ทางเลือกที่ 1 (แนะนำ): Google — กดครั้งเดียว ไม่ต้องรออีเมล */}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={googleLoading || loading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-4 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleLogo />
              {googleLoading ? 'กำลังไปที่ Google...' : 'ดำเนินการต่อด้วย Google'}
            </button>

            {/* คั่นสองทางเลือก */}
            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-500">หรือ</span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* ทางเลือกที่ 2: Magic link ทางอีเมล (ของเดิม) */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">อีเมล</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@payrentpro.com"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 shadow-sm transition placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">เราจะส่งลิงก์เข้าสู่ระบบไปที่อีเมลของคุณ</p>
              </div>
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'กำลังส่ง...' : 'ส่งลิงก์เข้าสู่ระบบ'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-5 text-center">
              <p className="text-3xl">📧</p>
              <p className="mt-2 text-base font-bold text-gray-900 dark:text-gray-100">ตรวจสอบอีเมลของคุณ</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                เราได้ส่งลิงก์เข้าสู่ระบบไปที่ <span className="font-semibold text-gray-900 dark:text-gray-100">{email}</span> แล้ว
                กดปุ่ม Sign in ในอีเมลเพื่อเข้าสู่ระบบ (ลิงก์ใช้ได้ครั้งเดียว)
              </p>
            </div>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendIn > 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'กำลังส่ง...' : resendIn > 0 ? `ส่งอีเมลอีกครั้ง (${resendIn} วิ)` : 'ส่งอีเมลอีกครั้ง'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-xl px-4 py-3 text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 transition-colors hover:text-indigo-500 dark:hover:text-indigo-300"
            >
              ใช้อีเมลอื่น
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
