# Changelog

Newest first. Commit hashes refer to `main`. Runtime contract 0.2.52 throughout.

## 2026-09-20
- Docs: `CLAUDE.md`, `docs/SPEC.md`, `docs/RUNTIME.md`, `docs/CHANGELOG.md`, `docs/contract/` added for the move to Claude Code.

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
