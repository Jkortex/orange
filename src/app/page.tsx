import { getAllEntries } from '@/lib/content'
import { HomeHeader, HomeContent } from '@/components/home'

export default function HomePage() {
  // 首页只保留混合时间线；品牌与站点定位由顶栏和简介承担，避免重复信号。
  const entries = getAllEntries().slice(0, 10)

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <HomeHeader />
      <HomeContent entries={entries} />
    </section>
  )
}
