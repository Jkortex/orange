import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 内容层/纯函数在 node 环境测试（AGENTS.md 测试规范）；markdown 渲染走 react-dom/server，同样 node 环境即可
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname.replace(/^\//, ''),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
