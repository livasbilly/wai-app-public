import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Entry } from '@/lib/supabase'

async function getEntry(id: string): Promise<Entry | null> {
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .eq('published', true)
    .single()
  return data as Entry | null
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entry = await getEntry(id)
  if (!entry) notFound()

  return (
    <div className="py-8">
      <Link href="/inspo" className="text-xs mb-6 inline-block" style={{ color: 'var(--text-muted)' }}>
        ← Back
      </Link>

      {/* Category + person */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>
          {entry.category}
        </span>
        {entry.person_topic && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{entry.person_topic}</span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold leading-snug mb-4" style={{ color: 'var(--text)' }}>
        {entry.title}
      </h1>

      {/* Cover */}
      {entry.cover_image_url && (
        <img src={entry.cover_image_url} alt={entry.title} className="w-full rounded-xl mb-6 max-h-64 object-cover" />
      )}

      {/* Hook */}
      {entry.hook && (
        <p className="text-base italic mb-6 leading-relaxed" style={{ color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '1rem' }}>
          {entry.hook}
        </p>
      )}

      {/* Story */}
      {entry.story && (
        <div className="prose-wai mb-8">
          {entry.story.split('\n').map((line, i) => (
            line.trim() ? <p key={i}>{line}</p> : <br key={i} />
          ))}
        </div>
      )}

      {/* Key lessons */}
      {entry.key_lessons.length > 0 && (
        <section className="mb-8 p-5 rounded-xl" style={{ background: 'var(--surface)' }}>
          <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
            KEY LESSONS
          </h2>
          <ul className="flex flex-col gap-3">
            {entry.key_lessons.map((lesson, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--accent)' }}>✦</span>
                {lesson}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Videos */}
      {entry.video_links.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
            WATCH
          </h2>
          <div className="flex flex-col gap-4">
            {entry.video_links.map((v, i) => {
              const ytId = getYouTubeId(v.url)
              return (
                <div key={i}>
                  {v.label && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{v.label}</p>}
                  {ytId ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube.com/embed/${ytId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={v.label}
                      />
                    </div>
                  ) : (
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm underline" style={{ color: 'var(--accent)' }}>
                      {v.url}
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Rabbit holes */}
      {entry.rabbit_holes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-bold tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
            GO DEEPER
          </h2>
          <ul className="flex flex-col gap-2">
            {entry.rabbit_holes.map((hole, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-dim)' }}>
                <span style={{ color: 'var(--accent)' }}>→</span>
                {hole}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Student prompt */}
      {entry.student_prompt && (
        <section className="p-5 rounded-xl border" style={{ borderColor: 'var(--accent)', background: 'var(--accent)11' }}>
          <h2 className="text-xs font-bold tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
            YOUR TURN
          </h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text)' }}>
            {entry.student_prompt}
          </p>
          <Link
            href="/log"
            className="inline-block mt-4 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#0a0a0a' }}
          >
            Log your thoughts →
          </Link>
        </section>
      )}

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8">
          {entry.tags.map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
