import { beforeEach, describe, expect, it, vi } from 'vitest';

const updates = vi.hoisted(() => ({
  isEnabled: true,
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));

vi.mock('expo-updates', () => updates);

import { ensureOAuthUpdateIsCurrent } from '../ensureOAuthUpdate';

describe('ensureOAuthUpdateIsCurrent', () => {
  const status = {
    isChecking: false,
    isDownloading: false,
    isUpdateAvailable: false,
    isUpdatePending: false,
  };
  const getStatus = () => status;

  beforeEach(() => {
    updates.isEnabled = true;
    status.isChecking = false;
    status.isDownloading = false;
    status.isUpdateAvailable = false;
    status.isUpdatePending = false;
    updates.checkForUpdateAsync.mockReset().mockResolvedValue({ isAvailable: false });
    updates.fetchUpdateAsync.mockReset().mockResolvedValue({ isNew: true });
    updates.reloadAsync.mockReset().mockResolvedValue(undefined);
  });

  it('does not check for OTA updates when updates are disabled', async () => {
    updates.isEnabled = false;

    await expect(ensureOAuthUpdateIsCurrent(getStatus)).resolves.toBe(true);
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('reloads an update that is already downloaded', async () => {
    status.isUpdatePending = true;

    await expect(ensureOAuthUpdateIsCurrent(getStatus)).resolves.toBe(false);
    expect(updates.reloadAsync).toHaveBeenCalledOnce();
    expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('downloads and reloads a newly available update before OAuth', async () => {
    updates.checkForUpdateAsync.mockResolvedValue({ isAvailable: true });

    await expect(ensureOAuthUpdateIsCurrent(getStatus)).resolves.toBe(false);
    expect(updates.fetchUpdateAsync).toHaveBeenCalledOnce();
    expect(updates.reloadAsync).toHaveBeenCalledOnce();
  });

  it('continues with the current bundle if update checking fails', async () => {
    updates.checkForUpdateAsync.mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(ensureOAuthUpdateIsCurrent(getStatus)).resolves.toBe(true);
    expect(updates.reloadAsync).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
