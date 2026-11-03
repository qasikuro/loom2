# Long chat performance check (Android)

This check exercises a real authenticated DM, rather than a mock list, so page
fetches and authorized image reads follow the same paths as the app. It can use
a disposable fixture created by the development API, or an existing
non-production test conversation containing:

- At least 400 messages (eight or more 50-message history pages).
- At least 20 text messages, 20 photos, and 20 videos, spread across old and
  recent pages.
- A known text-message ID at least 200 messages older than the newest message,
  used as an anchor to prove older history was reached.
- Valid, reachable image and video thumbnail URLs. The newest visible screen
  must contain at least one photo and one video so the flow can confirm both
  thumbnail-ready markers before beginning its scroll run.

Do not use real private conversations as test fixtures. The generated fixture
uses a hidden synthetic partner, 440 messages, 40 photo messages, 40 video
messages with posters, and the stable `CHAT_PERFORMANCE_OLDER_ANCHOR` text
message. Its test media is private and owned by the signed-in account. Fixture
creation and cleanup routes are mounted only outside production. An abandoned
fixture is automatically removed after seven days without a new message; the
development API checks hourly after startup. Cleanup verifies the hidden/private
synthetic profile, generated fixture ID, 440-message history, and anchor before
deleting only that fixture's uniquely named media objects.

## Target and pass criteria

Use a physical entry-level Android phone where possible: Android 11+, 2–3 GiB
RAM, 60 Hz display, and a 400 × 720 or smaller app viewport. Use the same
installed app build and network for comparisons; note whether the build is a
development build or release build.

The targets are:

- At least 95% of measured UI frames complete within 33.3 ms (60 Hz budget
  with headroom for a 30 fps low-end experience); no sustained blank/stalled
  history while a page is requested.
- App PSS grows by no more than 100 MiB from the warmed baseline through the
  scroll run, and returns to within 50 MiB of baseline after 30 seconds idle.
- Both photo and video thumbnail-ready markers appear before scrolling, and
  older pages continue to appear during repeated scrolling.
- The list keeps its configured bounded render window (7 viewports), 12 initial
  rows, and batches of at most 8 rows. Chat photos use normal decode priority;
  video messages remain poster-only until opened.

Treat these as regression budgets, not claimed measurements. A result is only
verified when the script's captured Android data is reviewed on the target
device. Development builds have higher memory and frame overhead than release
builds, so keep the build type in the result notes.

## Run

Install `adb`, Maestro, `curl`, and `jq` on the test workstation,
connect/unlock the Android device, and sign in to the development test account.
The installed app must use the same development API as the fixture endpoint.
To create a fixture, run from the workspace root and provide the development
API host and a bearer token for the signed-in test account as local environment
variables. Do not check in or share the token:

```sh
CHAT_FIXTURE_API_BASE_URL=https://<workspace>.replit.dev \
CHAT_FIXTURE_BEARER_TOKEN=<development-session-token> \
AUTO_CREATE_CHAT_FIXTURE=1 \
  bash artifacts/sky-journal/scripts/run-chat-performance-android.sh
```

Automatic creation accepts only a `.replit.dev` host or localhost. The wrapper
passes the returned partner and older-message IDs to Maestro and removes the
fixture's messages, synthetic profile, and 60 private media objects when the
run exits. If the workstation stops before cleanup runs, retry the authenticated
`DELETE /api/test-fixtures/chat-long-media/<partnerId>` request against that
development API.

To reuse a fixture created separately, or a prepared non-production
conversation, use the manual mode:

```sh
THREAD_USER_ID=<conversation-partner-user-id> \
OLDER_MESSAGE_ID=<older-text-message-id> \
  bash artifacts/sky-journal/scripts/run-chat-performance-android.sh
```

The flow deep-links to that DM, confirms photo and video rows and resolved
thumbnails, makes 36 repeated older-history scrolls, asserts the older message
anchor is reached, then scrolls back through the loaded history. The wrapper
captures device model/API/RAM/display information, before/after/30-second-idle
app PSS, Android frame summaries, and per-frame statistics in an
ignored `generated-artifacts/chat-performance-android/<timestamp>/` directory.
Keep the files with the test notes; do not commit device or account details.

For a valid result, check the Maestro output for successful assertions and no
missing-history/load errors. Compare `TOTAL PSS` in the three memory captures.
Review `frames-summary.txt` for janky-frame counts and `frames.csv` for frame
durations; record the device, build type, network, PSS delta, janky-frame
percentage, and any stalls alongside the run.

## Current verification record

- Repeatable Android flow and capture script: added; awaits a connected device
  and a prepared test conversation.
- Local workspace has no Android device/ADB target attached, so no physical
  device memory or frame measurements are claimed here.
