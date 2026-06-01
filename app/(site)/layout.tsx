import Nav from '@/components/Nav'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24">
        {children}
      </main>
    </>
  )
}
