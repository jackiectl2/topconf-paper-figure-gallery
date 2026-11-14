# Local FigureForge keys

The personal localhost server first reads the existing `~/.ai_keys.env` on this Mac: `OPENAI_API_KEY` for Step 1 and `GOOGLE_API_KEY` for Gemini bitmap generation. It accepts `export NAME="value"` lines and ignores unrelated entries. It does not copy the file or print the values. The installed FigureForgeTest app is not updated by this localhost change.

If the home file or an entry is missing, the server falls back to `_local/ai_keys.env` in this checkout. The entire `_local/` directory and every `ai_keys.env` file are Git-ignored. If you use this fallback, create it locally; do not send keys in chat or add them to commits. Use exactly these names, one unquoted key per line:

```text
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

Both files must be owned by you and have owner-only permissions (`chmod 600`). FigureForge reads a key only when its matching **Default (local file)** source is selected: OpenAI for Step 1, Gemini for bitmap generation. Switching to **Manual** unlocks the existing password field. Only the source choice, never the key value, is remembered between page loads. A key file by itself does not change Codex's sign-in method; `codex login status` shows the active method.

The localhost server accepts the key request only from the same loopback origin. It returns only the requested provider's key, with `Cache-Control: no-store`; it does not write requests or keys to logs. A missing file, wrong permissions or missing provider entry leaves manual entry available.

## Reference records on download

FigureForge downloads one ZIP per draft or export. Inside are the original image/SVG/PPTX/VSDX/draw.io file and `references.json`. The JSON lists the selected reference IDs, all IDs sent to reference analysis, and the IDs actually sent to the generation model. Step 4 exports keep the Step 3 draft ID, so the files can be matched later. Keep or extract the ZIP in your paper's project folder; no second copy of the 42 reference images is made. The browser does not reveal the final save folder to the app, so no central path ledger is written.
