import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { marked } from 'marked'

marked.use({ breaks: true, gfm: true })
import htmlToDocx from 'html-to-docx'
import type { ExportFormat, ExportLink } from '../shared/types'
import { readNoteById } from './vault'
import { getConfig } from './config'

interface ExportedNote {
  id: string
  notebook: string
  folder: string | null
  title: string
  summary: string
  tags: string[]
  created: string
  updated: string
  body: string
}

async function collect(noteIds: string[]): Promise<ExportedNote[]> {
  const vault = (await getConfig()).vaultPath
  if (!vault) throw new Error('No vault')
  const out: ExportedNote[] = []
  for (const id of noteIds) {
    const d = await readNoteById(vault, id)
    out.push({
      id: d.id,
      notebook: d.notebookId,
      folder: d.folderId,
      title: d.title,
      summary: d.summary,
      tags: d.tags,
      created: d.created,
      updated: d.updated,
      body: d.body
    })
  }
  return out
}

// strip the imported-file footer + wiki-link brackets for a clean document
function cleanBody(md: string): string {
  return md
    .replace(/\n+---\n+📎 Original:.*$/s, '')
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (_m, t: string, l?: string) => (l ?? t).trim())
    .trim()
}

const DOWNLOAD_URL = 'https://github.com/mylesazalewa-droid/solace/releases/latest'
const WATERMARK_TEXT = 'Made with Solace — a calm notes app by Myles Zalewa.'

function toMarkdown(notes: ExportedNote[], watermark: boolean): string {
  const body = notes
    .map((n) => {
      const front = [
        `# ${n.title}`,
        n.tags.length ? `*${n.tags.map((t) => `#${t}`).join('  ')}*` : '',
        n.summary ? `> ${n.summary}` : ''
      ]
        .filter(Boolean)
        .join('\n\n')
      return `${front}\n\n${cleanBody(n.body)}`
    })
    .join('\n\n\n---\n\n\n')
  if (!watermark) return body
  return `${body}\n\n---\n\n*${WATERMARK_TEXT} [Get the app](${DOWNLOAD_URL})*`
}

function toHtml(notes: ExportedNote[], title: string, watermark: boolean): string {
  const body = notes
    .map((n, i) => {
      const meta = [
        n.tags.length ? n.tags.map((t) => `#${t}`).join(' ') : '',
        new Date(n.updated).toLocaleDateString()
      ]
        .filter(Boolean)
        .join(' &middot; ')
      return `
        ${i > 0 ? '<div class="pb"></div>' : ''}
        <h1>${escapeHtml(n.title)}</h1>
        <p class="meta">${meta}</p>
        ${n.summary ? `<p class="summary">${escapeHtml(n.summary)}</p>` : ''}
        ${marked.parse(cleanBody(n.body)) as string}`
    })
    .join('\n')
  const footer = watermark
    ? `<div class="watermark"><p>${WATERMARK_TEXT} <a href="${DOWNLOAD_URL}">Get the app →</a></p></div>`
    : ''
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { margin: 22mm 20mm; }
  body { font: 12pt/1.55 Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 20pt; margin: 0 0 4pt; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 800; }
  h3 {
    font-size: 10.5pt; margin: 18pt 0 6pt; font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase;
    border-top: 0.75pt solid #ddd; padding-top: 8pt;
  }
  h3:first-of-type { border-top: 0; padding-top: 0; }
  p { margin: 0 0 9pt; }
  em { color: #666; }
  ul, ol { margin: 0 0 9pt; padding-left: 20pt; }
  li { margin-bottom: 3pt; }
  ol > li::marker { font-weight: 700; color: #2f7d5b; }
  blockquote { margin: 0 0 9pt; padding-left: 12pt; border-left: 2pt solid #ccc; color: #555; }
  code { background: #f2f2f2; padding: 1pt 3pt; border-radius: 3pt; font-size: 10pt; }
  .meta { color: #888; font-size: 9pt; font-family: 'Helvetica Neue', Arial, sans-serif; margin-bottom: 10pt; }
  .summary { color: #555; font-style: italic; border-left: 2pt solid #ddd; padding-left: 10pt; }
  .pb { page-break-before: always; }
  .watermark { margin-top: 28pt; padding-top: 10pt; border-top: 0.75pt solid #ddd; }
  .watermark p { margin: 0; font-size: 8.5pt; color: #999; font-family: 'Helvetica Neue', Arial, sans-serif; }
  .watermark a { color: #2f7d5b; text-decoration: none; }
</style></head><body>${body}${footer}</body></html>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function renderPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false }
  })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    return await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' }
    })
  } finally {
    win.destroy()
  }
}

const EXT: Record<ExportFormat, string> = { md: 'md', pdf: 'pdf', docx: 'docx', json: 'json' }

// ---------- "export to this same file again" links ----------
// Keyed by the note-set + format so re-exporting the same note(s) in the same
// format can skip the save dialog and just overwrite the file picked last time.

function linkKey(noteIds: string[], format: ExportFormat): string {
  return `${format}:${[...noteIds].sort().join('|')}`
}

function linksFile(vault: string): string {
  return join(vault, '.solace', 'exports.json')
}

async function readLinks(vault: string): Promise<Record<string, ExportLink>> {
  try {
    return JSON.parse(await fs.readFile(linksFile(vault), 'utf8')) as Record<string, ExportLink>
  } catch {
    return {}
  }
}

async function writeLinks(vault: string, links: Record<string, ExportLink>): Promise<void> {
  await fs.mkdir(join(vault, '.solace'), { recursive: true })
  await fs.writeFile(linksFile(vault), JSON.stringify(links, null, 2), 'utf8')
}

export async function getExportLink(
  noteIds: string[],
  format: ExportFormat
): Promise<ExportLink | null> {
  const vault = (await getConfig()).vaultPath
  if (!vault) return null
  return (await readLinks(vault))[linkKey(noteIds, format)] ?? null
}

export async function exportNotes(
  noteIds: string[],
  format: ExportFormat,
  suggestedName: string,
  reuseLink = false,
  watermark = false
): Promise<{ path: string; count: number } | null> {
  if (!noteIds.length) return null
  const vault = (await getConfig()).vaultPath
  if (!vault) throw new Error('No vault')
  const notes = await collect(noteIds)
  const key = linkKey(noteIds, format)

  let filePath: string
  if (reuseLink) {
    const link = (await readLinks(vault))[key]
    if (!link) throw new Error('No previous export to reuse — export as a new file first.')
    filePath = link.path
  } else {
    const res = await dialog.showSaveDialog({
      title: 'Export notes',
      defaultPath: `${suggestedName.replace(/[/\\:*?"<>|]/g, '')}.${EXT[format]}`,
      filters: [{ name: format.toUpperCase(), extensions: [EXT[format]] }]
    })
    if (res.canceled || !res.filePath) return null
    filePath = res.filePath
  }

  let data: Buffer | string
  if (format === 'md') {
    data = toMarkdown(notes, watermark)
  } else if (format === 'json') {
    data = JSON.stringify({ exported: new Date().toISOString(), notes }, null, 2)
  } else if (format === 'pdf') {
    data = await renderPdf(toHtml(notes, suggestedName, watermark))
  } else {
    const buf = await htmlToDocx(toHtml(notes, suggestedName, watermark), undefined, {
      margins: { top: 1440, right: 1200, bottom: 1440, left: 1200 }
    })
    data = buf as Buffer
  }

  await fs.writeFile(filePath, data)
  const links = await readLinks(vault)
  links[key] = { path: filePath, exportedAt: new Date().toISOString() }
  await writeLinks(vault, links)

  return { path: filePath, count: notes.length }
}
