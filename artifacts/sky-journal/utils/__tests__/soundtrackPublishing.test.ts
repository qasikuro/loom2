import { describe, expect, it, vi } from 'vitest';
import { calculateMusicSegment } from '../videoEditing';
import { toAppOutfit, toAppStory } from '../../context/mappers';
import { callable, evaluate, flush } from './helpers/soundtrackHarness';

const track = {
  id: 'track-a', title: 'Starlight', artist: 'Test artist',
  streamUrl: 'https://discovery.example.test/v1/tracks/a/stream',
  duration: 180, artworkUrl: null, genre: 'Ambient', mood: 'Peaceful',
};
const noop = () => {};
const haptics = {
  impactAsync: noop, notificationAsync: noop,
  ImpactFeedbackStyle: { Medium: 'medium' }, NotificationFeedbackType: { Success: 'success' },
};
const mangaPath = 'features/story-studio/screens/MangaStoryScreen.tsx';

function mangaEnv(music: typeof track | null) {
  return {
    generatedStorageUri: 'https://images.example.test/manga.png',
    generatedImageUri: 'https://images.example.test/manga.png',
    prompt: 'A moonlit journey', DEFAULT_PROMPT: 'Default',
    selectedStyle: { label: 'Watercolour' }, music,
    savedStoryId: null, lifecycleBusy: null, posting: false, posted: false,
    setLifecycleBusy: vi.fn(), setPosting: vi.fn(), setError: vi.fn(),
    setSavedStoryId: vi.fn(), setPosted: vi.fn(),
    Crypto: { randomUUID: () => 'new-manga' }, Haptics: haptics,
    addStory: vi.fn().mockResolvedValue(true),
    apiFetch: vi.fn().mockResolvedValue({}), reloadData: vi.fn().mockResolvedValue(undefined),
    t: (key: string) => key,
  };
}

describe('soundtracks survive creator publishing journeys', () => {
  it.each([track, null])('video composition and published post retain selected music: %j', async music => {
    const apiFetch = vi.fn().mockResolvedValue({});
    const composeVideo = vi.fn().mockReturnValue({ promise: Promise.resolve({ compositionId: 'composed-video' }) });
    const setStep = vi.fn();
    const publish = evaluate(callable('app/post-video.tsx', 'handlePublish'), {
      metadata: { uri: 'file:///clip.mp4', mimeType: 'video/mp4', fileName: 'clip.mp4' },
      editorValue: { trim: { startSeconds: 1, endSeconds: 21 }, music, musicStartSeconds: 12, originalVolume: 0.2, musicVolume: 0.7 },
      title: ' My video ', mood: 'Creative', calculateMusicSegment, composeVideo,
      apiFetch, composeRef: { current: null }, setStep,
      setError: noop, setProgress: noop, Haptics: haptics,
      refreshFeed: vi.fn().mockResolvedValue(undefined),
      router: { replace: vi.fn() }, setTimeout: vi.fn(), t: (key: string) => key,
    });
    await publish();
    expect(composeVideo).toHaveBeenCalledWith(expect.objectContaining({
      music, musicStartSeconds: music ? 12 : 0, originalVolume: 0.2, musicVolume: 0.7,
    }));
    const body = JSON.parse(apiFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({ chapterTitle: 'My video', compositionId: 'composed-video', contentType: 'video' });
    expect(body.music).toEqual(music ? {
      ...track, embedded: true, segmentStartSeconds: 12, segmentDurationSeconds: 20,
      originalVolume: 0.2, musicVolume: 0.7,
    } : null);
    expect(setStep).toHaveBeenLastCalledWith('done');
  });

  it('never posts video soundtrack metadata if composition fails', async () => {
    const apiFetch = vi.fn(), setError = vi.fn(), setStep = vi.fn();
    const publish = evaluate(callable('app/post-video.tsx', 'handlePublish'), {
      metadata: { uri: 'file:///clip.mp4' },
      editorValue: { trim: { startSeconds: 0, endSeconds: 20 }, music: track },
      title: 'Video', mood: 'Creative', calculateMusicSegment,
      composeVideo: () => ({ promise: Promise.reject(new Error('Mix failed')) }),
      apiFetch, composeRef: { current: null }, setStep, setError, setProgress: noop,
      Haptics: haptics, t: (key: string) => key,
    });
    await publish();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Mix failed');
    expect(setStep).toHaveBeenLastCalledWith('editing');
  });

  it.each(['saveManga', 'postManga'])('AI manga %s sends the chosen track with the generated story', async action => {
    const env = mangaEnv(track);
    const buildMangaStory = evaluate(callable(mangaPath, 'buildMangaStory'), env);
    await evaluate(callable(mangaPath, action), { ...env, buildMangaStory })();
    expect(env.addStory).toHaveBeenCalledWith(expect.objectContaining({
      music: track, isPublic: action === 'postManga',
    }));
    const story = env.addStory.mock.calls[0][0];
    expect(toAppStory({ ...story, date: story.date }).music).toEqual(track);
  });

  it.each([track, null])('publishing a saved manga persists a changed or removed soundtrack: %j', async music => {
    const env = { ...mangaEnv(music), savedStoryId: 'saved-manga' };
    await evaluate(callable(mangaPath, 'postManga'), env)();
    expect(env.apiFetch).toHaveBeenCalledWith('/stories/saved-manga', {
      method: 'PATCH', body: JSON.stringify({ isPublic: true, music }),
    });
    expect(env.addStory).not.toHaveBeenCalled();
    expect(env.reloadData).toHaveBeenCalledOnce();
  });

  it.each([
    { isEditing: false, music: track },
    { isEditing: true, music: { ...track, id: 'track-b' } },
    { isEditing: true, music: null },
  ])('outfit create/edit/remove passes explicit music to the persistence layer: %j', async ({ isEditing, music }) => {
    const requests: { path: string; body: any }[] = [];
    let outfits: any[] = [{ id: 'outfit-a', music: track }];
    const persistEnv = {
      useCallback: (cb: unknown) => cb,
      apiFetch: vi.fn((path: string, opts: RequestInit) => {
        requests.push({ path, body: JSON.parse(String(opts.body)) });
        return Promise.resolve({});
      }),
      setOutfits: (update: (prev: any[]) => any[]) => { outfits = update(outfits); },
      stateRef: { current: { outfits } }, writeOutfitCache: vi.fn(),
      writeAccountTimestamps: vi.fn().mockResolvedValue(undefined),
      clearMutation: vi.fn().mockResolvedValue(undefined),
      reloadConstellation: vi.fn().mockResolvedValue(undefined),
      publishLumiCreation: noop, userId: 'creator',
    };
    const save = evaluate(callable('app/create-outfit.tsx', 'handleSave'), {
      uploading: false, name: ' Star cape ', imageUri: 'https://images.example.test/cape.png',
      description: '', story: '', selectedTags: [], selectedVibe: null, isPublic: true,
      music, isEditing, editId: 'outfit-a', crypto: { randomUUID: () => 'outfit-new' },
      setError: noop, setSaving: noop, Haptics: haptics, markSaved: noop, safeBack: noop,
      addOutfit: evaluate(callable('context/AppContext.tsx', 'addOutfit'), persistEnv),
      updateOutfit: evaluate(callable('context/AppContext.tsx', 'updateOutfit'), persistEnv),
    });
    save();
    await flush();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      path: isEditing ? '/outfits/outfit-a' : '/outfits',
      body: { music, name: 'Star cape' },
    });
    const saved = outfits.find(o => o.id === (isEditing ? 'outfit-a' : 'outfit-new'));
    expect(saved.music).toEqual(music);
    expect(toAppOutfit({ ...saved, date: new Date().toISOString() }).music).toEqual(music);
  });
});
