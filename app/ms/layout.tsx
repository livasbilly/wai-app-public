export default function MsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 w-full flex flex-col">
      {children}
    </main>
  )
}
