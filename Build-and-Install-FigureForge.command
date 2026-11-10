#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h}"
cd "$project_dir"
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null
fi
if [[ ! -d desktop/node_modules ]]; then
  npm --prefix desktop ci
fi
npm --prefix desktop run cache:install
npm --prefix desktop run package:mac
app_source="$project_dir/_local/desktop-build/dist/FigureForge-darwin-arm64/FigureForge.app"
app_target="/Applications/FigureForge.app"
app_backup="/Applications/FigureForge.previous.app"
rm -rf "$app_backup"
if [[ -d "$app_target" ]]; then mv "$app_target" "$app_backup"; fi
if ! mv "$app_source" "$app_target"; then
  if [[ -d "$app_backup" ]]; then mv "$app_backup" "$app_target"; fi
  echo "Install failed; previous app restored." >&2
  exit 1
fi
rm -rf "$app_backup"
echo "Installed: $app_target"
echo "Private references: $HOME/Library/Application Support/FigureForge/paperbananabench"
