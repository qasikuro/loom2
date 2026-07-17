/**
 * Extracts the most evocative "pull quote" from a story's panel narrations.
 *
 * Algorithm:
 *  1. Collect all non-empty narration text from each panel's `text` field.
 *  2. Split combined text into sentences (splits on . ! ? followed by whitespace or end).
 *  3. Return the longest sentence, trimmed, capped at 120 characters with ellipsis.
 *  4. Falls back to empty string when no panels or no text is found.
 */
export function extractPullQuote(
  panels: Array<{ text?: string | null }> | null | undefined,
): string {
  if (!panels || panels.length === 0) return '';

  const combined = panels
    .map(p => (p.text ?? '').trim())
    .filter(t => t.length > 0)
    .join(' ');

  if (!combined) return '';

  const sentences = combined
    .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (sentences.length === 0) {
    return combined.length > 120 ? combined.slice(0, 117).trimEnd() + '…' : combined;
  }

  const longest = sentences.reduce((best, s) => (s.length > best.length ? s : best), '');

  if (longest.length <= 120) return longest;
  return longest.slice(0, 117).trimEnd() + '…';
}
