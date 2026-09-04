#!/bin/bash
# Setup development symlink to Obsidian vault
# Usage: ./scripts/setup-dev.sh /path/to/your/vault
#
# This script creates a symlink from your Obsidian vault's plugins directory
# to this project, enabling live development with hot-reload.

set -e

VAULT_PATH="${1:-}"
PLUGIN_ID="sample-plugin"

if [ -z "$VAULT_PATH" ]; then
    echo "Usage: $0 <vault-path>"
    echo "Example: $0 ~/Documents/ObsidianVault"
    exit 1
fi

PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Create plugins directory if it doesn't exist
mkdir -p "$VAULT_PATH/.obsidian/plugins"

# Remove existing symlink or directory
if [ -L "$PLUGINS_DIR" ]; then
    rm "$PLUGINS_DIR"
    echo "Removed existing symlink"
elif [ -d "$PLUGINS_DIR" ]; then
    echo "Warning: $PLUGINS_DIR is a directory, not a symlink"
    echo "Please remove it manually if you want to create a symlink"
    exit 1
fi

# Create symlink
ln -s "$PROJECT_DIR" "$PLUGINS_DIR"
echo "Created symlink: $PLUGINS_DIR -> $PROJECT_DIR"

# Create .hotreload file for hot-reload plugin
touch "$PROJECT_DIR/.hotreload"
echo "Created .hotreload marker file"

echo ""
echo "Setup complete! Now:"
echo "1. Install hot-reload plugin in Obsidian: https://github.com/pjeby/hot-reload"
echo "2. Run 'pnpm dev' to start watching for changes"
echo "3. Enable the plugin in Obsidian settings"
