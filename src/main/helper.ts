import type { AppConfig, HelperStatus } from '../shared/types'

/**
 * The helper — small AI tasks run either locally (Ollama) or on Google's
 * free Gemini tier. All calls go through the main process so the API key
 * never touches the renderer.
 */

const TIMEOUT_MS = 60_000

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, done: () => clearTimeout(t) }
}

// ---------- providers ----------

async function generateLocal(
  cfg: AppConfig,
  system: string,
  user: string
): Promise<string> {
  const { signal, done } = withTimeout(TIMEOUT_MS)
  try {
    const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.ollamaModel,
        stream: false,
        options: { temperature: 0.15 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        res.status === 404
          ? `Model "${cfg.ollamaModel}" isn't pulled. Run: ollama pull ${cfg.ollamaModel}`
          : `Ollama error ${res.status}. ${text.slice(0, 140)}`
      )
    }
    const data = (await res.json()) as { message?: { content?: string }; error?: string }
    if (data.error) throw new Error(`Ollama: ${data.error}`)
    const text = (data.message?.content ?? '').trim()
    if (!text) throw new Error('The local model returned nothing. Try a different model in Settings.')
    return text
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The local model took too long. Try a smaller model.')
    }
    if (err instanceof TypeError) {
      throw new Error(
        `Can't reach Ollama at ${cfg.ollamaUrl}. Is it running? (Install from ollama.com, then: ollama pull ${cfg.ollamaModel})`
      )
    }
    throw err
  } finally {
    done()
  }
}

async function generateCloud(
  cfg: AppConfig,
  system: string,
  user: string
): Promise<string> {
  if (!cfg.geminiKey.trim()) {
    throw new Error('No Gemini API key set. Add one in Settings → The helper.')
  }
  const { signal, done } = withTimeout(TIMEOUT_MS)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${encodeURIComponent(
      cfg.geminiKey.trim()
    )}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      }),
      signal
    })
    const data = (await res.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] }
        finishReason?: string
      }[]
      promptFeedback?: { blockReason?: string }
      error?: { message?: string }
    }
    if (!res.ok) {
      throw new Error(
        data.error?.message ? `Gemini: ${data.error.message}` : `Gemini error ${res.status}`
      )
    }
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked the request (${data.promptFeedback.blockReason}).`)
    }
    const cand = data.candidates?.[0]
    const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text.trim()) {
      throw new Error(
        `Gemini returned nothing${cand?.finishReason ? ` (${cand.finishReason})` : ''}. Check the model name in Settings — try "gemini-1.5-flash".`
      )
    }
    return text.trim()
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Gemini took too long to respond.')
    }
    if (err instanceof TypeError) {
      throw new Error('Can’t reach Gemini. Check your internet connection.')
    }
    throw err
  } finally {
    done()
  }
}

export async function generate(cfg: AppConfig, system: string, user: string): Promise<string> {
  return cfg.engine === 'cloud'
    ? generateCloud(cfg, system, user)
    : generateLocal(cfg, system, user)
}

// ---------- status ----------

export async function helperStatus(cfg: AppConfig): Promise<HelperStatus> {
  if (cfg.engine === 'cloud') {
    return {
      engine: 'cloud',
      ready: cfg.geminiKey.trim().length > 0,
      detail: cfg.geminiKey.trim()
        ? `Gemini · ${cfg.geminiModel}`
        : 'No API key set'
    }
  }
  const { signal, done } = withTimeout(4000)
  try {
    const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/tags`, { signal })
    if (!res.ok) throw new Error()
    const data = (await res.json()) as { models?: { name?: string }[] }
    const models = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    const hasModel = models.some((m) => m === cfg.ollamaModel || m.startsWith(cfg.ollamaModel + ':'))
    return {
      engine: 'local',
      ready: hasModel,
      detail: hasModel
        ? `Ollama running · ${cfg.ollamaModel}`
        : models.length
          ? `Ollama running, but "${cfg.ollamaModel}" isn't pulled`
          : 'Ollama running, no models pulled',
      localModels: models
    }
  } catch {
    return { engine: 'local', ready: false, detail: 'Ollama not running' }
  } finally {
    done()
  }
}

// ---------- tasks ----------

const TIDY_SYSTEM = `You fix spelling, typos, punctuation, capitalisation and Markdown formatting in a piece of text.
Correct every spelling mistake and typo. Fix capitalisation and punctuation. Tidy Markdown headings, lists and spacing.
Do NOT rephrase, add, remove, summarise or explain anything — only fix mistakes.
Reply with the corrected text and nothing else. No quotes around it, no notes, no preamble.`

const REFUSAL = /\b(i (cannot|can't|am unable|am sorry)|as an ai|i'm sorry, but)\b/i

export async function tidyUp(cfg: AppConfig, markdown: string): Promise<string> {
  const src = markdown.trim()
  if (!src) return ''

  const out = await generate(
    cfg,
    TIDY_SYSTEM,
    `Fix all spelling mistakes, typos and formatting in the text below. Return only the corrected text.\n\n---\n${src}\n---`
  )
  let cleaned = stripFences(out).trim()
  // some models wrap the answer in quotes or add a "Corrected:" label
  cleaned = cleaned
    .replace(/^(corrected( text)?|here('?s| is)[^:]*):\s*/i, '')
    .replace(/^["'“](.*)["'”]$/s, '$1')
    .trim()

  if (!cleaned) return src
  if (REFUSAL.test(cleaned.slice(0, 120))) return src
  // guard against wild hallucination (model rewrote / expanded a lot)
  if (cleaned.length > src.length * 2.5 + 60) return src
  return cleaned
}

const SUMMARY_SYSTEM = `You write one sentence describing what a note contains, so its author can recognise it in a long list later.
- ONE sentence, 12 to 30 words. Never just repeat the title.
- State the actual subject and the main point or takeaway, using specifics from the text (names, references, the key claim).
- Plain language. Do not start with "This note", "The note", "A note about", or "Notes on". No surrounding quotes.
- Output only the sentence.`

export async function summarize(cfg: AppConfig, title: string, markdown: string): Promise<string> {
  const body = markdown.trim().slice(0, 8000)
  if (body.length < 20) return ''
  const raw = await generate(
    cfg,
    SUMMARY_SYSTEM,
    `Write the one-sentence description.\n\nNote title: ${title}\n\nNote text:\n${body}`
  )
  let s = raw
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)[0] ?? ''
  s = s.replace(/^(here('?s| is)[^:]*:|summary:|description:)\s*/i, '').trim()
  // reject a summary that's just the title echoed back
  const norm = (x: string): string => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (!s || norm(s) === norm(title) || s.split(/\s+/).length < 4) return ''
  return s.slice(0, 260)
}

const TAGS_SYSTEM = `You label a personal note with topic tags so it can be found later.
- Give 3 to 5 tags. Lowercase. One or two words each; join two words with a hyphen (e.g. sermon-prep, mark-6).
- Tags must be REAL topics, people, places, books, or scripture references that appear in this specific note — not generic words like "note", "idea", "thoughts", "draft", "misc".
- No "#". Output only the tags separated by commas, nothing else.`

const GENERIC_TAGS = new Set([
  'note',
  'notes',
  'idea',
  'ideas',
  'thought',
  'thoughts',
  'draft',
  'misc',
  'general',
  'todo',
  'stuff',
  'personal',
  'imported',
  'untitled'
])

export async function suggestTags(
  cfg: AppConfig,
  title: string,
  markdown: string
): Promise<string[]> {
  const body = markdown.trim().slice(0, 8000)
  if (body.length < 20) return []
  const out = await generate(cfg, TAGS_SYSTEM, `Note title: ${title}\n\nNote text:\n${body}`)
  return out
    .replace(/^[^a-z0-9]*/i, '')
    .split(/[,\n]/)
    .map((t) =>
      t
        .trim()
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
    )
    .filter((t) => t && t.length >= 2 && t.length <= 24 && !GENERIC_TAGS.has(t))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5)
}

function stripFences(s: string): string {
  const m = s.match(/^```(?:markdown|md)?\n([\s\S]*?)\n```$/)
  return m ? m[1] : s
}
