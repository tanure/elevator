# Elevator desktop — E2E smoke tests

Playwright drives the packaged Electron build to verify the app boots and the
main routes render. The suite is intentionally tiny; broader UI coverage stays
in component tests and Vitest.

## Run locally

From `apps/desktop`:

```pwsh
npm run build        # produces out/main/index.js and out/renderer/
npm run test:e2e
```

The runner launches Electron with an isolated `userData` directory under the
OS temp folder, so it never touches your real profile. Each spec gets a fresh
window via `_electron.launch`.

## Adding a spec

- Put new specs in `apps/desktop/e2e/*.spec.ts`.
- Prefer role/text selectors over CSS — the renderer ships no `data-testid`
  attributes.
- Keep the suite under ~30 seconds total. Anything heavier belongs in a
  separate (manual) workflow.
