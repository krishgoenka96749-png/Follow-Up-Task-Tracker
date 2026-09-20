# Ledger — Claude Code context

Personal commitments ledger for Krish. Raw input (typed, dictated, pasted WhatsApp, meeting transcripts) becomes structured tasks, follow-ups and notes. Bookkeeping is the job; analysis and drafting only on request.

This repo is the **page** (the UI). The data lives in the claude.ai Artifact's `db`, not here.

- Live artifact: https://claude.ai/artifact/DFT23aPRfDHyockSvLFZwy
- Repo: `krishgoenka96749-png/Follow-Up-Tracker-Web-App` (private, branch `main`)
- Docs: `docs/SPEC.md` (behaviour + data model), `docs/RUNTIME.md` (platform limits), `docs/CHANGELOG.md`

## Layout

```
index.html        the whole app: HTML + CSS + vanilla JS, ~2k lines, no build step, no dependencies
docs/             SPEC, RUNTIME, CHANGELOG, contract/ (platform type definitions, v0.2.52)
```

Keep it a single self-contained `index.html`. Do not add a bundler, framework or npm dependencies.

## How it runs

- Published as a claude.ai Artifact. The page gets two platform capabilities through `window.claude.use(name)`:
  - `db` — JSON doc store. Collections: `tasks`, `notes`, `subjects`, `inbox`. The page subscribes with `db.collection(x).onSnapshot(...)` and writes with `db.doc("coll/id").set/update/delete`.
  - `sample` — asks Claude. Used by the capture box's "Refine" (`sample.json(prompt, {cache:false})`).
- Both resolve `null` when unavailable. The page must still render (disconnected state) and hide Refine. Never assume they exist.
- Neither exists outside claude.ai. Opening `index.html` locally shows the disconnected state unless a mock is loaded (see Local dev).
- Sandbox rules of a published page: scripts only from cdnjs / jsdelivr / tailwind CDN / jquery; stylesheets only from Google Fonts; no `fetch` to other hosts. `localStorage` works but is per-viewer UI prefs only (`ledger-tab`, `ledger-dirs`, `ledger-refine`, `ledger-theme`). Details in `docs/RUNTIME.md`.

## Code map (search by function name; line numbers drift)

- State: `S` (tasks, notes, subjects, inbox, tab, filter, drafts…). Render: `render` / `requestRender` → `renderLedger`, `renderNotes`, `renderApprove`, `renderHero`.
- Data in: `subscribe(name, key)` at boot. Data out: `setStatus`, `setDirection`, `saveField`, `saveNewNote`, `deleteNote`, `submitEdit`, `fileItem`/`fileAll` (inbox → tasks/notes), `dropItem`.
- Capture box: `capture` → `doRefine` (sample) / `captureRaw` / `captureDraft`; `buildPrompt` is the intake prompt; `cleanItem` sanitises model output.
- Two tabs: **Ledger** (open tasks by direction: mine / theirs) and **Approve** (pending inbox items).

## Rules that must not break

1. **Approval gate.** Nothing enters `tasks`/`notes` unreviewed. Captures go to `inbox` immediately; only an explicit user approval (`fileItem`/`fileAll`) promotes them. Edits and closures proposed from chat are inbox items with `kind: "edit"`, not direct writes. Never add a code path that writes to `tasks`/`notes` without a user action.
2. **Never lose input.** Capture to `inbox` is unconditional. Never silently drop an item; drops only on explicit user action.
3. **`due` is `YYYY-MM-DD` or `""`.** Never invent a date.
4. **`history` is append-only** (`{at, text}`). Later updates append; they don't overwrite.
5. **Last-writer-wins, no transactions.** Multi-step writes (e.g. promote inbox → task, delete inbox item) are chained, with manual rollback on failure. Keep that pattern. Destructive actions offer Undo (toast).
6. **Never claim a save that didn't return.** On write failure, say so and leave the item pending (`warn`).
7. **Ids:** `t_`, `n_`, `i_` + short timestamp string (`newId`).
8. **No secrets** in the page, the repo, or the db. Shared data is untrusted; escape everything rendered (`esc`).

## UI conventions

- Phone-first (used mainly in the Claude mobile app, ~380px). Check every change at narrow width.
- Light/dark via CSS tokens on `:root` + `prefers-color-scheme` + `data-theme`; keep the safe-area-inset handling.
- Fonts: Archivo (UI), Fraunces (accents), Google Fonts with fallbacks.
- Plain ES5-style JS (`var`, function expressions). Match it; don't mix in modules.

## Local dev

There is no local runtime for `db`/`sample`; `dev/` fakes both. The server reads `index.html` off disk untouched and injects `dev/seed.js` + `dev/mock-claude.js` into `<head>` on the way out. **The mock never goes in `index.html`** — the artifact is published from `index.html` alone.

```
python3 dev/server.py   # http://localhost:8000 — open this, not index.html directly
```

`?fresh` reseeds, `?db=none` gives the disconnected state, `?sample=none` hides Refine, `?sample=<code>` makes the next refine fail. `window.__ledgerMock` has `dump()`, `reset()`, `failNext(code)`, `fail(code)`. Details in `dev/README.md`; the real API it imitates is in `docs/contract/`.

## Shipping (Claude Code cannot publish artifacts)

1. Commit small, one logical change each. Message style: `Area: what changed` (see `git log`).
2. `git push origin main`.
3. In a Claude chat in the Ledger project: "pull main and republish". Claude publishes the repo's `index.html` to the same artifact URL.
   - Republish without a `capabilities` argument so the stored `db` + `sample` declaration carries forward. Never pass `{}`.
   - Do not bump the runtime contract (currently 0.2.52) as a side effect.
4. Before pushing anything that changes the data shape, update `docs/SPEC.md`. Existing docs in the db are live; migrations must be additive or handled in code.

## Working with Krish

Answer first, no preamble, no closing offers, no hedging. Short by default. For real work end with:
`Done:` ≤4 lines, what you produced, gaps stated plainly.
`Needs you:` what he must decide or provide, or "Nothing."

Never commit tokens. If a GitHub token is needed, it is fine-grained, single-repo, short-lived, and revoked after.
