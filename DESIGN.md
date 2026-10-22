# Design

## Architecture overview

Functional core, imperative shell.

- `src/worker`: the import worker and its typed message protocol. The protocol is the stand-in for a future backend API.
- `src/store`: Zustand. Holds the dataset and the load state, and owns the load flow.
- `src/ui`: React components. They read from the store through selectors and call store actions.
- `src/domain`: pure rules and normalizers (not built yet).

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
3. Rows go back as `string[]` arrays in chunks of 5,000.
4. The store collects the chunks outside of React state and commits the dataset once at the end.
5. Starting a new load cancels the previous one. A cancelled load never replaces the current dataset.

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
- Light and dark themes follow the device setting through Tailwind's `dark:` variant.

## Performance approach

- Parsing runs in the worker. The file is streamed, not read into one string.
- Chunks of 5,000 rows. Measured in Node `worker_threads` with a 200,000 row file (13 MB): load takes about 90 ms, each chunk is handled in under 1 ms on the main thread, and the longest main thread stall is about 2 ms.
- Progress messages are throttled to one per 100 ms.
- Files above 100 MB are rejected. Scaling path: keep the dataset in the worker and fetch row windows, or store cells in a columnar binary format.
- The grid is virtualized with TanStack Virtual and fixed row heights.

## Assumptions

- The first row is the header.
- Supported extensions: csv, tsv, txt.
- Parsing is a naive comma split for now (`src/worker/naiveParser.ts`). PapaParse replaces it in the next step.

## Dependencies

- react, react-dom: UI.
- zustand: small store with selectors, no boilerplate.
- @tanstack/react-virtual: row virtualization without a full grid library.
- papaparse: robust CSV parsing with quoting and delimiter detection.
- tailwindcss, @tailwindcss/vite: utility styling, required by the brief.
- oxlint: fast linter from the Vite template.
- prettier: consistent formatting.
- prettier-plugin-tailwindcss: stable class order, which keeps diffs small.

## AI note

To be written.

## Trade-offs and next steps

To be written.
