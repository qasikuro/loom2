/**
 * useJournalDraftLoader — loads a saved journal draft on mount and exposes it
 * as `pendingDraft` so the screen can offer a "Resume draft" banner.
 *
 * When the screen was opened with pre-filled content (e.g. an `initialPrompt`
 * parameter), the draft is deliberately skipped: restoring a draft on top of a
 * prompt would silently discard the prompt the caller sent.
 */
import { useState, useEffect } from 'react';
import { journalDraft, type JournalDraft } from '@/utils/entryDraftStore';
import type { JournalEntryType } from '@/context/AppContext';

export function useJournalDraftLoader(
  entryType: JournalEntryType,
  hasPrefilledContent: boolean,
) {
  const [pendingDraft, setPendingDraft] = useState<JournalDraft | null>(null);

  useEffect(() => {
    // When the screen already has content (e.g. an initialPrompt param) the
    // draft banner must be suppressed so it never overwrites the pre-fill.
    if (hasPrefilledContent) return;

    journalDraft.load(entryType).then(d => {
      // Only offer to restore if there is meaningful content to restore.
      if (d && (d.text.trim() || d.friendName.trim())) {
        setPendingDraft(d);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [pendingDraft, setPendingDraft] as const;
}
