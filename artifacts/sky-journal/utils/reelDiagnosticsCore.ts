/** Diagnostic data only. Never use these measurements to control playback. */
export type ReelDiagnosticStage =
  | 'player_render' | 'player_commit' | 'url_available' | 'activated'
  | 'play_requested' | 'pause_requested' | 'load_start' | 'load_complete'
  | 'ready_display_signal' | 'buffer_start' | 'buffer_end'
  | 'playing_position_signal' | 'visibility_commit' | 'visibility_animation_frame'
  | 'released' | 'error';

export type NativeReelTimings = {
  version: number;
  clockMs: number;
  loadStartedMs: number;
  requestStartedMs: number;
  responseAvailableMs: number;
  firstByteMs: number;
  firstFrameMs: number;
  requestCount: number;
  bytesRead: number;
};

type Sample = {
  key: string; traceId: string; createdAt: number; activatedAt: number | null;
  released: boolean;
  events: { stage: ReelDiagnosticStage; at: number }[];
  native?: NativeReelTimings;
  calibration?: { offsetMs: number; roundTripMs: number };
};

function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
}

export class ReelDiagnosticRecorder {
  private samples: Sample[] = [];
  private activeKey: string | null = null;
  private activeAt = 0;

  constructor(
    readonly runId: string,
    private readonly now: () => number,
    private readonly id: () => string,
  ) {}

  activate(key: string) {
    if (this.activeKey === key) return;
    this.activeKey = key;
    this.activeAt = this.now();
    const sample = [...this.samples].reverse().find(row => row.key === key && !row.released);
    if (sample && sample.activatedAt === null) {
      sample.activatedAt = this.activeAt;
      this.mark(sample.traceId, 'activated', this.activeAt);
    }
  }

  deactivate() { this.activeKey = null; }

  createPlayer(key: string) {
    const at = this.now();
    const sample: Sample = {
      key, traceId: this.id(), createdAt: at, released: false,
      activatedAt: this.activeKey === key ? this.activeAt : null,
      events: [{ stage: 'player_render', at }, { stage: 'url_available', at }],
    };
    if (sample.activatedAt !== null) sample.events.push({ stage: 'activated', at: sample.activatedAt });
    this.samples.push(sample);
    if (this.samples.length > 40) this.samples.shift();
    return sample.traceId;
  }

  mark(traceId: string, stage: ReelDiagnosticStage, at = this.now()) {
    const row = this.samples.find(sample => sample.traceId === traceId);
    if (!row) return;
    if (row.events.length < 60) row.events.push({ stage, at });
    if (stage === 'released') row.released = true;
  }

  native(traceId: string, value: unknown) {
    if (!value || typeof value !== 'object') return;
    const fields = ['clockMs', 'loadStartedMs', 'requestStartedMs', 'responseAvailableMs',
      'firstByteMs', 'firstFrameMs', 'requestCount', 'bytesRead'] as const;
    const input = value as Record<string, unknown>;
    if (input.version !== 1 || fields.some(key => typeof input[key] !== 'number' || !Number.isFinite(input[key]))) return;
    const row = this.samples.find(sample => sample.traceId === traceId);
    if (!row) return;
    // Explicit allowlist: no arbitrary native payload, URI, header or identity.
    row.native = { version: 1, ...Object.fromEntries(fields.map(key => [key, input[key]])) } as NativeReelTimings;
  }

  calibrate(traceId: string, nativeClockMs: number, jsBeforeMs: number, jsAfterMs: number) {
    const row = this.samples.find(sample => sample.traceId === traceId);
    if (!row || !Number.isFinite(nativeClockMs) || jsAfterMs < jsBeforeMs) return;
    const roundTripMs = jsAfterMs - jsBeforeMs;
    if (!row.calibration || roundTripMs < row.calibration.roundTripMs) {
      row.calibration = { offsetMs: (jsBeforeMs + jsAfterMs) / 2 - nativeClockMs, roundTripMs };
    }
  }

  report() {
    const samples = this.samples.map(row => {
      const n = row.native;
      const nativeFrameJs = n && n.firstFrameMs >= 0 && row.calibration
        ? n.firstFrameMs + row.calibration.offsetMs : null;
      const activated = row.activatedAt;
      const delta = (start: number | undefined, end: number | undefined) =>
        start !== undefined && end !== undefined && start >= 0 && end >= start ? end - start : null;
      return {
        traceId: row.traceId,
        activated: activated !== null,
        preparedBeforeActivation: activated !== null && row.createdAt < activated,
        nativeInstrumentationAvailable: !!n,
        events: row.events.map(event => ({
          stage: event.stage,
          sincePlayerRenderMs: event.at - row.createdAt,
          sinceActivationMs: activated === null ? null : event.at - activated,
        })),
        native: n ?? null,
        clockCalibration: row.calibration
          ? { ...row.calibration, uncertaintyMs: row.calibration.roundTripMs / 2 } : null,
        measurements: {
          nativeLoadToFrameMs: delta(n?.loadStartedMs, n?.firstFrameMs),
          nativeRequestToResponseAvailableMs: delta(n?.requestStartedMs, n?.responseAvailableMs),
          nativeResponseToFirstByteMs: delta(n?.responseAvailableMs, n?.firstByteMs),
          nativeFirstByteToFrameMs: delta(n?.firstByteMs, n?.firstFrameMs),
          // A negative value is an offscreen prepared frame, NOT zero-ms visible playback.
          activationToNativeFrameMs: activated === null || nativeFrameJs === null ? null : nativeFrameJs - activated,
        },
      };
    });
    const postActivation = samples.filter(row => row.activated)
      .map(row => row.measurements.activationToNativeFrameMs)
      .filter((value): value is number => value !== null && value >= 0);
    return {
      schemaVersion: 1,
      runId: this.runId,
      notes: [
        'ready_display_signal, positive playback position and JS animation frames are not proof of a displayed frame.',
        'Native first-frame and network timings are unavailable in stock Expo Go; only an instrumented native Expo Video build can provide them.',
        'Native rendering into a surface can precede its on-screen visibility. Warm/offscreen frames are not counted as zero-ms startup.',
        'responseAvailableMs is native DataSource transfer-start after opening the response, not wire-level first-header arrival.',
        'Cross-clock activation-to-frame values are estimates; uncertainty is bounded by the measured clock-calibration round trip.',
        'The summary excludes pre-activation frames and is not a complete cold/warm visible-playback benchmark.',
      ],
      summary: {
        activatedSamples: samples.filter(row => row.activated).length,
        postActivationNativeFrameSamples: postActivation.length,
        medianMs: percentile(postActivation, 0.5),
        p95Ms: percentile(postActivation, 0.95),
      },
      samples,
    };
  }
}
