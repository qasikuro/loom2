import * as Updates from 'expo-updates';

export interface OAuthUpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
}

const UPDATE_ACTIVITY_WAIT_MS = 15_000;

function waitBriefly(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * OAuth callbacks are deep-linked back into the currently running JS bundle.
 * Apply a newer compatible OTA first so first-time sign-in doesn't land in a
 * stale bundle that has not registered the callback route yet.
 *
 * Returns false when an update reload was requested; callers should stop the
 * current OAuth attempt and let the user retry after the app restarts.
 */
export async function ensureOAuthUpdateIsCurrent(
  getStatus: () => OAuthUpdateStatus,
): Promise<boolean> {
  if (!Updates.isEnabled) return true;

  try {
    let status = getStatus();
    const waitUntil = Date.now() + UPDATE_ACTIVITY_WAIT_MS;
    while ((status.isChecking || status.isDownloading) && Date.now() < waitUntil) {
      await waitBriefly(150);
      status = getStatus();
    }

    // The normal startup update check may still be downloading. Don't start
    // another check concurrently; if it takes unusually long, keep sign-in
    // available rather than trapping the user on this screen.
    if (status.isChecking || status.isDownloading) return true;

    if (status.isUpdatePending) {
      await Updates.reloadAsync();
      return false;
    }

    if (!status.isUpdateAvailable) {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return true;
    }

    const result = await Updates.fetchUpdateAsync();
    if (result.isNew || getStatus().isUpdatePending) {
      await Updates.reloadAsync();
      return false;
    }
  } catch (error) {
    console.warn('[OAuth] OTA preflight failed; continuing with the current bundle.', error);

    // A launch-time check may finish while this check is running. If it did
    // download an update, apply it rather than opening OAuth on stale code.
    if (getStatus().isUpdatePending) {
      try {
        await Updates.reloadAsync();
        return false;
      } catch (reloadError) {
        console.warn('[OAuth] Could not reload the pending update.', reloadError);
      }
    }
  }

  return true;
}
