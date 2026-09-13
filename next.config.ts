import type { NextConfig } from 'next'

// 纯前端静态导出：产物在 out/，可部署到任意静态托管平台
const nextConfig: NextConfig = {
  output: 'export',
  images: {
    // 静态导出不支持默认图片优化，统一走 unoptimized
    unoptimized: true,
  },
  // 允许局域网设备（本机 IP）访问 dev 资源（/_next/hmr 等）：
  // Next 16 dev 默认阻止非 localhost 主机的跨源 dev 请求，缺失时远程设备页面 JS 无法加载，
  // 客户端组件不 hydrate，表现为「主题/播放等交互点击无效」。
  // 注意：仅影响 dev；局域网 IP 变化后需同步更新
  allowedDevOrigins: ['192.168.0.102'],
}

export default nextConfig
