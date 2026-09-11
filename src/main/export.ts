import { BrowserWindow, dialog } from 'electron'
import { promises as fs } from 'fs'
import { marked } from 'marked'

marked.use({ breaks: true, gfm: true })
import htmlToDocx from 'html-to-docx'
import type { ExportFormat } from '../shared/types'
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

function toMarkdown(notes: ExportedNote[]): string {
  return notes
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
}

function toHtml(notes: ExportedNote[], title: string): string {
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
</style></head><body>${body}</body></html>`
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

export async function exportNotes(
  noteIds: string[],
  format: ExportFormat,
  suggestedName: string
): Promise<{ path: string; count: number } | null> {
  if (!noteIds.length) return null
  const notes = await collect(noteIds)

  const res = await dialog.showSaveDialog({
    title: 'Export notes',
    defaultPath: `${suggestedName.replace(/[/\\:*?"<>|]/g, '')}.${EXT[format]}`,
    filters: [{ name: format.toUpperCase(), extensions: [EXT[format]] }]
  })
  if (res.canceled || !res.filePath) return null

  let data: Buffer | string
  if (format === 'md') {
    data = toMarkdown(notes)
  } else if (format === 'json') {
    data = JSON.stringify({ exported: new Date().toISOString(), notes }, null, 2)
  } else if (format === 'pdf') {
    data = await renderPdf(toHtml(notes, suggestedName))
  } else {
    const buf = await htmlToDocx(toHtml(notes, suggestedName), undefined, {
      margins: { top: 1440, right: 1200, bottom: 1440, left: 1200 }
    })
    data = buf as Buffer
  }

  await fs.writeFile(res.filePath, data)
  return { path: res.filePath, count: notes.length }
}
