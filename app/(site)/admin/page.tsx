'use client'

import { useState } from 'react'
import type { Entry } from '@/lib/supabase'

const CATEGORIES = ['Makers', 'Storytellers', 'Scientists', 'Athletes', 'Philosophy', 'Film']

type VideoLink = { label: string; url: string }

type Form = {
  title: string
  person_topic: string
  category: string
  tags: string
  hook: string
  story: string
  key_lessons: string
  video_links: VideoLink[]
  rabbit_holes: string
  student_prompt: string
  cover_image_url: string
  featured: boolean
  published: boolean
}

const empty: Form = {
  title: '',
  person_topic: '',
  category: 'Makers',
  tags: '',
  hook: '',
  story: '',
  key_lessons: '',
  video_links: [{ label: '', url: '' }],
  rabbit_holes: '',
  student_prompt: '',
  cover_image_url: '',
  featured: false,
  published: false,
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [form, setForm] = useState<Form>(empty)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [jsonOpen, setJsonOpen] = useState(false)

  function headers() {
    return { 'Content-Type': 'application/json', 'x-admin-password': password }
  }

  function setVideo(index: number, key: keyof VideoLink, value: string) {
    setForm(f => {
      const links = [...f.video_links]
      links[index] = { ...links[index], [key]: value }
      return { ...f, video_links: links }
    })
  }

  function addVideo() {
    setForm(f => ({ ...f, video_links: [...f.video_links, { label: '', url: '' }] }))
  }

  function removeVideo(index: number) {
    setForm(f => ({ ...f, video_links: f.video_links.filter((_, i) => i !== index) }))
  }

  function importJson() {
    setJsonError('')
    try {
      const raw = jsonInput.trim()
      const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      const parsed = JSON.parse(match ? match[1] : raw)

      const videoLinks: VideoLink[] = Array.isArray(parsed.video_links) && parsed.video_links.length > 0
        ? parsed.video_links.map((v: VideoLink) => ({ label: v.label ?? '', url: v.url ?? '' }))
        : [{ label: '', url: '' }]

      setForm({
        title: parsed.title ?? '',
        person_topic: parsed.person_topic ?? '',
        category: parsed.category ?? 'Makers',
        tags: Array.isArray(parsed.tags) ? parsed.tags.join(', ') : '',
        hook: parsed.hook ?? '',
        story: parsed.story ?? '',
        key_lessons: Array.isArray(parsed.key_lessons) ? parsed.key_lessons.join('\n') : '',
        video_links: videoLinks,
        rabbit_holes: Array.isArray(parsed.rabbit_holes) ? parsed.rabbit_holes.join('\n') : '',
        student_prompt: parsed.student_prompt ?? '',
        cover_image_url: parsed.cover_image_url ?? '',
        featured: parsed.featured ?? false,
        published: parsed.published ?? false,
      })
      setJsonInput('')
      setJsonOpen(false)
      window.scrollTo({ top: 200, behavior: 'smooth' })
    } catch {
      setJsonError('Could not parse JSON — make sure you copied the full block from the AI.')
    }
  }

  async function loadEntries() {
    const res = await fetch('/api/entries', { headers: headers() })
    if (res.ok) setEntries(await res.json())
  }

  async function login() {
    const res = await fetch('/api/entries', { headers: headers() })
    if (res.ok) { setAuthed(true); setEntries(await res.json()) }
    else setMsg('Wrong password')
  }

  function startEdit(entry: Entry) {
    setEditId(entry.id)
    const videoLinks: VideoLink[] = entry.video_links.length > 0
      ? entry.video_links
      : [{ label: '', url: '' }]
    setForm({
      title: entry.title,
      person_topic: entry.person_topic ?? '',
      category: entry.category,
      tags: entry.tags.join(', '),
      hook: entry.hook ?? '',
      story: entry.story ?? '',
      key_lessons: entry.key_lessons.join('\n'),
      video_links: videoLinks,
      rabbit_holes: entry.rabbit_holes.join('\n'),
      student_prompt: entry.student_prompt ?? '',
      cover_image_url: entry.cover_image_url ?? '',
      featured: entry.featured,
      published: entry.published,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditId(null)
    setForm(empty)
    setMsg('')
  }

  async function save() {
    setSaving(true)
    setMsg('')

    const payload = {
      ...(editId ? { id: editId } : {}),
      title: form.title,
      person_topic: form.person_topic || null,
      category: form.category,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      hook: form.hook || null,
      story: form.story || null,
      key_lessons: form.key_lessons.split('\n').map(s => s.trim()).filter(Boolean),
      video_links: form.video_links.filter(v => v.url.trim()),
      rabbit_holes: form.rabbit_holes.split('\n').map(s => s.trim()).filter(Boolean),
      student_prompt: form.student_prompt || null,
      cover_image_url: form.cover_image_url || null,
      featured: form.featured,
      published: form.published,
    }

    const method = editId ? 'PUT' : 'POST'
    const res = await fetch('/api/entries', { method, headers: headers(), body: JSON.stringify(payload) })

    if (res.ok) {
      setMsg(editId ? 'Updated!' : 'Saved!')
      cancelEdit()
      loadEntries()
    } else {
      const err = await res.json()
      setMsg('Error: ' + err.error)
    }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    await fetch('/api/entries', { method: 'DELETE', headers: headers(), body: JSON.stringify({ id }) })
    loadEntries()
  }

  const inputStyle = {
    background: 'var(--surface2)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  }

  const field = (label: string, key: keyof Omit<Form, 'video_links'>, type: 'input' | 'textarea' = 'input', hint?: string) => (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
        {hint && <span className="ml-2 font-normal opacity-60">{hint}</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          rows={key === 'story' ? 10 : 4}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
      )}
    </div>
  )

  if (!authed) {
    return (
      <div className="py-16 flex flex-col items-center gap-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>Admin</h1>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-64 px-4 py-2 rounded-lg text-sm outline-none"
          style={inputStyle}
        />
        <button onClick={login} className="px-6 py-2 rounded-full text-sm font-medium" style={{ background: 'var(--accent)', color: '#0a0a0a' }}>
          Enter
        </button>
        {msg && <p className="text-sm" style={{ color: '#f87171' }}>{msg}</p>}
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>
          {editId ? 'Edit Entry' : 'New Entry'}
        </h1>
        {editId && (
          <button onClick={cancelEdit} className="text-xs" style={{ color: 'var(--text-muted)' }}>Cancel</button>
        )}
      </div>

      {/* JSON Import */}
      <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <button
          onClick={() => setJsonOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium"
          style={{ background: 'var(--surface2)', color: 'var(--accent)' }}
        >
          <span>⚡ Import from AI</span>
          <span style={{ color: 'var(--text-muted)' }}>{jsonOpen ? '▲' : '▼'}</span>
        </button>
        {jsonOpen && (
          <div className="p-5 flex flex-col gap-3" style={{ background: 'var(--surface)' }}>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Paste the JSON block from the AI. Works with or without the ```json``` wrapper.
            </p>
            <textarea
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              rows={6}
              placeholder={'```json\n{\n  "title": "...",\n  ...\n}\n```'}
              className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y"
              style={inputStyle}
            />
            {jsonError && <p className="text-xs" style={{ color: '#f87171' }}>{jsonError}</p>}
            <button
              onClick={importJson}
              disabled={!jsonInput.trim()}
              className="py-2 rounded-full text-sm font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#0a0a0a' }}
            >
              Fill form from JSON
            </button>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5 mb-10 p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {field('Title *', 'title')}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Category *</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {field('Person / Topic', 'person_topic')}
        </div>

        {field('Tags', 'tags', 'input')}
        {field('Hook', 'hook', 'textarea')}
        {field('Story', 'story', 'textarea')}
        {field('Key Lessons', 'key_lessons', 'textarea', 'one per line')}

        {/* Video Links — explicit label + URL rows */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
            Videos
          </label>
          <div className="flex flex-col gap-2">
            {form.video_links.map((v, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input
                  type="text"
                  placeholder="Label (e.g. Steve Jobs Stanford speech)"
                  value={v.label}
                  onChange={e => setVideo(i, 'label', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="YouTube URL"
                  value={v.url}
                  onChange={e => setVideo(i, 'url', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
                {form.video_links.length > 1 && (
                  <button
                    onClick={() => removeVideo(i)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ color: '#f87171' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addVideo}
              className="self-start text-xs px-3 py-1.5 rounded-full mt-1"
              style={{ background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              + Add video
            </button>
          </div>
        </div>

        {field('Rabbit Holes', 'rabbit_holes', 'textarea', 'one search prompt per line')}
        {field('Student Prompt', 'student_prompt', 'textarea')}
        {field('Cover Image URL', 'cover_image_url')}

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={form.featured} onChange={e => setForm(f => ({ ...f, featured: e.target.checked }))} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-dim)' }}>
            <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} />
            Published
          </label>
        </div>

        {msg && (
          <p className="text-sm" style={{ color: msg.startsWith('Error') ? '#f87171' : '#4ade80' }}>{msg}</p>
        )}

        <button
          onClick={save}
          disabled={saving || !form.title}
          className="py-3 rounded-full text-sm font-medium disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0a0a0a' }}
        >
          {saving ? 'Saving…' : editId ? 'Update Entry' : 'Save Entry'}
        </button>
      </div>

      {/* Entries list */}
      <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-muted)' }}>
        All Entries ({entries.length})
      </h2>
      <div className="flex flex-col gap-3">
        {entries.map(e => (
          <div key={e.id} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-medium" style={{ color: e.published ? 'var(--text)' : 'var(--text-muted)' }}>
                {e.title}
                {!e.published && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>(draft)</span>}
                {e.featured && <span className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>★</span>}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{e.category} · {e.person_topic}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => startEdit(e)} className="text-xs" style={{ color: 'var(--accent)' }}>Edit</button>
              <button onClick={() => deleteEntry(e.id)} className="text-xs" style={{ color: '#f87171' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
