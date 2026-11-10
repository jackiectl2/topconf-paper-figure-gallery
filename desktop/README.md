# FigureForgeTest for macOS

This is a personal desktop wrapper around the existing FigureForge page. It does not publish a website or change the paper, analysis, generation, reconstruction, or export workflow.

## Daily use

Open `/Applications/FigureForgeTest.app`. The app starts a loopback-only HTTP server on a random port and opens the existing `forge/` page in an Electron window. The 42 private references live outside the app at `~/Library/Application Support/FigureForgeTest/paperbananabench/`. The app bundle contains only Git-tracked public page assets. The first local update moves the previous FigureForge app data into this directory.

## Development

Use Node 22.12 or later:

```sh
cd /Users/ctl/Local_Documents/1_personal_projs/topconf-paper-figure-gallery
npm --prefix desktop ci
npm --prefix desktop run dev
```

The development window reads the working tree. Reload with Command-R after source edits. Close the window to stop its local server. If the private cache source in `_local/paperbananabench/` is updated, `npm --prefix desktop run cache:install` refreshes the shared app data.

## Update the installed app

Run `./Build-and-Install-FigureForgeTest.command` from the project root, or double-click it in Finder. It builds a fresh snapshot from tracked `forge/`, `assets/`, and `images/` files and installs it at `/Applications/FigureForgeTest.app`. Rebuild after changing source code; reloading the installed app cannot pick up source changes. Commit new public assets before building, since the packager copies tracked files only. The desktop wrapper files are copied directly from the working tree.

API keys are entered in the page and sent to the selected provider during use. The current page removes legacy `ff_key_` localStorage values and does not store key inputs in localStorage. The desktop server does not log requests or keys. Keep the application data and `_local/` private. The reference image rights are separate from the repository's MIT code license.

## Checks

```sh
npm --prefix desktop test
node scripts/check-forge-workflow-lock.mjs
```
