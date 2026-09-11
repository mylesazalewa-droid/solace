import { promises as fs } from 'fs'
import { join, basename, extname } from 'path'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import TurndownService from 'turndown'
import type { AppConfig, ImportOutcome, SortProposal } from '../shared/types'
import { createNote, saveNote, slugify } from './vault'
import { summarize, suggestTags, helperStatus, generate } from './helper'

const NBSP = String.fromCharCode(160)

const td = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*'
})
// Word tables come through as HTML tables — keep the cell text instead of dropping it
td.addRule('cell', {
  filter: ['td', 'th'],
  replacement: (content) => `${content.trim()} `
})

function normalizeMd(md: string): string {
  return md
    .split(NBSP)
    .join(' ')
    // collapse runs of spaces that follow real text — leaves list indentation alone
    .replace(/(\S)[ \t]{2,}/g, '$1 ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Word docs written by non-technical people use a whole-line **bold** phrase where a
// heading belongs. Promote those to real headings so the note has structure.
function promoteHeadings(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      const m = line.match(/^\*\*(.+?)\*\*$/)
      if (!m) return line
      const inner = m[1].trim()
      if (inner.length > 64 || /[.!?,;]$/.test(inner) || inner.includes('**')) return line
      return `### ${inner.replace(/:$/, '')}`
    })
    .join('\n')
}

// Non-technical Word docs also fake numbered steps with a bold "1." at the start
// of an otherwise-plain paragraph (real numbered-list styling never gets used).
// Turndown escapes the period as "1\." to avoid it reading as a real list marker —
// undo that and make it one, so it actually renders as a numbered list.
function promoteNumberedSteps(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      const m = line.match(/^\*\*(\d{1,3})\\?\.\s*\*\*\s*(.+)$/)
      return m ? `${m[1]}. ${m[2]}` : line
    })
    .join('\n')
}

function htmlToMarkdown(html: string): string {
  return promoteNumberedSteps(promoteHeadings(normalizeMd(td.turndown(html))))
}

/**
 * Word docs put the document's own title as the first line, which importItems
 * also lifts out to use as the note's title — leaving it duplicated at the top
 * of the body too. Drop it from the body when the two match.
 */
function stripLeadingTitleLine(text: string, title: string): string {
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  if (i >= lines.length) return text
  const clean = lines[i]
    .replace(/^#+\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/\*\*/g, '')
    .trim()
  if (clean.toLowerCase() !== title.trim().toLowerCase()) return text
  lines.splice(i, 1)
  while (lines[i] !== undefined && lines[i].trim() === '') lines.splice(i, 1)
  return lines.join('\n')
}

export interface ImportItem {
  /** absolute path for a file, or null for pasted text */
  path: string | null
  /** for pasted text */
  text?: string
  name: string
}

const TEXT_EXT = new Set(['.md', '.markdown', '.txt', '.text'])

async function extractText(item: ImportItem): Promise<string> {
  if (item.path === null) return (item.text ?? '').trim()
  const ext = extname(item.path).toLowerCase()

  if (ext === '.pdf') {
    const buf = await fs.readFile(item.path)
    const data = await pdfParse(buf)
    // PDFs give ragged lines; collapse trailing spaces and huge gaps
    return (data.text ?? '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  if (ext === '.docx') {
    // convertToHtml keeps headings, lists, bold/italic, tables — extractRawText throws them away
    const res = await mammoth.convertToHtml({ path: item.path })
    const md = htmlToMarkdown(res.value ?? '')
    if (md) return md
    // fall back to raw text if the doc had no recoverable structure
    const raw = await mammoth.extractRawText({ path: item.path })
    return (raw.value ?? '').trim()
  }
  if (TEXT_EXT.has(ext)) {
    return (await fs.readFile(item.path, 'utf8')).trim()
  }
  throw new Error(`Can't read ${ext || 'that file type'} yet — try PDF, Word, Markdown, or paste the text.`)
}

function titleFrom(raw: string, fallback: string): string {
  const firstLine = raw
    .split('\n')
    .map((l) =>
      l
        .replace(/^#+\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
        .replace(/^>\s*/, '')
        .trim()
    )
    .find((l) => l.length > 0)
  if (firstLine && firstLine.length <= 90) return firstLine
  if (firstLine) return firstLine.slice(0, 80).replace(/\s\S*$/, '') + '…'
  return fallback
}

export async function importItems(
  vault: string,
  cfg: AppConfig,
  items: ImportItem[],
  notebookId: string,
  folderId: string | null,
  onProgress?: (name: string, step: string) => void
): Promise<ImportOutcome[]> {
  const status = await helperStatus(cfg).catch(() => ({ ready: false }))
  const useHelper = Boolean(status.ready)
  const out: ImportOutcome[] = []

  for (const item of items) {
    try {
      onProgress?.(item.name, 'Reading')
      const text = await extractText(item)
      if (!text) throw new Error('No readable text found.')

      const fallbackTitle = basename(item.name, extname(item.name)).replace(/[-_]+/g, ' ')
      const title = titleFrom(text, fallbackTitle)
      const cleanedText = stripLeadingTitleLine(text, title)

      onProgress?.(item.name, 'Saving')
      const doc = await createNote(vault, notebookId, folderId, title, cleanedText)

      // attach the original file
      let body = cleanedText
      if (item.path) {
        const attachDir = join(vault, notebookId, '_attachments')
        await fs.mkdir(attachDir, { recursive: true })
        const attachName = `${slugify(title)}${extname(item.path)}`
        await fs.copyFile(item.path, join(attachDir, attachName))
        body = `${text}\n\n---\n\n📎 Original: [${basename(item.path)}](_attachments/${attachName})\n`
        await saveNote(vault, doc.id, { body })
      }

      if (useHelper) {
        onProgress?.(item.name, 'Summarising')
        try {
          const [summary, tags] = await Promise.all([
            summarize(cfg, title, text),
            suggestTags(cfg, title, text)
          ])
          await saveNote(vault, doc.id, { summary, tags })
        } catch {
          /* non-fatal */
        }
      }

      onProgress?.(item.name, 'Done')
      out.push({ name: item.name, ok: true, noteId: doc.id })
    } catch (err) {
      out.push({
        name: item.name,
        ok: false,
        error: err instanceof Error ? err.message : 'Import failed'
      })
    }
  }
  return out
}

// ---------- Sort: propose a home for un-filed notes ----------

const SORT_SYSTEM = (notebooks: string[]): string =>
  `You file personal notes into notebooks. Available notebooks: ${notebooks.join(', ')}.
Given a note, reply with STRICT JSON: {"notebook": "<one of the list, best fit>", "tags": ["2-4 lowercase tags"]}.
Pick the existing notebook that fits best. No prose, only the JSON object.`

export async function proposeSort(
  cfg: AppConfig,
  notes: { id: string; title: string; body: string; notebookId: string }[],
  notebookNames: string[]
): Promise<SortProposal[]> {
  const proposals: SortProposal[] = []
  for (const n of notes) {
    const base: SortProposal = {
      noteId: n.id,
      title: n.title,
      currentNotebook: n.notebookId,
      toNotebook: n.notebookId,
      toFolder: null,
      tags: []
    }
    try {
      const raw = await generate(
        cfg,
        SORT_SYSTEM(notebookNames),
        `Title: ${n.title}\n\n${n.body.slice(0, 4000)}`
      )
      const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      const parsed = JSON.parse(json) as { notebook?: string; tags?: string[] }
      base.toNotebook =
        notebookNames.find((x) => x.toLowerCase() === (parsed.notebook ?? '').toLowerCase()) ??
        n.notebookId
      base.tags = (parsed.tags ?? []).map((t) => String(t).toLowerCase().replace(/\s+/g, '-')).slice(0, 4)
    } catch {
      /* leave base proposal */
    }
    proposals.push(base)
  }
  return proposals
}
