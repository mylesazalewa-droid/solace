import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { getConfig } from './config'
import { scanVault, createNotebook, createNote } from './vault'

const INBOX = 'Inbox'

let captureWin: BrowserWindow | null = null
let registered: string | null = null
let openedFromApp = false
let getMain: () => BrowserWindow | null = () => null

const preloadPath = join(app.getAppPath(), 'out/preload/index.js')
const rendererHtml = join(app.getAppPath(), 'out/renderer/index.html')

function buildCaptureWindow(): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    width: 560,
    height: 232,
    x: Math.round(width / 2 - 280),
    y: 140,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    roundedCorners: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: preloadPath, sandbox: false }
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#capture`)
  } else {
    win.loadFile(rendererHtml, { hash: 'capture' })
  }

  // close on blur so it behaves like a spotlight panel
  win.on('blur', () => {
    if (captureWin === win) hideCapture()
  })
  win.on('closed', () => {
    if (captureWin === win) captureWin = null
  })
  return win
}

function toggleCapture(fromApp = false): void {
  if (captureWin && captureWin.isVisible()) {
    hideCapture()
    return
  }
  openedFromApp = fromApp
  if (!captureWin) captureWin = buildCaptureWindow()
  const win = captureWin
  win.center()
  const b = win.getBounds()
  win.setBounds({ ...b, y: 140 })
  win.show()
  win.focus()
  win.webContents.send('capture:reset')
}

function hideCapture(): void {
  captureWin?.hide()
  // when triggered by the global hotkey from another app, hand focus back to it;
  // when opened from inside Solace, keep Solace in front
  if (process.platform === 'darwin' && !openedFromApp) app.hide()
  else if (openedFromApp) getMain()?.focus()
}

async function saveThought(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  const cfg = await getConfig()
  if (!cfg.vaultPath) throw new Error('No vault selected yet — open Solace and choose a folder first.')
  const vault = cfg.vaultPath

  const snap = await scanVault(vault)
  if (!snap.notebooks.some((n) => n.id === INBOX)) {
    await createNotebook(vault, INBOX)
  }

  const lines = trimmed.split('\n')
  const first = lines[0].trim()
  const title = first.length > 80 ? `${first.slice(0, 77)}…` : first || 'Quick note'
  const body = lines.length > 1 || first.length > 80 ? trimmed : ''

  await createNote(vault, INBOX, null, title, body)
  getMain()?.webContents.send('vault:changed')
}

export function setupQuickCapture(mainGetter: () => BrowserWindow | null): void {
  getMain = mainGetter

  ipcMain.handle('capture:save', async (_e, text: string) => {
    await saveThought(text)
    hideCapture()
  })
  ipcMain.handle('capture:dismiss', () => hideCapture())
  ipcMain.handle('capture:open', () => toggleCapture(true))
  ipcMain.handle('capture:refresh-hotkey', () => applyHotkey())

  applyHotkey()
  app.on('will-quit', () => globalShortcut.unregisterAll())
}

export async function applyHotkey(): Promise<void> {
  const cfg = await getConfig()
  if (registered) {
    globalShortcut.unregister(registered)
    registered = null
  }
  if (!cfg.quickCapture) return
  const accel = cfg.quickCaptureHotkey || 'CommandOrControl+Shift+Space'
  try {
    const ok = globalShortcut.register(accel, toggleCapture)
    if (ok) registered = accel
  } catch {
    /* invalid accelerator string — silently skip, Settings validates */
  }
}
