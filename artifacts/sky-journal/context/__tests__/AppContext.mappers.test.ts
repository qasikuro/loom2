import { describe, it, expect } from 'vitest';
import {
  toAppCharacter,
  toAppJournalEntry,
  toAppStory,
  toAppOutfit,
  toRawDiscoverPost,
  resolveUri,
  DEFAULT_CHARACTER,
} from '../mappers';

// ── resolveUri ────────────────────────────────────────────────────────────────

describe('resolveUri', () => {
  it('returns undefined for null', () => {
    expect(resolveUri(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(resolveUri(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(resolveUri('')).toBeUndefined();
  });

  it('passes through https URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(resolveUri(url)).toBe(url);
  });

  it('passes through http URLs unchanged', () => {
    const url = 'http://example.com/image.jpg';
    expect(resolveUri(url)).toBe(url);
  });

  it('passes through data: URIs unchanged', () => {
    const uri = 'data:image/png;base64,abc123';
    expect(resolveUri(uri)).toBe(uri);
  });

  it('resolves a relative /api/images path using the supplied apiBase', () => {
    const result = resolveUri('/api/images/photo.jpg', 'https://my.domain/api');
    expect(result).toBe('https://my.domain/api/images/photo.jpg');
  });

  it('strips the /api suffix from apiBase before prepending (avoids double-prefix)', () => {
    const result = resolveUri('/api/images/photo.jpg', '/api');
    expect(result).toBe('/api/images/photo.jpg');
  });

  it('uses /api as default apiBase', () => {
    const result = resolveUri('/api/images/photo.jpg');
    expect(result).toBe('/api/images/photo.jpg');
  });
});

// ── toAppCharacter ────────────────────────────────────────────────────────────

describe('toAppCharacter', () => {
  it('maps a full payload to Character', () => {
    const raw = {
      name:             'Luna',
      bio:              'Stargazer',
      mood:             'Dreamy',
      traits:           ['Curious', 'Kind'],
      isPublic:         false,
      username:         'luna',
      avatarUri:        'https://example.com/avatar.png',
      activeOutfitId:   'outfit-1',
      birthday:         '2000-06-15',
      country:          'JP',
      role:             'user',
      timezone:         'Asia/Tokyo',
      pushToken:        'tok123',
      links:            [{ label: 'Twitter', url: 'https://twitter.com/luna' }],
      isGuide:          true,
      guideBio:         'Helping dreamers',
      guideTopics:      ['Journaling', 'Mindfulness'],
      guideAvailability: { days: [1, 2], timeFrom: '09:00', timeTo: '17:00' },
    };
    const result = toAppCharacter(raw);
    expect(result.name).toBe('Luna');
    expect(result.bio).toBe('Stargazer');
    expect(result.mood).toBe('Dreamy');
    expect(result.traits).toEqual(['Curious', 'Kind']);
    expect(result.isPublic).toBe(false);
    expect(result.username).toBe('luna');
    expect(result.avatarUri).toBe('https://example.com/avatar.png');
    expect(result.activeOutfitId).toBe('outfit-1');
    expect(result.birthday).toBe('2000-06-15');
    expect(result.country).toBe('JP');
    expect(result.role).toBe('user');
    expect(result.timezone).toBe('Asia/Tokyo');
    expect(result.pushToken).toBe('tok123');
    expect(result.isGuide).toBe(true);
    expect(result.guideBio).toBe('Helping dreamers');
    expect(result.guideTopics).toEqual(['Journaling', 'Mindfulness']);
    expect(result.guideAvailability).toEqual({ days: [1, 2], timeFrom: '09:00', timeTo: '17:00' });
  });

  it('applies DEFAULT_CHARACTER values for missing name/bio/mood', () => {
    const result = toAppCharacter({});
    expect(result.name).toBe(DEFAULT_CHARACTER.name);
    expect(result.bio).toBe(DEFAULT_CHARACTER.bio);
    expect(result.mood).toBe(DEFAULT_CHARACTER.mood);
  });

  it('returns isPublic true when both isPublic and is_public are absent', () => {
    expect(toAppCharacter({}).isPublic).toBe(true);
  });

  it('prefers isPublic (camelCase) over is_public (snake_case)', () => {
    expect(toAppCharacter({ isPublic: false, is_public: true }).isPublic).toBe(false);
  });

  it('falls back to is_public when isPublic is absent', () => {
    expect(toAppCharacter({ is_public: false }).isPublic).toBe(false);
  });

  it('prefers activeOutfitId (camelCase) over active_outfit_id (snake_case)', () => {
    const result = toAppCharacter({ activeOutfitId: 'a', active_outfit_id: 'b' });
    expect(result.activeOutfitId).toBe('a');
  });

  it('falls back to active_outfit_id when activeOutfitId is absent', () => {
    const result = toAppCharacter({ active_outfit_id: 'b' });
    expect(result.activeOutfitId).toBe('b');
  });

  it('prefers pushToken over push_token', () => {
    const result = toAppCharacter({ pushToken: 'a', push_token: 'b' });
    expect(result.pushToken).toBe('a');
  });

  it('falls back to push_token when pushToken is absent', () => {
    const result = toAppCharacter({ push_token: 'b' });
    expect(result.pushToken).toBe('b');
  });

  it('returns empty traits array when traits is null/missing', () => {
    expect(toAppCharacter({ traits: null }).traits).toEqual([]);
    expect(toAppCharacter({}).traits).toEqual([]);
  });

  it('returns empty traits array when traits is not an array', () => {
    expect(toAppCharacter({ traits: 'Dreamer' }).traits).toEqual([]);
  });

  it('returns undefined links when links is null/missing', () => {
    expect(toAppCharacter({}).links).toBeUndefined();
    expect(toAppCharacter({ links: null }).links).toBeUndefined();
  });

  it('maps links array when provided', () => {
    const links = [{ label: 'Blog', url: 'https://blog.example.com' }];
    expect(toAppCharacter({ links }).links).toEqual(links);
  });

  it('defaults isGuide to false when absent', () => {
    expect(toAppCharacter({}).isGuide).toBe(false);
  });

  it('defaults guideBio to empty string when absent', () => {
    expect(toAppCharacter({}).guideBio).toBe('');
  });

  it('defaults guideTopics to empty array when absent', () => {
    expect(toAppCharacter({}).guideTopics).toEqual([]);
  });

  it('defaults guideAvailability to null when absent', () => {
    expect(toAppCharacter({}).guideAvailability).toBeNull();
  });
});

// ── toAppJournalEntry ─────────────────────────────────────────────────────────

describe('toAppJournalEntry', () => {
  const base = {
    id:   'entry-1',
    date: '2024-03-15T10:00:00.000Z',
    type: 'diary',
    text: 'Today was magical.',
    mood: 'Hopeful',
  };

  it('maps a full payload', () => {
    const raw = {
      ...base,
      imageUri:     'https://example.com/photo.jpg',
      friendName:   'Aria',
      stickerCount: 3,
    };
    const result = toAppJournalEntry(raw);
    expect(result.id).toBe('entry-1');
    expect(result.date).toBe('2024-03-15T10:00:00.000Z');
    expect(result.type).toBe('diary');
    expect(result.text).toBe('Today was magical.');
    expect(result.mood).toBe('Hopeful');
    expect(result.imageUri).toBe('https://example.com/photo.jpg');
    expect(result.friendName).toBe('Aria');
    expect(result.stickerCount).toBe(3);
  });

  it('maps a minimal payload with required fields only', () => {
    const result = toAppJournalEntry(base);
    expect(result.id).toBe('entry-1');
    expect(result.imageUri).toBeUndefined();
    expect(result.friendName).toBeUndefined();
    expect(result.stickerCount).toBe(0);
  });

  it('converts a Date object date to ISO string', () => {
    const d = new Date('2024-06-01T00:00:00.000Z');
    const result = toAppJournalEntry({ ...base, date: d });
    expect(result.date).toBe(d.toISOString());
  });

  it('leaves a string date unchanged', () => {
    const result = toAppJournalEntry({ ...base, date: '2024-01-01' });
    expect(result.date).toBe('2024-01-01');
  });

  it('resolves relative image_uri (snake_case) to absolute path', () => {
    const result = toAppJournalEntry({ ...base, image_uri: '/api/images/shot.jpg' });
    expect(result.imageUri).toContain('/api/images/shot.jpg');
  });

  it('prefers imageUri (camelCase) over image_uri (snake_case)', () => {
    const result = toAppJournalEntry({
      ...base,
      imageUri:  'https://cdn.example.com/a.jpg',
      image_uri: '/api/images/b.jpg',
    });
    expect(result.imageUri).toBe('https://cdn.example.com/a.jpg');
  });

  it('prefers friendName (camelCase) over friend_name (snake_case)', () => {
    const result = toAppJournalEntry({ ...base, friendName: 'A', friend_name: 'B' });
    expect(result.friendName).toBe('A');
  });

  it('falls back to friend_name when friendName is absent', () => {
    const result = toAppJournalEntry({ ...base, friend_name: 'Sage' });
    expect(result.friendName).toBe('Sage');
  });

  it('defaults stickerCount to 0 when absent', () => {
    expect(toAppJournalEntry(base).stickerCount).toBe(0);
  });

  it('returns undefined imageUri when both imageUri and image_uri are null', () => {
    const result = toAppJournalEntry({ ...base, imageUri: null, image_uri: null });
    expect(result.imageUri).toBeUndefined();
  });
});

// ── toAppStory ────────────────────────────────────────────────────────────────

describe('toAppStory', () => {
  const base = {
    id:   'story-1',
    date: '2024-03-15T10:00:00.000Z',
    mood: 'Romantic',
  };

  it('maps a full payload', () => {
    const raw = {
      ...base,
      chapterTitle:   'The Lost Sky',
      description:    'A journey begins.',
      location:       'Highlands',
      isPublic:       true,
      witnessedCount: 12,
      savedCount:     5,
      stickerCount:   2,
      pageLayoutKey:  'layout-a',
      panels: [
        { id: 'p1', text: 'Narration one', imageUri: 'https://cdn.example.com/p1.jpg' },
      ],
    };
    const result = toAppStory(raw);
    expect(result.id).toBe('story-1');
    expect(result.chapterTitle).toBe('The Lost Sky');
    expect(result.description).toBe('A journey begins.');
    expect(result.location).toBe('Highlands');
    expect(result.isPublic).toBe(true);
    expect(result.witnessedCount).toBe(12);
    expect(result.savedCount).toBe(5);
    expect(result.stickerCount).toBe(2);
    expect(result.pageLayoutKey).toBe('layout-a');
    expect(result.panels).toHaveLength(1);
    expect(result.panels[0].id).toBe('p1');
    expect(result.panels[0].text).toBe('Narration one');
    expect(result.panels[0].imageUri).toBe('https://cdn.example.com/p1.jpg');
  });

  it('maps a minimal payload (only id, date, mood)', () => {
    const result = toAppStory(base);
    expect(result.id).toBe('story-1');
    expect(result.chapterTitle).toBe('');
    expect(result.description).toBe('');
    expect(result.location).toBe('');
    expect(result.isPublic).toBe(false);
    expect(result.witnessedCount).toBe(0);
    expect(result.savedCount).toBe(0);
    expect(result.stickerCount).toBe(0);
    expect(result.panels).toEqual([]);
    expect(result.pages).toBeUndefined();
  });

  it('converts a Date object date to ISO string', () => {
    const d = new Date('2024-06-01T00:00:00.000Z');
    const result = toAppStory({ ...base, date: d });
    expect(result.date).toBe(d.toISOString());
  });

  it('prefers chapterTitle over chapter_title (snake_case)', () => {
    const result = toAppStory({ ...base, chapterTitle: 'A', chapter_title: 'B' });
    expect(result.chapterTitle).toBe('A');
  });

  it('falls back to chapter_title when chapterTitle is absent', () => {
    const result = toAppStory({ ...base, chapter_title: 'Chapter One' });
    expect(result.chapterTitle).toBe('Chapter One');
  });

  it('prefers isPublic over is_public', () => {
    const result = toAppStory({ ...base, isPublic: true, is_public: false });
    expect(result.isPublic).toBe(true);
  });

  it('prefers witnessedCount over witnessed_count', () => {
    const result = toAppStory({ ...base, witnessedCount: 10, witnessed_count: 1 });
    expect(result.witnessedCount).toBe(10);
  });

  it('falls back to witnessed_count', () => {
    const result = toAppStory({ ...base, witnessed_count: 7 });
    expect(result.witnessedCount).toBe(7);
  });

  it('prefers savedCount over saved_count', () => {
    const result = toAppStory({ ...base, savedCount: 3, saved_count: 1 });
    expect(result.savedCount).toBe(3);
  });

  it('falls back to saved_count', () => {
    const result = toAppStory({ ...base, saved_count: 4 });
    expect(result.savedCount).toBe(4);
  });

  it('prefers pageLayoutKey over page_layout_key', () => {
    const result = toAppStory({ ...base, pageLayoutKey: 'a', page_layout_key: 'b' });
    expect(result.pageLayoutKey).toBe('a');
  });

  it('falls back to page_layout_key', () => {
    const result = toAppStory({ ...base, page_layout_key: 'grid' });
    expect(result.pageLayoutKey).toBe('grid');
  });

  it('maps panels with missing fields to safe defaults', () => {
    const result = toAppStory({ ...base, panels: [{}] });
    expect(result.panels[0].id).toBe('');
    expect(result.panels[0].text).toBe('');
    expect(result.panels[0].imageUri).toBeUndefined();
  });

  it('returns empty panels array when panels is null/absent', () => {
    expect(toAppStory({ ...base, panels: null as any }).panels).toEqual([]);
    expect(toAppStory(base).panels).toEqual([]);
  });

  it('maps pages array when present', () => {
    const pages = [{ id: 'pg1', layoutKey: 'lk', panels: [] }];
    const result = toAppStory({ ...base, pages });
    expect(result.pages).toEqual(pages);
  });
});

// ── toAppOutfit ───────────────────────────────────────────────────────────────

describe('toAppOutfit', () => {
  const base = {
    id:   'outfit-1',
    date: '2024-03-15T10:00:00.000Z',
    name: 'Dreamer Set',
  };

  it('maps a full payload', () => {
    const raw = {
      ...base,
      description: 'Flowing robes',
      story:       'Found at the dawn shrine.',
      imageUri:    'https://example.com/outfit.jpg',
      tags:        ['cozy', 'starlight'],
      isPublic:    true,
    };
    const result = toAppOutfit(raw);
    expect(result.id).toBe('outfit-1');
    expect(result.name).toBe('Dreamer Set');
    expect(result.description).toBe('Flowing robes');
    expect(result.story).toBe('Found at the dawn shrine.');
    expect(result.imageUri).toBe('https://example.com/outfit.jpg');
    expect(result.tags).toEqual(['cozy', 'starlight']);
    expect(result.isPublic).toBe(true);
  });

  it('maps a minimal payload (only id, date, name)', () => {
    const result = toAppOutfit(base);
    expect(result.description).toBe('');
    expect(result.story).toBe('');
    expect(result.imageUri).toBeUndefined();
    expect(result.tags).toEqual([]);
    expect(result.isPublic).toBe(false);
  });

  it('converts a Date object date to ISO string', () => {
    const d = new Date('2024-06-01T00:00:00.000Z');
    const result = toAppOutfit({ ...base, date: d });
    expect(result.date).toBe(d.toISOString());
  });

  it('prefers imageUri (camelCase) over image_uri (snake_case)', () => {
    const result = toAppOutfit({
      ...base,
      imageUri:  'https://cdn.example.com/a.jpg',
      image_uri: '/api/images/b.jpg',
    });
    expect(result.imageUri).toBe('https://cdn.example.com/a.jpg');
  });

  it('resolves relative image_uri to absolute path', () => {
    const result = toAppOutfit({ ...base, image_uri: '/api/images/outfit.jpg' });
    expect(result.imageUri).toContain('/api/images/outfit.jpg');
  });

  it('prefers isPublic over is_public', () => {
    const result = toAppOutfit({ ...base, isPublic: true, is_public: false });
    expect(result.isPublic).toBe(true);
  });

  it('falls back to is_public', () => {
    const result = toAppOutfit({ ...base, is_public: true });
    expect(result.isPublic).toBe(true);
  });

  it('returns empty tags array when tags is null/absent', () => {
    expect(toAppOutfit(base).tags).toEqual([]);
    expect(toAppOutfit({ ...base, tags: null }).tags).toEqual([]);
  });

  it('returns undefined imageUri when both imageUri and image_uri are null', () => {
    const result = toAppOutfit({ ...base, imageUri: null, image_uri: null });
    expect(result.imageUri).toBeUndefined();
  });
});

// ── toRawDiscoverPost ─────────────────────────────────────────────────────────

describe('toRawDiscoverPost', () => {
  const NOW_ISO = new Date().toISOString();

  const base = {
    id:       'post-1',
    date:     '2024-03-15T10:00:00.000Z',
  };

  it('maps a full payload', () => {
    const raw = {
      id:               'post-1',
      authorUserId:     'user-42',
      authorName:       'Luna',
      authorUsername:   'luna_sky',
      authorAvatarUri:  'https://cdn.example.com/avatar.jpg',
      chapterTitle:     'The Forgotten Isle',
      storySnippet:     'She walked...',
      imageUri:         'https://cdn.example.com/cover.jpg',
      mood:             'Peaceful',
      witnessedCount:   8,
      savedCount:       3,
      stickerCount:     1,
      date:             '2024-03-15T10:00:00.000Z',
      chapterNumber:    2,
      panels: [
        { text: 'Opening scene', imageUri: 'https://cdn.example.com/p1.jpg' },
      ],
    };
    const result = toRawDiscoverPost(raw);
    expect(result.id).toBe('post-1');
    expect(result.authorUserId).toBe('user-42');
    expect(result.authorName).toBe('Luna');
    expect(result.authorHandle).toBe('@luna_sky');
    expect(result.authorAvatarUri).toBe('https://cdn.example.com/avatar.jpg');
    expect(result.chapterTitle).toBe('The Forgotten Isle');
    expect(result.storySnippet).toBe('She walked...');
    expect(result.imageUri).toBe('https://cdn.example.com/cover.jpg');
    expect(result.mood).toBe('Peaceful');
    expect(result.witnessedCount).toBe(8);
    expect(result.savedCount).toBe(3);
    expect(result.stickerCount).toBe(1);
    expect(result.chapterNumber).toBe(2);
    expect(result.vibe).toBe('Peaceful');
    expect(result.panels).toHaveLength(1);
    expect(result.panels![0].text).toBe('Opening scene');
    expect(result.panels![0].imageUri).toBe('https://cdn.example.com/p1.jpg');
  });

  it('maps a minimal payload with safe defaults', () => {
    const result = toRawDiscoverPost({ id: 'post-1' });
    expect(result.id).toBe('post-1');
    expect(result.authorUserId).toBe('');
    expect(result.authorName).toBe('Sky Child');
    expect(result.chapterTitle).toBe('');
    expect(result.storySnippet).toBe('');
    expect(result.mood).toBe('Hopeful');
    expect(result.vibe).toBe('Hopeful');
    expect(result.witnessedCount).toBe(0);
    expect(result.savedCount).toBe(0);
    expect(result.stickerCount).toBe(0);
    expect(result.chapterNumber).toBe(1);
    expect(result.panels).toEqual([]);
    expect(result.authorAvatarUri).toBeNull();
    expect(result.imageUri).toBeUndefined();
  });

  it('derives authorHandle from authorUsername when present', () => {
    const result = toRawDiscoverPost({ id: 'p1', authorUsername: 'sky_walker' });
    expect(result.authorHandle).toBe('@sky_walker');
  });

  it('derives authorHandle from authorName when authorUsername is absent', () => {
    const result = toRawDiscoverPost({ id: 'p1', authorName: 'Sky Walker' });
    expect(result.authorHandle).toBe('@skywalker');
  });

  it('falls back to createdAt when date is absent', () => {
    const raw = { id: 'p1', createdAt: '2024-01-01T00:00:00.000Z' };
    const result = toRawDiscoverPost(raw);
    expect(result.date).toBe('2024-01-01T00:00:00.000Z');
  });

  it('prefers date over createdAt', () => {
    const raw = { id: 'p1', date: '2024-03-01T00:00:00.000Z', createdAt: '2024-01-01T00:00:00.000Z' };
    const result = toRawDiscoverPost(raw);
    expect(result.date).toBe('2024-03-01T00:00:00.000Z');
  });

  it('maps panels with missing fields to safe defaults', () => {
    const result = toRawDiscoverPost({ id: 'p1', panels: [{}] });
    expect(result.panels![0].text).toBe('');
    expect(result.panels![0].imageUri).toBeUndefined();
    expect(result.panels![0].overlays).toBeUndefined();
  });

  it('resolves relative authorAvatarUri to absolute path', () => {
    const result = toRawDiscoverPost({ id: 'p1', authorAvatarUri: '/api/images/av.jpg' }, '/api');
    expect(result.authorAvatarUri).toContain('/api/images/av.jpg');
  });

  it('sets authorAvatarUri to null when absent', () => {
    const result = toRawDiscoverPost({ id: 'p1' });
    expect(result.authorAvatarUri).toBeNull();
  });

  it('maps pages array when present', () => {
    const pages = [{ id: 'pg1', layoutKey: 'lk', panels: [] }];
    const result = toRawDiscoverPost({ id: 'p1', pages });
    expect(result.pages).toEqual(pages);
  });
});
