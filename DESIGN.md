# Design

## Architecture overview

Functional core, imperative shell, all in the browser.

- `src/domain`: pure TypeScript, unit tested. Chunked CSV parser on PapaParse, column rules and issue catalog, validation, duplicate index, filters, fix planning, cell edits.
- `src/worker`: parses and validates off the main thread. Its typed protocol (request, progress, chunk, result, error, cancel) is the stand-in for a backend API.
- `src/store`: one Zustand store: dataset, issues, view state, edit history.
- `src/ui`: components read the store through selectors. `VirtualScroller` and `Table<TRow>` are generic; only `customerColumns.tsx` knows the data.
- `src/constants`: all error and issue texts as typed `{placeholder}` templates.

Flow: the store checks the file and sends the `File` handle to the worker. The worker streams it through `TextDecoder` and PapaParse, sends rows in chunks of 5,000, then validates in slices (cancel works between slices) and sends issues in chunks. Row statuses and per-row issue offsets come as transferred typed arrays. The store commits once. Each row is valid, fixable (every issue has a suggested value) or manual. Views are index arrays over the rows. Every change is a patch `{ row, column, before, after }`; undo restores the previous validation snapshot.

## ADR: parse and validate in a worker, keep the dataset on the main thread

**Decision.** The worker parses and validates; rows and issues stream back in chunks and live in the store, where edits, filters and undo are synchronous.

**Alternatives.**

- Main thread parsing: simplest, but freezes the page for seconds on 200,000 rows.
- Dataset in the worker, fetch visible rows only: I chose this first, then reverted it. Every edit, search and undo would become an async round trip.
- `SharedArrayBuffer`: needs COOP and COEP headers and a binary format. Overengineering here.
- PapaParse `worker: true`: cannot validate, and its file reader breaks multi-byte characters at chunk borders.

**Why.** 200,000 rows fit in memory, and small chunks keep each structured clone to a few milliseconds. Measured with 200,000 messy rows: parsing about 180 ms, validation about 340 ms, longest main thread stall about 16 ms.

## UX decisions

- **Loading:** one drop zone (drop anywhere), stage, percent, rows, Cancel. One progress bar for both stages, so it never jumps back. View Transitions between screens, off with reduced motion. Device light or dark theme.
- **Overview first:** not thousands of red cells. Row counts, then one item per issue type, grouped into "Can be fixed automatically" and "Needs your input", with a plain explanation and a good example. Clicking an item shows its rows. The overview can be hidden and disappears when nothing is left.
- **Cells:** subtle marks. Red for manual, amber with the suggestion (`Germany → DE`), green for fixed with the old value in the tooltip.
- **Automatic fix per issue type:** "Apply automatic fix (N)" under the selected type; the filtered grid is the before and after preview. Assumptions ask to check first. A confirmation dialog with two modes was replaced by this: fewer steps, real data as preview.
- **Search sets the scope:** with a search, overview counts and fixes cover only matching rows ("only the Johns"), shown in a banner. Quick filters and the overview selection exclude each other.
- **Editing:** hover shows a pencil (double click was not discoverable; Enter and F2 from the keyboard). A live hint says what is wrong and offers "Use DE". Enter saves, Escape cancels, unchanged values do nothing, a spinner shows while the cell is checked.
- **Narrow screens:** columns shrink, then hide by priority.
- **Editing options considered:** row card side panel, fix one by one, apply to all similar values, find and replace, AI suggestions, edit dialog. Inline editing covers the common case and is what the spec asks for.

## Performance approach

- **Worker:** streaming, parsing, validation, duplicate pass. Progress at most every 100 ms.
- **Main thread**, each under 50 ms on 200,000 rows: search (index built once in about 28 ms, then about 3 ms, debounced 250 ms); cell edit (row and duplicate groups only, counts by difference, about 0.3 ms; duplicate index built in idle time); automatic fix of 275,000 values (about 42 ms, undo about 10 ms; fixed issues are removed, not revalidated, because suggestions always pass their rule).
- **Rendering:** TanStack Virtual, fixed row height in Tailwind spacing units measured from a probe. Cells find issues through per-row offsets.
- **No large props:** React 19 dev mode diffs changed props; passing the dataset as a prop blocked each edit for 2.5 s. Components read it from the store.
- **Limit:** files above 100 MB are rejected. Scaling path: dataset in the worker with row windows.

## Assumptions

- First row is the header. Delimiter and line break detected from the first 64 KB. Header names match spec columns trimmed and case-insensitive; a missing column is one file-level message.
- One issue per cell. Missing or invalid beats duplicate, duplicate beats fixable.
- Dates: target YYYY-MM-DD, parsed explicitly. A part above 12 is the day; 03/04/2024 is read as day/month (European) and marked as suggested.
- Countries: 249 ISO alpha-2 codes; names from `Intl.DisplayNames` in five locales plus a short alias list. Unknown values are never guessed.
- Amounts: currency removed (safe). A comma with 1 or 2 digits is decimal, commas between 3-digit groups are thousands (suggested). Negative is manual.
- Duplicates: customer_id trimmed, email trimmed and case-insensitive; every row of a group is flagged.
- Scope: the spec asks for one bulk fix (countries). I widened it to every safe or suggested type, one type at a time.

## AI note

Claude Code generated almost all code, tests and drafts of this document, step by step on my requests.

**What I decided or changed:** Prettier as an extra dev tool; `lodash.debounce` as an exception to the no-lodash rule (recorded in CLAUDE.md); `postMessage` instead of `SharedArrayBuffer`; reverting "dataset in the worker" to the chunked design; generic grid components sized in Tailwind units; priority-based column hiding; a mock stage before the real pipeline; one constants file for texts; PapaParse as a standalone module; three row categories; per-type fixes instead of a dialog; search-scoped overview; pencil editing and a saving state. I found by hand the bugs tests missed: a transition flicker on every edit, a hang after edits, a spinner that did not spin.

**How it was verified:** `npm run check` (typecheck, oxlint, 160 Vitest tests, Prettier) before every commit. Tests were checked by injecting bugs; this exposed a parser test that never crossed chunk borders. Worker and fixes were load tested with 200,000 generated rows in Node. The dev-mode hang was found with a CPU profile in headless Chrome. Screens, animation and themes were checked in the browser.

## Trade-offs and next steps

- Hidden columns cannot be viewed on narrow screens; next is a row card.
- Duplicates are checked after saving, not while typing.
- No sorting yet (views are index arrays, so it is a small step).
- Dates and amounts cover common formats only.
- No component or end-to-end tests.

**Import summary screen (not built):** after validation, file name, row counts by status, missing columns and the top issue types with "Fix automatically" and "Review in table".

**API contract:** `POST /imports` (upload) returns `{ importId }`. `GET /imports/{id}/events` streams progress, then `{ columns, rowCount, statusCounts, issueCounts, missingColumns }`. `GET /imports/{id}/rows?offset&limit&filter&issueType&q` returns rows with issues. `PATCH /imports/{id}/cells` takes patches and returns issues of affected rows. `POST /imports/{id}/fixes { issueType, q }` and `POST /imports/{id}/undo`.

## Dependencies

- react, react-dom: UI.
- zustand: small store with selectors.
- @tanstack/react-virtual: virtualization without a grid library.
- papaparse: CSV parsing with quotes and delimiter detection.
- tailwindcss, @tailwindcss/vite: utility styling.
- lodash.debounce: search debounce, standalone function only.
- vitest: domain and store tests.
- oxlint, prettier, prettier-plugin-tailwindcss: lint, format, stable class order.
