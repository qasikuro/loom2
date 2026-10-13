import { Icon } from '@/components/Icon';
import type { FriendSummary } from '@/context/AppContext';
import type { DiscoverPost } from '@/context/mappers';
import { getResumableStoryDraft, type ResumableStoryDraft } from '@/utils/entryDraftStore';
import { SecureImage as Image } from '@/components/SecureImage';
import {
  FriendOutfitsRow, FriendsRow, HeroAmbience, HERO_INK, NewStoryCard, SectionHeader, WhatsNewCarousel,
  useAmbientState, useHomeInk, type HomeAnnouncement,
} from '@/components/home/HomeSections';
import { useFriendOutfits, type FriendOutfit } from '@/hooks/useFriendOutfits';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

type FocusedHomeContentProps = {
  greeting: string;
  characterName: string;
  characterImage: ImageSourcePropType;
  accent: string;
  hasNotifications: boolean;
  onOpenNotifications: () => void;
  onLongPressAvatar?: () => void;
  friends: FriendSummary[];
  friendStories: DiscoverPost[];
  friendCount: number;
  /** Signed-in user id: scopes the outfit cache to this account. */
  viewerId: string | null | undefined;
  announcements: HomeAnnouncement[];
  /** Living Lumi hero; receives the budgeted hero height. */
  renderCompanion?: (heroHeight: number) => React.ReactNode;
  /** Top safe-area padding — the hero art bleeds behind it. */
  topInset: number;
};

// Conservative layout allowance; text and native safe areas vary by device.
// Keep scrolling available rather than clipping content or shrinking tap targets.
const FIXED = 474;
const FIXED_COMPACT = 446;
const TAB_FOOTPRINT = 96;
const clamp = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, v)));
function useHomeLayout(topInset: number) {
  const { height, fontScale } = useWindowDimensions();
  return useMemo(() => {
    // Large text: roomy sizes; the parent ScrollView provides the fallback.
    if (fontScale > 1.15) return { compact: false, lumi: 168, avatar: 58, outfit: 136 };
    const avail = (height - topInset - TAB_FOOTPRINT) / Math.max(1, fontScale);
    const roomyFlex = avail - FIXED;
    const compact = roomyFlex < 240;
    const flex = compact ? avail - FIXED_COMPACT : roomyFlex;
    const avatar = clamp(flex * 0.18, 44, 58);
    const rest = flex - avatar;
    return {
      compact, avatar,
      lumi: clamp(rest * 0.56, 124, 176),
      outfit: clamp(rest * 0.44, compact ? 74 : 84, 140),
    };
  }, [height, fontScale, topInset]);
}

export function FocusedHomeContent(p: FocusedHomeContentProps) {
  const { reduced, foreground } = useAmbientState();
  const ink = useHomeInk();
  const layout = useHomeLayout(p.topInset);
  const [resumeDraft, setResumeDraft] = useState<ResumableStoryDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [focused, setFocused] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setFocused(true);
    setDraftReady(false);
    getResumableStoryDraft()
      .then(d => { if (active) { setResumeDraft(d); setDraftReady(true); } })
      .catch(() => { if (active) { setResumeDraft(null); setDraftReady(true); } });
    return () => { active = false; setFocused(false); };
  }, []));

  const go = (path: string | object) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(path as never);
  };

  // Activity labels only for genuinely recent posts (7 days); recent creators lead the row.
  const { activityByUser, orderedFriends } = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    const map: Record<string, string> = {};
    const latest: Record<string, number> = {};
    p.friendStories.forEach(post => {
      const ts = new Date(post.date).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) return;
      if (!latest[post.authorUserId] || ts > latest[post.authorUserId]!) {
        latest[post.authorUserId] = ts;
        map[post.authorUserId] = post.contentType === 'video' ? 'New video' : 'New story';
      }
    });
    const ordered = [...p.friends].sort((a, b) =>
      (latest[b.userId] ?? 0) - (latest[a.userId] ?? 0) || Number(!!b.isOnline) - Number(!!a.isOnline));
    return { activityByUser: map, orderedFriends: ordered };
  }, [p.friendStories, p.friends]);

  const outfitsQ = useFriendOutfits(p.viewerId, orderedFriends);

  const openOutfit = (it: FriendOutfit) => {
    const all = it.authorOutfits.map(o => ({ id: o.id, name: o.name, description: o.description, story: o.story, imageUri: o.imageUri ?? '', tags: o.tags, music: o.music ?? null, date: o.date }));
    go({
      pathname: '/user-outfit',
      params: {
        outfitName: it.outfit.name, outfitId: it.outfit.id,
        outfitDesc: it.outfit.description ?? '', outfitStory: it.outfit.story ?? '',
        outfitImage: it.outfit.imageUri ?? '', outfitTags: JSON.stringify(it.outfit.tags ?? []),
        outfitMusic: it.outfit.music ? JSON.stringify(it.outfit.music) : '', outfitDate: it.outfit.date,
        authorUserId: it.author.userId, authorName: it.author.name, authorHandle: it.author.username ?? '',
        authorBio: it.author.bio ?? '', authorAvatarUri: it.author.avatarUri ?? '', authorIsSelf: 'false',
        authorMood: it.author.mood ?? '', authorTraits: JSON.stringify(it.author.traits ?? []),
        allOutfitsJson: JSON.stringify(all),
        initialIndex: String(Math.max(0, it.authorOutfits.findIndex(o => o.id === it.outfit.id))),
      },
    });
  };

  return (
    <View style={[s.content, { backgroundColor: ink.bg }]}>
      <View style={[s.hero, { paddingTop: p.topInset }]}>
        <Image
          source={require('@/features/lumi/home/lumi-castle-night.jpg')}
          style={[StyleSheet.absoluteFill, { opacity: 0.95 }]}
          contentFit="cover"
          contentPosition={{ top: 0, right: 0 }}
          accessible={false}
        />
        <LinearGradient
          colors={['rgba(14,8,40,0.5)', 'rgba(14,8,40,0.04)', 'rgba(16,10,40,0.28)', ink.bg]}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <HeroAmbience active={focused && foreground} reduced={reduced} />
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.brandRow}>
              <Icon name="star" size={12} color={HERO_INK.eyebrow} />
              <Text style={s.brand}>Storigam</Text>
            </View>
            <Text style={s.greeting} numberOfLines={1}>{p.greeting},</Text>
            <View style={s.brandRow}>
              <Text style={[s.name, { color: HERO_INK.cyan, flexShrink: 1 }]} numberOfLines={1}>{p.characterName}</Text>
              <Icon name="star" size={13} color={HERO_INK.cyan} />
            </View>
            {!layout.compact && <Text style={s.sub} numberOfLines={1}>Another beautiful day to create</Text>}
          </View>
          <TouchableOpacity testID="home-notifications" accessibilityRole="button" accessibilityLabel="Notifications"
            onPress={() => { p.onOpenNotifications(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
            style={s.bell} activeOpacity={0.8}>
            <Icon name="bell" size={18} color={HERO_INK.title} />
            {p.hasNotifications && <View style={s.dot} />}
          </TouchableOpacity>
          <TouchableOpacity testID="home-character-avatar" accessibilityRole="button" accessibilityLabel="Open your character profile"
            onPress={() => go('/(tabs)/profile')} onLongPress={p.onLongPressAvatar}
            style={[s.avatar, { borderColor: p.accent }]} activeOpacity={0.82}>
            <Image source={p.characterImage} style={StyleSheet.absoluteFill} contentFit="cover" />
          </TouchableOpacity>
        </View>
        <View style={s.companion}>{p.renderCompanion?.(layout.lumi)}</View>
      </View>

      <View style={[s.body, layout.compact && { gap: 4, marginTop: 0 }]}>
        <View style={s.section}>
          <SectionHeader title="FRIENDS" onSeeAll={() => go('/friends')} />
          <FriendsRow
            friends={orderedFriends.slice(0, 12)}
            avatarSize={layout.avatar}
            activityByUser={activityByUser}
            onAdd={() => go({ pathname: '/friends', params: { tab: 'suggestions' } })}
            onOpen={userId => go({ pathname: '/user/[userId]', params: { userId } })}
          />
        </View>

        <View style={s.section}>
          <SectionHeader title="NEW OUTFITS FROM FRIENDS" />
          <FriendOutfitsRow
            items={outfitsQ.data ?? []}
            loading={!!p.viewerId && orderedFriends.length > 0 && outfitsQ.isLoading}
            error={outfitsQ.isError}
            hasFriends={orderedFriends.length > 0}
            onRetry={() => { outfitsQ.refetch(); }}
            onOpen={openOutfit}
            onFind={() => go('/friends')}
            cardHeight={layout.outfit}
          />
        </View>

        <NewStoryCard
          active={focused}
          ready={draftReady}
          resumeTitle={resumeDraft?.title ?? null}
          onNew={() => go('/(tabs)/create')}
          onResume={() => resumeDraft && go(resumeDraft.kind === 'manga' ? '/quick-moment?resumeDraft=1' : '/chapter-editor?resumeDraft=1')}
        />

        <View style={s.section}>
          <SectionHeader title="WHAT'S NEW" />
          <WhatsNewCarousel items={p.announcements} active={focused} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 12 },
  hero: { paddingHorizontal: 16, paddingBottom: 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brand: { color: HERO_INK.eyebrow, fontFamily: 'Satoshi-Bold', fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  greeting: { color: HERO_INK.title, fontFamily: 'Satoshi-Medium', fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  sub: { color: HERO_INK.sub, fontFamily: 'Satoshi-Medium', fontSize: 11.5, lineHeight: 15, marginTop: 1 },
  name: { fontFamily: 'Satoshi-Black', fontSize: 22, lineHeight: 25, letterSpacing: -0.5 },
  bell: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,10,44,0.7)', borderWidth: 1, borderColor: HERO_INK.border },
  dot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5C8A' },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, overflow: 'hidden' },
  companion: { marginTop: 2 },
  body: { paddingHorizontal: 16, gap: 8, marginTop: 4 },
  section: { gap: 4 },
});
