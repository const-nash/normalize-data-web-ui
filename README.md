# Normalize Data

A browser-only prototype for cleaning a large, messy customer CSV: load the file without freezing the page, see the problems in plain language, and fix them one by one or automatically, with undo.

**Live demo:** https://const-nash.github.io/normalize-data-web-ui/

Design decisions, trade-offs and the AI note are in [DESIGN.md](DESIGN.md).

## Run locally

Requires Node.js 24.

```sh
npm install
npm run generate   # creates import-data.csv
npm run dev        # http://localhost:5173
```

Then drop `import-data.csv` on the start screen. Check performance with a production build (`npm run build && npm run preview`); development mode is slower.

## Test data

`import-data.csv` comes from the generator provided by the reviewers (`scripts/generate-data.mjs`). It was used with default settings. The generator's issue report was not used during development: the column rules in CLAUDE.md are the only specification. The data and the report are gitignored.

> **Note:** the generator is intentionally not committed to this repository, so it stays a true black box: the rules were built from the specification, not from its code. To create test data, put the reviewers' `generate-data.mjs` into `scripts/` and run `npm run generate`. The file is gitignored, so it cannot be committed by accident.

## Scripts

- `npm run dev`: start the app
- `npm run build`: production build
- `npm run preview`: serve the production build
- `npm run check`: typecheck, lint, tests and formatting
- `npm run test`: unit tests (Vitest)
- `npm run format`: format with Prettier

## Stack

React, TypeScript, Vite, Tailwind CSS v4, Zustand, PapaParse, TanStack Virtual, Vitest, lodash.debounce.

## Structure

- `src/domain`: pure logic: CSV parser, column rules, validation, filters, fixes, edits
- `src/worker`: import worker and its typed message protocol
- `src/store`: Zustand store: dataset, issues, view state, history
- `src/ui`: React components
- `src/constants`: file types, sizes and all user-facing texts

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: `npm run check`, a production build with the repository name as base path, and a deploy to GitHub Pages. In the repository settings, Pages must use "GitHub Actions" as the source.
