import { scanVault, readNoteById, saveNote } from './vault'
import type { VaultSnapshot, TaskItem } from '../shared/types'

const TASK_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/

export async function collectTasks(vault: string): Promise<TaskItem[]> {
  const { notes } = await scanVault(vault)
  const out: TaskItem[] = []
  for (const n of notes) {
    const doc = await readNoteById(vault, n.id)
    const lines = doc.body.split('\n')
    lines.forEach((raw, i) => {
      const m = raw.match(TASK_RE)
      if (!m) return
      out.push({
        noteId: n.id,
        noteTitle: doc.title,
        notebookId: doc.notebookId,
        line: i,
        text: m[4].trim(),
        done: m[3].toLowerCase() === 'x',
        updated: doc.updated
      })
    })
  }
  // open items first, then by most-recently-touched note
  out.sort((a, b) => Number(a.done) - Number(b.done) || b.updated.localeCompare(a.updated))
  return out
}

export async function toggleTask(
  vault: string,
  noteId: string,
  line: number,
  done: boolean
): Promise<VaultSnapshot> {
  const doc = await readNoteById(vault, noteId)
  const lines = doc.body.split('\n')
  const raw = lines[line]
  const m = raw?.match(TASK_RE)
  if (m) {
    lines[line] = `${m[1]}${m[2]} [${done ? 'x' : ' '}] ${m[4]}`
    await saveNote(vault, noteId, { body: lines.join('\n') })
  }
  return scanVault(vault)
}
