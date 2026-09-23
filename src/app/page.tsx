import { getAllEntries } from '@/lib/content'
import { isMusic } from '@/lib/content-guards'
import { HomeHeader, HomeContent, type HomeSignal } from '@/components/home'

export default function HomePage() {
  // 单一事实源：全类型聚合（日期倒序）既喂时间线，也用于派生 hero 动态信号
  const all = getAllEntries()
  const entries = all.slice(0, 10)

  const latest = all.find((entry) => !isMusic(entry)) ?? null
  const latestMusic = all.find(isMusic) ?? null

  const signals = [
    latest && {
      label: '最近',
      href: `/${latest.collection}/${latest.slug}`,
      text: latest.data.title,
    },
    latestMusic && {
      label: '在听',
      href: `/music/${latestMusic.slug}`,
      text: `${latestMusic.data.title} · ${latestMusic.data.artist}`,
    },
  ].filter((signal): signal is HomeSignal => signal !== null)

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <HomeHeader signals={signals} />
      <HomeContent entries={entries} />
    </section>
  )
}
