# FigureForge Method Figure Visual Budget Implementation Plan

> **For agentic workers:** Execute these tasks inline in this session. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Keep method figures free of empirical result callouts, cap visible non-whitespace text at 1,300 characters, and add restrained cartoon details while preserving FigureForge geometry.

**Architecture:** Apply target-specific content rules to PDF extraction and both Step 3 prompts. Count editable SVG text before showing it; count bitmap text with a localhost-only macOS Vision OCR endpoint, and reject drafts above the cap with a clear regenerate message. Keep the Step 4 reconstruction and export path intact.

**Tech Stack:** Existing single-page JavaScript app, Node localhost relay, macOS Vision through Swift, Node tests, browser tests.

**Spec:** User request in this conversation on 2026-11-11; existing density design in `docs/superpowers/specs/2026-11-11-figureforge-density-experiment.md`.

## Global Constraints

- Work on `codex/figureforge-density-experiment` and make one reversible commit.
- Do not include private reference images, IDs, or API keys in Git or logs.
- Preserve square rectangles, aligned spacing, straight arrows, and reference-derived panel topology.
- Keep the cartoon guidance to at most three concise sentences.
- The owner explicitly authorized changing the protected Step 3 workflow in this conversation; update and verify `.github/forge-workflow-lock.json`.

---

### Task 1: Content and visual prompts

**Files:** Modify `forge/index.html`; test `forge/test-generation-intent.mjs`.

- [x] Adjust the `pipeline` and `architecture` intent instructions to show method stages and final artifacts without benchmark/result panels.
- [x] Make PDF extraction omit empirical results for those targets while retaining method hyperparameters, dimensions, equations, and variables.
- [x] Apply the same conditional exclusion to detailed and compact bitmap prompts, and to SVG prompts.
- [x] Add a 1,300 non-whitespace character budget to both SVG and bitmap prompts. Add no more than three cartoon guidance sentences that preserve the layout constraints.
- [x] Run `node --test forge/test-generation-intent.mjs`.

### Task 2: Enforce the output budget locally

**Files:** Modify `forge/index.html` and `scripts/serve-personal-figureforge.mjs`; create `scripts/figureforge-ocr.swift`; test `scripts/test-personal-figureforge.mjs` and a browser mock test.

- [x] Count visible SVG `<text>` content after the existing repair pass and refuse to display a draft over 1,300 non-whitespace characters.
- [x] Add a same-origin, localhost-only OCR endpoint that accepts a generated bitmap, runs macOS Vision, returns its recognized non-whitespace character count, and deletes temporary files.
- [x] Check OCR count after bitmap generation and before marking Step 3 complete; provide an explicit count and regeneration action when the limit is exceeded.
- [x] Test the route with fake keys and mocked image responses; do not call real APIs.

### Task 3: Verify and deliver

**Files:** Modify `.github/forge-workflow-lock.json` using the checker; no private files.

- [x] Run focused Node and browser tests plus `node scripts/check-forge-workflow-lock.mjs`.
- [x] Confirm the localhost service still serves the edited page and refresh the test tab.
- [x] Review `git diff`, commit only intended files, and report the commit and test results.
