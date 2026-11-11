# FigureForge Density Experiment Implementation Plan

**Goal:** Carry more distinct paper facts and layout instructions into Gemini bitmap generation without hidden truncation, on `codex/figureforge-density-experiment` only.

**Architecture:** Count the full model requests in the existing GPT PDF parser and native Gemini image route. Keep the editable paper text as an untruncated intermediate. Build the image prompt from ranked visual facts and a complete compact layout. Use the localhost relay for cross-origin count requests. Preserve provider routing, reference selection, Step 3 review gate, Step 4 reconstruction/export, and the installed app.

**Tech stack:** Browser JavaScript, Node localhost server, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-11-figureforge-density-experiment.md`

**State:** Implemented on the experimental branch after the owner's request to proceed. The protected Step 3 diff was reviewed, the owner-approved lock baseline was recorded, and mock API/browser tests passed. No real key was used.

## Task 1: Capture baseline losses

**Files:** Inspect `forge/index.html`, parser/image tests, `scripts/serve-personal-figureforge.mjs`, and the workflow lock.

- [x] Use synthetic long-paper and layout fixtures to demonstrate current losses at six sections, 12,000 paper characters, 6,000 image-prompt characters, and 10 zone-role characters.
- [x] Record actual section, module, PDF-page, and prompt counts for comparison. Do not use a private paper or real key in fixtures.

## Task 2: Count GPT PDF input and cover all pages

**Files:** `forge/index.html`, `forge/pdf-openai-api.mjs`, parser tests, localhost relay only if browser CORS requires it.

- [x] Count the actual Responses payload with `/v1/responses/input_tokens`, including PDF page images. Allow at most **900,000 GPT input tokens** and raise parser `max_output_tokens` from 5,000 to **48,000**. Preserve model and reasoning-effort settings.
- [x] If the native PDF exceeds 50 MB or 900,000 tokens, split into sequential page ranges and merge page-tagged facts. For GPT fallback modes, cover all extracted text or rendered pages in counted batches; do not stop at 60,000 characters or page 8.
- [x] Detect incomplete/malformed parser output and report recoverable errors. Show actual input count and page coverage, with a warning above the official 272,000-input-token long-context pricing threshold.

## Task 3: Preserve a structured paper intermediate

**Files:** `forge/index.html`, parser tests.

- [x] Ask for an English inventory of components, inputs/outputs, data-flow edges, branches/loops, visual assets, relevant results, and page evidence. Retain target-specific focus and avoid invented facts.
- [x] Render all distinct relevant returned sections in `#paper`; remove `.slice(0,6)` and `.slice(0,12000)`. Show section and drawable-module counts. Regenerating Step 3 must reuse the edited paper text.
- [x] Test that a final-page component survives into `#paper` and then into generation input.

## Task 4: Budget the exact Gemini bitmap request

**Files:** `forge/index.html`, `forge/image-api.mjs`, `scripts/serve-personal-figureforge.mjs`, image-route tests.

- [x] Add a localhost-only `models.countTokens` relay for the selected native `gemini-3-pro-image` request, forwarding the same text and image parts as `generateContent`. Do not log or persist key, prompt, or pixels. Keep the existing **32 MiB** request-body cap explicit.
- [x] Build the compact layout with full short zone roles, module kinds/counts, occupancy, geometry, hierarchy, edges, and palette. Rank factual modules; remove duplicate style prose before removing facts. Preserve reference selection and display.
- [x] Keep the reference-analysis stage's existing 16,000-token output ceiling unless its 6–16-zone JSON is demonstrably incomplete. Test that its full layout fields survive prompt assembly; the loss currently occurs mainly in the compact guide.
- [x] Count the final prompt plus the actual 1–3 representative reference images. Cap at **60,000 input tokens**, show used/available tokens, and report any excluded low-priority material. If counting fails, stop with a clear error. Do not silently slice paragraphs or zone roles.
- [x] Treat Gemini's **65,536 input** and **32,768 output** limits separately and check body bytes before posting to the relay.

## Task 5: Verify and serve A/B comparison

**Files:** Targeted Node tests, workflow lock only after authorized implementation review, local documentation.

- [x] Mock under/over budget, count failure, malformed JSON, all-page coverage, long-paper retention, image references, regeneration semantics, and Step 3 review gate. No real API keys.
- [x] Run `node scripts/check-forge-workflow-lock.mjs` and relevant parser/image tests; review protected-file diff before recording any new lock baseline.
- [x] Serve this branch on `127.0.0.1:8767`; verify `/forge/`, private reference manifest, and mocked browser flow. Compare with the installed baseline. Do not merge, push, or rebuild the installed app during this experiment.
- [x] Report changed files, tests, localhost command, and behavior still unverified with real keys. Leave private cache, keys, and other local-only files untracked.
