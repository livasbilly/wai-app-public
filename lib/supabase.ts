import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side: public reads only (respects RLS — only published entries)
export const supabase = createClient(url, anon)

export type Entry = {
  id: string
  title: string
  person_topic: string | null
  category: 'Makers' | 'Storytellers' | 'Scientists' | 'Athletes' | 'Philosophy' | 'Film'
  tags: string[]
  hook: string | null
  story: string | null
  key_lessons: string[]
  video_links: { label: string; url: string }[]
  rabbit_holes: string[]
  student_prompt: string | null
  cover_image_url: string | null
  featured: boolean
  published: boolean
  created_at: string
}
