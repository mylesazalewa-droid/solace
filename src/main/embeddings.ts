import { promises as fs } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import type { AppConfig, AskAnswer, IndexStatus } from '../shared/types'
import { scanVault, readNoteById } from './vault'
import { generate } from './helper'

interface IndexEntry {
  hash: string
  vector: number[]
  title: string
  notebookId: string
}
type Index = Record<string, IndexEntry>

const INDEX_FILE = (vault: string): string => join(vault, '.solace', 'embeddings.json')
const TIMEOUT_MS = 30_000

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return { signal: ctrl.signal, done: () => clearTimeout(t) }
}

async function readIndex(vault: string): Promise<Index> {
  try {
    return JSON.parse(await fs.readFile(INDEX_FILE(vault), 'utf8')) as Index
  } catch {
    return {}
  }
}

async function writeIndex(vault: string, idx: Index): Promise<void> {
  await fs.mkdir(join(vault, '.solace'), { recursive: true })
  await fs.writeFile(INDEX_FILE(vault), JSON.stringify(idx), 'utf8')
}

function contentHash(text: string): string {
  return createHash('sha1').update(text).digest('hex')
}

function noteText(doc: { title: string; summary: string; body: string }): string {
  return [doc.title, doc.summary, doc.body].filter(Boolean).join('\n\n').slice(0, 6000)
}

async function embedOllama(cfg: AppConfig, text: string): Promise<number[]> {
  const { signal, done } = withTimeout(TIMEOUT_MS)
  try {
    const res = await fetch(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.ollamaEmbedModel, prompt: text }),
      signal
    })
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? `Embedding model "${cfg.ollamaEmbedModel}" isn't pulled. Run: ollama pull ${cfg.ollamaEmbedModel}`
          : `Ollama embeddings error ${res.status}`
      )
    }
    const data = (await res.json()) as { embedding?: number[] }
    if (!data.embedding?.length) throw new Error('Ollama returned no embedding.')
    return data.embedding
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Embedding timed out.')
    if (err instanceof TypeError) throw new Error(`Can’t reach Ollama at ${cfg.ollamaUrl}.`)
    throw err
  } finally {
    done()
  }
}

async function embedGemini(cfg: AppConfig, text: string): Promise<number[]> {
  if (!cfg.geminiKey.trim()) throw new Error('No Gemini API key set. Add one in Settings → The helper.')
  const { signal, done } = withTimeout(TIMEOUT_MS)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(cfg.geminiKey.trim())}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
      signal
    })
    const data = (await res.json()) as {
      embedding?: { values?: number[] }
      error?: { message?: string }
    }
    if (!res.ok) throw new Error(data.error?.message ? `Gemini: ${data.error.message}` : `Gemini error ${res.status}`)
    if (!data.embedding?.values?.length) throw new Error('Gemini returned no embedding.')
    return data.embedding.values
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Embedding timed out.')
    if (err instanceof TypeError) throw new Error('Can’t reach Gemini. Check your internet connection.')
    throw err
  } finally {
    done()
  }
}

function embed(cfg: AppConfig, text: string): Promise<number[]> {
  return cfg.engine === 'cloud' ? embedGemini(cfg, text) : embedOllama(cfg, text)
}

export async function indexStatus(vault: string): Promise<IndexStatus> {
  const [snap, idx] = await Promise.all([scanVault(vault), readIndex(vault)])
  const live = new Set(snap.notes.map((n) => n.id))
  const indexed = Object.keys(idx).filter((id) => live.has(id)).length
  return { indexed, total: snap.notes.length }
}

/** Incremental: only re-embeds notes whose content changed since the last pass. */
export async function buildIndex(
  vault: string,
  cfg: AppConfig,
  onProgress?: (done: number, total: number) => void
): Promise<IndexStatus> {
  const snap = await scanVault(vault)
  const idx = await readIndex(vault)
  let done = 0
  for (const s of snap.notes) {
    try {
      const doc = await readNoteById(vault, s.id)
      const text = noteText(doc)
      const hash = contentHash(text)
      if (idx[s.id]?.hash !== hash) {
        const vector = await embed(cfg, text)
        idx[s.id] = { hash, vector, title: doc.title, notebookId: doc.notebookId }
      }
    } catch {
      /* skip this note, keep going — a stale/missing entry just won't show up in results */
    }
    done++
    onProgress?.(done, snap.notes.length)
  }
  const live = new Set(snap.notes.map((n) => n.id))
  for (const id of Object.keys(idx)) if (!live.has(id)) delete idx[id]
  await writeIndex(vault, idx)
  return indexStatus(vault)
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom ? dot / denom : 0
}

export interface SemanticHit {
  noteId: string
  title: string
  notebookId: string
  score: number
}

export async function semanticSearch(
  vault: string,
  cfg: AppConfig,
  query: string,
  limit = 8
): Promise<SemanticHit[]> {
  const idx = await readIndex(vault)
  const entries = Object.entries(idx)
  if (!entries.length) return []
  const qVec = await embed(cfg, query)
  return entries
    .map(([noteId, e]) => ({ noteId, title: e.title, notebookId: e.notebookId, score: cosine(qVec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const ASK_SYSTEM = `You answer questions using only the notes provided as context. Be direct and
specific — quote or paraphrase the relevant part rather than being vague. If the notes don't
actually answer the question, say so plainly instead of guessing. Keep it to a short paragraph
or a few bullet points. Do not invent facts not present in the notes.`

export async function askNotes(vault: string, cfg: AppConfig, question: string): Promise<AskAnswer> {
  const hits = await semanticSearch(vault, cfg, question, 6)
  if (!hits.length) {
    return {
      answer: "I don't have an index to search yet — build one first, or none of your notes matched closely enough.",
      sources: []
    }
  }
  const docs = await Promise.all(hits.map((h) => readNoteById(vault, h.noteId).catch(() => null)))
  const context = docs
    .map((d, i) => (d ? `### ${d.title}\n${d.body.slice(0, 2500)}` : null))
    .filter(Boolean)
    .join('\n\n---\n\n')
  const answer = await generate(cfg, ASK_SYSTEM, `Notes:\n\n${context}\n\nQuestion: ${question}`)
  return {
    answer,
    sources: hits.map((h) => ({ noteId: h.noteId, title: h.title, notebookId: h.notebookId, score: h.score }))
  }
}
