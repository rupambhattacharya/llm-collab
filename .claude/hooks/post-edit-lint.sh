#!/bin/bash
# PostToolUse hook: run lint after Write/Edit on .ts/.js files
FILE=$(jq -r '.tool_input.file_path // .tool_response.filePath')
if echo "$FILE" | grep -qE '\.(ts|js)$'; then
  npm run lint 2>/dev/null || true
fi
