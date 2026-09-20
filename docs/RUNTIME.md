# Runtime notes (claude.ai Artifact, contract 0.2.52)

The page only fully works when published as a claude.ai Artifact. This file records what the platform provides and what it forbids. Authoritative type definitions: `docs/contract/` (copied from the platform, v0.2.52).

## Declared capabilities

The Artifact declares `db` and `sample`. The exact stored declaration (including any `db` rules) is held by the platform, not by this repo.

- Republish **without** a `capabilities` argument: the stored declaration and contract pin carry forward.
- `capabilities: {}` clears everything. Never pass it.
- A non-empty `capabilities` object is a full-set declaration; anything not restated is revoked.
- Don't pass `contract: "latest"` unless the runtime upgrade is intended.

## How the page uses them

```js
// boot (see the bottom of index.html)
window.claude.use("db").then(function(db){
  if(!db) { /* disconnected state */ return; }
  db.collection("tasks").onSnapshot(function(snap){ /* snap.docs[].data(), .id */ }, onErr);
  db.doc("tasks/t_abc").update({status: "done"});   // also set(obj), delete()
});

window.claude.use("sample").then(function(sample){
  if(!sample) { /* hide Refine */ return; }
  sample.json(promptString, {cache: false}).then(function(parsed){ /* ... */ });
});
```

- `use()` resolves `null` when the capability isn't served/granted. Render without it; light features up when it resolves. Never read `window.claude.db` etc. — only `use` exists.
- Subscribe once per collection at boot, never inside render.
- One write at a time per doc; last-writer-wins; no transactions.
- `sample` is billed to the viewer, first call asks consent, 5–60 s latency, errors reject `{code, message}` (`not_granted`, `rate_limited`, `cancelled`). Model tier is the default (not `quick`).
- Don't store secrets. Shared data is untrusted: escape on render.

## Published-page sandbox

- Scripts load only from: `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com`, `code.jquery.com`. This page uses none.
- Stylesheets only from `fonts.googleapis.com` (font files from `fonts.gstatic.com`). Everything else is blocked silently.
- No `fetch`/XHR to other origins. No remote images. Inline everything else (data: URIs).
- The direct Anthropic API call and `window.storage` that work in the chat preview do **not** work in a published page.
- `localStorage` works, per viewer, per artifact. In use for UI prefs only: `tracker-tab`, `tracker-dirs`, `tracker-refine`, `tracker-theme` (the page still reads the pre-rename `ledger-*` keys once as a fallback so nobody loses their settings). Always wrapped in try/catch.
- Plain download links and script-started saves are inert; a file save needs the `downloads` capability (not declared).
- File size cap 16 MB (page is ~117 kB).

## Layout requirements

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.
- Respect safe-area insets (`env(safe-area-inset-*)`); the phone draws the page under translucent system bars.
- Theme tokens on `:root`, dark under `@media (prefers-color-scheme: dark)` guarded with `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. `body` has an explicit background.

## Chat-side database access

The project instructions tell Claude to use the Artifact tool's `read_db` / `write_db` actions against the artifact URL. Those actions were **not** exposed in the Artifact tool of the chat session on 2026-09-20 (it offered `publish`, `list`, `read`, `capabilities`, `open`). Check availability at the start of a session before relying on chat-side capture to `inbox`; if they're missing, say so rather than claiming a capture happened.

## Publishing from this repo

Claude Code can't publish. In a Claude chat: "pull main and republish" → Claude fetches `index.html` from GitHub and publishes it to `https://claude.ai/artifact/DFT23aPRfDHyockSvLFZwy` (existing artifact `url`, so the link and data stay). Rollback: republish an earlier commit's `index.html` the same way (`cab889d` = the page before the 2026-09-18 cleanup).
