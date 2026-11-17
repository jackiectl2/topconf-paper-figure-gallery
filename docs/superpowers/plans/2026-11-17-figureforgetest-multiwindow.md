# FigureForgeTest Multiwindow Implementation Plan

> **For agentic workers:** Execute these tasks inline and verify each boundary before committing. The user has already requested implementation and testing on a new branch.

**Goal:** Run several independent FigureForgeTest experiments at once, with a command to copy the current paper text into a new experiment.

**Architecture:** One Electron process owns one loopback server. Every experiment gets a separate BrowserWindow and a unique in-memory Electron session partition, so localStorage and IndexedDB cannot cross between experiments. The app serves the same read-only private reference cache and reads the same local key file for each window. A duplicate command copies only the current paper text and figure intent into a new window.

**Tech Stack:** Electron, Node.js, FigureForge HTML, Playwright Core, Node test runner.

**Spec:** User request of 2026-11-17 in this conversation.

## Global Constraints

- Work on `codex/figureforgetest-multiwindow`; do not merge, push, or replace the installed app.
- Preserve Step 3 and Step 4 prompts, model calls, reconstruction, and export logic.
- Test with mock keys and responses; never read or log real keys.
- Keep private reference IDs, images, and default selection out of Git.

---

### Task 1: Independent desktop experiment windows

**Files:** Modify `desktop/main.mjs`; add `desktop/test-multiwindow.mjs`; modify `desktop/package.json` and `desktop/README.md`.

**Interface:** File menu exposes New Experiment (`Command+N`) and Duplicate Paper Into New Experiment (`Command+Shift+N`). Each invocation creates a BrowserWindow with a fresh nonpersistent `webPreferences.partition`. The duplicate command transfers the source window's `#paper`, `#target`, and `#targetDesc` values only.

- [x] Write an Electron integration test that opens multiple windows and verifies distinct paper text, localStorage, and IndexedDB.
- [x] Inspect the original single-window entrypoint and confirm it has no new-window menu action.
- [x] Implement the window factory and menu; keep one loopback server for all windows.
- [x] Run the integration test using a temporary app data directory with fake private references and mock API responses.

### Task 2: Private default references in the desktop runtime

**Files:** Modify `desktop/server.mjs`, `desktop/install-private-cache.mjs`, and `desktop/test-server.mjs`.

**Interface:** The private server serves only `manifest.json`, validated image paths, and `default-selection.json`. The installer validates the optional 10-ID default selection against the private manifest and copies it into Application Support without copying `special_ids.txt`.

- [x] Add server and installer tests using synthetic `ref_1` through `ref_42` data.
- [x] Verify the tests fail before the route and copy logic exist.
- [x] Implement the private configuration copy and exact route.
- [x] Run desktop unit tests and the multiwindow integration test.

### Task 3: Final verification

**Files:** No implementation changes unless tests reveal a defect.

- [x] Run `node scripts/check-forge-workflow-lock.mjs` and `git diff --check`.
- [x] Check Git does not include private references, keys, or generated artifacts.
- [x] Commit only the feature files and report the branch, test results, and how to launch development mode.
