import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform, Share } from 'react-native';
import { ReelDiagnosticRecorder, type ReelDiagnosticStage } from './reelDiagnosticsCore';

const STORAGE_KEY = 'reel_diagnostics_opt_in_v1';
const now = () => performance.now();
type Report = ReturnType<ReelDiagnosticRecorder['report']>;
type SavedRun = { condition: string; appVersion: string | null; nativeBuild: string | null; platform: string; report: Report };
let enabled = false;
let expiresAt = 0;
let condition = 'unlabelled';
let recorder: ReelDiagnosticRecorder | null = null;
let archives: SavedRun[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let persistChain = Promise.resolve();

function current(): SavedRun | null {
  return recorder ? {
    condition,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
    nativeBuild: Constants.nativeBuildVersion ?? null,
    platform: Platform.OS,
    report: recorder.report(),
  } : null;
}

function persist() {
  const run = current();
  const payload = JSON.stringify({ enabled, expiresAt, condition, runs: [...archives, ...(run ? [run] : [])].slice(-5) });
  persistChain = persistChain.catch(() => undefined).then(() => AsyncStorage.setItem(STORAGE_KEY, payload));
  return persistChain;
}

function changed() {
  if (timer) return;
  // Diagnostic-only bounded writes; never await storage on the playback path.
  timer = setTimeout(() => { timer = undefined; void persist().catch(() => undefined); }, 1000);
}

// No screen, data fetch or player waits for this opt-in restoration.
const ready = AsyncStorage.getItem(STORAGE_KEY).then(raw => {
  if (!raw) return;
  const saved = JSON.parse(raw);
  expiresAt = typeof saved.expiresAt === 'number' ? saved.expiresAt : 0;
  enabled = saved.enabled === true && Date.now() < expiresAt;
  condition = typeof saved.condition === 'string' ? saved.condition.slice(0, 80) : 'unlabelled';
  archives = Array.isArray(saved.runs) ? saved.runs.slice(-4) : [];
  if (enabled) recorder = new ReelDiagnosticRecorder(randomUUID(), now, randomUUID);
}).catch(() => undefined);

function isEnabled() {
  if (enabled && Date.now() >= expiresAt) { enabled = false; changed(); }
  return enabled;
}

export function createReelDiagnosticPlayer(localKey: string): string | null {
  return isEnabled() && Platform.OS === 'android' ? recorder?.createPlayer(localKey) ?? null : null;
}

export function activateReelDiagnostic(localKey: string | null) {
  if (!isEnabled()) return;
  if (localKey === null) recorder?.deactivate();
  else recorder?.activate(localKey);
}

export function markReelDiagnostic(traceId: string | null, stage: ReelDiagnosticStage) {
  if (!isEnabled() || !traceId) return;
  recorder?.mark(traceId, stage);
  // Avoid diagnostic disk writes during the measured cold-start interval.
  if (stage === 'released' || stage === 'error' || stage === 'visibility_animation_frame') changed();
}

export function recordReelNativeTiming(traceId: string | null, status: unknown) {
  if (!isEnabled() || !traceId) return;
  const native = (status as { reelDiagnostics?: unknown } | undefined)?.reelDiagnostics;
  recorder?.native(traceId, native);
  // Native values are kept in memory, but avoid continuous storage writes on
  // every normal progress callback. Other lifecycle/transition events persist.
  return native as { firstFrameMs?: number; clockMs?: number } | undefined;
}

export function calibrateReelClock(traceId: string, nativeClock: number, before: number, after: number) {
  if (!isEnabled()) return;
  recorder?.calibrate(traceId, nativeClock, before, after);
  changed();
}

async function shareReport() {
  await persist();
  const run = current();
  const data = JSON.stringify({ runs: [...archives, ...(run ? [run] : [])] }, null, 2);
  if (Platform.OS !== 'web' && FileSystem.cacheDirectory && await Sharing.isAvailableAsync()) {
    const uri = `${FileSystem.cacheDirectory}storigam-reel-diagnostics.json`;
    await FileSystem.writeAsStringAsync(uri, data);
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Share Reels timing report' });
  } else await Share.share({ message: data, title: 'Reels timing report' });
}

function start(network: string, scenario: string) {
  enabled = true;
  expiresAt = Date.now() + 2 * 60 * 60 * 1000;
  condition = `${network}/${scenario} (manually labelled)`;
  archives = [];
  recorder = new ReelDiagnosticRecorder(randomUUID(), now, randomUUID);
  void persist().then(() => Alert.alert('Timing recording enabled',
    'Restart the app, then watch at least 10 Reels. Recordings remain on this device until you share them. No credentials, usernames or video URLs are recorded. Stock Expo Go records JavaScript events only; native frame/network timings are unavailable.'))
    .catch(() => { enabled = false; Alert.alert('Could not enable recording', 'Local diagnostic storage is unavailable.'); });
}

/** Explicit opt-in, reachable by holding the existing Reels heading. */
export async function openReelDiagnosticMenu() {
  await ready;
  Alert.alert('Reels timing diagnostics', enabled
    ? `Recording locally: ${condition}. Hold the heading again to share or stop.`
    : 'Off by default. This records local timing data only; it does not change buffering, preloading or playback.',
  [
    { text: 'Start new test', onPress: () => Alert.alert('Network label', 'Select the connection you will test. This is a manual label, not an automatic network measurement.', [
      ...['Wi-Fi', 'Mobile data'].map(network => ({ text: network, onPress: () => Alert.alert('Test label', 'Select the test condition.', [
        ...['Cold app launch', 'Warm relaunch', 'Consecutive swipes'].map(scenario => ({ text: scenario, onPress: () => start(network, scenario) })),
      ]) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]) },
    { text: 'Share report', onPress: () => { void shareReport().catch(() => Alert.alert('Could not share report', 'Try again. No report was uploaded automatically.')); } },
    { text: 'Stop / clear', onPress: () => Alert.alert('Recording controls', 'Stopping does not reload or change any active player.', [
      { text: 'Stop', onPress: () => { enabled = false; void persist().catch(() => undefined); } },
      { text: 'Delete local report', style: 'destructive', onPress: () => {
        enabled = false; recorder = null; archives = []; if (timer) clearTimeout(timer); timer = undefined;
        void persist().catch(() => undefined);
      } },
      { text: 'Cancel', style: 'cancel' },
    ]) },
  ]);
}
