import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  VaultSnapshot,
  NoteDoc,
  SearchHit,
  CoverSpec,
  HelperStatus,
  ImportOutcome,
  SortProposal,
  NoteTemplate,
  ExportFormat,
  HistoryEntry,
  TaskItem,
  SyncSnapshot,
  SyncApply,
  SyncState,
  VerseRef,
  VerseText,
  TrashItem,
  PassageGroup,
  AttachInfo,
  AttachState
} from '../shared/types'

const api = {
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:get'),
  setConfig: (patch: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke('config:set', patch),
  setTheme: (theme: 'system' | 'light' | 'dark'): Promise<AppConfig> =>
    ipcRenderer.invoke('theme:set', theme),

  chooseVault: (): Promise<{ path: string; empty: boolean } | null> =>
    ipcRenderer.invoke('vault:choose'),
  seedVault: (): Promise<VaultSnapshot> => ipcRenderer.invoke('vault:seed'),
  scanVault: (): Promise<VaultSnapshot> => ipcRenderer.invoke('vault:scan'),

  readNote: (noteId: string): Promise<NoteDoc> => ipcRenderer.invoke('note:read', noteId),
  saveNote: (
    noteId: string,
    patch: { body?: string; title?: string; summary?: string; tags?: string[]; pinned?: boolean }
  ): Promise<NoteDoc> => ipcRenderer.invoke('note:save', noteId, patch),
  createNote: (args: {
    notebookId: string
    folderId?: string | null
    title?: string
    body?: string
  }): Promise<NoteDoc> => ipcRenderer.invoke('note:create', args),

  createNotebook: (name: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('notebook:create', name),
  createFolder: (notebookId: string, name: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('folder:create', notebookId, name),
  renameNotebook: (notebookId: string, newName: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('notebook:rename', notebookId, newName),
  renameFolder: (notebookId: string, folderId: string, newName: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('folder:rename', notebookId, folderId, newName),
  setNotebookCover: (notebookId: string, cover: CoverSpec): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('notebook:setCover', notebookId, cover),
  reorderNotebooks: (ids: string[]): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('notebook:reorder', ids),
  deleteNote: (noteId: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('note:delete', noteId),
  deleteNotebook: (notebookId: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('notebook:delete', notebookId),
  deleteFolder: (notebookId: string, folderId: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('folder:delete', notebookId, folderId),

  search: (query: string): Promise<SearchHit[]> => ipcRenderer.invoke('search:run', query),
  moveNote: (
    noteId: string,
    toNotebook: string,
    toFolder: string | null
  ): Promise<{ snapshot: VaultSnapshot; newId: string }> =>
    ipcRenderer.invoke('note:move', noteId, toNotebook, toFolder),
  reveal: (noteId?: string): Promise<void> => ipcRenderer.invoke('vault:reveal', noteId),
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('open:url', url),

  helperStatus: (): Promise<HelperStatus> => ipcRenderer.invoke('helper:status'),
  tidy: (markdown: string): Promise<string> => ipcRenderer.invoke('helper:tidy', markdown),
  enrichNote: (noteId: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('helper:enrich', noteId),
  summarizeNote: (noteId: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('helper:summary', noteId),

  pickImportFiles: (): Promise<string[]> => ipcRenderer.invoke('import:pick'),
  runImport: (args: {
    files: string[]
    pasted: string | null
    notebookId: string
    folderId: string | null
  }): Promise<{ outcomes: ImportOutcome[]; snapshot: VaultSnapshot }> =>
    ipcRenderer.invoke('import:run', args),
  onImportProgress: (cb: (p: { name: string; step: string }) => void): (() => void) => {
    const listener = (_e: unknown, p: { name: string; step: string }): void => cb(p)
    ipcRenderer.on('import:progress', listener)
    return () => ipcRenderer.removeListener('import:progress', listener)
  },

  proposeSort: (noteIds: string[]): Promise<SortProposal[]> =>
    ipcRenderer.invoke('sort:propose', noteIds),
  applySort: (
    moves: { noteId: string; toNotebook: string; toFolder: string | null; tags: string[] }[]
  ): Promise<VaultSnapshot> => ipcRenderer.invoke('sort:apply', moves),

  listTemplates: (): Promise<NoteTemplate[]> => ipcRenderer.invoke('templates:list'),
  saveTemplate: (tpl: NoteTemplate): Promise<NoteTemplate[]> =>
    ipcRenderer.invoke('templates:save', tpl),
  deleteTemplate: (id: string): Promise<NoteTemplate[]> =>
    ipcRenderer.invoke('templates:delete', id),

  exportNotes: (args: {
    noteIds: string[]
    format: ExportFormat
    name: string
  }): Promise<{ path: string; count: number } | null> => ipcRenderer.invoke('export:run', args),

  historyList: (noteId: string): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('history:list', noteId),
  historyRead: (noteId: string, entryId: string): Promise<{ title: string; body: string }> =>
    ipcRenderer.invoke('history:read', noteId, entryId),
  historyRestore: (
    noteId: string,
    entryId: string
  ): Promise<{ doc: NoteDoc; snapshot: VaultSnapshot }> =>
    ipcRenderer.invoke('history:restore', noteId, entryId),

  openDaily: (key?: string): Promise<{ snapshot: VaultSnapshot; noteId: string }> =>
    ipcRenderer.invoke('daily:open', key),
  readDaily: (key: string): Promise<NoteDoc | null> => ipcRenderer.invoke('daily:read', key),

  agendaList: (): Promise<TaskItem[]> => ipcRenderer.invoke('agenda:list'),
  agendaToggle: (noteId: string, line: number, done: boolean): Promise<VaultSnapshot> =>
    ipcRenderer.invoke('agenda:toggle', noteId, line, done),

  splitNote: (noteId: string): Promise<VaultSnapshot> => ipcRenderer.invoke('note:split', noteId),

  syncSnapshot: (): Promise<SyncSnapshot> => ipcRenderer.invoke('sync:snapshot'),
  syncApply: (apply: SyncApply): Promise<VaultSnapshot> => ipcRenderer.invoke('sync:apply', apply),
  syncStateGet: (): Promise<SyncState> => ipcRenderer.invoke('sync:state:get'),
  syncStateSet: (state: SyncState): Promise<void> => ipcRenderer.invoke('sync:state:set', state),
  syncStateClear: (): Promise<void> => ipcRenderer.invoke('sync:state:clear'),
  syncClearTombstones: (paths: string[]): Promise<void> =>
    ipcRenderer.invoke('sync:tombstones:clear', paths),
  syncDevice: (): Promise<string> => ipcRenderer.invoke('sync:device'),
  googleSignIn: (): Promise<{ idToken: string; accessToken: string }> =>
    ipcRenderer.invoke('google:signin'),

  attachImage: (
    noteId: string,
    dataUrl: string
  ): Promise<{ markdownPath: string; name: string }> =>
    ipcRenderer.invoke('note:attach', noteId, dataUrl),

  attachFilesPick: (
    noteId: string
  ): Promise<{ markdownPath: string; name: string; kind: 'image' | 'audio' | 'file' }[]> =>
    ipcRenderer.invoke('note:attachFiles', noteId),
  openAttachment: (attachUrl: string): Promise<void> =>
    ipcRenderer.invoke('attach:open', attachUrl),

  attachmentsList: (): Promise<AttachInfo[]> => ipcRenderer.invoke('sync:attachments:list'),
  attachmentRead: (relPath: string): Promise<string> =>
    ipcRenderer.invoke('sync:attachments:read', relPath),
  attachmentWrite: (relPath: string, base64: string): Promise<void> =>
    ipcRenderer.invoke('sync:attachments:write', relPath, base64),
  attachmentStateGet: (): Promise<AttachState> =>
    ipcRenderer.invoke('sync:attachments:state:get'),
  attachmentStateSet: (state: AttachState): Promise<void> =>
    ipcRenderer.invoke('sync:attachments:state:set', state),

  trashList: (): Promise<TrashItem[]> => ipcRenderer.invoke('trash:list'),
  trashRestore: (id: string): Promise<VaultSnapshot> => ipcRenderer.invoke('trash:restore', id),
  trashPurge: (id: string): Promise<TrashItem[]> => ipcRenderer.invoke('trash:purge', id),
  trashEmpty: (): Promise<TrashItem[]> => ipcRenderer.invoke('trash:empty'),

  scriptureRefs: (text: string): Promise<VerseRef[]> =>
    ipcRenderer.invoke('scripture:refs', text),
  scriptureLookup: (ref: VerseRef, translation?: 'kjv' | 'bbe'): Promise<VerseText> =>
    ipcRenderer.invoke('scripture:lookup', ref, translation),
  scripturePassages: (): Promise<PassageGroup[]> => ipcRenderer.invoke('scripture:passages'),

  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdate: (): Promise<{
    current: string
    latest: string | null
    url: string | null
    notes: string | null
    updateAvailable: boolean
  }> => ipcRenderer.invoke('app:checkUpdate'),

  saveCapture: (text: string): Promise<void> => ipcRenderer.invoke('capture:save', text),
  dismissCapture: (): Promise<void> => ipcRenderer.invoke('capture:dismiss'),
  openCapture: (): Promise<void> => ipcRenderer.invoke('capture:open'),
  onCaptureReset: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('capture:reset', listener)
    return () => ipcRenderer.removeListener('capture:reset', listener)
  },
  onVaultChanged: (cb: () => void): (() => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('vault:changed', listener)
    return () => ipcRenderer.removeListener('vault:changed', listener)
  }
}

contextBridge.exposeInMainWorld('solace', api)

export type SolaceApi = typeof api
