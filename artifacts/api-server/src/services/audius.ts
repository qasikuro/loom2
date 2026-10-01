export const AUDIUS_BASE = "https://discoveryprovider.audius.co/v1";
export const AUDIUS_APP_NAME = "Storigam";

export function audiusStreamUrl(trackId: string): string {
  return `${AUDIUS_BASE}/tracks/${encodeURIComponent(trackId)}/stream?app_name=${encodeURIComponent(AUDIUS_APP_NAME)}`;
}