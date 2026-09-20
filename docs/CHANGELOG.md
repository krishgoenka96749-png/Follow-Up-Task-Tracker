# Changelog

Newest first. Commit hashes refer to `main`. Runtime contract 0.2.52 throughout.

## 2026-09-20
Live artifact: versions 22 and 23 published today (v23 = `index.html` at `333f66d`).
- `d99ec49` Docs: claude.ai project is "Follow Up Tracker"; the `ledger-18` CLI session was closed.
- `333f66d` Naming sweep: nothing in the page, dev harness or docs says "ledger" except the deliberate fallbacks listed in `CLAUDE.md` under "Old names". Tab **Ledger** → **Tasks**; copy ("File as task", "Filed as a task", "Your tracker is clear.", new placeholder); JS `renderLedger` → `renderTasks`; localStorage `ledger-*` → `tracker-*` (old keys read as a fallback); new records' `source` and `history` text say "tracker page"; dev `__ledgerMock` → `__trackerMock`. GitHub repo renamed `Follow-Up-Tracker-Web-App` → `Follow-Up-Task-Tracker`.
- `d2ff934` Docs: shipping via the Artifact tool from the desktop app.
- `888e0cf` Capture box: Task/Note switch above the text box, usable with Refine on or off. Raw capture as Note writes an `inbox` note (`kind:"note"`, `body`=raw); with Refine on it hints the intake prompt to default to notes. Resets to Task after each capture; hidden in the draft preview (cards keep their own switch).
- `89d3fdd` Page: `<title>`, iOS app title and header say Follow Up Task Tracker.
- `bb8e628` Project renamed **Follow Up Task Tracker** (was called "Ledger") and moved from `Sandboxes/ledger/` to `Sandboxes/General Projects/Follow Up Task Tracker/`.
- `e0c8c44` Dev: `dev/` local mock harness — `server.py` injects `seed.js` + `mock-claude.js` into `<head>`, faking `db` (in-memory store, snapshots, queries, contract-shaped errors) and `sample` (regex intake). `index.html` unchanged. See `dev/README.md`.
- `63875bf`, `acecf90`, `3cef949` Docs: `CLAUDE.md`, `docs/SPEC.md`, `docs/RUNTIME.md`, `docs/CHANGELOG.md`, `docs/contract/` added for the move to Claude Code.

## 2026-09-19
- `5fa5412` Capture preview: Task/Note switch per card (switching keeps all fields); refine defaults to task and runs on the default model tier (can take up to ~1 min).
- `c625454` Capture box: Refine shows an editable preview first; refine is a switch; nothing saved until Capture.
- `f9cfbe6` Capture box: type a note, saved to `inbox`; optional refine with Claude (`sample`).

## 2026-09-18 — cleanup, behaviour unchanged
- `c0e6d96` JS: short `$(id)` for the 30 `document.getElementById` calls.
- `f4e6234` JS: reuse `subjectOptions`/`dirOf`; shared `TASK_FIELDS`/`NOTE_FIELDS`; one `cancelFieldEdit` for Cancel and Escape.
- `04eba49` JS: shared helpers (`has`, `trim`, `cap`, `newId`, `nowIso`, `findIn`, `dirOf`); declare `dirPrompt`/`triedConnect` up front; remove unused `pendingTitle`.
- `fee3caa` CSS: merge the split `.dir` and `.dir-head` rules.
- `75be92d` CSS: remove selectors nothing on the page uses.
- `cab889d` Snapshot: live Ledger artifact before cleanup (rollback point).
