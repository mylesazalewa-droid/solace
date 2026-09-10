# Solace Web

A lightweight browser companion to the Solace desktop app. Same Firebase project,
same notes. Works on a phone (installable as a PWA) and any desktop browser.

**What it does:** sign in (Google or email/password), browse notebooks, read/edit
notes in Markdown, tick checkboxes, search, create notes, delete notes. Edits sync
back to the desktop app automatically.

**What it doesn't:** templates, cover art, calendar, version history, import, split —
those stay in the desktop app.

## Run locally

```
cd web
npm install
npm run dev
```

## Deploy to Vercel

From the `web/` folder:

```
npx vercel        # first run links/creates the project — accept the defaults
npx vercel --prod # deploy to the live URL
```

Or in the Vercel dashboard: **Add New → Project → import the repo → set Root
Directory to `web` → Deploy.** No environment variables needed (the Firebase web
config is public and lives in `src/lib/firebase.ts`).

### After the first deploy — two Firebase settings

1. **Authorized domains.** Firebase Console → **Authentication → Settings →
   Authorized domains → Add domain** → your Vercel domain (e.g.
   `solace-web.vercel.app`). Without this, Google sign-in on the web is blocked.
2. **`latest.json`** is served at `https://<your-domain>/latest.json` — the desktop
   app's "Check for updates" reads it. Bump `version` / `url` there each release.
   (The desktop build currently points its update check at Firestore `public/release`
   instead; switch it to this URL if you prefer — see `src/main/updates.ts`.)

## How editing stays in sync

Each note is a Firestore doc at `users/{uid}/notes/{base64url(path)}`. On save the web
app recomputes the same content `hash` the desktop uses, bumps `rev`, and sets
`updated` + `device: "web"`. The desktop app's next sync sees the higher `rev`,
pulls the new body to disk, and updates its local Markdown file.
