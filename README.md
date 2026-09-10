# Solace

A calm Mac notes app: a shelf of notebooks that file and find themselves.

- **Storage:** plain Markdown files + YAML frontmatter, in a folder you choose. Obsidian can
  open the same folder. Notebooks = top-level folders; series/folders = one level of subfolders.
- **Stack:** Electron + React + TypeScript (electron-vite), CodeMirror 6 editor.
- **Design:** see the mockup and `spec` — warm paper, calm green, Nunito + Baloo 2.

## Develop

```bash
npm install
npm run dev
```

## Status — Stage 1 (in progress)

Done: project scaffold, folder picker + example-vault seeding, the shelf, a notebook with its
side panel (folders/series + note list + scoped search), the Markdown editor with live preview
and autosave, and search (scoped + global) with grouped results.

Next stages: the helper (Ollama + Gemini), Tidy up, auto-summaries, Sort, import, calendar,
quick capture, templates, pins, series export, version history. See the spec.

## App icon

Provided by Myles — a dark rounded-square with an embossed notebook (elastic band + bookmark
ribbon), matte charcoal, white ribbon. Drop the source PNG at `build/icon.png` (1024×1024)
before packaging in Stage 8.
