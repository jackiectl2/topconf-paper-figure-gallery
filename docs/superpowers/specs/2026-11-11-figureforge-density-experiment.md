# FigureForge paper-density experiment

Run an isolated localhost A/B experiment on `codex/figureforge-density-experiment`. Use `gpt-6.1-sol` for PDF parsing and reference analysis and the current `gemini-3-pro-image` for bitmap generation. The installed FigureForgeTest app and `main` are the comparison baseline. The experimental implementation is now available on this branch.

The goal is to carry more distinct, verifiable, drawable paper facts into the bitmap prompt. Filling a context window with repeated prose is not a success criterion. Preserve the current UI, target intent, two-stage analysis, reference selection, Step 3 review gate, reconstruction/export, English output, Comic Sans MS, cartoon style, and absence of a figure-wide title banner.

## Verified limits and experimental ceilings

| Stage | Current app limit | Proposed ceiling |
| --- | --- | --- |
| GPT PDF source | Native PDF first; extracted-text fallback keeps 60,000 characters; rendered-image fallback takes first 8 pages | Native PDF under 50 MB, with exact GPT input count at most **900,000 tokens**; count and batch all pages if fallback is needed |
| GPT parser output | 5,000 tokens | Up to **48,000 output tokens**, including reasoning; detect incomplete replies |
| Editable paper summary | First 6 sections, then first 12,000 characters | All relevant distinct sections and visual facts; no fixed character slice |
| GPT reference-image analysis | Up to 16,000 output tokens for a 6–16-zone layout JSON | Keep 16,000 unless a mock or actual incomplete response proves it insufficient; preserve complete zone fields when building the Gemini prompt |
| Gemini bitmap request | 6,000 **characters** of prompt | At most **60,000 input tokens for the whole request**, including prompt and actual reference images; count before generation |
| Compact layout | Zone roles shortened to 10 characters, with module details omitted | Full short roles plus module kind/count, occupancy, geometry, hierarchy, arrows, and palette |

GPT 6.1 Sol's API context is 1,050,000 tokens and its maximum output is 128,000; a 900,000-token input leaves 150,000 for output and overhead, even if the endpoint reserves the full output allowance. OpenAI recommends reserving at least 25,000 tokens for reasoning and output when first using reasoning models. Gemini 3 Pro Image has 65,536 **input** tokens and 32,768 **output** tokens; its output allowance is not extra prompt capacity. The proposed 60,000-token input ceiling leaves 5,536 tokens of margin. The local relay's current 32 MiB request-body cap must also be checked. These numbers are safety ceilings, not targets to pad; a normal paper may require far fewer tokens. Warn before a GPT request crosses the published 272,000-input-token long-context pricing threshold.

Official references: [GPT 6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [PDF inputs](https://developers.openai.com/api/docs/guides/file-inputs), [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting), [reasoning allowance](https://developers.openai.com/api/docs/guides/reasoning), [Gemini 3 Pro Image](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image), [Gemini token counting](https://ai.google.dev/gemini-api/docs/tokens).

## Experiment behavior

1. Ask the parser for an English visual-fact inventory: concrete components, inputs/outputs, flow edges, branches/loops, quantitative results when relevant, and page/evidence references. Keep the target-specific focus. Deduplicate and rank by relevance, without a six- or twelve-section quota.
2. Keep every relevant returned section in the editable paper box. Regenerating Step 3 uses this existing text; it does not reparse the PDF.
3. Count the exact GPT Responses PDF request with `/v1/responses/input_tokens`, including page images. If the file is over 50 MB or count exceeds 900,000, process page ranges and merge page-tagged inventories. Extracted-text and rendered-page fallbacks should cover all pages in counted batches for GPT. Leave other providers' fallback limits unchanged until their caps are known.
4. Assemble Gemini's prompt from figure intent, complete layout blueprint, and ranked factual modules. Remove duplicate style prose before substantive facts. Count the exact text and image parts with `models.countTokens`; if over 60,000, compress redundant background in a visible, deterministic order and report omitted material. Never silently slice a paragraph or zone. If counting fails, stop with an actionable error.
5. Show actual token counts, PDF page coverage, retained section/module counts, and which representative reference IDs were sent to the bitmap model. Count routes must be localhost-only and must not log or persist keys, prompts, or image data.

## Acceptance

Use mock OpenAI/Gemini responses, no real key. Test more than six sections, a relevant final-page fact, scanned-page fallback, over-budget input, count failure, and actual 1–3 image references. Assert that component names, edges, counts, and zone roles survive to the bitmap prompt, and that Step 4 does not auto-advance. Verify the workflow lock after any authorized implementation change. Run the branch on another localhost port for the user's private A/B comparison; do not merge, push, or rebuild the installed app during this experiment.
