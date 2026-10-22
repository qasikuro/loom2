import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
  alert: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Platform: { OS: 'ios' },
  Share: { share: mocks.share, dismissedAction: 'dismissedAction' },
}));

vi.mock('expo-linking', () => ({
  createURL: (path: string) => `storigam://${path}`,
}));

vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn().mockResolvedValue(false),
  shareAsync: vi.fn(),
}));

vi.mock('@/utils/mediaAccess', () => ({
  resolveMediaReadUrl: vi.fn(),
}));

import { createStorigamDeepLink, shareStory } from '../shareContent';

describe('Storigam content sharing', () => {
  afterEach(() => mocks.share.mockClear());

  it('creates app links only for existing app routes', () => {
    expect(createStorigamDeepLink('/guide-tutorial/tutorial-42'))
      .toBe('storigam:///guide-tutorial/tutorial-42');
  });

  it('includes a stable story route for a public story', async () => {
    await shareStory({
      id: 'story-42',
      isPublic: true,
      title: 'A small adventure',
      mood: 'Dreamy',
      authorName: 'Rin',
      panels: [{ text: 'The lights came alive.' }],
    });

    expect(mocks.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'A small adventure',
        url: 'storigam:///story/story-42',
      }),
      expect.any(Object),
    );
  });

  it('does not include a route for a private story', async () => {
    await shareStory({
      id: 'private-story-42',
      isPublic: false,
      title: 'A private note',
      mood: 'Soft',
      authorName: 'Rin',
      panels: [{ text: 'Only for me.' }],
    });

    expect(mocks.share).toHaveBeenCalledWith(
      expect.not.objectContaining({ url: expect.any(String) }),
      expect.any(Object),
    );
  });
});
