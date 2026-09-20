# Local dev harness

`index.html` only gets `db` and `sample` when it runs as a claude.ai Artifact.
This folder fakes both so the page can be worked on offline. Nothing here ships
— `index.html` never references it, and the artifact is published from
`index.html` alone.

```
python3 dev/server.py        # http://localhost:8000
```

The server reads `index.html` off disk untouched and injects two script tags
into `<head>` on the way out, so `window.claude` exists before the page's own
script runs.

| file | what it is |
| --- | --- |
| `server.py` | static server + the `<head>` injection |
| `mock-claude.js` | `claude.use("db")` / `claude.use("sample")` against an in-memory store |
| `seed.js` | the starting documents (all fictional — the real data lives only in the claude.ai artifact's db; this repo is public): subjects, tasks (mine and theirs, one overdue), notes, inbox items including two `kind: edit` links |

## URL switches

| | |
| --- | --- |
| `?fresh` | reseed from `seed.js`, discarding local changes |
| `?db=none` | `use("db")` resolves `null` → the disconnected state |
| `?sample=none` | `use("sample")` resolves `null` → Refine hidden |
| `?sample=rate_limited` | the next `sample.json` rejects with that code (any `SampleErrorCode` works) |
| `?latency=300` | slower writes and snapshots (default 60 ms) |
| `?slow=3000` | slower Refine (default 700 ms) |

## Console handle

```js
__trackerMock.dump()          // every document, by path
__trackerMock.reset()         // reseed and reload
__trackerMock.failNext("invalid_json")   // break the next refine
__trackerMock.fail("unavailable")        // break every db write; fail(null) restores
```

## What the mock is faithful about

From `docs/contract/`: path grammar (`TypeError` for the wrong segment parity or
a bad segment), `set` full-replace vs `update` recursive merge, `update` on a
missing document rejecting `invalid_argument`, frozen snapshot bodies with the
same object identity while a document is unchanged, `docChanges()`,
`where`/`orderBy`/`limit`, latency-compensated delivery (`hasPendingWrites`),
and `{code, message}` rejections. State persists in `localStorage`
(`tracker-dev-db`) so a reload keeps what you filed.

## What it is not

`sample` is a crude regex parser, not Claude. It splits on lines and sentences,
guesses direction from phrasing, resolves only obvious dates, and matches a
subject by name. It exists to exercise the draft UI — never judge intake quality
by it. There are no access rules, no other viewers, and no quota.
