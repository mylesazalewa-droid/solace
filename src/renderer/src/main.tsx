import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { QuickCapture } from './QuickCapture'
import './fonts.css'
import './styles.css'

const isPackaged = window.location.protocol === 'file:'

if (!('solace' in window)) {
  if (isPackaged) {
    // Packaged app but the preload bridge is missing — never fall back to mock
    // data here, that silently hides a real bug. Show what's wrong instead.
    document.body.innerHTML =
      '<div style="font:15px system-ui;padding:40px;max-width:520px;margin:40px auto;color:#2c2a26;background:#fff;border-radius:14px">' +
      '<h2 style="font-family:system-ui">Solace couldn’t start</h2>' +
      '<p>The internal bridge (preload) didn’t load, so the app can’t reach your files. ' +
      'This is a packaging bug — please report it. Quit and reopen; if it keeps happening, reinstall.</p>' +
      '</div>'
    throw new Error('preload bridge missing in packaged app')
  }
  // Browser dev only (vite dev server): use the in-memory mock.
  const { installDevMock } = await import('./devMock')
  installDevMock()
}

const isCapture = window.location.hash === '#capture'
if (isCapture) document.documentElement.setAttribute('data-capture', 'true')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isCapture ? <QuickCapture /> : <App />}</React.StrictMode>
)
