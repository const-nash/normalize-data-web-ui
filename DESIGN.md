# Design

## Architecture overview

Functional core, imperative shell.

- `src/worker`: the import worker and its typed message protocol. The protocol is the stand-in for a future backend API.
- `src/store`: Zustand. Holds the dataset and the load state, and owns the load flow.
- `src/ui`: React components. They read from the store through selectors and call store actions.
- `src/domain`: pure types and rules. For now the `CustomerRow` type, the column list and the import file check.
- `src/domain/csv`: chunked CSV parser on PapaParse. `createCsvChunkParser` takes text slices and completes rows split between them. `parseCsvStream` and `parseCsvBlob` read bytes with a streaming `TextDecoder`, so characters split between chunks stay intact. The module knows nothing about workers or threads. PapaParse's own file reader and worker mode are not used: the file reader decodes each byte slice separately (breaks multi-byte characters) and needs `FileReader`, which Node lacks.
- `src/domain/rules`: column rules. `columnRules.ts` has one rule per column: it takes a raw value and returns the most important issue or null, with a suggested value for safe and suggested fixes. `issueTypes.ts` is the issue catalog (column, title, explanation, good example, fix kind). Helpers parse dates, countries and amounts. Uniqueness of customer_id and email is checked across rows later by the duplicate index.
- `src/domain/validation.ts`: validates all rows. Maps the header to spec columns, builds the duplicate indexes for customer_id and email, runs the column rules and sorts each row into valid, fixable or manual. A row is fixable when every issue has a suggested value; suggested fixes are confirmed through a preview before they are applied. It is a generator, so the worker can pause between slices and handle cancel.
- The worker also sends `issueOffsets` (a transferred `Uint32Array`): issues of row r start at `issueOffsets[r]`. A cell finds its issue by scanning a few entries, without a map over all issues.
- `src/domain/filter.ts`: search and quick filters. The result is a `Uint32Array` of row indices; rows are never copied. The grid takes a row count and `getRow(i)`, so it renders any view.
- `src/constants`: shared constants: file extensions, byte sizes and all error texts. Error texts are templates with `{name}` placeholders, filled in by `formatMessage`. Placeholder names are inferred from the template, so a missing or extra parameter is a type error.

### Grid

- `VirtualScroller` is a generic vertical virtualizer. It takes a count, an item size, an optional sticky header and a render function. It does not know what it renders.
- `Table<TRow>` is a generic grid on top of it. Columns are `{ id, header, cell(row), size }`, so the table does not know the row type. `columnsForHeader` builds the columns from the file header. Rows stay positional `string[]` arrays as the worker sends them, so no objects are created per row. Known columns get their size and priority by name, unknown columns get a default size and the lowest priority.
- Sizes use the Tailwind spacing scale, not pixels. `rowSize={8}` equals `h-8`, `size={36}` equals `w-36`. Styles use `calc(var(--spacing) * n)`, because class names built at runtime are not picked up by Tailwind. TanStack Virtual needs pixels, so a hidden probe element measures the real row height. It follows root font size and zoom.
- The viewport size comes from the parent through `className` (for example `h-full`). TanStack measures the scroll element itself.
- Rows render in normal flow inside one translated wrapper, so wide rows can scroll horizontally.
- Responsive columns: each column has a minimum `size` and a `priority`. Columns share free space with `1fr` and shrink down to their minimum. When they no longer fit, the table hides the lowest priority columns first. It measures its own container, not the window, so it works in any layout. At least one column stays visible. Hidden columns cannot be viewed yet; a way to reveal them is an open question.

### Worker protocol

Defined in `src/worker/protocol.ts`, used by `src/worker/client.ts` on the main thread.

- The main thread sends `{ kind: 'request', id, method, params }`.
- For that id the worker sends any number of `progress` and `chunk` messages, then exactly one `result` or `error`.
- The main thread sends `{ kind: 'cancel', id }` to abort. The client rejects the promise with an `AbortError` right away and ignores late messages for that id.
- Errors cross the boundary as `{ name, message }` and are rebuilt as `Error` objects.
- `WorkerClient.request(method, params, { signal, onProgress, onChunk })` returns a typed promise. Methods, params, progress and chunk types come from one `WorkerMethods` map.

Load flow:

1. The store checks the extension and size, then sends the `File` to the worker. A `File` is a handle, so nothing is copied.
2. The worker reads the file as a stream and parses it chunk by chunk. It reports progress at most every 100 ms.
3. Rows go back as `string[]` arrays in chunks of 5,000 while parsing.
4. The worker then validates in slices of 5,000 rows (stage `validating`) and sends the issues in chunks of 5,000. Each issue is `{ row, column, type, suggestion }`; with the original cell value this is enough to preview a fix. Row statuses go back as one `Uint8Array`, transferred without copying. Spec columns missing from the file are reported once for the file, not per row.
5. The store collects the chunks outside of React state and commits the dataset once at the end.
6. Starting a new load cancels the previous one. A cancelled load never replaces the current dataset.

## ADR: parse in a worker, keep the dataset on the main thread

Decision: the worker parses and validates. The rows are sent back in chunks and live in the Zustand store.

Alternatives:

- Parse on the main thread. Simple, but a 200,000 row file blocks the page for seconds.
- Keep the dataset in the worker and fetch only the visible rows. No transfer cost, but every edit, search, sort and undo becomes an async round trip. Too complex for this scope.
- SharedArrayBuffer. Zero copy, but needs COOP and COEP headers on every host and a binary row format.

Why: 200,000 rows fit easily in main thread memory. Edits, undo and index based filtering are simpler as synchronous store actions. Small chunks keep each structured clone short, so the page does not freeze.

## UX decisions

- Welcome screen with one drop zone. A file can be dropped anywhere on the page.
- Loading shows the stage, percent, row count and a Cancel button.
- Filter bar above the grid: a search over all columns (case-insensitive substring) and quick filters All, With issues, Needs manual fix, Auto-fixable, Only valid with row counts. Clearing the search applies at once, without the debounce.
- Cells with issues are marked subtly, because many cells can have issues at once: a light red background and a thin left bar for manual fixes, light amber for fixable ones with the suggested value shown after an arrow (`Germany → DE`). Empty values show a muted "empty". The tooltip and screen reader text give the issue title and explanation. The issues overview (next step) remains the main entry point.
- Issues overview next to the grid: row counts (valid, auto-fixable, manual), then one item per issue type, grouped into "Can be fixed automatically" and "Needs your input", most frequent first. Each item shows the title, a plain explanation, the column and a good example. Clicking an item shows only rows with that issue; clicking again clears it.
- Automatic fixes are applied per issue type, from the overview. Selecting a fixable issue type filters the grid to its rows and shows "Apply automatic fix (N)" under the item. The filtered grid is the before/after preview: every cell shows its value and the suggested one (`Germany → DE`). Suggested (assumption) types say to check the values first. Manual types show how to fix them with the pencil instead. Applying is one history entry with Undo; fixed cells are marked green with the old value in the tooltip. When a type has no issues left, its item disappears.
- The search sets the scope of the overview. With a search, the stats, the issue items and "Apply automatic fix" count and fix only the matching rows (for example only rows with "john"), and a banner says so with a "Clear search" button. With an empty search everything covers all rows. Quick filters and the overview selection exclude each other: picking an issue type looks at all rows within the search, picking a quick filter clears the issue type.
- The overview can be hidden and opened again ("Issues (N)" in the header). With no issues left it is not shown at all; missing columns keep it visible because they cannot be fixed in the app.
- An earlier version used a confirmation `<dialog>` with two modes (only fully fixable rows, or everything). It was replaced by the per-type flow: fewer steps, and the preview is the real data in the grid.
- Scope note: CLAUDE.md asks for exactly one bulk fix (country normalization). On request this was widened to an automatic fix for every safe or suggested issue type, applied one type at a time.
- Light and dark themes follow the device setting through Tailwind's `dark:` variant.
- One progress bar for all stages. Each stage gets a fixed share, so the bar never jumps back. Until validation exists, parsing fills the whole bar. The bar is held at 100 percent for 300 ms before the screen changes.
- Screen changes use the View Transitions API. The heading and the drop zone morph into the header title and the table card; the rest blurs out and slides in. Without the API the screen switches instantly. Animations are off with `prefers-reduced-motion`.
- The progress bar animates `transform: scaleX` with a transition a bit longer than the update interval, so it moves smoothly without layout work.

### Editing: options considered

Chosen: inline editing in the cell. It is what CLAUDE.md asks for, it matches how people use spreadsheets, and it covers the main case: one wrong value, fixed on the spot.

- Hovering a cell shows a pencil button; clicking it opens an input in place (double click was dropped as not discoverable). On keyboard and touch the pencil shows on the focused cell, and Enter or F2 also edit. Saving an unchanged value does nothing: no history entry, no revalidation. Enter or leaving the field saves, Escape cancels. Arrow keys, Home/End and PageUp/PageDown move between cells.
- While typing, a hint below the cell says whether the value is fine, or what is wrong and what a good value looks like. When the rule has a suggested value, "Use DE" applies it in one click.
- After saving, only the row and the duplicate groups it left or joined are revalidated; counts change by difference. Each edit is one history entry with Undo. Rows stay in place until the filter changes, so an edited row does not jump away.

Considered, not built yet:

- Row card: clicking a row opens a side panel with all fields as a form, each with its issue and a "Use" button. Shows columns hidden on narrow screens and suits rows with several issues. Next candidate.
- Fix one by one: pick an issue type in the overview and step through its cells: problem, example, input, "Save & next". The clearest flow for non-technical users with many manual issues.
- Apply to all similar: after fixing a value by hand, offer to apply the same change to every cell with the same original value (for example all "Deutschland" to DE).
- Find and replace in one column, with a preview like the automatic fix.
- AI suggestions for manual issues (names, unknown countries), always shown as a suggestion to confirm, never applied silently.
- Edit in a dialog per cell: simple, but slower and hides the table context.

## Performance approach

- Large data is never passed as React props. Components read the dataset from the store through selectors. In development React 19 diffs changed props for its performance tracks; passing the dataset (200,000 rows, typed arrays) as a prop made each edit block the page for 2.5 s in dev mode, while production was unaffected. Found with a CPU profile in headless Chrome.

- Cell edit, measured on 200,000 rows: about 0.3 ms with `toSpliced` replacing the row's issues (spreading the 367,000-item array cost 5 to 15 ms). The duplicate index (about 55 ms) is built with `requestIdleCallback` after load and after bulk changes, not during an edit. A saved cell shows the new value with a spinner at once; revalidation runs after the next paint, and edits run in order.

- Automatic fix on the main thread, measured on 200,000 rows with 275,000 fixes: about 42 ms, undo about 10 ms. Every suggested value passes its rule (tested), so fixed issues are removed and counts recomputed instead of running the rules again. Changed cells are a `Uint8Array` mask; old values are found by binary search in the history patches.

- Search is debounced (250 ms). On the first search a lowercase string per row is built (cells joined with a separator that never appears in text, so matches cannot span columns). Measured on 200,000 rows: building it takes about 28 ms once, a search about 3 ms.

- Parsing runs in the worker. The file is streamed, not read into one string.
- Chunks of 5,000 rows. Measured in Node with 200,000 messy rows: parsing about 180 ms, validation about 340 ms, the longest main thread stall about 16 ms with 10,000 issues per chunk (now 5,000).
- Earlier measurement before validation existed: in Node `worker_threads` with a 200,000 row file (13 MB): load takes about 90 ms, each chunk is handled in under 1 ms on the main thread, and the longest main thread stall is about 2 ms.
- Progress messages are throttled to one per 100 ms.
- Files above 100 MB are rejected. Scaling path: keep the dataset in the worker and fetch row windows, or store cells in a columnar binary format.
- The grid is virtualized with TanStack Virtual and fixed row heights.

## Assumptions

- The first row is the header.
- Supported extensions: csv, tsv, txt. Empty files and files above 100 MB are rejected. The check runs in the store for both the file picker and drag and drop, because drag and drop ignores the `accept` attribute.
- The delimiter (comma, semicolon, tab or pipe) and line break are detected from the first 64 KB. Empty lines are skipped. Rows with a different number of fields are kept as they are, so validation can report them.
- The worker parses with the PapaParse module (`src/domain/csv`) and regroups rows into batches of 5,000 for transfer.

### Validation assumptions

- One issue per cell, the most important one. Missing beats format.
- Dates: accepted inputs are YYYY-MM-DD, year first with `/` `.` `-`, and day or month first with a 4-digit year. A part above 12 must be the day. If both parts are 12 or less and differ (03/04/2024), we assume day/month, the European order, and mark it as suggested. Two-digit years and month names are not recognized.
- Countries: valid codes are the 249 ISO 3166-1 alpha-2 codes. Names in English, German, French, Spanish and Italian map to codes, plus a short alias list (USA, UK, Holland, Czech Republic). Case, spaces and dots in a code are a safe fix. A name is a suggested fix. Anything else stays an issue.
- Amounts: currency signs and codes are removed as a safe fix. A comma with 1 or 2 digits after it is a decimal comma. Commas between groups of 3 digits are thousands separators. `1.234,56` is read as 1234.56. Separator changes are suggested fixes. Negative amounts need user input.
- Email: practical format check (name, @, domain with a dot). Not full RFC 5322.
- Plans and names: case and surrounding spaces are safe fixes.

## Dependencies

- react, react-dom: UI.
- zustand: small store with selectors, no boilerplate.
- @tanstack/react-virtual: row virtualization without a full grid library.
- papaparse: robust CSV parsing with quoting and delimiter detection.
- tailwindcss, @tailwindcss/vite: utility styling, required by the brief.
- oxlint: fast linter from the Vite template.
- prettier: consistent formatting.
- lodash.debounce: debounced search input. Only this standalone function, not the full lodash.
- vitest: unit tests for `src/domain`, shares the Vite config.
- prettier-plugin-tailwindcss: stable class order, which keeps diffs small.

## AI note

To be written.

## Trade-offs and next steps

To be written.
