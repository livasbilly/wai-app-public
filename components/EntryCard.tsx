import Link from 'next/link'
import type { Entry } from '@/lib/supabase'

const categoryColors: Record<string, string> = {
  Makers:       '#d4a853',
  Storytellers: '#7c9d8e',
  Scientists:   '#6b7fc4',
  Athletes:     '#c47c6b',
  Philosophy:   '#9b7cc4',
  Film:         '#c4a77c',
}

export default function EntryCard({ entry }: { entry: Entry }) {
  const color = categoryColors[entry.category] ?? 'var(--accent)'

  return (
    <Link href={`/entry/${entry.id}`} className="block group">
      <article
        className="rounded-xl p-5 border transition-all duration-200 group-hover:border-opacity-60"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: color + '22', color }}
          >
            {entry.category}
          </span>
          {entry.featured && (
            <span className="text-xs" style={{ color: 'var(--accent)' }}>★ Featured</span>
          )}
        </div>

        {entry.cover_image_url && (
          <img
            src={entry.cover_image_url}
            alt={entry.title}
            className="w-full h-40 object-cover rounded-lg mb-4"
          />
        )}

        <h2 className="text-base font-semibold mb-1 leading-snug" style={{ color: 'var(--text)' }}>
          {entry.title}
        </h2>

        {entry.person_topic && (
          <p className="text-xs mb-2" style={{ color }}>
            {entry.person_topic}
          </p>
        )}

        {entry.hook && (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-dim)' }}>
            {entry.hook}
          </p>
        )}

        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {entry.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </Link>
  )
}
