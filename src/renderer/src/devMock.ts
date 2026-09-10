/**
 * Browser-only mock of the `window.solace` bridge, so the renderer can be
 * developed and visually checked in a plain browser (`vite`) without Electron.
 * Never loaded in the packaged app — `main.tsx` only installs it when
 * `window.solace` is missing.
 */
import type {
  AppConfig,
  VaultSnapshot,
  NoteDoc,
  NoteSummary,
  SearchHit,
  CoverSpec
} from '../../shared/types'

interface RawNote {
  notebookId: string
  folderId: string | null
  title: string
  body: string
  tags: string[]
  summary?: string
  pinned?: boolean
  daysAgo: number
}

const COVERS: Record<string, CoverSpec> = {
  'Sermon Prep': { style: 'arcs', c1: '#2f7d5b', c2: '#e9f2ec' },
  Journal: { style: 'stripe', c1: '#d99436', c2: '#f6e7cf' },
  Ideas: { style: 'dots', c1: '#7367e8', c2: '#e6e2fb' },
  Reading: { style: 'arcs', c1: '#c15b3c', c2: '#f3ddd2' }
}

const RAW: RawNote[] = [
  {
    notebookId: 'Sermon Prep',
    folderId: 'Rest & Sabbath',
    title: 'The weight of rest',
    tags: ['rest', 'mark-6'],
    summary:
      'A study on Mark 6:31 — Jesus pulls the disciples away to rest before the work is finished. Rest as a rhythm you keep, not a reward you earn.',
    daysAgo: 1,
    body: `The disciples had just come back from being sent out — they hadn't even had time to eat. Jesus tells them, "Come away by yourselves and rest a while." He doesn't praise how busy they've been. He pulls them out of it.\n\nRest here isn't a reward for finished work. The work *wasn't* finished — the crowds were still coming. It's a rhythm you keep while things are unfinished, or you never keep it at all.`
  },
  {
    notebookId: 'Sermon Prep',
    folderId: 'Rest & Sabbath',
    title: '"Come away" — sermon outline',
    tags: ['outline'],
    summary:
      'Three movements: the invitation to rest, the interruption by the crowd, and the compassion that teaches them anyway. Lands on Psalm 23.',
    daysAgo: 4,
    body: `## Passage\nMark 6:30–34\n\n## Big idea\nRest is a rhythm we keep *while* the work is unfinished.\n\n## Outline\n1. The invitation to rest\n2. The interruption by the crowd\n3. The compassion that teaches them anyway`
  },
  {
    notebookId: 'Sermon Prep',
    folderId: 'Advent 2025',
    title: 'Advent 1 — waiting',
    tags: ['advent'],
    summary: 'Notes on Isaiah 64 and what it means to wait for God to tear the heavens open.',
    daysAgo: 20,
    body: `"Oh that you would rend the heavens and come down." Advent starts in the dark, not the tinsel.`
  },
  {
    notebookId: 'Sermon Prep',
    folderId: null,
    title: 'Greek note — anapausis',
    tags: ['word study'],
    summary:
      'The word for "rest" in Matthew 11:28 — stopping to recover strength, an intermission, not just sleep.',
    daysAgo: 8,
    body: `The word for "rest" in Matthew 11:28. Carries the sense of stopping to recover strength — an intermission, not just sleep.`
  },
  {
    notebookId: 'Journal',
    folderId: null,
    title: 'Morning pages',
    tags: [],
    pinned: true,
    summary: 'Slept badly; thinking about whether the fall calendar has any margin in it at all.',
    daysAgo: 2,
    body: `Slept badly. Thinking about the fall calendar and whether we've built any margin into it at all. Note to self: block a real day off before Advent.`
  },
  {
    notebookId: 'Ideas',
    folderId: null,
    title: 'Song idea in the car',
    tags: ['music'],
    summary: 'A slow 6/8 built on the John 12 image — "the seed that dies is the seed that grows".',
    daysAgo: 6,
    body: `A slow 6/8 thing. "The seed that dies is the seed that grows." Chorus could lean on the John 12 image.`
  },
  {
    notebookId: 'Reading',
    folderId: 'Theology',
    title: 'Margin — the room between load and limit',
    tags: ['rest', 'method'],
    summary: "Swenson's idea of margin: the space between your load and your limit, and why you've spent it.",
    daysAgo: 11,
    body: `Swenson's idea of margin: the space between your load and your limit. You need some, and most of us have spent it. Pairs with [[The weight of rest]].`
  }
]

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 864e5).toISOString()
}

function buildNotes(): (NoteDoc & { _body: string })[] {
  return RAW.map((r) => {
    const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const id = [r.notebookId, r.folderId, `${slug}.md`].filter(Boolean).join('/')
    return {
      id,
      notebookId: r.notebookId,
      folderId: r.folderId,
      title: r.title,
      summary: r.summary ?? '',
      tags: r.tags,
      pinned: r.pinned ?? false,
      created: iso(r.daysAgo + 3),
      updated: iso(r.daysAgo),
      excerpt: r.body.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 240),
      links: [...r.body.matchAll(/\[\[([^\]|]+?)\]\]/g)].map((m) => m[1].trim()),
      body: r.body,
      _body: r.body
    }
  })
}

let notes = buildNotes()
// notebooks that exist even with zero notes (mirrors on-disk folders)
const knownNotebooks = new Set<string>(notes.map((n) => n.notebookId))
const knownFolders = new Map<string, Set<string>>()
for (const n of notes) {
  if (n.folderId) {
    if (!knownFolders.has(n.notebookId)) knownFolders.set(n.notebookId, new Set())
    knownFolders.get(n.notebookId)!.add(n.folderId)
  }
}
let config: AppConfig = {
  vaultPath: '/Users/you/Notes',
  theme: 'system',
  engine: 'local',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  autoSummary: true,
  quickCapture: true,
  quickCaptureHotkey: 'CommandOrControl+Shift+Space',
  firebaseConfig: '',
  syncEnabled: true
}

let nbOrder: string[] = []

function snapshot(): VaultSnapshot {
  notes.forEach((n) => knownNotebooks.add(n.notebookId))
  const names = [...knownNotebooks].sort((a, b) => {
    const ra = nbOrder.indexOf(a)
    const rb = nbOrder.indexOf(b)
    if (ra !== -1 || rb !== -1) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb)
    return a.localeCompare(b)
  })
  const notebooks = names.map((name) => {
    const own = notes.filter((n) => n.notebookId === name)
    const folderIds = new Set<string>([
      ...(knownFolders.get(name) ?? []),
      ...(own.map((n) => n.folderId).filter(Boolean) as string[])
    ])
    return {
      id: name,
      name,
      cover: COVERS[name] ?? { style: 'grid', c1: '#4c6b86', c2: '#d7e2ea' },
      noteCount: own.length,
      folders: [...folderIds].map((fid) => ({
        id: fid,
        name: fid,
        noteCount: own.filter((n) => n.folderId === fid).length
      }))
    }
  })
  const summaries: NoteSummary[] = notes.map(({ body: _b, _body: _c, ...s }) => s)
  return { path: config.vaultPath!, notebooks, notes: summaries }
}

export function installDevMock(): void {
  const api = {
    getConfig: async () => config,
    setConfig: async (p: Partial<AppConfig>) => (config = { ...config, ...p }),
    setTheme: async (theme: AppConfig['theme']) => (config = { ...config, theme }),
    chooseVault: async () => ({ path: config.vaultPath!, empty: false }),
    seedVault: async () => snapshot(),
    scanVault: async () => snapshot(),
    readNote: async (noteId: string) => {
      const n = notes.find((x) => x.id === noteId)!
      const { _body: _c, ...doc } = n
      return doc as NoteDoc
    },
    saveNote: async (noteId: string, patch: Partial<NoteDoc>) => {
      notes = notes.map((n) =>
        n.id === noteId ? { ...n, ...patch, updated: new Date().toISOString() } : n
      )
      const n = notes.find((x) => x.id === noteId)!
      const { _body: _c, ...doc } = n
      return doc as NoteDoc
    },
    createNote: async (args: { notebookId: string; folderId?: string | null; title?: string }) => {
      const title = args.title || 'Untitled note'
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      const id = [args.notebookId, args.folderId, `${slug}.md`].filter(Boolean).join('/')
      const doc = {
        id,
        notebookId: args.notebookId,
        folderId: args.folderId ?? null,
        title,
        summary: '',
        tags: [] as string[],
        pinned: false,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        excerpt: '',
        links: [],
        body: '',
        _body: ''
      }
      notes = [doc, ...notes]
      const { _body: _c, ...d } = doc
      return d as NoteDoc
    },
    createNotebook: async (name: string) => {
      COVERS[name] = COVERS[name] ?? { style: 'wash', c1: '#4b5bbf', c2: '#c9c2f4' }
      knownNotebooks.add(name)
      return snapshot()
    },
    createFolder: async (nb: string, name: string) => {
      if (!knownFolders.has(nb)) knownFolders.set(nb, new Set())
      knownFolders.get(nb)!.add(name)
      return snapshot()
    },
    renameNotebook: async (id: string, newName: string) => {
      notes = notes.map((n) => (n.notebookId === id ? { ...n, notebookId: newName } : n))
      COVERS[newName] = COVERS[id]
      knownNotebooks.delete(id)
      knownNotebooks.add(newName)
      if (knownFolders.has(id)) knownFolders.set(newName, knownFolders.get(id)!)
      return snapshot()
    },
    renameFolder: async (nb: string, folderId: string, newName: string) => {
      notes = notes.map((n) =>
        n.notebookId === nb && n.folderId === folderId ? { ...n, folderId: newName } : n
      )
      return snapshot()
    },
    setNotebookCover: async (id: string, cover: CoverSpec) => {
      COVERS[id] = cover
      return snapshot()
    },
    reorderNotebooks: async (ids: string[]) => {
      nbOrder = ids
      return snapshot()
    },
    deleteNote: async (noteId: string) => {
      notes = notes.filter((n) => n.id !== noteId)
      return snapshot()
    },
    deleteNotebook: async (id: string) => {
      notes = notes.filter((n) => n.notebookId !== id)
      knownNotebooks.delete(id)
      knownFolders.delete(id)
      return snapshot()
    },
    deleteFolder: async (nb: string, folderId: string) => {
      notes = notes.filter((n) => !(n.notebookId === nb && n.folderId === folderId))
      knownFolders.get(nb)?.delete(folderId)
      return snapshot()
    },
    search: async (query: string): Promise<SearchHit[]> => {
      const q = query.toLowerCase()
      return notes
        .filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n._body.toLowerCase().includes(q) ||
            n.tags.join(' ').toLowerCase().includes(q)
        )
        .map((n) => {
          const { body: _b, _body: _c, ...s } = n
          const hay = `${n.title} — ${n._body}`.replace(/\s+/g, ' ')
          const at = hay.toLowerCase().indexOf(q)
          const start = Math.max(0, at - 50)
          const snippet =
            (start ? '… ' : '') +
            hay.slice(start, at) +
            '<mark>' +
            hay.slice(at, at + q.length) +
            '</mark>' +
            hay.slice(at + q.length, at + q.length + 80) +
            ' …'
          return { note: s as NoteSummary, snippet }
        })
    },
    reveal: async () => {},
    openUrl: async (url: string) => {
      window.open(url, '_blank')
    },
    helperStatus: async () => ({
      engine: config.engine,
      ready: true,
      detail: config.engine === 'cloud' ? 'Gemini · gemini-2.0-flash (mock)' : 'Ollama running · llama3.2 (mock)'
    }),
    tidy: async (md: string) => {
      await new Promise((r) => setTimeout(r, 500))
      const fixes: [RegExp, string][] = [
        [/\bteh\b/g, 'the'],
        [/\bLoev\b/g, 'Love'],
        [/\bloev\b/g, 'love'],
        [/\brecieve\b/g, 'receive'],
        [/\bdefinately\b/g, 'definitely'],
        [/\bi\b/g, 'I']
      ]
      let out = md
      for (const [re, to] of fixes) out = out.replace(re, to)
      return out
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    },
    enrichNote: async (noteId: string) => {
      await new Promise((r) => setTimeout(r, 400))
      notes = notes.map((n) =>
        n.id === noteId
          ? {
              ...n,
              summary: n.summary || `A note about ${n.title.toLowerCase()} — written up by the helper.`,
              tags: n.tags.length ? n.tags : ['auto-tag', 'draft']
            }
          : n
      )
      return snapshot()
    },
    summarizeNote: async (noteId: string) => {
      notes = notes.map((n) =>
        n.id === noteId ? { ...n, summary: `Fresh summary for “${n.title}”.` } : n
      )
      return snapshot()
    },
    pickImportFiles: async () => ['/Users/you/Downloads/example.pdf'],
    runImport: async (args: { files: string[]; pasted: string | null; notebookId: string; folderId: string | null }) => {
      const names = [...args.files.map((f) => f.split('/').pop() ?? f), ...(args.pasted ? ['Pasted text'] : [])]
      const now = new Date().toISOString()
      names.forEach((nm, i) => {
        notes = [
          {
            id: `${args.notebookId}/${args.folderId ? args.folderId + '/' : ''}imported-${Date.now()}-${i}.md`,
            notebookId: args.notebookId,
            folderId: args.folderId,
            title: nm.replace(/\.[a-z]+$/i, ''),
            summary: `Imported from ${nm} and cleaned up by the helper.`,
            tags: ['imported'],
            pinned: false,
            created: now,
            updated: now,
            excerpt: 'Imported content preview…',
            links: [],
            body: `Imported content from ${nm}.`,
            _body: `Imported content from ${nm}.`
          },
          ...notes
        ]
      })
      return { outcomes: names.map((nm) => ({ name: nm, ok: true })), snapshot: snapshot() }
    },
    onImportProgress: () => () => {},
    proposeSort: async (noteIds: string[]) => {
      const names = ['Sermon Prep', 'Journal', 'Ideas', 'Reading']
      return noteIds.map((id) => {
        const n = notes.find((x) => x.id === id)
        return {
          noteId: id,
          title: n?.title ?? id,
          currentNotebook: n?.notebookId ?? '',
          toNotebook: names[Math.floor(Math.random() * names.length)],
          toFolder: null,
          tags: ['auto', 'sorted']
        }
      })
    },
    applySort: async (moves: { noteId: string; toNotebook: string; tags: string[] }[]) => {
      moves.forEach((m) => {
        notes = notes.map((n) =>
          n.id === m.noteId
            ? { ...n, notebookId: m.toNotebook, folderId: null, tags: [...new Set([...n.tags, ...m.tags])] }
            : n
        )
      })
      return snapshot()
    },
    listTemplates: async () => [
      { id: 'blank', name: 'Blank', body: '', builtin: true },
      { id: 'sermon-prep', name: 'Sermon prep', body: '## Passage\n\n## Big idea\n', builtin: true },
      { id: 'meeting-notes', name: 'Meeting notes', body: '**Present:**\n\n## Agenda\n-\n', builtin: true },
      { id: 't-demo', name: 'My template', body: '## Custom\n' }
    ],
    saveTemplate: async () => (window as unknown as { solace: typeof api }).solace.listTemplates(),
    deleteTemplate: async () => (window as unknown as { solace: typeof api }).solace.listTemplates(),
    exportNotes: async (args: { noteIds: string[]; format: string; name: string }) => ({
      path: `/Users/you/Desktop/${args.name}.${args.format}`,
      count: args.noteIds.length
    }),
    saveCapture: async (text: string) => {
      const now = new Date().toISOString()
      const first = text.trim().split('\n')[0].slice(0, 80)
      notes = [
        {
          id: `Inbox/quick-${Date.now()}.md`,
          notebookId: 'Inbox',
          folderId: null,
          title: first || 'Quick note',
          summary: '',
          tags: [],
          pinned: false,
          created: now,
          updated: now,
          excerpt: text.slice(0, 200),
          links: [],
          body: text,
          _body: text
        },
        ...notes
      ]
    },
    dismissCapture: async () => {},
    openCapture: async () => {},
    historyList: async () => [
      { id: 'a', at: new Date(Date.now() - 3600_000).toISOString(), title: 'Earlier draft', preview: 'An earlier version of this note before the last round of edits.' },
      { id: 'b', at: new Date(Date.now() - 86400_000).toISOString(), title: 'Yesterday', preview: 'The note as it stood yesterday.' }
    ],
    historyRead: async (_id: string, entryId: string) => ({
      title: entryId === 'a' ? 'Earlier draft' : 'Yesterday',
      body: '# Earlier version\n\nThis is what the note looked like then.'
    }),
    historyRestore: async () => ({ doc: notes[0], snapshot: snapshot() }),
    openDaily: async (key?: string) => {
      const k = key ?? new Date().toISOString().slice(0, 10)
      const id = `Daily/${k}.md`
      if (!notes.some((n) => n.id === id)) {
        const now = new Date().toISOString()
        notes = [
          { id, notebookId: 'Daily', folderId: null, title: k, summary: '', tags: [], pinned: false, created: now, updated: now, excerpt: '', links: [], body: `## Today\n- [ ] \n\n## Notes\n`, _body: '' },
          ...notes
        ]
      }
      return { snapshot: snapshot(), noteId: id }
    },
    readDaily: async (key: string) => notes.find((n) => n.id === `Daily/${key}.md`) ?? null,
    agendaList: async () =>
      notes.flatMap((n) =>
        (n._body || n.body || '')
          .split('\n')
          .map((l, i) => ({ l, i }))
          .filter(({ l }) => /^\s*[-*+]\s+\[[ xX]\]/.test(l))
          .map(({ l, i }) => ({
            noteId: n.id,
            noteTitle: n.title,
            notebookId: n.notebookId,
            line: i,
            text: l.replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, ''),
            done: /\[[xX]\]/.test(l),
            updated: n.updated
          }))
      ),
    agendaToggle: async () => snapshot(),
    splitNote: async () => snapshot(),
    syncSnapshot: async () => ({
      notes: notes.map((n) => ({
        path: n.id,
        title: n.title,
        created: n.created,
        updated: n.updated,
        tags: n.tags,
        summary: n.summary,
        pinned: !!n.pinned,
        body: n._body || n.body || '',
        hash: `${n.id}:${(n._body || n.body || '').length}`
      })),
      notebooks: {},
      templates: [],
      metaUpdated: new Date(0).toISOString(),
      device: 'dev'
    }),
    syncApply: async () => snapshot(),
    syncStateGet: async () => ({}),
    syncStateSet: async () => {},
    syncStateClear: async () => {},
    syncDevice: async () => 'dev-browser',
    googleSignIn: async () => {
      throw new Error('Google sign-in only works in the packaged app.')
    },
    appVersion: async () => '0.0.0-dev',
    checkForUpdate: async () => ({
      current: '0.0.0-dev',
      latest: null,
      url: null,
      notes: null,
      updateAvailable: false
    }),
    moveNote: async (noteId: string, toNotebook: string, toFolder: string | null) => {
      let newId = noteId
      notes = notes.map((n) => {
        if (n.id !== noteId) return n
        newId = `${toNotebook}/${toFolder ? toFolder + '/' : ''}${n.id.split('/').pop()}`
        return { ...n, id: newId, notebookId: toNotebook, folderId: toFolder }
      })
      return { snapshot: snapshot(), newId }
    },
    onCaptureReset: () => () => {},
    onVaultChanged: () => () => {}
  }
  ;(window as unknown as { solace: typeof api }).solace = api
}
