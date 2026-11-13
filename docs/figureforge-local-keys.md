# Local FigureForge keys

The personal localhost server can read `_local/ai_keys.env` from this checkout. The entire `_local/` directory and every `ai_keys.env` file are Git-ignored. The installed FigureForgeTest app is not updated by this localhost change.

Create the file yourself on this Mac; do not send keys in chat or add them to commits. Use exactly these names, one unquoted key per line:

```text
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

Set the file to owner-only permissions (`chmod 600 _local/ai_keys.env`). FigureForge reads a key only when its matching **Default (local file)** source is selected: OpenAI for Step 1, Gemini for bitmap generation. Switching to **Manual** unlocks the existing password field. Only the source choice, never the key value, is remembered between page loads.

The localhost server accepts the key request only from the same loopback origin. It returns only the requested provider's key, with `Cache-Control: no-store`; it does not write requests or keys to logs. A missing file, wrong permissions or missing provider entry leaves manual entry available.

## Reference records on download

FigureForge downloads one ZIP per draft or export. Inside are the original image/SVG/PPTX/VSDX/draw.io file and `references.json`. The JSON lists the selected reference IDs, all IDs sent to reference analysis, and the IDs actually sent to the generation model. Step 4 exports keep the Step 3 draft ID, so the files can be matched later. Keep or extract the ZIP in your paper's project folder; no second copy of the 42 reference images is made. The browser does not reveal the final save folder to the app, so no central path ledger is written.
