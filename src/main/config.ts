import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../shared/types'

const CONFIG_PATH = () => join(app.getPath('userData'), 'solace-config.json')

const DEFAULTS: AppConfig = {
  vaultPath: null,
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

let cache: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (cache) return cache
  let loaded: AppConfig = { ...DEFAULTS }
  try {
    const raw = await fs.readFile(CONFIG_PATH(), 'utf8')
    loaded = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<AppConfig>) }
  } catch {
    /* first run — use defaults */
  }
  cache = loaded
  return loaded
}

export async function setConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const next = { ...(await getConfig()), ...patch }
  cache = next
  await fs.writeFile(CONFIG_PATH(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
