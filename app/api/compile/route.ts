import { NextRequest, NextResponse } from 'next/server'

function getCompilerPrompt(subject: string) {
  return `You are a Socratic compiler for the subject: "${subject}".
Your task is to analyze new raw source files (notes, quotes, reflections) and compile/merge them into a student's structured, interlinked Digital Garden of concepts for this subject.

We will provide you with:
1. "NEW SOURCES": The raw notes to process.
2. "EXISTING WIKI": The current state of the compiled digital garden (if any). The files in "EXISTING WIKI" are listed with their filenames formatted as "concept-id.md" (e.g., "theme-ambition.md"). The concept-id corresponds to the filename without the ".md" extension (e.g., "theme-ambition").

Instructions:
- Analyze ALL the "NEW SOURCES" and identify key concepts mentioned in them. You must dynamically extract 5-6 logical category types appropriate for the subject "${subject}" (e.g., Work, Character, Theme, Device, Concept; or Organism, Process, System, Molecule, Theory; or Event, Figure, Concept, Period, Source).

- For each concept:
  - If a concept is mentioned in "NEW SOURCES" and it ALREADY exists in "EXISTING WIKI" (by matching its concept-id, ignoring the ".md" extension of the filename), intelligently MERGE the new insights, quotes, and sources from "NEW SOURCES" into the existing content. Do not overwrite or lose previous insights. Synthesize them into a single, cohesive, deeper page. The resulting page MUST be included in the output.
  - If a concept is mentioned in "NEW SOURCES" and it is NEW (does not exist in "EXISTING WIKI"), create a fresh page for it. The resulting page MUST be included in the output. Even if the concept is completely unrelated to the existing wiki documents, you MUST detect it and create a new concept page for it.
  
- Crucially, you must build a highly connected web of knowledge:
  - Enforce dense connection creation: aim for multiple links per page to establish a rich network.
  - In the markdown "content" of each page, write inline Obsidian-style [[wiki-link]] connections to other concepts whenever relevant.
  - Ensure the index backlink is included: every page must link back to the index. Specifically, you MUST include the '[[index]]' link inline in the markdown content and also include 'index' in the relatedLinks list.
  - Use lowercase hyphenated keys matching the concept-ids for your [[wiki-link]] identifiers (e.g., [[lady-macbeth]], [[theme-ambition]]).

- Exclude Unchanged Pages:
  - You MUST ONLY return pages in the JSON output that are either NEW (created from the new raw sources) or have been ACTUALLY UPDATED with new insights, quotes, or references from the new raw sources.
  - Do NOT include any existing concept pages that remain unchanged or are unrelated to the new sources. They must be completely excluded from the JSON response.

You MUST output the result ONLY as a JSON object of this structure:
{
  "compiled": {
    "concept-id": {
      "title": "Clean Title of Concept",
      "type": "string (one of the 5-6 logical category types appropriate for the subject, or 'other')",
      "summary": "1-2 sentence description",
      "sources": ["source-filename.md"],
      "content": "Deep, structured analysis of the concept. Include key quotes, textual context, and analytical commentary. Keep headings tidy and include inline [[concept-id]] links. Always include the '[[index]]' link to ensure index backlink.",
      "relatedLinks": ["other-concept-id-1", "other-concept-id-2", "index"]
    }
  }
}

Rules:
- The concept-id keys in the "compiled" object must be lowercase and hyphenated (e.g., 'lady-macbeth', 'theme-ambition') and must NOT include the '.md' extension.
- Ensure all relatedLinks and inline [[links]] reference valid lowercase hyphenated concept-ids in the garden.
- Respond ONLY with valid JSON.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const files: Array<{ name: string; content: string }> = body.files
    const existingWiki: Array<{ name: string; content: string }> | undefined = body.existingWiki
    const instruction: string | undefined = body.instruction
    const subject: string = body.subject || body.gardenSubject || 'Mind Sailing'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const newSourcesData = files.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n')
    const existingWikiData = existingWiki && existingWiki.length > 0
      ? existingWiki.map(f => `PAGE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n')
      : 'None (this is the first compile or empty garden)'

    const userMessage = `### NEW SOURCES TO PROCESS:\n${newSourcesData}\n\n### EXISTING WIKI GARDEN STATE:\n${existingWikiData}`

    let systemPrompt = getCompilerPrompt(subject)
    if (instruction) {
      systemPrompt += `\n\nUSER'S COMPILATION INSTRUCTION: The user has specified the following goal for this compilation step:\n${instruction}`
    }

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.15, // lower temperature for precise merge reasoning
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`DeepSeek API failed: ${errText}`)
    }

    const data = await res.json()
    const contentText = data.choices?.[0]?.message?.content

    if (!contentText) {
      throw new Error('No content returned from AI compiler')
    }

    const parsed = JSON.parse(contentText)
    if (!parsed || typeof parsed !== 'object' || !parsed.compiled) {
      throw new Error('AI response structure is missing the "compiled" field')
    }
    return NextResponse.json(parsed)

  } catch (err: any) {
    console.error('Compiler error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
