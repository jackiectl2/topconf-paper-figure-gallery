# Private reference picker and local key defaults

## Scope

Develop on the existing local `main` branch. Test through the loopback-only personal server. Do not rebuild the installed desktop app as part of this change. Keep all API credentials and the 42 private images outside Git.

## Reference selection

- The existing automatic draw remains the default. Its count selector accepts 1 through 10 and starts at 4.
- A new picker shows all 42 private cached images in a scrollable grid with their `ref_` or `test_` IDs. The chosen count comes from the same count selector. A user selects exactly that many distinct images and confirms; Cancel leaves the previous selection intact.
- The picker supports mouse clicks, Space/Enter to toggle the focused image, and arrow keys to move focus around the grid. It uses the existing private image URLs and creates no new image copy.
- Manual private picks replace automatic drawing until the user chooses automatic mode again. Existing gallery and upload overrides remain available.
- Analysis receives every selected image. Generation receives all 1–3 images or exactly three sampled images from a selection of 4–10, in direct and two-stage modes and for both SVG and bitmap drafts. Show both sets of IDs and thumbnails in the existing disclosure. The analysis instructions must also work when only one image is supplied.

## Local API key defaults

- The local server reads only `_local/ai_keys.env`, with `OPENAI_API_KEY` and `GEMINI_API_KEY` entries. This path is already Git-ignored; the file must be owner-readable only. No default file is created with actual credentials.
- Step 1 OpenAI and bitmap-only Gemini inputs each offer Default and Manual source choices. Default is selected when available, loads the matching key from a same-origin localhost-only endpoint, and fills the existing password input in memory. Manual editing remains possible after switching source.
- Missing or malformed local configuration produces a visible, non-secret error and leaves manual entry available. No key is placed in Git, logs, URL parameters, localStorage, reference metadata, or test fixtures. The installed app is not updated in this turn.

## Validation

Use fake keys and mocked model responses to check the private picker, 1–10 automatic draw, analysis and generation counts, provider-specific key routing, missing-key handling, and reload behavior. Run the FigureForge workflow lock check after recording this owner-approved change.

## Download provenance (added by the owner's follow-up)

- Give each successful Step 3 draft a unique ID and a provenance record containing its creation time, selected reference IDs, analysis input IDs, actual generation input IDs, format, and model. Never include keys or paper text.
- Each Step 3 bitmap/SVG download and Step 4 export downloads one ZIP containing the original-format artifact and `references.json`. The record names the artifact and export operation; Step 4 keeps the Step 3 draft ID. Reconstruction/validation JSON downloads receive the same treatment.
- This per-file bundle stays with the artifact in whatever project folder the browser saves it. Browser downloads cannot reliably report the user's final filesystem path, so do not write a misleading central path ledger.
