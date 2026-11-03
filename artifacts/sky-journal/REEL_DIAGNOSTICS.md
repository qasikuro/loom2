# Reels timing diagnostics

The current Expo Go path records opt-in JavaScript lifecycle signals only. The
Expo AV native patch has been removed along with Expo AV; Expo Video does not
expose native transfer or compositor timestamps through stock Expo Go.

## Use diagnostics

1. Hold the **Reels** heading to open the diagnostic menu.
2. Start a test and choose manual network and scenario labels.
3. Restart the app, then watch at least 10 consecutive Reels.
4. Hold the heading and choose **Share report**. The report stays on-device until
   the user explicitly shares it. **Stop / clear** stops recording or deletes it.

Recording is off by default, expires after two hours, and retains at most five
launch reports with 40 player samples per launch and 60 transitions per sample.
The report contains JavaScript activation, load, buffering, readiness and
visibility signals. A first-frame callback or positive playback position is not
proof of compositor presentation. Pair tests with a screen recording.

No credentials, usernames, post IDs, URLs, headers, message content, or raw
player error strings are exported, and nothing is uploaded automatically. An
opt-in trace header may be sent with Android video requests for API-side
correlation; it is not an authentication or cache-bypass token.

Native request, first-byte, and rendered-frame measurements require a separately
instrumented native Expo Video build. Those measurements are not available in
Expo Go and are exported as unavailable; JavaScript timing must not be presented
as native frame timing.
