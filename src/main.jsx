import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import BillPage from './BillPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/assets" element={<App />} />
        <Route path="/settings" element={<App />} />
        <Route path="/audit" element={<App />} />
        <Route path="/bill/:secure_token" element={<BillPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
