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
npm --prefix desktop run package:mac
npm --prefix desktop run cache:install
key_source="$project_dir/_local/figureforge_keys.env"
key_dir="$HOME/Library/Application Support/FigureForgeTest"
if [[ -f "$key_source" ]]; then
  mkdir -p "$key_dir"
  chmod 700 "$key_dir"
  install -m 600 "$key_source" "$key_dir/figureforge_keys.env"
fi
app_source="$project_dir/_local/desktop-build/dist/FigureForgeTest-darwin-arm64/FigureForgeTest.app"
app_target="/Applications/FigureForgeTest.app"
app_backup="/Applications/FigureForgeTest.previous.app"
legacy_app="/Applications/FigureForge.app"
rm -rf "$app_backup"
if [[ -d "$app_target" ]]; then mv "$app_target" "$app_backup"; fi
if ! mv "$app_source" "$app_target"; then
  if [[ -d "$app_backup" ]]; then mv "$app_backup" "$app_target"; fi
  echo "Install failed; previous app restored." >&2
  exit 1
fi
rm -rf "$app_backup"
if [[ -d "$legacy_app" ]]; then rm -rf "$legacy_app"; fi
echo "Installed: $app_target"
echo "Private references: $HOME/Library/Application Support/FigureForgeTest/paperbananabench"
