import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ธีมของแอป (เฉพาะส่วนที่ login แล้ว) — 'light' | 'dark'
// เก็บค่าไว้ใน localStorage และสลับ class "dark" บน <html> เพื่อให้ Tailwind dark: variant ทำงาน
const THEME_KEY = 'payrentpro-theme'
// โหมดตัวอักษรขยาย (accessibility) — ใช้ร่วมกับธีมได้อย่างอิสระ สลับ class "text-large" บน <html>
const LARGE_TEXT_KEY = 'payrentpro-largetext'

const ThemeContext = createContext(null)

function readStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function readStoredLargeText() {
  try {
    return localStorage.getItem(LARGE_TEXT_KEY) === '1'
  } catch {
    return false
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme)
  const [largeText, setLargeText] = useState(readStoredLargeText)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.toggle('text-large', largeText)
  }, [largeText])

  const toggleTheme = useCallback(() => {
    // ใส่ class ชั่วคราวเพื่อให้ transition สี (ใน index.css) ทำงานตอนสลับ แล้วถอดทิ้งเมื่อจบ
    const root = document.documentElement
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 300)

    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // localStorage ใช้ไม่ได้ (private mode ฯลฯ) — สลับได้แค่ในเซสชันนี้
      }
      return next
    })
  }, [])

  const toggleLargeText = useCallback(() => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    window.setTimeout(() => root.classList.remove('theme-transition'), 300)

    setLargeText((prev) => {
      const next = !prev
      try {
        localStorage.setItem(LARGE_TEXT_KEY, next ? '1' : '0')
      } catch {
        // localStorage ใช้ไม่ได้ — สลับได้แค่ในเซสชันนี้
      }
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, largeText, toggleLargeText }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ไฟล์นี้มี hook คู่กับ component โดยตั้งใจ (ใช้ร่วมกันเป็นโมดูลเดียว)
// oxlint-disable-next-line
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

// สีสำหรับกราฟ (Recharts) ตามโหมด — โทนตัวอักษร/เส้น grid สลับตามธีม
// สี series ของกราฟคุมที่จุดใช้งานตามเดิม (ไม่เปลี่ยนตามธีม)
// oxlint-disable-next-line
export function useChartTheme() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    tick: dark ? '#9ca3af' : '#6b7280',      // ตัวอักษรแกน: gray-400 / gray-500
    axisLine: dark ? '#4b5563' : '#d1d5db',  // เส้นแกน: gray-600 / gray-300
    grid: dark ? '#374151' : '#e5e7eb',      // เส้น grid: gray-700 / gray-200
    legend: dark ? '#d1d5db' : '#374151',    // ข้อความ legend (สี series ยังเป็นของ series เอง)
    cursor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    tooltip: {
      backgroundColor: dark ? '#111827' : '#ffffff',
      border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
      borderRadius: '0.75rem',
      padding: '0.625rem 0.875rem',
      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      color: dark ? '#f9fafb' : '#111827',
      fontSize: '0.75rem',
    },
    tooltipLabel: dark ? '#e5e7eb' : '#374151',
  }
}
