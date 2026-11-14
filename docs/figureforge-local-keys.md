# FigureForge local API keys

The localhost server reads `_local/figureforge_keys.env` first. The installer copies this file to `~/Library/Application Support/FigureForgeTest/figureforge_keys.env`, which the packaged app reads first. Both locations are outside Git and the app bundle. The existing `~/.ai_keys.env` remains a fallback; localhost can also read the older `_local/ai_keys.env` as a last fallback.

The dedicated file uses only these entries:

```text
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
```

Create it locally and set mode `600` (`chmod 600 _local/figureforge_keys.env`). The file must be a regular file owned by the current user. Never add a real key to a commit, log, screenshot, or chat message. If the dedicated file exists but has invalid permissions or format, the server reports the error rather than silently using a different key.

The local server returns only the requested provider's key to the same-origin page when **Default (local file)** is selected. The page does not save key values to localStorage. OpenAI remains the Step 1 parser and vision provider; Gemini keys are used only for bitmap generation. The app key copy can be refreshed by running `Build-and-Install-FigureForgeTest.command` after changing the project file.
