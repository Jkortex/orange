import { getRecentEntries } from '@/lib/content'
import { HomeHeader, HomeContent } from '@/components/home'

export default function HomePage() {
  const entries = getRecentEntries(10)

  return (
    <section className="mx-auto w-full max-w-2xl animate-in fade-in-50 duration-300">
      <HomeHeader />
      <HomeContent entries={entries} />
    </section>
  )
}
