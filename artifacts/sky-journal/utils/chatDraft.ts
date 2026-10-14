/** Keep both messages when a send fails after the user starts their next draft. */
export function restoreFailedChatDraft(current: string, failed: string): string {
  if (!current.trim()) return failed;
  if (!failed) return current;
  return `${failed}\n${current}`;
}
