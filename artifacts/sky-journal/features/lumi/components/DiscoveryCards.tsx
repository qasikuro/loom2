import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { apiFetch, useApp, resolveUri } from '@/context/AppContext';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { AudiusTrack, AudiusTrackPlayer } from '@/features/story-studio/components/AudiusMusicPicker';
import { useLumiMusic } from '../music/LumiMusicProvider';

type C = ReturnType<typeof useColors>;

function useLoader<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    loadRef.current()
      .then(d => { if (alive) setData(d); })
      .catch(() => { if (alive) setError(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { data, error, loading, retry: () => setNonce(n => n + 1) };
}

export function Skeleton({ c, rows = 2 }: { c: C; rows?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[s.skel, { backgroundColor: c.muted }]} />
      ))}
    </View>
  );
}

export function InlineState({ c, text, onRetry }: { c: C; text: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.state}>
      <Text style={[s.stateText, { color: c.mutedForeground }]}>{text}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={[s.ghostBtn, { borderColor: c.border }]} accessibilityRole="button">
          <Icon name="refresh-cw" size={12} color={c.tint} />
          <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.retry', 'Try again')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function fmt(sec: number) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

export function MusicDiscovery({ query }: { query: string }) {
  const c = useColors();
  const { t } = useTranslation();
  const music = useLumiMusic();
  const preview = { playingId: music.playingId, toggle: music.toggle };
  const { data, error, loading, retry } = useLoader(
    async () => {
      const r = await apiFetch<{ tracks: AudiusTrack[] }>(`/music/search?q=${encodeURIComponent(query)}`);
      return (r.tracks ?? []).filter(tr => tr.duration > 0 && tr.duration <= 3600).slice(0, 3);
    },
    [query],
  );
  const row = (tr: AudiusTrack) => (
    <View key={tr.id} style={[s.row, { borderColor: c.border, backgroundColor: c.background }]}>
      {tr.artworkUrl
        ? <Image source={{ uri: tr.artworkUrl }} style={s.art} />
        : <View style={[s.art, { backgroundColor: c.glowPurple, alignItems: 'center', justifyContent: 'center' }]}><Icon name="volume-2" size={16} color={c.tint} /></View>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.rowTitle, { color: c.foreground }]} numberOfLines={1}>{tr.title}</Text>
        <Text style={[s.rowSub, { color: music.errorId === tr.id ? c.destructive : c.mutedForeground }]} numberOfLines={1}>
          {music.errorId === tr.id ? t('lumi.music.failed', 'Could not play this track') : `${tr.artist} · ${fmt(tr.duration)}${tr.genre ? ` · ${tr.genre}` : ''}`}
        </Text>
      </View>
      <TouchableOpacity onPress={() => music.toggleFavorite(tr)} hitSlop={8}
        accessibilityLabel={music.isFavorite(tr.id) ? t('lumi.music.unfav', 'Remove from saved tracks') : t('lumi.music.fav', 'Save track')}>
        <Icon name="heart" size={15} color={music.isFavorite(tr.id) ? c.gold : c.mutedForeground} />
      </TouchableOpacity>
      <AudiusTrackPlayer track={tr} compact preview={preview} />
    </View>
  );
  const favs = music.favorites.slice(0, 3);
  const favBlock = favs.length > 0 && (
    <View style={{ gap: 8, marginBottom: 6 }}>
      <Text style={[s.attrib, { color: c.mutedForeground }]}>{t('lumi.music.saved', 'Your saved tracks')}</Text>
      {favs.map(row)}
    </View>
  );
  if (loading) return <View>{favBlock}<Skeleton c={c} rows={3} /></View>;
  if (error) return <InlineState c={c} text={t('lumi.musicError', 'Music search is not available right now.')} onRetry={retry} />;
  if (!data?.length) return <InlineState c={c} text={t('lumi.musicEmpty', 'No tracks matched that. Try another mood.')} />;
  return (
    <View style={{ gap: 8 }}>
      {favBlock}
      {data.filter(tr => !favs.some(f => f.id === tr.id)).map(row)}
      <Text style={[s.attrib, { color: c.mutedForeground }]}>{t('lumi.audius', 'Streams from Audius. Keeps playing in Lumi, journal and creators; stops anywhere else.')}</Text>
    </View>
  );
}

interface GuideResult {
  userId: string; name: string; username: string | null; guideBio: string; bio: string;
  guideTopics: string[]; isAvailableNow?: boolean; avatarUri?: string | null; peaceRating?: number;
}

export function GuidesDiscovery({ query }: { query?: string }) {
  const c = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { data, error, loading, retry } = useLoader(async () => {
    const all = await apiFetch<GuideResult[]>('/guides?');
    const q = (query ?? '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = (all ?? []).map(g => {
      const hay = `${g.guideTopics.join(' ')} ${g.guideBio} ${g.bio}`.toLowerCase();
      return { g, score: q.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) + (g.isAvailableNow ? 0.5 : 0) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map(x => x.g);
  }, [query]);
  if (loading) return <Skeleton c={c} rows={2} />;
  if (error) return <InlineState c={c} text={t('lumi.guidesError', 'Could not load mentor guides.')} onRetry={retry} />;
  if (!data?.length) return <InlineState c={c} text={t('lumi.guidesEmpty', 'No mentor guides are listed yet.')} />;
  return (
    <View style={{ gap: 8 }}>
      {data.map(g => (
        <TouchableOpacity key={g.userId} onPress={() => router.push(`/guide/${g.userId}` as never)}
          style={[s.row, { borderColor: c.border, backgroundColor: c.background }]} accessibilityRole="button">
          <Avatar c={c} name={g.name} uri={g.avatarUri} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.rowTitle, { color: c.foreground }]} numberOfLines={1}>{g.name}</Text>
            <Text style={[s.rowSub, { color: c.mutedForeground }]} numberOfLines={1}>
              {g.guideTopics.slice(0, 3).join(' · ') || g.guideBio}
            </Text>
          </View>
          {g.isAvailableNow && <View style={[s.dot, { backgroundColor: c.gold }]} />}
          <Icon name="chevron-right" size={16} color={c.mutedForeground} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Avatar({ c, name, uri }: { c: C; name: string; uri?: string | null }) {
  const src = uri ? resolveUri(uri) : undefined;
  if (src) return <Image source={{ uri: src }} style={s.avatar} />;
  return (
    <View style={[s.avatar, { backgroundColor: c.glowPurple, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: c.tint, fontFamily: 'Satoshi-Bold', fontSize: 13 }}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function FriendsDiscovery({ draft }: { draft?: string }) {
  const c = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { friends } = useApp();
  const list = useMemo(
    () => [...friends].sort((a, b) => Number(!!b.isOnline) - Number(!!a.isOnline)).slice(0, 4),
    [friends],
  );
  if (!list.length) {
    return (
      <View style={s.state}>
        <Text style={[s.stateText, { color: c.mutedForeground }]}>{t('lumi.friendsEmpty', 'Your friends list is empty for now.')}</Text>
        <TouchableOpacity onPress={() => router.push('/friends' as never)} style={[s.ghostBtn, { borderColor: c.border }]}>
          <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.openFriends', 'Open friends')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {!!draft && (
        <Text style={[s.draft, { color: c.text, borderColor: c.border }]}>
          {t('lumi.draftIdea', 'Idea to say')}: “{draft}”
        </Text>
      )}
      {list.map(f => (
        <TouchableOpacity key={f.userId}
          onPress={() => router.push({ pathname: '/messages/[userId]', params: { userId: f.userId, name: f.name, handle: f.username ?? '' } } as never)}
          style={[s.row, { borderColor: c.border, backgroundColor: c.background }]} accessibilityRole="button">
          <Avatar c={c} name={f.name} uri={f.avatarUri} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.rowTitle, { color: c.foreground }]} numberOfLines={1}>{f.name}</Text>
            <Text style={[s.rowSub, { color: c.mutedForeground }]} numberOfLines={1}>
              {f.isOnline ? t('lumi.online', 'Online now') : (f.mood || f.bio || t('lumi.openChat', 'Open chat'))}
            </Text>
          </View>
          <Icon name="message-circle" size={16} color={c.tint} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface CampfireRoom {
  id: string; name: string; mood: string; soulCount: number;
  lastMessage: { authorName: string; content: string | null; createdAt: string } | null;
}

export function CampfireDiscovery({ query }: { query?: string }) {
  const c = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, retry } = useLoader(async () => {
    const rooms = await apiFetch<CampfireRoom[]>('/campfire');
    const q = (query ?? '').toLowerCase();
    const sorted = [...(rooms ?? [])].sort((a, b) => {
      const ma = q && `${a.name} ${a.mood}`.toLowerCase().includes(q) ? 1 : 0;
      const mb = q && `${b.name} ${b.mood}`.toLowerCase().includes(q) ? 1 : 0;
      return mb - ma || b.soulCount - a.soulCount;
    });
    return sorted.slice(0, 3);
  }, [query]);
  if (loading) return <Skeleton c={c} rows={2} />;
  if (error) return <InlineState c={c} text={t('lumi.campError', 'Could not load campfires.')} onRetry={retry} />;
  if (!data?.length) return <InlineState c={c} text={t('lumi.campEmpty', 'No campfires are open right now.')} />;
  return (
    <View style={{ gap: 8 }}>
      {data.map(r => {
        const expanded = open === r.id;
        return (
          <View key={r.id} style={[s.rowCol, { borderColor: expanded ? c.tint : c.border, backgroundColor: c.background }]}>
            <TouchableOpacity onPress={() => setOpen(expanded ? null : r.id)} style={s.rowInner} accessibilityRole="button">
              <View style={[s.avatar, { backgroundColor: c.glowGold, alignItems: 'center', justifyContent: 'center' }]}>
                <Icon name="sunrise" size={16} color={c.gold} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.rowTitle, { color: c.foreground }]} numberOfLines={1}>{r.name}</Text>
                <Text style={[s.rowSub, { color: c.mutedForeground }]} numberOfLines={1}>
                  {r.mood} · {t('lumi.souls', '{{n}} here', { n: r.soulCount })}
                </Text>
              </View>
              <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={16} color={c.mutedForeground} />
            </TouchableOpacity>
            {expanded && (
              <View style={{ gap: 8, paddingTop: 8 }}>
                <Text style={[s.rowSub, { color: c.text }]} numberOfLines={3}>
                  {r.lastMessage?.content
                    ? `${r.lastMessage.authorName}: ${r.lastMessage.content}`
                    : t('lumi.campQuiet', 'Quiet so far. You could be the first to say hi.')}
                </Text>
                <TouchableOpacity onPress={() => router.push(`/campfire/${r.id}` as never)}
                  style={[s.solidBtn, { backgroundColor: c.secondary }]} accessibilityRole="button">
                  <Text style={[s.solidText, { color: c.secondaryForeground }]}>{t('lumi.enterRoom', 'Enter this room')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  skel: { height: 48, borderRadius: 12 },
  state: { gap: 8, alignItems: 'flex-start', paddingVertical: 4 },
  stateText: { fontFamily: 'Satoshi-Regular', fontSize: 12.5 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  ghostText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 8 },
  rowCol: { borderWidth: 1, borderRadius: 14, padding: 8 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  art: { width: 40, height: 40, borderRadius: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  rowTitle: { fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  rowSub: { fontFamily: 'Satoshi-Regular', fontSize: 11.5, marginTop: 1 },
  attrib: { fontFamily: 'Satoshi-Regular', fontSize: 10.5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  draft: { fontFamily: 'Satoshi-Regular', fontSize: 12, borderLeftWidth: 2, paddingLeft: 8 },
  solidBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  solidText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
});
