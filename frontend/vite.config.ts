import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 開啟主機廣播，允許同區域網路內的手機/平板連線
    port: 5173,
  }
})
