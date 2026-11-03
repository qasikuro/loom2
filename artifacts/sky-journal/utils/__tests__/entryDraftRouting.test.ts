import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

import {
  getCreateDestination,
  getDraftResumeDestination,
  type ResumableStoryDraft,
} from '@/utils/entryDraftStore';

describe('Create sheet destinations', () => {
  it('resumes manga drafts in the quick moment editor', () => {
    const draft: ResumableStoryDraft = {
      kind: 'manga',
      title: 'Manga draft',
      savedAt: 10,
    };

    expect(getDraftResumeDestination(draft)).toEqual({
      pathname: '/quick-moment',
      params: { resumeDraft: '1' },
    });
  });

  it('resumes chapter drafts in the story editor', () => {
    const draft: ResumableStoryDraft = {
      kind: 'chapter',
      title: 'Chapter draft',
      savedAt: 10,
    };

    expect(getDraftResumeDestination(draft)).toEqual({
      pathname: '/chapter-editor',
      params: { resumeDraft: '1' },
    });
  });

  it('preserves event prompt and mood when resuming a draft', () => {
    const draft: ResumableStoryDraft = {
      kind: 'chapter',
      title: 'Event story',
      savedAt: 10,
    };

    expect(getDraftResumeDestination(draft, 'Write about spring', 'hopeful')).toEqual({
      pathname: '/chapter-editor',
      params: {
        eventPrompt: 'Write about spring',
        eventMood: 'hopeful',
        resumeDraft: '1',
      },
    });
  });

  it('does not pass an event mood without its prompt', () => {
    expect(getCreateDestination('/chapter-editor', undefined, 'hopeful', { resumeDraft: '1' })).toEqual({
      pathname: '/chapter-editor',
      params: { resumeDraft: '1' },
    });
  });
});
