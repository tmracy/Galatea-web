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
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/agent': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/emotion': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
