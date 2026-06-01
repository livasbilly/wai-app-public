'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* ── SECTION 1: Hero (Retained) ──────────────────────────────────────── */}
      <section
        className="flex flex-col items-center justify-center text-center px-6 py-24"
        style={{ minHeight: 'calc(100svh - 56px)' }}
      >
        <h1
          className="text-6xl sm:text-7xl font-bold leading-none mb-4"
          style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}
        >
          Start with<br />W.A.I.
        </h1>

        <p
          className="text-xl mb-16"
          style={{ color: 'var(--text-muted)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
        >
          Who Am I?
        </p>

        <blockquote className="max-w-sm border-l-2 pl-5 text-left" style={{ borderColor: 'var(--accent)' }}>
          <p
            className="text-sm leading-relaxed mb-3"
            style={{ color: 'var(--text-dim)', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
          >
            "You can control what you think, you can control how you think, and therefore you can control who you are."
          </p>
          <cite className="text-xs not-italic" style={{ color: 'var(--text-muted)' }}>— Eileen Gu</cite>
        </blockquote>

        <div className="mt-16 flex flex-col items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <span className="text-lg animate-bounce">↓</span>
        </div>
      </section>

      {/* ── SECTION 2: Mission (Retained with updates) ───────────────────────── */}
      <section className="px-6 py-20 max-w-lg mx-auto w-full">
        <div
          className="text-lg leading-relaxed flex flex-col gap-2"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          <span style={{ color: '#e06c55', display: 'block' }}>Stop passively consuming inspiration.</span>
          <span style={{ color: '#58a67a', display: 'block' }}>Start tinkering with your own mind like a scientist.</span>
        </div>
        <p
          className="text-base leading-relaxed mt-6"
          style={{ color: 'var(--text-dim)', fontFamily: 'Georgia, serif' }}
        >
          WAI is the framework to capture your thoughts, analyze patterns, and actively rewire your brain.
        </p>
      </section>

      {/* ── SECTION 3: Proof Video (Repositioned below Mission) ─────────────────── */}
      <section className="px-6 py-12 max-w-lg mx-auto w-full flex flex-col items-center">
        <p
          className="text-base font-semibold mb-6 text-center"
          style={{ color: 'var(--text)', fontFamily: 'Georgia, serif' }}
        >
          Approach your mind like a craft.
        </p>

        {/* Elegant vertical video frame */}
        <div className="relative w-full max-w-[320px] group">
          {/* Decorative ambient glow behind the video */}
          <div
            className="absolute -inset-1.5 rounded-[2.2rem] bg-gradient-to-r from-[#e06c55] to-[#58a67a] opacity-35 blur-lg transition duration-1000 group-hover:opacity-45"
          />

          {/* Sleek mobile device mockup wrapper */}
          <div
            className="relative w-full bg-black rounded-[2.2rem] p-3.5 border border-neutral-800 shadow-2xl"
            style={{ aspectRatio: '9/16' }}
          >
            {/* Notch/Speaker detail for the mockup */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-neutral-900 rounded-full flex items-center justify-center z-10">
              <div className="w-12 h-1 bg-neutral-800 rounded-full" />
            </div>

            {/* The video iframe */}
            <div className="w-full h-full rounded-[1.4rem] overflow-hidden bg-zinc-950 relative">
              <iframe
                className="absolute inset-0 w-full h-full border-0"
                src="https://www.youtube.com/embed/2YNKH2A3uQQ?modestbranding=1&rel=0&iv_load_policy=3&controls=0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Approach your mind like a craft"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: SRC Framework Cards ────────────────────────────────────── */}
      <section className="px-6 py-16 max-w-lg mx-auto w-full flex flex-col gap-6">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>
            The S.R.C. Framework
          </h2>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            An invitation to explore your mind
          </p>
        </div>

        {/* Card 1 — Spar */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-2" style={{ color: 'var(--accent)' }}>Spar</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              Spar with XPLorer to unpack your thoughts, break down movies, and share daily observations.
            </p>
          </div>
          <Link
            href="/log?persona=xplorer"
            className="w-full text-center py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: '#0a0a0a' }}
          >
            XPLorer ⚔️
          </Link>
        </div>

        {/* Card 2 — Reflect */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-2" style={{ color: '#9b7cc4' }}>Reflect</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              A structured reflection partner, CASper, is designed to extract evidence-based learnings from your experiences, prompting you with unique paths to capture growth.
            </p>
          </div>
          <Link
            href="/log?persona=casper"
            className="w-full text-center py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#9b7cc4', color: '#ffffff' }}
          >
            CASper 🪞
          </Link>
        </div>

        {/* Card 3 — Chart */}
        <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <p className="text-xs tracking-widest uppercase mb-2" style={{ color: '#7c9d8e' }}>Chart</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              Your brain, offline and interconnected. Direct-link your local folders in the browser to visualize your concepts on an interactive knowledge graph and chat with Ember.
            </p>
          </div>
          <Link
            href="/ms"
            className="w-full text-center py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#7c9d8e', color: '#0a0a0a' }}
          >
            Ember 🔥
          </Link>
        </div>
      </section>

      {/* ── SECTION 5: Local-First Manifesto ─────────────────────────────────── */}
      <section className="px-6 py-16 max-w-lg mx-auto w-full pb-12">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>
            The Local-First Philosophy
          </h2>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            No friction, total ownership, futureproof design
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex gap-4">
            <div className="text-xl mt-0.5" style={{ color: 'var(--accent)' }}>🔓</div>
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>No Accounts</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                No signups, no logins, no barriers. Your thoughts run entirely inside your browser session. Complete private introspection by design.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-xl mt-0.5" style={{ color: 'var(--accent)' }}>📁</div>
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Local Directories</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                Directly read and write markdown files on your local device or USB drive using standard browser directory APIs. Keep your files offline and in your control.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="text-xl mt-0.5" style={{ color: 'var(--accent)' }}>💾</div>
            <div>
              <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Futureproof & Agent Native</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                AI models, local editors, and agents natively understand Markdown. Saving your thoughts in raw text (`.md`) ensures they will never be trapped in locked databases or obsolete file formats. Your data is always ready for whatever platform comes next.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: Call to Action (Read) ─────────────────────────────────── */}
      <section className="px-6 py-16 max-w-lg mx-auto w-full text-center border-t border-neutral-900 pb-32">
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text)', fontFamily: 'Georgia, serif' }}>
          Don't know where to start?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-dim)' }}>
          Dive into our curated collection of notes, philosophy, and mental experiments.
        </p>
        <Link
          href="/inspo"
          className="inline-block px-8 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--accent)', color: '#0a0a0a' }}
        >
          READ (no joke)
        </Link>
      </section>

    </div>
  )
}

