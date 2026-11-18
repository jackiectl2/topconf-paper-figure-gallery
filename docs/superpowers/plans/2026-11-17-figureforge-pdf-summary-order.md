# FigureForge PDF Summary Order Implementation Plan

> **For agentic workers:** Execute the tasks inline in this session. The user requested this exact PDF summary change and an updated local App.

**Goal:** Put the PDF planner's figure prompt, all relevant section summaries and evidence, paper title, then abstract in the Step 1 text box, without the separate drawable-module inventory.

**Architecture:** Change only `renderPdfSummary` in `forge/index.html`; retain the parser's structured `visualModules` response and all Step 3/4 prompts and model calls. Extend the existing browser test with a mocked PDF parser response, then rebuild the local Electron app from the tested working tree.

**Tech Stack:** Browser JavaScript, Playwright, Electron, Node.js.

**Spec:** The owner's current conversation request (2026-11-17): keep all relevant sections, omit the visible inventory, preserve personal drawing rules, and update FigureForgeTest.app.

## Global Constraints

- Do not alter Step 3/4 prompts, routing, reconstruction, or export code.
- Keep private references and API keys outside Git and the app bundle.
- Run the workflow lock checker and record only the approved `forge/index.html` digest change.

---

### Task 1: Test the requested text-box order

**Files:**
- Modify: `scripts/test-density-pdf-browser.mjs`

**Interfaces:**
- Consumes: mocked parser JSON with `figurePrompt`, 12 `selectedSections`, `title`, `abstract`, and `visualModules`.
- Produces: assertions on the `#paper` textarea after Step 1 PDF parsing.

- [x] Add an abstract to the mocked response and assert that `Figure prompt:` precedes all 12 `[Section N]` summaries, followed by `Title:` and `Abstract highlights:`.
- [x] Assert that `Drawable module inventory` and `connects to:` are absent from `#paper` even though the mocked parser returns `visualModules`.
- [x] Run `node scripts/test-density-pdf-browser.mjs` and confirm the new assertions fail against the old rendering.

### Task 2: Implement, verify, and install

**Files:**
- Modify: `forge/index.html` at `renderPdfSummary`.
- Modify: `.github/forge-workflow-lock.json` only to refresh the `forge/index.html` hash after the owner-approved change.

**Interfaces:**
- Consumes: the existing parser response JSON.
- Produces: a textarea value in the requested order; the parser JSON and generation workflow remain otherwise unchanged.

- [x] Set `pieces` to `Figure prompt`, all section summaries with evidence, `Title`, then `Abstract highlights`; join with blank lines and do not add an inventory or a section cap.
- [x] Run the browser test, the density coverage test, desktop tests, and `git diff --check`.
- [x] Refresh the lock manifest, verify that only the `forge/index.html` hash changed, and run `node scripts/check-forge-workflow-lock.mjs`.
- [x] Commit the tested files, build and install `/Applications/FigureForgeTest.app`, and compare its bundled `forge/index.html` and `desktop/main.mjs` with the source files.
