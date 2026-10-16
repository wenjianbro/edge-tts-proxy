#!/usr/bin/env bash
# 探活失败告警：去重后开 issue（若已有未关闭的告警 issue 则跳过）
set -euo pipefail

OPEN=$(gh issue list --state open --search 'Edge TTS proxy probe failed' --json number --jq length)
if [ "$OPEN" -eq 0 ]; then
  gh issue create \
    --title 'Edge TTS proxy probe failed' \
    --body "Scheduled probe detected /synthesize did not return valid MP3 audio.

Check Edge TTS protocol changes (rany2/edge-tts latest release / issue #490 / PR #492).

Run: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
else
  echo 'Open alert issue exists, skip'
fi
