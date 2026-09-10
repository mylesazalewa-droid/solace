// Shared between main and renderer.

export type CoverStyle = 'arcs' | 'stripe' | 'dots' | 'wash' | 'chev' | 'grid'

export interface CoverSpec {
  style: CoverStyle
  c1: string
  c2: string
}

export interface NotebookMeta {
  /** folder name on disk, unique within the vault; also the id */
  id: string
  name: string
  cover: CoverSpec
  noteCount: number
  /** subfolder names, i.e. series / folders inside the notebook */
  folders: FolderMeta[]
}

export interface FolderMeta {
  /** path relative to the notebook folder, e.g. "Rest & Sabbath" */
  id: string
  name: string
  noteCount: number
}

export interface NoteSummary {
  /** path relative to the vault root, e.g. "Sermon Prep/Rest & Sabbath/the-weight-of-rest.md" */
  id: string
  notebookId: string
  /** folder id within the notebook, or null for notebook root */
  folderId: string | null
  title: string
  summary: string
  tags: string[]
  pinned: boolean
  created: string // ISO
  updated: string // ISO
  /** first ~200 chars of body, for search fallback + previews */
  excerpt: string
  /** [[wiki link]] targets found in the body (raw titles) */
  links: string[]
}

export interface NoteDoc extends NoteSummary {
  /** raw markdown body (without frontmatter) */
  body: string
}

export interface VaultSnapshot {
  path: string
  notebooks: NotebookMeta[]
  notes: NoteSummary[]
}

export interface SearchHit {
  note: NoteSummary
  /** matched snippet with <mark> around the term */
  snippet: string
}

export type HelperEngine = 'local' | 'cloud'

export interface AppConfig {
  vaultPath: string | null
  theme: 'system' | 'light' | 'dark'
  engine: HelperEngine
  ollamaUrl: string
  ollamaModel: string
  geminiKey: string
  geminiModel: string
  autoSummary: boolean
  /** global hotkey capture window on/off */
  quickCapture: boolean
  /** Electron accelerator string for the capture hotkey */
  quickCaptureHotkey: string
  /** Firebase web config JSON (not secret — guarded by Firestore rules) */
  firebaseConfig: string
  /** turn cloud sync on/off */
  syncEnabled: boolean
}

/** one note, flattened for the sync layer (main ⇄ renderer) */
export interface SyncNote {
  path: string
  title: string
  created: string
  updated: string
  tags: string[]
  summary: string
  pinned: boolean
  body: string
  /** content hash of the fields above */
  hash: string
}

export interface SyncSnapshot {
  notes: SyncNote[]
  notebooks: Record<string, CoverSpec>
  templates: NoteTemplate[]
  /** ISO mtime of the newest piece of vault metadata */
  metaUpdated: string
  device: string
}

export interface SyncApply {
  writes: { path: string; fields: Omit<SyncNote, 'hash' | 'path'> }[]
  deletes: string[]
  conflicts: { path: string; fields: Omit<SyncNote, 'hash' | 'path'>; from: string }[]
  notebooks?: Record<string, CoverSpec>
  templates?: NoteTemplate[]
}

/** path -> what we last reconciled */
export type SyncState = Record<string, { rev: number; hash: string }>

export interface SyncStatus {
  state: 'off' | 'signed-out' | 'idle' | 'syncing' | 'error'
  email?: string
  lastSync?: string
  lastResult?: { pushed: number; pulled: number; conflicts: number }
  error?: string
}

export interface HelperStatus {
  engine: HelperEngine
  ready: boolean
  /** short human-readable detail, e.g. "Ollama running · llama3.2" or "No API key set" */
  detail: string
  /** models available locally, when engine is local and Ollama is reachable */
  localModels?: string[]
}

export interface TidyResult {
  before: string
  after: string
}

export interface ImportOutcome {
  name: string
  ok: boolean
  noteId?: string
  error?: string
}

export interface NoteTemplate {
  id: string
  name: string
  body: string
  /** true for the shipped defaults (can be hidden but not deleted) */
  builtin?: boolean
}

export type ExportFormat = 'md' | 'pdf' | 'docx' | 'json'

export interface HistoryEntry {
  id: string
  at: string
  title: string
  preview: string
}

export interface TaskItem {
  noteId: string
  noteTitle: string
  notebookId: string
  line: number
  text: string
  done: boolean
  updated: string
}

export interface SortProposal {
  noteId: string
  title: string
  currentNotebook: string
  toNotebook: string
  toFolder: string | null
  tags: string[]
}
