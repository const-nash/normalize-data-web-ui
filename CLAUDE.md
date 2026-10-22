# CLAUDE.md

## Project

A browser-only prototype that lets a non-technical user load a large, messy CSV (200,000 rows), find the problems, understand them in plain language and fix them one by one or in bulk, while the page stays fast and responsive.

This is a time-boxed case study (2 to 4 hours in total). The reviewers value a simple, well-reasoned solution over a complete or polished one. When in doubt, build less and document the rest.

## Stack

React, TypeScript, Vite, Tailwind CSS v4, Zustand, PapaParse, TanStack Virtual, Vitest, lodash.debounce.

Do not add any other dependency without asking me first. Every dependency needs a one-line reason in DESIGN.md.

Not used on purpose: TanStack Table, AG Grid, router, UI kit, date libraries, lodash (the full library; the standalone lodash.debounce is allowed), immer, react-dropzone.

## Commands

- `npm run dev`: start the app
- `npm run generate`: create `import-data.csv` with the provided generator
- `npm run check`: typecheck, lint and tests
- `npm run build`: production build (check performance here, dev mode is slower)

## Data and the generator

- `scripts/generate-data.mjs` is provided by the reviewers. Treat it as a black box: never open, read or modify it.
- Never run it with `--report` and never read `issues-report.json`.
- `import-data.csv` and `issues-report.json` are gitignored.
- The column rules below are the only specification. Rules must be generic, never tuned to specific values seen in the data.

## Column rules

| Column | Rule |
|---|---|
| customer_id | Required, unique |
| first_name, last_name | Required, not empty after trimming whitespace |
| email | Required, valid format. Two rows with the same email are duplicates |
| signup_date | Required, a real calendar date. Target format YYYY-MM-DD |
| country | Required. Target is an ISO 3166-1 alpha-2 code, for example DE |
| plan | One of free, pro, enterprise. Target is lowercase |
| monthly_spend | Required, a number of 0 or more, no currency symbol, dot as decimal separator |

Ambiguous values (for example 03/04/2024) get a reasonable assumption that is written down in DESIGN.md.

## Scope

Must have, and nothing beyond it:

1. Load the file without freezing the page, with a clear loading state and progress.
2. A virtualized grid that scrolls smoothly through all rows, with search and at least one of sorting or filtering.
3. An issues overview: counts per issue type, a way to jump to a problem, and a plain-language explanation of what is wrong and what a good value looks like.
4. Inline cell editing with immediate revalidation.
5. Exactly one explained bulk fix (country normalization). Show the affected rows (before and after) before applying, and support undo.

Out of scope, document only: import summary screen, more bulk fixes, export, persistence across reloads, backend, routing, auth.

## Architecture

Functional core, imperative shell.

- `src/domain`: pure TypeScript, no React, no DOM. Column rules, parsing and normalization of values, issue types, duplicate index, bulk fix preview. Shared by the worker and the UI. Unit tested.
- `src/worker`: `import.worker.ts` parses the file with PapaParse and validates all rows off the main thread. Created with `new Worker(new URL('./worker/import.worker.ts', import.meta.url), { type: 'module' })`. Its typed message protocol is the stand-in for a future backend API.
- `src/store`: Zustand. Dataset, issue index, view state, edit history.
- `src/ui`: React components. They read from the store through selectors and call store actions. No business logic in components.

Data flow:

1. The user picks or drops a file. The `File` object goes to the worker.
2. The worker parses and validates everything, including the duplicate pass, and reports progress (stage and rows processed).
3. The result goes back in chunks of about 5,000 to 10,000 rows, so the main thread never deserializes everything at once. The main thread collects the chunks and updates the store once at the end.
4. The view state is an array of row indices for the current search, filter and sort. The grid renders from it.
5. Every change is a patch `{ row, column, before, after }`. A single edit is one history entry. A bulk fix is one history entry with many patches. Undo applies patches in reverse. Changed cells are marked from the patches.

## Domain conventions

- Each issue type has: id, column, short plain-language title, explanation, an example of a good value, and a fix kind: `safe` (can be applied automatically), `suggested` (needs confirmation) or `manual` (needs user input).
- Messages use the user's language, not technical terms. Write "Country should be a 2-letter code like DE", not "Invalid ISO 3166-1 alpha-2".
- Dates: never rely on `new Date(string)`. It rolls impossible dates over (2024-02-30 becomes March 1) and guesses formats. Parse year, month and day explicitly, validate them, and keep dates as `YYYY-MM-DD` strings without time zones.
- Countries: generic lookup, for example a reverse map built with `Intl.DisplayNames` for a few locales plus a short alias list. Unknown values stay as issues for the user, they are never guessed.
- Duplicates: compare emails trimmed and case-insensitive. Keep an index from email to row indices, so an edit updates only the affected group.
- Validation functions take a value (or a row) and return issues. They never mutate input.

## Performance rules

- Parsing and full validation run in the worker. The main thread only renders.
- Grid rows have a fixed height. Only visible rows render. Rows are memoized and subscribe only to their own data.
- Search is debounced. Filtering and sorting produce index arrays and never copy row objects.
- A cell edit revalidates only its row and its duplicate group, then updates the issue counts by difference.
- A bulk fix must not block the UI. If it takes more than about 50 ms on the main thread, move it to the worker.
- Reject files above about 100 MB with a clear message, and note the scaling path in DESIGN.md.

## UI rules

- Clarity over visual polish. Tailwind utility classes only, no custom design system.
- Do not show thousands of red cells at once. Lead with the issues overview and let the user focus on one issue type at a time.
- Render cell values as plain text. Never use `dangerouslySetInnerHTML`.
- Editing: Enter saves, Escape cancels. The grid uses `role="grid"` with `aria-rowcount` and `aria-rowindex`.
- Native elements where possible, for example `<dialog>` for the bulk fix preview and a plain file input with drag and drop.

## Testing

- Vitest unit tests for everything in `src/domain`: each rule, each normalizer, ambiguous cases, duplicate index updates, bulk fix preview and undo.
- No component tests unless a key interaction cannot be covered through the domain and the store.

## Workflow

- For any non-trivial step, propose a short plan first and wait for my go.
- Small commits with clear imperative messages, one logical step each.
- Run `npm run check` before every commit.
- Update DESIGN.md while working: decisions, assumptions, trade-offs. Do not leave it for the end.
- After each step, list briefly what you generated, so I can write the AI note (what AI did, what I changed, how I verified it).

## Deliverables

- README.md: how to run (`npm install`, `npm run generate`, `npm run dev`) and how the generator was used (default settings, the report was not used during development).
- DESIGN.md, at most two pages, with these sections: Architecture overview, ADR (one decision, alternatives, why), UX decisions, Performance approach, Assumptions, AI note, Trade-offs and next steps. Also a short description of the import summary screen (not built) and the API contract a backend would provide.

## Writing style for docs and commits

Plain, concise English. Short sentences. No em dashes, no marketing words, no filler. State decisions and their reasons.
