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
    // Vitest 5.0.1 并行跑多个文件时（Windows + Node 24）会触发
    // "failed to find the current suite"，改为顺序执行文件规避。
    fileParallelism: false,
  },
})
