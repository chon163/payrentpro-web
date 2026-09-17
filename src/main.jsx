import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
// ฟอนต์ไทย Sarabun — ฝังมากับแอปเพื่อให้ใบเสร็จที่วาดบน canvas ได้ฟอนต์เดียวกันทุกเครื่อง
// (เดิมพึ่งฟอนต์ระบบ เครื่องที่ไม่มีฟอนต์ไทยจะวาดออกมาเป็นอักขระเพี้ยน)
import '@fontsource/sarabun/thai-400.css'
import '@fontsource/sarabun/thai-600.css'
import '@fontsource/sarabun/thai-700.css'
import '@fontsource/sarabun/latin-400.css'
import '@fontsource/sarabun/latin-600.css'
import '@fontsource/sarabun/latin-700.css'
import './index.css'
import App from './App.jsx'
import BillPage from './BillPage.jsx'
import RepairPortalPage from './RepairPortalPage.jsx'
import { LoginRoute, PublicHomeRoute } from './HomeRoutes.jsx'
import { ThemeProvider } from './theme.jsx'

// หน้าเทส responsive (/devtest) — dev เท่านั้น
// วาง import() ไว้ใต้ import.meta.env.DEV ให้ทั้งก้อนเป็น dead code ตอน build (DEV → false)
// จึงไม่มีทั้ง route และ chunk ของหน้านี้ขึ้น production
const DevTestRoute = import.meta.env.DEV
  ? (() => {
      // oxlint-disable-next-line
      const DevTestPage = lazy(() => import('./DevTestPage.jsx'))
      return (
        <Route
          path="/devtest"
          element={
            <Suspense fallback={null}>
              <DevTestPage />
            </Suspense>
          }
        />
      )
    })()
  : null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomeRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/assets" element={<App />} />

        {/* Redirects from old routes */}
        <Route path="/pending" element={<Navigate to="/finance/pending" replace />} />
        <Route path="/overdue" element={<Navigate to="/finance/overdue" replace />} />
        <Route path="/repairs" element={<Navigate to="/repairs/active" replace />} />
        <Route path="/leases" element={<Navigate to="/leases/expiring" replace />} />
        <Route path="/comms" element={<Navigate to="/docs/announcements" replace />} />
        <Route path="/finance" element={<Navigate to="/profit" replace />} />

        {/* Finance group */}
        <Route path="/finance/pending" element={<App />} />
        <Route path="/finance/overdue" element={<App />} />
        <Route path="/finance/recent" element={<App />} />

        {/* Repairs group */}
        <Route path="/repairs/active" element={<App />} />
        <Route path="/repairs/recent" element={<App />} />

        {/* Leases group */}
        <Route path="/leases/expired" element={<App />} />
        <Route path="/leases/expiring" element={<App />} />

        {/* Profit */}
        <Route path="/profit" element={<App />} />

        {/* Docs group */}
        <Route path="/docs/announcements" element={<App />} />
        <Route path="/docs/notes" element={<App />} />
        <Route path="/docs/files" element={<App />} />

        {/* Settings & Admin */}
        <Route path="/settings" element={<App />} />
        <Route path="/audit" element={<App />} />
        <Route path="/activity" element={<App />} />
        <Route path="/membership" element={<App />} />
        <Route path="/admin" element={<App />} />

        <Route path="/bill/:secure_token" element={<BillPage />} />
        {/* หน้าแจ้งซ่อมของผู้เช่า — public ไม่ต้อง login (คุมสิทธิ์ที่ RPC ด้วย token) */}
        <Route path="/repair" element={<RepairPortalPage />} />
        {DevTestRoute}
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
