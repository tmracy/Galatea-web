import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 开发期通过 VITE_API_BASE 指向后端（默认空 => 触发 mock 回退）
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok.app',
    ],
    // 如后端跑在本机 8000，可启用以下代理，前端用相对路径 /api 即可
    // Agent 深度流程可能跑 5–10 分钟，代理超时需足够长，否则前端会先收到 503/504
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      '/agent': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
      '/emotion': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
        timeout: 600_000,
        proxyTimeout: 600_000,
      },
    },
  },
})
