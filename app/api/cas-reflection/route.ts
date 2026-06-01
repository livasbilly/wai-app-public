import { NextRequest, NextResponse } from 'next/server'

const REFLECTION_PROMPT = `You are generating a structured personal growth reflection.

Based on the conversation below, produce an Obsidian-ready markdown file using EXACTLY this template. Preserve the person's authentic voice — do not rewrite or sanitise their language. Extract only the growth themes, skills, or insights that genuinely emerged in the conversation. Do not invent or pad.

---
Title: [A specific, authentic title — pull it from what they actually described, not generic]
Date: {{DATE}}
Tags: #reflection #[activity_type] #[core_theme]
Growth_Themes: [[Theme 1]], [[Theme 2]]
---

### The Raw Feed
[Lightly proofread version of their original narrative. Fix typos, repeated words, voice-to-text transcription errors, and broken grammar — but preserve their vocabulary, slang, sentence rhythm, and emotional tone exactly. It should read like they cleaned it up themselves. Do not rewrite, restructure, or sanitise the content.]

### The Synthesis
[2–3 sentences: what was the real insight that emerged? How did this experience shape their thinking or actions?]

### Growth Themes & Insights
- **[[Theme 1]]:** [Specific moment or action from their story demonstrating this theme or insight]
- **[[Theme 2]]:** [Specific moment or action from their story demonstrating this theme or insight]

---

Output ONLY the markdown. No preamble, no explanation after it.`

type Message = { role: 'user' | 'ai'; text: string }

export async function POST(req: NextRequest) {
  const { messages, date }: { messages: Message[]; date: string } = await req.json()

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'User' : 'CASper'}: ${m.text}`)
    .join('\n\n')

  const prompt = REFLECTION_PROMPT.replace('{{DATE}}', date)

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `Here is the full conversation:\n\n${conversation}` },
      ],
      max_tokens: 1000,
      temperature: 0.4,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Generation failed' }, { status: 500 })

  const data = await res.json()
  const markdown = data.choices?.[0]?.message?.content ?? ''
  return NextResponse.json({ markdown })
}
