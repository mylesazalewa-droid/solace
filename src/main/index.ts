import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  nativeTheme,
  protocol,
  net
} from 'electron'
import { join, sep } from 'path'
import { pathToFileURL } from 'url'
import { promises as fs, existsSync } from 'fs'
import { getConfig, setConfig } from './config'
import {
  scanVault,
  readNoteById,
  saveNote,
  createNote,
  createNotebook,
  createFolder,
  renameNotebook,
  renameFolder,
  setNotebookCover,
  setNotebookOrder,
  deleteNote,
  deleteNotebook,
  deleteFolder,
  moveNote,
  searchVault,
  seedVault
} from './vault'
import { helperStatus, tidyUp, summarize, suggestTags } from './helper'
import { importItems, proposeSort, type ImportItem } from './importer'
import { listTemplates, saveTemplate, deleteTemplate } from './templates'
import { exportNotes, getExportLink } from './export'
import { setupQuickCapture, applyHotkey } from './quickcapture'
import { maybeSnapshot, listHistory, readHistory, restoreHistory } from './history'
import { openDaily, readDaily } from './daily'
import { collectTasks, toggleTask } from './agenda'
import { splitNote } from './split'
import {
  buildSnapshot,
  applyRemote,
  readSyncState,
  writeSyncState,
  clearSyncState,
  recordTombstones,
  clearTombstones,
  deviceName
} from './sync'
import { signInWithGoogle } from './googleAuth'
import { checkForUpdate } from './updates'
import {
  parseRefs,
  lookup as lookupVerse,
  collectPassages,
  type Translation
} from './scripture'
import { listTrash, restoreTrash, purgeTrash, emptyTrash } from './trash'
import { saveAttachment, attachFiles } from './attach'
import {
  listAttachments,
  readAttachmentBase64,
  writeAttachmentBase64,
  readAttachState,
  writeAttachState
} from './attachSync'
import type {
  ExportFormat,
  NoteTemplate,
  SyncApply,
  SyncState,
  VerseRef
} from '../shared/types'

// Resolve bundle paths from the app root — works in dev and inside the asar.
// (Avoids electron-vite's __dirname ESM shim, which mis-injects when the bundle
// contains multibyte characters.)
const preloadPath = join(app.getAppPath(), 'out/preload/index.js')
const rendererHtml = join(app.getAppPath(), 'out/renderer/index.html')

console.log('[solace] appPath', app.getAppPath(), '· preload exists:', existsSync(preloadPath))

// serve note attachments to the renderer — a plain file:// subresource is blocked
// from a file:// page. URL shape: solace-attach://f/<uri-encoded absolute path>
protocol.registerSchemesAsPrivileged([
  { scheme: 'solace-attach', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])
async function registerAttachProtocol(): Promise<void> {
  protocol.handle('solace-attach', async (request) => {
    try {
      const abs = decodeURIComponent(new URL(request.url).pathname.replace(/^\//, ''))
      const vault = (await getConfig()).vaultPath
      if (!vault || !abs.startsWith(vault)) return new Response('', { status: 403 })
      return net.fetch(pathToFileURL(abs).toString())
    } catch {
      return new Response('', { status: 404 })
    }
  })
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1917' : '#efe9df',
    webPreferences: {
      preload: preloadPath,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(rendererHtml)
  }
}

// ---------------- IPC ----------------

function currentVault(): Promise<string> {
  return getConfig().then((c) => {
    if (!c.vaultPath) throw new Error('No vault selected')
    return c.vaultPath
  })
}

function register(): void {
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', async (_e, patch) => {
    const next = await setConfig(patch)
    if ('quickCapture' in patch || 'quickCaptureHotkey' in patch) await applyHotkey()
    return next
  })

  ipcMain.handle('theme:set', (_e, theme: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = theme
    return setConfig({ theme })
  })

  ipcMain.handle('vault:choose', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a folder for your notebooks',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'Use this folder'
    })
    if (res.canceled || !res.filePaths[0]) return null
    const path = res.filePaths[0]
    const entries = await fs.readdir(path).catch(() => [])
    const visible = entries.filter((e) => !e.startsWith('.'))
    await setConfig({ vaultPath: path })
    return { path, empty: visible.length === 0 }
  })

  ipcMain.handle('vault:seed', async () => {
    const vault = await currentVault()
    await seedVault(vault)
    return scanVault(vault)
  })

  ipcMain.handle('vault:scan', async () => {
    const vault = await currentVault()
    return scanVault(vault)
  })

  ipcMain.handle('note:read', async (_e, noteId: string) => {
    return readNoteById(await currentVault(), noteId)
  })

  ipcMain.handle('note:save', async (_e, noteId: string, patch) => {
    const vault = await currentVault()
    await maybeSnapshot(vault, noteId).catch(() => {})
    return saveNote(vault, noteId, patch)
  })

  ipcMain.handle('note:attach', async (_e, noteId: string, dataUrl: string) =>
    saveAttachment(await currentVault(), noteId, dataUrl)
  )

  ipcMain.handle('note:attachFiles', async (_e, noteId: string) => {
    const res = await dialog.showOpenDialog({
      title: 'Attach files',
      properties: ['openFile', 'multiSelections']
    })
    if (res.canceled || !res.filePaths.length) return []
    return attachFiles(await currentVault(), noteId, res.filePaths)
  })

  ipcMain.handle('attach:open', async (_e, attachUrl: string) => {
    const vault = await currentVault()
    const m = attachUrl.match(/^solace-attach:\/\/f\/(.+)$/)
    const abs = m ? decodeURIComponent(m[1]) : join(vault, attachUrl.split('/').join(sep))
    if (!abs.startsWith(vault)) throw new Error('Invalid attachment path')
    await shell.openPath(abs)
  })

  ipcMain.handle('sync:attachments:list', () => currentVault().then(listAttachments))
  ipcMain.handle('sync:attachments:read', (_e, relPath: string) =>
    currentVault().then((v) => readAttachmentBase64(v, relPath))
  )
  ipcMain.handle('sync:attachments:write', (_e, relPath: string, base64: string) =>
    currentVault().then((v) => writeAttachmentBase64(v, relPath, base64))
  )
  ipcMain.handle('sync:attachments:state:get', () => currentVault().then(readAttachState))
  ipcMain.handle('sync:attachments:state:set', (_e, state) =>
    currentVault().then((v) => writeAttachState(v, state))
  )

  ipcMain.handle('note:create', async (_e, args) => {
    const vault = await currentVault()
    return createNote(vault, args.notebookId, args.folderId ?? null, args.title ?? 'Untitled note', args.body ?? '')
  })

  ipcMain.handle('notebook:create', async (_e, name: string) => {
    const vault = await currentVault()
    await createNotebook(vault, name)
    return scanVault(vault)
  })

  ipcMain.handle('folder:create', async (_e, notebookId: string, name: string) => {
    const vault = await currentVault()
    await createFolder(vault, notebookId, name)
    return scanVault(vault)
  })

  ipcMain.handle('notebook:rename', async (_e, notebookId: string, newName: string) => {
    const vault = await currentVault()
    await renameNotebook(vault, notebookId, newName)
    return scanVault(vault)
  })

  ipcMain.handle('folder:rename', async (_e, notebookId: string, folderId: string, newName: string) => {
    const vault = await currentVault()
    await renameFolder(vault, notebookId, folderId, newName)
    return scanVault(vault)
  })

  ipcMain.handle('notebook:setCover', async (_e, notebookId: string, cover) => {
    const vault = await currentVault()
    await setNotebookCover(vault, notebookId, cover)
    return scanVault(vault)
  })

  ipcMain.handle('notebook:reorder', async (_e, ids: string[]) => {
    const vault = await currentVault()
    await setNotebookOrder(vault, ids)
    return scanVault(vault)
  })

  ipcMain.handle('note:delete', async (_e, noteId: string) => {
    const vault = await currentVault()
    await recordTombstones(vault, await deleteNote(vault, noteId))
    return scanVault(vault)
  })

  ipcMain.handle('notebook:delete', async (_e, notebookId: string) => {
    const vault = await currentVault()
    await recordTombstones(vault, await deleteNotebook(vault, notebookId))
    return scanVault(vault)
  })

  ipcMain.handle('folder:delete', async (_e, notebookId: string, folderId: string) => {
    const vault = await currentVault()
    await recordTombstones(vault, await deleteFolder(vault, notebookId, folderId))
    return scanVault(vault)
  })

  ipcMain.handle('search:run', async (_e, query: string) => {
    return searchVault(await currentVault(), query)
  })

  ipcMain.handle(
    'note:move',
    async (_e, noteId: string, toNotebook: string, toFolder: string | null) => {
      const vault = await currentVault()
      const newId = await moveNote(vault, noteId, toNotebook, toFolder)
      return { snapshot: await scanVault(vault), newId }
    }
  )

  // ---- the helper ----

  ipcMain.handle('helper:status', async () => helperStatus(await getConfig()))

  ipcMain.handle('helper:tidy', async (_e, markdown: string) => {
    return tidyUp(await getConfig(), markdown)
  })

  ipcMain.handle('helper:enrich', async (_e, noteId: string) => {
    const cfg = await getConfig()
    const vault = await currentVault()
    const doc = await readNoteById(vault, noteId)
    const [summary, tags] = await Promise.all([
      summarize(cfg, doc.title, doc.body),
      suggestTags(cfg, doc.title, doc.body)
    ])
    const mergedTags = Array.from(new Set([...doc.tags, ...tags])).slice(0, 8)
    await saveNote(vault, noteId, { summary, tags: mergedTags })
    return scanVault(vault)
  })

  ipcMain.handle('helper:summary', async (_e, noteId: string) => {
    const cfg = await getConfig()
    const vault = await currentVault()
    const doc = await readNoteById(vault, noteId)
    const summary = await summarize(cfg, doc.title, doc.body)
    await saveNote(vault, noteId, { summary })
    return scanVault(vault)
  })

  // ---- import ----

  ipcMain.handle('import:pick', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose files to import',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'md', 'markdown', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle(
    'import:run',
    async (
      e,
      args: {
        files: string[]
        pasted: string | null
        notebookId: string
        folderId: string | null
      }
    ) => {
      const cfg = await getConfig()
      const vault = await currentVault()
      const items: ImportItem[] = args.files.map((p) => ({ path: p, name: p.split('/').pop() ?? p }))
      if (args.pasted && args.pasted.trim()) {
        items.push({ path: null, text: args.pasted, name: 'Pasted text' })
      }
      const outcomes = await importItems(
        vault,
        cfg,
        items,
        args.notebookId,
        args.folderId,
        (name, step) => e.sender.send('import:progress', { name, step })
      )
      const snapshot = await scanVault(vault)
      return { outcomes, snapshot }
    }
  )

  // ---- sort ----

  ipcMain.handle('sort:propose', async (_e, noteIds: string[]) => {
    const cfg = await getConfig()
    const vault = await currentVault()
    const snap = await scanVault(vault)
    const names = snap.notebooks.map((n) => n.name)
    const notes = await Promise.all(
      noteIds.map(async (id) => {
        const d = await readNoteById(vault, id)
        return { id, title: d.title, body: d.body, notebookId: d.notebookId }
      })
    )
    return proposeSort(cfg, notes, names)
  })

  ipcMain.handle(
    'sort:apply',
    async (
      _e,
      moves: { noteId: string; toNotebook: string; toFolder: string | null; tags: string[] }[]
    ) => {
      const vault = await currentVault()
      for (const m of moves) {
        const newId = await moveNote(vault, m.noteId, m.toNotebook, m.toFolder)
        if (m.tags.length) {
          const doc = await readNoteById(vault, newId)
          const merged = Array.from(new Set([...doc.tags, ...m.tags])).slice(0, 8)
          await saveNote(vault, newId, { tags: merged })
        }
      }
      return scanVault(vault)
    }
  )

  // ---- version history ----

  ipcMain.handle('history:list', async (_e, noteId: string) =>
    listHistory(await currentVault(), noteId)
  )
  ipcMain.handle('history:read', async (_e, noteId: string, entryId: string) =>
    readHistory(await currentVault(), noteId, entryId)
  )
  ipcMain.handle('history:restore', async (_e, noteId: string, entryId: string) => {
    const vault = await currentVault()
    const doc = await restoreHistory(vault, noteId, entryId)
    return { doc, snapshot: await scanVault(vault) }
  })

  // ---- daily notes ----

  ipcMain.handle('daily:open', async (_e, key?: string) => openDaily(await currentVault(), key))
  ipcMain.handle('daily:read', async (_e, key: string) => readDaily(await currentVault(), key))

  // ---- action items ----

  ipcMain.handle('agenda:list', async () => collectTasks(await currentVault()))
  ipcMain.handle(
    'agenda:toggle',
    async (_e, noteId: string, line: number, done: boolean) =>
      toggleTask(await currentVault(), noteId, line, done)
  )

  // ---- split a note into a series ----

  ipcMain.handle('note:split', async (_e, noteId: string) => splitNote(await currentVault(), noteId))

  // ---- cloud sync (filesystem side; Firebase lives in the renderer) ----

  ipcMain.handle('sync:snapshot', async () => buildSnapshot(await currentVault()))
  ipcMain.handle('sync:apply', async (_e, apply: SyncApply) =>
    applyRemote(await currentVault(), apply)
  )
  ipcMain.handle('sync:state:get', async () => readSyncState(await currentVault()))
  ipcMain.handle('sync:state:set', async (_e, state: SyncState) =>
    writeSyncState(await currentVault(), state)
  )
  ipcMain.handle('sync:state:clear', async () => clearSyncState(await currentVault()))
  ipcMain.handle('sync:tombstones:clear', async (_e, paths: string[]) =>
    clearTombstones(await currentVault(), paths)
  )
  ipcMain.handle('sync:device', () => deviceName())
  ipcMain.handle('google:signin', () => signInWithGoogle())

  // ---- templates ----

  ipcMain.handle('templates:list', () => listTemplates())
  ipcMain.handle('templates:save', (_e, tpl: NoteTemplate) => saveTemplate(tpl))
  ipcMain.handle('templates:delete', (_e, id: string) => deleteTemplate(id))

  // ---- export ----

  ipcMain.handle(
    'export:run',
    async (
      _e,
      args: { noteIds: string[]; format: ExportFormat; name: string; reuse?: boolean }
    ) => {
      return exportNotes(args.noteIds, args.format, args.name, args.reuse)
    }
  )
  ipcMain.handle('export:link', (_e, noteIds: string[], format: ExportFormat) =>
    getExportLink(noteIds, format)
  )

  ipcMain.handle('vault:reveal', async (_e, noteId?: string) => {
    const vault = await currentVault()
    shell.showItemInFolder(noteId ? join(vault, noteId.split('/').join('/')) : vault)
  })

  ipcMain.handle('open:url', async (_e, url: string) => {
    if (/^https?:\/\//.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:checkUpdate', () => checkForUpdate())

  // ---- trash ----
  ipcMain.handle('trash:list', async () => listTrash(await currentVault()))
  ipcMain.handle('trash:restore', async (_e, id: string) => {
    const vault = await currentVault()
    await restoreTrash(vault, id)
    return scanVault(vault)
  })
  ipcMain.handle('trash:purge', async (_e, id: string) => {
    await purgeTrash(await currentVault(), id)
    return listTrash(await currentVault())
  })
  ipcMain.handle('trash:empty', async () => {
    await emptyTrash(await currentVault())
    return []
  })

  // ---- scripture ----
  ipcMain.handle('scripture:refs', (_e, text: string) => parseRefs(text))
  ipcMain.handle('scripture:passages', async () => collectPassages(await currentVault()))
  ipcMain.handle('scripture:lookup', async (_e, ref: VerseRef, translation?: Translation) => {
    const t = translation ?? (await getConfig()).bibleTranslation ?? 'kjv'
    return lookupVerse(ref, t)
  })
}

// one running copy only — a second launch just focuses the first (and keeps the
// IndexedDB store, which Firebase auth relies on, from being locked twice)
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    const cfg = await getConfig()
    nativeTheme.themeSource = cfg.theme
    await registerAttachProtocol()
    register()
    createWindow()
    setupQuickCapture(() => mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
