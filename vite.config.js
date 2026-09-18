import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { assetsDir: 'static' }, // กัน path /assets ของแอปชนโฟลเดอร์ bundle dist/assets บน Vercel
})
