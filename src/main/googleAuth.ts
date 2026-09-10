import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { shell } from 'electron'
import { SHARED } from '../shared/appConfig'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const DONE_HTML = (msg: string): string =>
  `<!doctype html><meta charset="utf-8"><title>Solace</title>` +
  `<body style="font:16px -apple-system,system-ui,sans-serif;text-align:center;padding:64px 24px;color:#2c2a26;background:#faf7f1">` +
  `<div style="font-size:30px">▲</div><h2 style="font-weight:700">Solace</h2><p style="color:#6b6660">${msg}</p></body>`

interface Loopback {
  port: number
  waitForCode: () => Promise<string>
  close: () => void
}

function startLoopback(state: string): Promise<Loopback> {
  return new Promise((resolve, reject) => {
    let resolveCode: (c: string) => void = () => {}
    let rejectCode: (e: Error) => void = () => {}
    const codeP = new Promise<string>((res, rej) => {
      resolveCode = res
      rejectCode = rej
    })
    const timeout = setTimeout(
      () => rejectCode(new Error('Timed out waiting for Google sign-in.')),
      3 * 60 * 1000
    )

    const server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (!u.searchParams.has('code') && !u.searchParams.has('error')) {
        res.writeHead(404)
        res.end()
        return
      }
      const err = u.searchParams.get('error')
      const gotState = u.searchParams.get('state')
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(
        DONE_HTML(
          err
            ? 'Sign-in was cancelled. You can close this tab.'
            : 'You’re signed in. You can close this tab and go back to Solace.'
        )
      )
      clearTimeout(timeout)
      if (err) rejectCode(new Error('Google sign-in was cancelled.'))
      else if (gotState !== state) rejectCode(new Error('Sign-in could not be verified — try again.'))
      else resolveCode(u.searchParams.get('code') as string)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({ port, waitForCode: () => codeP, close: () => server.close() })
    })
  })
}

/** Opens the system browser for Google sign-in and returns fresh tokens. */
const CLIENT_SECRET = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET ?? ''

export async function signInWithGoogle(): Promise<{ idToken: string; accessToken: string }> {
  const clientId = SHARED.googleClientId
  const clientSecret = CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('One-click Google sign-in is not set up in this build.')
  }

  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  const lb = await startLoopback(state)
  const redirectUri = `http://127.0.0.1:${lb.port}`

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile')
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  await shell.openExternal(authUrl.toString())

  let code: string
  try {
    code = await lb.waitForCode()
  } finally {
    lb.close()
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    })
  })
  if (!res.ok) {
    throw new Error('Google token exchange failed: ' + (await res.text()).slice(0, 200))
  }
  const json = (await res.json()) as { id_token?: string; access_token?: string }
  if (!json.id_token || !json.access_token) {
    throw new Error('Google did not return the expected tokens.')
  }
  return { idToken: json.id_token, accessToken: json.access_token }
}
