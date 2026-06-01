'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function NavLinks() {
  const path = usePathname()
  const searchParams = useSearchParams()
  const currentPersona = searchParams?.get('persona')

  const emojis = [
    {
      href: '/log?persona=xplorer',
      label: '⚔️',
      title: 'XPLorer',
      active: path === '/log' && currentPersona === 'xplorer'
    },
    {
      href: '/log?persona=casper',
      label: '🪞',
      title: 'CASper',
      active: path === '/log' && currentPersona === 'casper'
    },
    {
      href: '/ms',
      label: '🔥',
      title: 'Ember',
      active: path.startsWith('/ms')
    },
  ]

  return (
    <nav className="flex items-center gap-4">
      <Link
        href="/inspo"
        className="px-4 py-1.5 rounded-full text-sm transition-all"
        style={{
          background: path.startsWith('/inspo') || path.startsWith('/entry') ? 'var(--accent)' : 'transparent',
          color: path.startsWith('/inspo') || path.startsWith('/entry') ? '#0a0a0a' : 'var(--text-dim)',
          fontFamily: 'Georgia, serif',
        }}
      >
        Inspo
      </Link>

      <div className="flex gap-2 items-center">
        {emojis.map(emoji => (
          <Link
            key={emoji.href}
            href={emoji.href}
            title={emoji.title}
            className="text-lg p-1.5 rounded-lg transition-all hover:scale-115 active:scale-95 flex items-center justify-center"
            style={{
              opacity: emoji.active ? 1 : 0.45,
              transform: emoji.active ? 'scale(1.15)' : 'none',
              filter: emoji.active ? 'drop-shadow(0 0 4px var(--accent))' : 'none',
            }}
          >
            {emoji.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export default function Nav() {
  const path = usePathname()
  const isAdmin = path.startsWith('/admin')

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">

        <Link
          href="/"
          className="text-sm font-bold tracking-widest"
          style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif', letterSpacing: '0.2em' }}
        >
          W.A.I.
        </Link>

        {!isAdmin && (
          <Suspense fallback={<div className="w-32 h-6" />}>
            <NavLinks />
          </Suspense>
        )}

        {isAdmin && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Admin</span>
        )}
      </div>
    </header>
  )
}

