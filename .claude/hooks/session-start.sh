#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

SKILLS_SRC="${CLAUDE_PROJECT_DIR}/.claude/skills"
SKILLS_DEST="$HOME/.claude/skills"

mkdir -p "$SKILLS_DEST"

if [ -d "$SKILLS_SRC" ]; then
  cp -r "$SKILLS_SRC"/. "$SKILLS_DEST/"
  echo "Skills installed to $SKILLS_DEST"
else
  echo "No skills directory found at $SKILLS_SRC"
fi
