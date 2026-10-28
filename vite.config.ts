import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    // 允许 localtunnel 等内网穿透服务的外网域名访问开发服务器
    allowedHosts: ['.loca.lt', '.trycloudflare.com'],
  },
  test: {
    // Vitest 5.0.1 在 Windows + Node 24 下默认 threads 池会报
    // "Vitest failed to find the current suite" / "reading 'config'"，
    // 改用 forks 池规避；同时顺序执行文件，避免并行时的同类崩溃。
    pool: 'forks',
    fileParallelism: false,
  },
})
