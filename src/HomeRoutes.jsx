import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import { supabase } from './supabaseClient'

// "/" เป็นหน้ากลาง: ยังไม่ login → landing page สาธารณะ / login แล้ว → เข้าแอป (dashboard) ตามเดิม
// (กดออกจากระบบในแอปแล้ว onAuthStateChange จะพากลับมาหน้า landing ที่ "/" เอง)
export function PublicHomeRoute() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    // กันจอขาวแบบเดียวกับ App.jsx: getSession() reject ได้ (Web Locks / refresh token ล้ม)
    // ถ้าไม่ .catch ค่า checking จะค้าง true → ติดหน้า "กำลังโหลด..." บนพื้นขาวตลอดไป
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setChecking(false)
      }
    }, (err) => {
      console.warn('getSession failed:', err?.message || err)
      if (active) {
        setSession(null)
        setChecking(false)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'INITIAL_SESSION' && active) setChecking(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">กำลังโหลด...</p>
      </div>
    )
  }

  return session ? <App /> : <LandingPage />
}

// หน้า /login — App แสดงฟอร์มเข้าสู่ระบบเองเมื่อยังไม่มี session
// พอ login สำเร็จ (หรือเข้าลิงก์ทั้งที่ login อยู่แล้ว) พากลับ "/"
export function LoginRoute() {
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate('/', { replace: true })
    }, (err) => console.warn('getSession failed:', err?.message || err))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/', { replace: true })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [navigate])
  return <App />
}
