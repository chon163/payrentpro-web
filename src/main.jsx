import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import BillPage from './BillPage.jsx'
import { LoginRoute, PublicHomeRoute } from './HomeRoutes.jsx'
import { ThemeProvider } from './theme.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHomeRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/assets" element={<App />} />
        <Route path="/finance" element={<App />} />
        <Route path="/comms" element={<App />} />
        <Route path="/settings" element={<App />} />
        <Route path="/audit" element={<App />} />
        <Route path="/membership" element={<App />} />
        <Route path="/admin" element={<App />} />
        <Route path="/bill/:secure_token" element={<BillPage />} />
      </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
