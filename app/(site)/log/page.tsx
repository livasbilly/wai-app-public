'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
type Persona = 'xplorer' | 'casper'
type Message = { role: 'user' | 'ai'; text: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date) { return d.toISOString().slice(0, 10) }

function buildXplorerMarkdown(messages: Message[], date: string): string {
  const lines = [`---`, `date: ${date}`, `persona: XPLorer`, `---`, ``, `# XPLorer Log — ${date}`, ``]
  for (const m of messages) {
    if (m.role === 'user') lines.push(`**Me:** ${m.text}`, '')
    else lines.push(`> ${m.text}`, '')
  }
  return lines.join('\n')
}

function downloadMd(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── CASper inline renderer ───────────────────────────────────────────────────
// Handles **bold**, *italic* within a line of text
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{part.slice(1, -1)}</em>
    return <span key={i}>{part}</span>
  })
}

// Processes the response line-by-line so single \n works fine
function CasperMessage({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let bodyAcc: string[] = []
  let pathAcc: string[] = []
  let key = 0

  function flushBody() {
    if (bodyAcc.length === 0) return
    const combined = bodyAcc.join(' ').trim()
    if (combined) {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed" style={{ color: 'var(--text-dim)' }}>
          {renderInline(combined)}
        </p>
      )
    }
    bodyAcc = []
  }

  function flushPaths() {
    if (pathAcc.length === 0) return
    elements.push(
      <div key={key++} className="flex flex-col gap-2 mt-1" style={{ borderLeft: '2px solid #9b7cc455', paddingLeft: '12px' }}>
        {pathAcc.map((line, j) => (
          <p key={j} className="text-xs leading-relaxed" style={{ color: '#9b7cc4' }}>
            {renderInline(line)}
          </p>
        ))}
      </div>
    )
    pathAcc = []
  }

  for (const raw of lines) {
    const line = raw.trim()

    // Arrow path line
    if (line.startsWith('→') || line.startsWith('->')) {
      flushBody()
      pathAcc.push(line.startsWith('->') ? '→' + line.slice(2) : line)
      continue
    }

    // Non-arrow line: flush any accumulated paths first
    flushPaths()

    if (!line) continue

    // Reaction: whole line wrapped in single *…* (not **)
    const isReaction = line.startsWith('*') && line.endsWith('*') && !line.startsWith('**') && line.length > 2
    if (isReaction) {
      flushBody()
      elements.push(
        <p key={key++} className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {line.slice(1, -1)}
        </p>
      )
      continue
    }

    // Regular body text — accumulate to join into one paragraph
    bodyAcc.push(line)
  }

  flushBody()
  flushPaths()

  return <div className="flex flex-col gap-3">{elements}</div>
}

// ─── Main Log Content Component ───────────────────────────────────────────────
function LogPageContent() {
  const [persona, setPersona] = useState<Persona>('xplorer')
  const [xplorerMessages, setXplorerMessages] = useState<Message[]>([])
  const [casperMessages, setCasperMessages] = useState<Message[]>([])
  const [xplorerInput, setXplorerInput] = useState('')
  const [casperInput, setCasperInput] = useState('')
  const [xplorerReflection, setXplorerReflection] = useState<string | null>(null)
  const [casperReflection, setCasperReflection] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [exported, setExported] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const today = formatDate(new Date())
  const INACTIVITY_LIMIT = 10 * 60 * 1000 // 10 minutes

  // Compute active variables dynamically based on active persona
  const messages = persona === 'xplorer' ? xplorerMessages : casperMessages
  const setMessages = persona === 'xplorer' ? setXplorerMessages : setCasperMessages
  const input = persona === 'xplorer' ? xplorerInput : casperInput
  const setInput = persona === 'xplorer' ? setXplorerInput : setCasperInput
  const reflection = persona === 'xplorer' ? xplorerReflection : casperReflection
  const setReflection = persona === 'xplorer' ? setXplorerReflection : setCasperReflection

  // 1. Hydrate state from localStorage on mount
  useEffect(() => {
    let urlPersona: Persona | null = null
    if (typeof window !== 'undefined') {
      const p = searchParams?.get('persona')
      if (p === 'casper' || p === 'xplorer') {
        urlPersona = p as Persona
      }
    }

    const now = Date.now()

    // Hydrate XPLorer
    const savedXplorer = localStorage.getItem('wai_log_session_xplorer')
    if (savedXplorer) {
      try {
        const data = JSON.parse(savedXplorer)
        if (now - data.lastUpdated < INACTIVITY_LIMIT) {
          setXplorerMessages(data.messages || [])
          setXplorerReflection(data.reflection || null)
          setXplorerInput(data.input || '')
        } else {
          localStorage.removeItem('wai_log_session_xplorer')
        }
      } catch (e) {
        console.error('Failed to parse saved xplorer session:', e)
      }
    }

    // Hydrate CASper
    const savedCasper = localStorage.getItem('wai_log_session_casper')
    if (savedCasper) {
      try {
        const data = JSON.parse(savedCasper)
        if (now - data.lastUpdated < INACTIVITY_LIMIT) {
          setCasperMessages(data.messages || [])
          setCasperReflection(data.reflection || null)
          setCasperInput(data.input || '')
        } else {
          localStorage.removeItem('wai_log_session_casper')
        }
      } catch (e) {
        console.error('Failed to parse saved casper session:', e)
      }
    }

    // Determine final persona
    let finalPersona: Persona = 'xplorer'
    if (urlPersona) {
      finalPersona = urlPersona
    } else {
      const lastX = savedXplorer ? JSON.parse(savedXplorer).lastUpdated || 0 : 0
      const lastC = savedCasper ? JSON.parse(savedCasper).lastUpdated || 0 : 0
      if (lastC > lastX && now - lastC < INACTIVITY_LIMIT) {
        finalPersona = 'casper'
      }
    }

    setPersona(finalPersona)
    if (urlPersona !== finalPersona) {
      router.replace(`/log?persona=${finalPersona}`, { scroll: false })
    }
    setIsLoaded(true)
  }, [searchParams, router])

  // 2. Auto-save XPLorer state
  useEffect(() => {
    if (!isLoaded) return
    if (xplorerMessages.length > 0 || xplorerInput.trim()) {
      localStorage.setItem('wai_log_session_xplorer', JSON.stringify({
        messages: xplorerMessages,
        reflection: xplorerReflection,
        input: xplorerInput,
        lastUpdated: Date.now()
      }))
    } else {
      localStorage.removeItem('wai_log_session_xplorer')
    }
  }, [xplorerMessages, xplorerReflection, xplorerInput, isLoaded])

  // 3. Auto-save CASper state
  useEffect(() => {
    if (!isLoaded) return
    if (casperMessages.length > 0 || casperInput.trim()) {
      localStorage.setItem('wai_log_session_casper', JSON.stringify({
        messages: casperMessages,
        reflection: casperReflection,
        input: casperInput,
        lastUpdated: Date.now()
      }))
    } else {
      localStorage.removeItem('wai_log_session_casper')
    }
  }, [casperMessages, casperReflection, casperInput, isLoaded])

  const personaParam = searchParams?.get('persona') as Persona | null

  // 4. Listen for query parameter changes in URL to hot-swap persona
  useEffect(() => {
    if (!isLoaded) return
    if (personaParam === 'casper' || personaParam === 'xplorer') {
      if (personaParam !== persona) {
        setPersona(personaParam)
        setExported(false)
      }
    }
  }, [personaParam, isLoaded, persona])

  // 5. Real-time inactivity timeout (clears both after 10 minutes of inactivity)
  useEffect(() => {
    if (!isLoaded) return
    if (xplorerMessages.length === 0 && casperMessages.length === 0) return

    let timeoutId: NodeJS.Timeout

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        setXplorerMessages([])
        setXplorerReflection(null)
        setXplorerInput('')
        setCasperMessages([])
        setCasperReflection(null)
        setCasperInput('')
        setExported(false)
        localStorage.removeItem('wai_log_session_xplorer')
        localStorage.removeItem('wai_log_session_casper')
        alert('Your log session has expired due to 10 minutes of inactivity.')
      }, INACTIVITY_LIMIT)
    };

    resetTimer()

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetTimer))

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      events.forEach(event => window.removeEventListener(event, resetTimer))
    }
  }, [xplorerMessages.length, casperMessages.length, isLoaded])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, reflection])

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    if (!overrideText) setInput('')
    setExported(false)

    const updated: Message[] = [...messages, { role: 'user', text }]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, persona }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'ai', text: data.reply }])
    } catch {
      setMessages(m => [...m, { role: 'ai', text: 'Connection error. Keep writing — your words are saved here.' }])
    }
    setLoading(false)
  }

  async function generateReflection() {
    setGenerating(true)
    try {
      const res = await fetch('/api/cas-reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, date: today }),
      })
      const data = await res.json()
      setReflection(data.markdown ?? 'Could not generate reflection.')
    } catch {
      setReflection('Error generating reflection. Try again.')
    }
    setGenerating(false)
  }

  const accentColor = persona === 'casper' ? '#9b7cc4' : 'var(--accent)'

  return (
    <div className="py-8 flex flex-col" style={{ minHeight: 'calc(100vh - 56px)' }}>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold" style={{ color: accentColor }}>Log</h1>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {today} — {persona === 'xplorer' ? 'What caught your attention today?' : 'What experience are you reflecting on?'}
        </p>
      </div>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
          <div className="text-5xl mb-2" style={{ color: accentColor, opacity: 0.4 }}>
            {persona === 'xplorer' ? '✦' : '◎'}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {persona === 'xplorer'
              ? <>Start typing — a video, a thought, something that stuck with you today.</>
              : <>Describe your experience in your own words.<br />Raw notes, voice transcription, anything goes.</>}
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-5 mb-6">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start w-full max-w-[92%]'}>
              {m.role === 'user' ? (
                <div className="px-4 py-3 rounded-2xl rounded-br-sm text-sm leading-relaxed"
                  style={{ background: accentColor, color: persona === 'casper' ? '#fff' : '#0a0a0a' }}>
                  {m.text}
                </div>
              ) : persona === 'casper' ? (
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{ background: 'var(--surface)', border: '1px solid #9b7cc422' }}>
                  <CasperMessage text={m.text} />
                </div>
              ) : (
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed"
                  style={{ background: 'var(--surface)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                  {m.text}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="self-start px-4 py-3 rounded-2xl rounded-bl-sm text-sm"
              style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <span className="animate-pulse">thinking…</span>
            </div>
          )}

          {/* CASper reflection preview */}
          {reflection && (
            <div className="rounded-2xl p-4 mt-2" style={{ background: 'var(--surface)', border: '1px solid #9b7cc4' }}>
              <p className="text-xs font-bold mb-3 tracking-widest" style={{ color: '#9b7cc4' }}>REFLECTION — PREVIEW</p>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono" style={{ color: 'var(--text-dim)' }}>
                {reflection}
              </pre>
              <button
                onClick={() => { downloadMd(reflection, `reflection-${today}.md`); setExported(true) }}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: '#9b7cc4', color: '#fff' }}
              >
                {exported ? '✓ Downloaded' : '↓ Download Reflection'}
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-6 mt-auto">
        <div className="rounded-2xl p-3 flex gap-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={persona === 'xplorer' ? "What's on your mind?" : "Describe your experience — raw, unfiltered, voice notes welcome."}
            rows={2}
            className="flex-1 resize-none text-sm outline-none bg-transparent leading-relaxed"
            style={{ color: 'var(--text)' }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="self-end px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30 transition-opacity"
            style={{ background: accentColor, color: persona === 'casper' ? '#fff' : '#0a0a0a' }}
          >
            →
          </button>
        </div>

        <div className="text-[10px] text-center mt-2.5 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
          <span>⚡ Powered by DeepSeek API</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>🔒 Private local-data processing via Google Vertex AI coming soon</span>
        </div>

        {messages.length > 0 && (
          <div className="flex items-center justify-between mt-3 px-1">
            <div className="flex items-center gap-3">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {messages.filter(m => m.role === 'user').length} entries
              </p>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to clear the current conversation?')) {
                    setMessages([])
                    setReflection(null)
                    setInput('')
                    setExported(false)
                  }
                }}
                className="text-xs hover:underline cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            </div>
            {persona === 'xplorer' ? (
              <button
                onClick={() => { downloadMd(buildXplorerMarkdown(messages, today), `WAI-${today}.md`); setExported(true) }}
                className="text-xs px-3 py-1.5 rounded-full"
                style={{ background: exported ? 'var(--surface2)' : 'var(--accent)', color: exported ? 'var(--text-muted)' : '#0a0a0a' }}
              >
                {exported ? '✓ Downloaded' : '↓ Save to SD card'}
              </button>
            ) : (
              <button
                onClick={generateReflection}
                disabled={generating || messages.length < 2}
                className="text-xs px-3 py-1.5 rounded-full disabled:opacity-40"
                style={{ background: '#9b7cc4', color: '#fff' }}
              >
                {generating ? 'Generating…' : '✦ Generate Reflection'}
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

export default function LogPage() {
  return (
    <Suspense fallback={
      <div className="py-8 flex flex-col items-center justify-center text-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading log...</p>
      </div>
    }>
      <LogPageContent />
    </Suspense>
  )
}
