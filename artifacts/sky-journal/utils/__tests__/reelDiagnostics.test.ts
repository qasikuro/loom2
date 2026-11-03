import { describe, expect, it } from 'vitest';
import { ReelDiagnosticRecorder, type NativeReelTimings } from '../reelDiagnosticsCore';

function harness() {
  let time = 0;
  let sequence = 0;
  const recorder = new ReelDiagnosticRecorder('test-run', () => time, () => `trace-${++sequence}`);
  return { recorder, at: (value: number) => { time = value; } };
}

const native = (overrides: Partial<NativeReelTimings> = {}): NativeReelTimings => ({
  version: 1, clockMs: 10_900, loadStartedMs: 10_100, requestStartedMs: 10_110,
  responseAvailableMs: 10_400, firstByteMs: 10_450, firstFrameMs: 10_800,
  requestCount: 1, bytesRead: 200_000, ...overrides,
});

describe('opt-in Reel timing recorder', () => {
  it('retains activation before player construction and uses native clocks for stage durations', () => {
    const { recorder, at } = harness();
    at(20); recorder.activate('private-local-post-id');
    at(80); const id = recorder.createPlayer('private-local-post-id');
    recorder.native(id, native());
    recorder.calibrate(id, 10_900, 898, 902);
    const sample = recorder.report().samples[0]!;
    expect(sample.events[0]!.sinceActivationMs).toBe(60);
    expect(sample.measurements).toEqual({
      nativeLoadToFrameMs: 700,
      nativeRequestToResponseAvailableMs: 290,
      nativeResponseToFirstByteMs: 50,
      nativeFirstByteToFrameMs: 350,
      activationToNativeFrameMs: 780,
    });
    expect(sample.clockCalibration?.uncertaintyMs).toBe(2);
    expect(JSON.stringify(recorder.report())).not.toContain('private-local-post-id');
  });

  it('never substitutes readiness or positive playback position for a native frame', () => {
    const { recorder } = harness();
    recorder.activate('one');
    const id = recorder.createPlayer('one');
    recorder.mark(id, 'ready_display_signal');
    recorder.mark(id, 'playing_position_signal');
    recorder.native(id, native({ firstFrameMs: -1 }));
    expect(recorder.report().samples[0]!.measurements.activationToNativeFrameMs).toBeNull();
    expect(recorder.report().summary.medianMs).toBeNull();
  });

  it('leaves native timing unavailable on old native builds', () => {
    const { recorder } = harness();
    const id = recorder.createPlayer('one');
    recorder.native(id, undefined);
    const sample = recorder.report().samples[0]!;
    expect(sample.nativeInstrumentationAvailable).toBe(false);
    expect(sample.native).toBeNull();
  });

  it('excludes an offscreen prepared frame from startup percentiles instead of calling it instant', () => {
    const { recorder, at } = harness();
    at(10); const id = recorder.createPlayer('next');
    recorder.native(id, native({ firstFrameMs: 10_100 }));
    recorder.calibrate(id, 10_900, 898, 902);
    at(500); recorder.activate('next');
    const sample = recorder.report().samples[0]!;
    expect(sample.preparedBeforeActivation).toBe(true);
    expect(sample.measurements.activationToNativeFrameMs).toBe(-400);
    expect(recorder.report().summary.postActivationNativeFrameSamples).toBe(0);
    expect(recorder.report().summary.medianMs).toBeNull();
  });

  it('does not reset activation on repeated viewability callbacks', () => {
    const { recorder, at } = harness();
    at(10); recorder.activate('one');
    at(50); const id = recorder.createPlayer('one');
    at(500); recorder.activate('one');
    recorder.mark(id, 'play_requested');
    expect(recorder.report().samples[0]!.events.at(-1)!.sinceActivationMs).toBe(490);
  });

  it('allowlists native fields and rejects malformed measurements', () => {
    const { recorder } = harness();
    const id = recorder.createPlayer('one');
    recorder.native(id, { ...native(), url: 'https://secret.example', username: 'never-export' });
    expect(JSON.stringify(recorder.report())).not.toContain('secret.example');
    expect(JSON.stringify(recorder.report())).not.toContain('never-export');
    recorder.native(id, { ...native(), firstFrameMs: NaN });
    expect(recorder.report().samples[0]!.native?.firstFrameMs).toBe(10_800);
  });

  it('bounds sample count and transition history', () => {
    const { recorder } = harness();
    for (let i = 0; i < 55; i++) {
      const id = recorder.createPlayer(`local-${i}`);
      for (let event = 0; event < 100; event++) recorder.mark(id, 'buffer_start');
    }
    expect(recorder.report().samples).toHaveLength(40);
    expect(recorder.report().samples.every(row => row.events.length <= 60)).toBe(true);
  });

  it('calculates nearest-rank median and p95 only from observed post-activation native frames', () => {
    const { recorder, at } = harness();
    for (let i = 1; i <= 20; i++) {
      at(0); recorder.activate(`video-${i}`);
      const id = recorder.createPlayer(`video-${i}`);
      recorder.native(id, native({ firstFrameMs: 10_000 + i * 10 }));
      recorder.calibrate(id, 10_900, 900, 900);
    }
    expect(recorder.report().summary).toEqual({
      activatedSamples: 20, postActivationNativeFrameSamples: 20, medianMs: 100, p95Ms: 190,
    });
  });
});
