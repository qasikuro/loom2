import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { ShareButton } from '@/components/ShareButton';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { SecureImage } from '@/components/SecureImage';
import { TutorialStepper } from '@/components/guide-session/TutorialStepper';
import { Initials, Notice, PillButton, SectionCard, gs } from '@/components/guide-session/shared';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useGuideTutorialBookmarks } from '@/hooks/useGuideTutorialBookmarks';
import { shareContent } from '@/utils/shareContent';
import { useAuth } from '@clerk/expo';
import { getGetGuideTutorialQueryKey, useGetGuideTutorial } from '@workspace/api-client-react';
import { type Href, Redirect, router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GuideTutorialReaderScreen() {
  const { tutorialId } = useLocalSearchParams<{ tutorialId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const { followingIds, followUser } = useApp();
  const bookmarks = useGuideTutorialBookmarks();
  const [index, setIndex] = useState(0);
  const [visited, setVisited] = useState(1);
  const query = useGetGuideTutorial(tutorialId ?? '', { query: { queryKey: [...getGetGuideTutorialQueryKey(tutorialId ?? ''), userId], enabled: !!tutorialId && !!isSignedIn, retry: false } });
  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!isSignedIn) {
    const returnTo = `/guide-tutorial/${encodeURIComponent(tutorialId ?? '')}`;
    return <Redirect href={{ pathname: '/(auth)/sign-in', params: { returnTo } }} />;
  }

  if (query.isLoading) {
    return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}><View style={s.header}><BackButton /></View><SkyLoadingOverlay message="Opening tutorial…" /></View>;
  }
  const tut = query.data;
  if (!tut) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
        <View style={s.header}><BackButton /></View>
        <View style={s.center}>
          <Icon name="eye-off" size={28} color={colors.mutedForeground} />
          <Text style={[s.title, { color: colors.foreground, textAlign: 'center' }]}>Tutorial unavailable</Text>
          <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>It may have been removed, or it is only visible to the guide's followers.</Text>
          <PillButton testID="reader-retry" colors={colors} variant="secondary" icon="refresh-cw" label="Try again" onPress={() => void query.refetch()} />
          <PillButton colors={colors} variant="secondary" icon="book" label="Tutorial library" onPress={() => router.replace('/guide-tutorials' as Href)} />
        </View>
      </View>
    );
  }

  const isOwner = userId === tut.guideId;
  const canShare = tut.status === 'published' && (tut.visibility === 'public' || tut.visibility === 'unlisted');
  const isSaved = bookmarks.ids.includes(tut.id);
  const isFollowing = followingIds.includes(tut.guideId);
  const cover = tut.steps.find(st => st.type === 'image' && st.mediaUri)?.mediaUri;
  const finished = visited >= tut.steps.length;
  const go = (i: number) => { setIndex(i); setVisited(v => Math.max(v, i + 1)); };

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <View style={{ flex: 1 }} />
        {canShare && (
          <ShareButton
            testID="tutorial-share"
            onPress={() => {
              void shareContent({
                title: tut.title,
                description: `${tut.description}\nBy ${tut.guideName} · Storigam`,
                path: `/guide-tutorial/${encodeURIComponent(tut.id)}`,
              });
            }}
            accessibilityLabel="Share tutorial"
            style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, paddingHorizontal: 0, marginRight: 8 }}
            iconColor={colors.primary}
          />
        )}
        <TouchableOpacity testID="reader-bookmark" disabled={bookmarks.isLoading || bookmarks.isSaving} onPress={() => { void bookmarks.toggle(tut.id).catch(() => {}); }}
          style={[s.saveBtn, { backgroundColor: isSaved ? `${colors.primary}16` : colors.card, borderColor: isSaved ? colors.primary : colors.border }]}>
          <Icon name="bookmark" size={14} color={isSaved ? colors.primary : colors.mutedForeground} />
          <Text style={[gs.meta, { color: isSaved ? colors.primary : colors.foreground }]}>{isSaved ? 'Saved on this device' : 'Save on this device'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottom + 40 }}>
        {cover && <View style={s.cover}><SecureImage source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>}
        {tut.status === 'draft' && <Notice colors={colors} icon="lock" tone="primary" text="Draft. Only you can see this until it is published." />}
        {!!tut.topic && <Text style={[gs.eyebrow, { color: colors.primary, marginBottom: 4 }]}>{tut.topic.toUpperCase()}</Text>}
        <Text style={[s.title, { color: colors.foreground }]}>{tut.title}</Text>
        <TouchableOpacity onPress={() => router.push(`/guide/${tut.guideId}` as Href)} style={[gs.row, { marginTop: 10 }]}>
          {tut.guideAvatarUri ? <View style={s.avatar}><SecureImage source={{ uri: tut.guideAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" /></View> : <Initials name={tut.guideName} colors={colors} />}
          <View style={{ flex: 1 }}>
            <Text style={[gs.label, { color: colors.foreground, marginBottom: 0 }]}>{tut.guideName}</Text>
            <Text style={[gs.meta, { color: colors.mutedForeground }]}>{tut.guideUsername ? `@${tut.guideUsername} · ` : ''}{tut.steps.length} steps · updated {new Date(tut.updatedAt).toLocaleDateString()}</Text>
          </View>
          {!isOwner && (isFollowing
            ? <Text style={[gs.meta, { color: colors.primary }]}>Following</Text>
            : <PillButton testID="reader-follow" colors={colors} variant="secondary" icon="user-plus" label="Follow" onPress={() => followUser(tut.guideId)} />)}
        </TouchableOpacity>
        <Text style={[gs.body, { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginVertical: 14 }]}>{tut.description}</Text>

        <SectionCard colors={colors} icon="list" eyebrow="READ ALONG" title={finished ? 'You reached the end' : `Step ${index + 1}`}>
          <TutorialStepper steps={tut.steps} index={index} completed={visited} colors={colors} onIndex={go}
            questionHint="Think about your answer, or bring it to one of this guide's sessions." />
          <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Reading progress is kept while this page is open.</Text>
        </SectionCard>

        {isOwner ? (
          <View style={{ gap: 8 }}>
            <PillButton testID="reader-edit" colors={colors} variant="secondary" icon="edit-3" label="Edit tutorial"
              onPress={() => router.push({ pathname: '/create-guide-tutorial', params: { tutorialId: tut.id } } as Href)} />
            {tut.status === 'published'
              ? <PillButton testID="reader-host" colors={colors} icon="calendar" label="Host a session with this tutorial"
                  onPress={() => router.push({ pathname: '/create-guide-session', params: { tutorialId: tut.id } } as Href)} />
              : <Notice colors={colors} icon="info" text="Publish this tutorial to host a session with it." />}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <PillButton colors={colors} variant="secondary" icon="calendar" label="See this guide's upcoming sessions" onPress={() => router.push(`/guide/${tut.guideId}` as Href)} />
            <PillButton colors={colors} variant="secondary" icon="book" label="More tutorials" onPress={() => router.push('/guide-tutorials' as Href)} />
          </View>
        )}
        {bookmarks.error && <View style={{ marginTop: 10 }}><Notice colors={colors} icon="alert-circle" tone="danger" text={bookmarks.error} /></View>}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  cover: { height: 190, borderRadius: 22, overflow: 'hidden', marginBottom: 14 },
  title: { fontFamily: 'Satoshi-Black', fontSize: 26, lineHeight: 32 },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 },
});
