import type { NextConfig } from 'next'

// 纯前端静态导出：产物在 out/，可部署到任意静态托管平台
const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // 静态导出不支持默认图片优化，统一走 unoptimized
    unoptimized: true,
  },
  // 允许局域网设备（本机 IP）访问 dev 资源（/_next/hmr 等）：
  // Next 16 dev 默认阻止非 localhost 主机的跨源 dev 请求，缺失时远程设备页面 JS 无法加载。
  // 支持通过环境变量 ALLOWED_DEV_ORIGINS 覆盖（逗号分隔），默认回退到常用内网 IP 与主机
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim())
    : ['192.168.0.102', 'localhost', '127.0.0.1'],
}

export default nextConfig
