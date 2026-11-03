import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ saved: null as string | null, setItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: async () => fixture.saved, setItem: fixture.setItem },
}));
vi.mock('expo-constants', () => ({ default: { nativeAppVersion: '1.0', nativeBuildVersion: '4' } }));
vi.mock('expo-crypto', () => ({ randomUUID: () => '2d07aa42-c24d-4d1a-90d9-74975d18c038' }));
vi.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/' }));
vi.mock('expo-sharing', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, Alert: {}, Share: {} }));

describe('device-local diagnostic consent', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fixture.saved = null;
    fixture.setItem.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('is disabled by default and does not write playback events or create a trace', async () => {
    const diagnostics = await import('../reelDiagnostics');
    await Promise.resolve();
    diagnostics.activateReelDiagnostic('never-export-this-id');
    expect(diagnostics.createReelDiagnosticPlayer('never-export-this-id')).toBeNull();
    diagnostics.markReelDiagnostic(null, 'load_start');
    await vi.runAllTimersAsync();
    expect(fixture.setItem).not.toHaveBeenCalled();
  });

  it('does not resume expired opt-in recording after app restart', async () => {
    fixture.saved = JSON.stringify({ enabled: true, expiresAt: Date.now() - 1, runs: [] });
    const diagnostics = await import('../reelDiagnostics');
    await Promise.resolve();
    expect(diagnostics.createReelDiagnosticPlayer('one')).toBeNull();
  });

  it('restores consent but persists only anonymous, bounded report data', async () => {
    fixture.saved = JSON.stringify({ enabled: true, expiresAt: Date.now() + 60_000, condition: 'Wi-Fi/test', runs: [] });
    const diagnostics = await import('../reelDiagnostics');
    await Promise.resolve();
    diagnostics.activateReelDiagnostic('private-post-id');
    const trace = diagnostics.createReelDiagnosticPlayer('private-post-id');
    expect(trace).toBeTruthy();
    diagnostics.markReelDiagnostic(trace, 'player_commit');
    await vi.runAllTimersAsync();
    expect(fixture.setItem).not.toHaveBeenCalled();
    diagnostics.markReelDiagnostic(trace, 'released');
    await vi.runAllTimersAsync();
    expect(fixture.setItem).toHaveBeenCalledTimes(1);
    const serialized = fixture.setItem.mock.calls[0]![1] as string;
    expect(serialized).not.toContain('private-post-id');
    expect(JSON.parse(serialized).runs[0].report.samples).toHaveLength(1);
  });
});
