import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 内容层/纯函数在 node 环境测试（AGENTS.md 测试规范）；markdown 渲染走 react-dom/server，同样 node 环境即可
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // fileURLToPath 保留绝对路径；直接使用 URL.pathname 在 Linux 上会去掉开头 /，
      // 变成 Vite 无法解析的相对路径。
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
