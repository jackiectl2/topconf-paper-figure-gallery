# Private Reference Picker and Local Key Defaults Implementation Plan

> **For agentic workers:** Execute the tasks inline in this session; the owner requested a direct `main` commit and a localhost test.

**Goal:** Add a 1–10 image private picker and local defaults for OpenAI and Gemini keys without changing the installed app.

**Architecture:** Reuse the existing private manifest and image URLs. Keep reference-count selection in a small pure helper, while the page owns the picker and generation flow. The personal loopback server reads an ignored, permission-restricted env file and returns one requested key to the same-origin page.

**Tech Stack:** Browser JavaScript, Node.js HTTP server, Node test runner, Playwright browser mocks.

**Spec:** `docs/superpowers/specs/2026-11-12-private-reference-picker-and-local-keys.md`

## Global Constraints

- Work on local `main`; make a new commit there, without packaging the app.
- Do not read or require real keys for tests; do not commit private images or credentials.
- Step 3 protected changes and the lock baseline are authorized by the owner's current request; verify the lock before finishing.

---

### Task 1: Reference count and generation subset

**Files:** Modify `forge/private-reference-sampler.mjs`, `forge/index.html`; test `scripts/test-personal-figureforge.mjs` and browser flow.

**Interfaces:** `ReferenceSampler.draw(count)` accepts integers 1–10. `sampleGenerationReferences(ids, random)` returns all IDs if length is at most 3, otherwise three distinct IDs from the input.

- [x] Add failing tests for automatic draws of 1 and 10 and generation subsets of 1, 3, 4 and 10.
- [x] Update the sampler and the Step 3 flow, keeping all selected IDs in analysis and showing the three actually sent to generation.
- [x] Adapt analysis wording for a single reference and run the focused tests.

### Task 2: Private image picker

**Files:** Modify `forge/index.html`; test `scripts/test-personal-figureforge-browser.mjs` or a focused browser test.

**Interfaces:** The picker reads `privateFigures`, stages an ordered selection without changing `refs`, then writes `refs` and `manualReferenceOverride` only on Confirm.

- [x] Add a browser test for exact-count confirmation, cancel, keyboard navigation, and manual selection surviving Generate.
- [x] Add a button and modal grid using the existing `privateURL` images. Render ID labels, checked state and selected count; disable Confirm until the count matches.
- [x] Keep upload, public gallery and return-to-auto flows working; rerun the browser test.

### Task 3: Local key defaults

**Files:** Modify `scripts/serve-personal-figureforge.mjs`, `forge/index.html`, `.gitignore`; create a key-loader module and tests; add a short configuration guide.

**Interfaces:** `POST /api/local-key` accepts `{provider:"openai"|"gemini"}` with an exact same-origin `Origin` header and returns `{key}` only from `_local/ai_keys.env`. The UI's Default source fills only the matching password field.

- [x] Add server tests with a temporary `0600` file containing fake keys; cover wrong origin, missing file, malformed data and wrong provider.
- [x] Implement strict parsing, no logging or persistence, and default/manual UI controls for OpenAI Step 1 and Gemini bitmap generation.
- [x] Add a mock browser test for startup/reload and provider-specific routing, then run the relevant suites.

### Task 4: Localhost review and commit

**Files:** Update `.github/forge-workflow-lock.json` through its checker; commit only task files.

- [x] Start the personal server on a free loopback port and verify the picker and key source controls without real API calls.
- [x] Run `node scripts/check-forge-workflow-lock.mjs`, targeted Node/browser tests and `git diff --check`.
- [x] Commit on `main`; leave pre-existing untracked notes untouched and report the localhost URL and App packaging status.

### Task 5: Bundle every downloaded output with its reference record

**Files:** Modify `forge/index.html`; extend browser mock tests.

- [x] Capture a unique draft ID, selected/analysis/generation reference IDs, format, model and timestamp only after a successful Step 3 draft.
- [x] Package Step 3 bitmap and SVG downloads, Step 4 exports, and reconstruction/validation records as ZIPs with the original artifact plus `references.json`.
- [x] Verify bitmap, SVG and Step 4 SVG ZIP contents and ID continuity with mocked responses.
- [x] Re-run all targeted checks, record the workflow lock, then commit on local `main`.
