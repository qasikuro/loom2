#!/usr/bin/env bash
set -euo pipefail

APP_ID="${ANDROID_APP_ID:-com.storigam.app}"
THREAD_USER_ID="${THREAD_USER_ID:-}"
OLDER_MESSAGE_ID="${OLDER_MESSAGE_ID:-}"
AUTO_CREATE_CHAT_FIXTURE="${AUTO_CREATE_CHAT_FIXTURE:-0}"
CHAT_FIXTURE_API_BASE_URL="${CHAT_FIXTURE_API_BASE_URL:-}"
CHAT_FIXTURE_BEARER_TOKEN="${CHAT_FIXTURE_BEARER_TOKEN:-}"
FLOW="artifacts/sky-journal/.maestro/chat-long-media-android.yaml"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="generated-artifacts/chat-performance-android/${STAMP}"

if [[ "$AUTO_CREATE_CHAT_FIXTURE" == "1" ]]; then
  if [[ -z "$CHAT_FIXTURE_API_BASE_URL" || -z "$CHAT_FIXTURE_BEARER_TOKEN" ]]; then
    echo "Set CHAT_FIXTURE_API_BASE_URL and CHAT_FIXTURE_BEARER_TOKEN to create a disposable fixture." >&2
    exit 2
  fi
  if [[ ! "$CHAT_FIXTURE_API_BASE_URL" =~ ^https://[A-Za-z0-9.-]+\.replit\.dev$ &&
        ! "$CHAT_FIXTURE_API_BASE_URL" =~ ^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$ ]]; then
    echo "Fixture creation is restricted to a Replit development host or local API." >&2
    exit 2
  fi
  command -v curl >/dev/null || { echo "curl is required to create the fixture." >&2; exit 2; }
  command -v jq >/dev/null || { echo "jq is required to read the fixture response." >&2; exit 2; }
  FIXTURE_RESPONSE="$(curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$CHAT_FIXTURE_BEARER_TOKEN") \
    -fsS -H "Content-Type: application/json" \
    -d '{}' "$CHAT_FIXTURE_API_BASE_URL/api/test-fixtures/chat-long-media")"
  THREAD_USER_ID="$(jq -er '.partnerId' <<<"$FIXTURE_RESPONSE")"
  OLDER_MESSAGE_ID="$(jq -er '.olderMessageId' <<<"$FIXTURE_RESPONSE")"

  cleanup_chat_fixture() {
    if ! curl --config <(printf 'header = "Authorization: Bearer %s"\n' "$CHAT_FIXTURE_BEARER_TOKEN") \
      -fsS -X DELETE \
      "$CHAT_FIXTURE_API_BASE_URL/api/test-fixtures/chat-long-media/$THREAD_USER_ID" >/dev/null; then
      echo "Fixture cleanup failed; retry DELETE /api/test-fixtures/chat-long-media/$THREAD_USER_ID against the development API." >&2
      return 1
    fi
  }
  trap cleanup_chat_fixture EXIT
fi

if [[ -z "$THREAD_USER_ID" ]]; then
  echo "Set THREAD_USER_ID to the test conversation partner." >&2
  exit 2
fi
if [[ -z "$OLDER_MESSAGE_ID" ]]; then
  echo "Set OLDER_MESSAGE_ID to a text message at least 200 rows older than the newest." >&2
  exit 2
fi
command -v adb >/dev/null || { echo "adb is required." >&2; exit 2; }
command -v maestro >/dev/null || { echo "Maestro is required." >&2; exit 2; }
adb get-state >/dev/null
mkdir -p "$OUT"

{
  echo "timestamp_utc=$STAMP"
  echo "app_id=$APP_ID"
  echo "device_model=$(adb shell getprop ro.product.model | tr -d '\r')"
  echo "android_release=$(adb shell getprop ro.build.version.release | tr -d '\r')"
  echo "android_api=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
  echo "device_ram_kb=$(adb shell cat /proc/meminfo | awk '/MemTotal/ {print $2}')"
  echo "display=$(adb shell wm size | tr -d '\r')"
  echo "refresh_rate=$(adb shell dumpsys display | awk '/mRefreshRate/ {print $1; exit}' | tr -d '\r')"
} > "$OUT/device.txt"

adb shell am start -W -a android.intent.action.VIEW \
  -d "storigam://messages/${THREAD_USER_ID}" "$APP_ID" > "$OUT/open-chat.txt"
sleep 8
adb shell dumpsys meminfo "$APP_ID" > "$OUT/memory-before.txt"
adb shell dumpsys gfxinfo "$APP_ID" reset >/dev/null

maestro test \
  -e THREAD_USER_ID="$THREAD_USER_ID" \
  -e OLDER_MESSAGE_ID="$OLDER_MESSAGE_ID" \
  "$FLOW" 2>&1 | tee "$OUT/maestro.txt"

adb shell dumpsys meminfo "$APP_ID" > "$OUT/memory-after.txt"
adb shell dumpsys gfxinfo "$APP_ID" > "$OUT/frames-summary.txt"
adb shell dumpsys gfxinfo "$APP_ID" framestats > "$OUT/frames.csv"
sleep 30
adb shell dumpsys meminfo "$APP_ID" > "$OUT/memory-idle-30s.txt"

echo "Results saved under $OUT"
echo "Compare TOTAL PSS in memory-before.txt and memory-after.txt."
echo "Review frames-summary.txt and frames.csv for frame time and jank."
