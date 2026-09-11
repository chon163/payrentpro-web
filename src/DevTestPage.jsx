import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from './theme.jsx'

// หน้าเทส responsive แบบ device preview — dev เท่านั้น (ผูก route ไว้ใต้ import.meta.env.DEV ใน main.jsx)
// ยิง iframe หน้าเว็บจริงพร้อมกันหลายความกว้าง แล้วคุมเส้นทาง/ธีมจาก toolbar เดียว
// iframe เป็น same-origin จึงเข้าถึง document ของมันได้ตรง ๆ ไม่ต้องแก้โค้ดหน้าอื่นให้รับ postMessage

const DEVICES = [
  { label: 'Mobile', width: 375, height: 812 },
  { label: 'Tablet', width: 768, height: 1024 },
  { label: 'Laptop', width: 1024, height: 768 },
  { label: 'Desktop', width: 1280, height: 800 },
]

const ROUTES = [
  { label: 'Dashboard', path: '/' },
  { label: 'Assets', path: '/assets' },
  { label: 'Membership', path: '/membership' },
  { label: 'Finance', path: '/finance' },
  { label: 'Comms', path: '/comms' },
  { label: 'Settings', path: '/settings' },
  { label: 'Landing', path: '/login' },
]

const ZOOMS = [0.4, 0.5, 0.6, 0.75, 1]

// คีย์เดียวกับ theme.jsx — เขียนลง localStorage ของ iframe (แชร์ origin กัน) ให้หน้าที่โหลดใหม่หยิบไปใช้ต่อ
const THEME_KEY = 'payrentpro-theme'
const LARGE_TEXT_KEY = 'payrentpro-largetext'

// ดัน state ของ toolbar ลงไปในเอกสารของ iframe โดยตรง (เร็วกว่า reload และไม่ต้องรอ React ในนั้น re-render)
function pushAppearance(frame, theme, largeText) {
  const doc = frame?.contentDocument
  if (!doc) return
  try {
    frame.contentWindow.localStorage.setItem(THEME_KEY, theme)
    frame.contentWindow.localStorage.setItem(LARGE_TEXT_KEY, largeText ? '1' : '0')
  } catch {
    // localStorage ใช้ไม่ได้ — ยังสลับ class ให้เห็นผลในเฟรมนี้ได้
  }
  doc.documentElement.classList.toggle('dark', theme === 'dark')
  doc.documentElement.classList.toggle('text-large', largeText)
}

export default function DevTestPage() {
  const { theme, toggleTheme, largeText, toggleLargeText } = useTheme()
  const [path, setPath] = useState('/')
  const [customPath, setCustomPath] = useState('')
  const [zoom, setZoom] = useState(0.5)
  const [nonce, setNonce] = useState(0) // เปลี่ยนค่าเพื่อบังคับ reload ทุกเฟรม
  const frames = useRef([])

  // สลับธีม/ตัวอักษรใหญ่ → ส่งผลทุกเฟรมทันที
  useEffect(() => {
    frames.current.forEach((frame) => pushAppearance(frame, theme, largeText))
  }, [theme, largeText, path, nonce])

  const handleLoad = useCallback(
    (index) => (event) => {
      frames.current[index] = event.currentTarget
      pushAppearance(event.currentTarget, theme, largeText)
    },
    [theme, largeText],
  )

  const go = (next) => {
    const clean = next.trim()
    if (!clean) return
    setPath(clean.startsWith('/') ? clean : `/${clean}`)
  }

  const btn = 'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors'
  const btnIdle = 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
  const btnOn = 'border-gray-900 bg-gray-900 text-white'

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="sticky top-0 z-10 space-y-2 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            /devtest
          </span>
          {ROUTES.map((route) => (
            <button
              key={route.path}
              type="button"
              onClick={() => setPath(route.path)}
              className={`${btn} ${path === route.path ? btnOn : btnIdle}`}
            >
              {route.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* /bill/:secure_token กับ /repair ต้องมี token — พิมพ์ path เต็มเองที่ช่องนี้ */}
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              go(customPath)
            }}
          >
            <input
              value={customPath}
              onChange={(event) => setCustomPath(event.target.value)}
              placeholder="/bill/<token>"
              className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <button type="submit" className={`${btn} ${btnIdle}`}>
              ไป
            </button>
          </form>

          <span className="mx-1 h-4 w-px bg-gray-300" />

          <button type="button" onClick={toggleTheme} className={`${btn} ${btnIdle}`}>
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <button
            type="button"
            onClick={toggleLargeText}
            className={`${btn} ${largeText ? btnOn : btnIdle}`}
          >
            ตัวอักษรใหญ่
          </button>

          <span className="mx-1 h-4 w-px bg-gray-300" />

          <span className="text-xs text-gray-500">ย่อ</span>
          {ZOOMS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setZoom(value)}
              className={`${btn} ${zoom === value ? btnOn : btnIdle}`}
            >
              {Math.round(value * 100)}%
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-gray-300" />

          <button
            type="button"
            onClick={() => setNonce((value) => value + 1)}
            className={`${btn} ${btnIdle}`}
          >
            โหลดใหม่ทุกจอ
          </button>
          <code className="ml-auto rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
            {path}
          </code>
        </div>
      </header>

      <div className="flex items-start gap-4 overflow-x-auto p-4">
        {DEVICES.map((device, index) => (
          <div key={device.width} className="shrink-0">
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <span className="text-xs font-semibold">{device.label}</span>
              <span className="text-xs text-gray-500">
                {device.width}×{device.height}
              </span>
            </div>
            <div
              className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm"
              style={{ width: device.width * zoom, height: device.height * zoom }}
            >
              <iframe
                key={`${device.width}-${nonce}`}
                ref={(node) => {
                  frames.current[index] = node
                }}
                onLoad={handleLoad(index)}
                src={path}
                title={`${device.label} ${device.width}px`}
                style={{
                  width: device.width,
                  height: device.height,
                  border: 0,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
