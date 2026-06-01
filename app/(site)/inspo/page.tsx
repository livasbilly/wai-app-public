import { supabase } from '@/lib/supabase'
import EntryCard from '@/components/EntryCard'
import type { Entry } from '@/lib/supabase'

const CATEGORIES = ['Makers', 'Storytellers', 'Scientists', 'Athletes', 'Philosophy', 'Film'] as const

async function getEntries(category?: string) {
  let query = supabase
    .from('entries')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data } = await query
  return (data ?? []) as Entry[]
}

export default async function InspoPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const entries = await getEntries(category)

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--accent)' }}>
          Explore
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Ideas worth chasing. Pick one and go deep.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-8">
        <a
          href="/inspo"
          className="px-3 py-1 rounded-full text-xs transition-all"
          style={{
            background: !category ? 'var(--accent)' : 'var(--surface)',
            color: !category ? '#0a0a0a' : 'var(--text-dim)',
            border: '1px solid',
            borderColor: !category ? 'var(--accent)' : 'var(--border)',
          }}
        >
          All
        </a>
        {CATEGORIES.map(cat => (
          <a
            key={cat}
            href={`/inspo?category=${cat}`}
            className="px-3 py-1 rounded-full text-xs transition-all"
            style={{
              background: category === cat ? 'var(--accent)' : 'var(--surface)',
              color: category === cat ? '#0a0a0a' : 'var(--text-dim)',
              border: '1px solid',
              borderColor: category === cat ? 'var(--accent)' : 'var(--border)',
            }}
          >
            {cat}
          </a>
        ))}
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-4xl mb-4">✦</p>
          <p className="text-sm">Nothing here yet. Check back soon.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map(entry => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
