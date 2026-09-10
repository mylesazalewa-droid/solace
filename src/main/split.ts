import { scanVault, readNoteById, createNote, createFolder, saveNote } from './vault'
import type { VaultSnapshot } from '../shared/types'

interface Section {
  heading: string
  body: string
}

/** Split a note's body at level-1/2 markdown headings. */
export function sectionsOf(body: string): Section[] {
  const lines = body.split('\n')
  const sections: Section[] = []
  let cur: Section | null = null
  const preamble: string[] = []

  for (const line of lines) {
    const m = line.match(/^(#{1,2})\s+(.*)$/)
    if (m) {
      if (cur) sections.push(cur)
      cur = { heading: m[2].trim(), body: '' }
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line
    } else {
      preamble.push(line)
    }
  }
  if (cur) sections.push(cur)

  // drop an empty lead section, keep meaningful preamble as an intro section
  const intro = preamble.join('\n').trim()
  if (intro) sections.unshift({ heading: 'Overview', body: intro })
  return sections.filter((s) => s.heading || s.body.trim())
}

export function canSplit(body: string): boolean {
  return sectionsOf(body).length >= 3
}

export async function splitNote(vault: string, noteId: string): Promise<VaultSnapshot> {
  const doc = await readNoteById(vault, noteId)
  const sections = sectionsOf(doc.body)
  if (sections.length < 2) throw new Error('This note has no headings to split on.')

  const folderName = doc.title.replace(/[/\\:*?"<>|]/g, '').trim() || 'Series'
  const notebookId = doc.notebookId
  try {
    await createFolder(vault, notebookId, folderName)
  } catch {
    /* folder may already exist */
  }

  const links: string[] = []
  for (const s of sections) {
    const title = s.heading || 'Section'
    const body = s.body.trim() ? `# ${title}\n\n${s.body.trim()}\n` : `# ${title}\n`
    const made = await createNote(vault, notebookId, folderName, title, body)
    links.push(`- [[${made.title}]]`)
  }

  // turn the original into an index that points at the pieces
  const index =
    `${doc.body.trim()}\n\n---\n\n**Split into ${sections.length} notes** in _${folderName}_:\n\n` +
    links.join('\n') +
    '\n'
  await saveNote(vault, noteId, { body: index })

  return scanVault(vault)
}
