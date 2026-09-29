import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 允许 localtunnel 等内网穿透服务的外网域名访问开发服务器
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
})
