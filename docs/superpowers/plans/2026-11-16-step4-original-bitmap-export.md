# Step 4 Original Bitmap Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the original Step 3 bitmap in every Step 4 export ZIP derived from a bitmap draft.

**Architecture:** Use the existing export state and ZIP helper. Resolve the original bitmap from the Step 3 draft, add it as a companion ZIP entry, and write its filename into `references.json`.

**Tech Stack:** Browser JavaScript in `forge/index.html`, Node and Playwright browser test.

**Spec:** `docs/superpowers/specs/2026-11-16-step4-original-bitmap-export.md`

## Global Constraints

- Change only the Step 4 packaging path and the shared ZIP helper needed for it.
- Preserve original PNG or JPEG bytes and include the bitmap only for a generated Step 3 bitmap draft.
- Do not change the protected workflow lock checker; update the approved hash after the implementation passes.
- Leave this branch unmerged and unpushed.

---

### Task 1: Package the original bitmap

**Files:**
- Modify: `forge/index.html:4540` and `forge/index.html:6220`
- Test: `scripts/test-personal-figureforge-browser.mjs`

**Interfaces:**
- Consumes: `window.__ffExportState` with `source`, `bitmap`, and `provenance`.
- Produces: `referenceDownloadBundle(filename, data, provenance, kind, companion)` with an optional `{name, data}` bitmap companion and `sourceBitmapFile` manifest field.

- [x] **Step 1: Add a browser assertion that fails on the current code.** Generate a mock bitmap, continue to Step 4, supply a mock editable scene, export SVG, and require the ZIP to contain the original bitmap bytes plus the SVG and `references.json`.
- [x] **Step 2: Run the browser test and observe the missing bitmap ZIP entry.** Run `node scripts/test-personal-figureforge-browser.mjs`.
- [x] **Step 3: Implement packaging.** For a generated bitmap draft, fetch `state.bitmap`, read its MIME type, name it `figure-forge-<draftId>-draft.png` or `.jpg`, and pass it to the ZIP helper. The helper adds the extra entry and `sourceBitmapFile` to the manifest.
- [x] **Step 4: Verify bitmap and SVG-first exports.** Run `node scripts/test-personal-figureforge-browser.mjs`; the bitmap export must contain both artifacts, and the SVG-first export must retain its existing two entries.
- [x] **Step 5: Record and verify the protected baseline.** Run `node scripts/check-forge-workflow-lock.mjs --record` and `node scripts/check-forge-workflow-lock.mjs`.
- [x] **Step 6: Commit the focused change.** Commit the implementation, test, spec, plan, and updated lock manifest on `codex/step4-export-original-bitmap`.
