import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { NoteTemplate } from '../shared/types'
import { getConfig } from './config'

const BUILTINS: NoteTemplate[] = [
  { id: 'blank', name: 'Blank', body: '', builtin: true },
  {
    id: 'sermon-prep',
    name: 'Sermon prep',
    builtin: true,
    body: `## Passage

## Big idea
_One sentence._

## Context & notes

## Outline
1.
2.
3.

## Illustrations

## Application
`
  },
  {
    id: 'meeting-notes',
    name: 'Meeting notes',
    builtin: true,
    body: `**Date:**
**Present:**

## Agenda
-

## Discussion

## Decisions
-

## Action items
- [ ]
`
  },
  {
    id: 'book-notes',
    name: 'Book notes',
    builtin: true,
    body: `**Author:**
**Started:**   **Finished:**

## In one line

## Key ideas
-

## Quotes
>

## What I want to remember
`
  },
  {
    id: 'journal',
    name: 'Journal entry',
    builtin: true,
    body: `## Today

## Grateful for
-

## On my mind
`
  }
]

function customPath(vault: string): string {
  return join(vault, '.solace', 'templates.json')
}

async function readCustom(vault: string): Promise<NoteTemplate[]> {
  try {
    const raw = await fs.readFile(customPath(vault), 'utf8')
    const arr = JSON.parse(raw) as NoteTemplate[]
    return Array.isArray(arr) ? arr.filter((t) => t && t.id && t.name != null) : []
  } catch {
    return []
  }
}

async function writeCustom(vault: string, list: NoteTemplate[]): Promise<void> {
  await fs.mkdir(join(vault, '.solace'), { recursive: true })
  await fs.writeFile(customPath(vault), JSON.stringify(list, null, 2), 'utf8')
}

async function vaultPath(): Promise<string | null> {
  return (await getConfig()).vaultPath
}

export async function listTemplates(): Promise<NoteTemplate[]> {
  const vault = await vaultPath()
  const custom = vault ? await readCustom(vault) : []
  return [...BUILTINS, ...custom]
}

export async function saveTemplate(tpl: NoteTemplate): Promise<NoteTemplate[]> {
  const vault = await vaultPath()
  if (!vault) throw new Error('No vault')
  const custom = await readCustom(vault)
  const id =
    tpl.id && !BUILTINS.some((b) => b.id === tpl.id)
      ? tpl.id
      : `t-${Date.now().toString(36)}`
  const next: NoteTemplate = { id, name: tpl.name.trim() || 'Untitled template', body: tpl.body }
  const idx = custom.findIndex((c) => c.id === id)
  if (idx >= 0) custom[idx] = next
  else custom.push(next)
  await writeCustom(vault, custom)
  return listTemplates()
}

export async function deleteTemplate(id: string): Promise<NoteTemplate[]> {
  const vault = await vaultPath()
  if (!vault) throw new Error('No vault')
  const custom = (await readCustom(vault)).filter((c) => c.id !== id)
  await writeCustom(vault, custom)
  return listTemplates()
}

// so an app-menu "New from template" could exist later
export function templatesDir(): string {
  return app.getPath('userData')
}
