import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SecureImage } from '@/components/SecureImage';
import { Notice, PillButton, gs } from '@/components/guide-session/shared';
import { useColors } from '@/hooks/useColors';
import { useGuideTutorialBookmarks } from '@/hooks/useGuideTutorialBookmarks';
import { useAuth } from '@clerk/expo';
import { useQueries } from '@tanstack/react-query';
import {
  getGetGuideTutorialQueryOptions,
  getListGuideTutorialsQueryKey,
  useListGuideTutorials,
  type GuideTutorial,
} from '@workspace/api-client-react';
import { type Href, Redirect, router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Tab = 'explore' | 'mine' | 'saved';

export default function GuideTutorialsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('explore');
  const bookmarks = useGuideTutorialBookmarks();
  const { userId, isLoaded, isSignedIn } = useAuth();

  const explore = useListGuideTutorials({ mine: false }, { query: { queryKey: [...getListGuideTutorialsQueryKey({ mine: false }), userId], enabled: !!isSignedIn && tab === 'explore' } });
  const mine = useListGuideTutorials({ mine: true }, { query: { queryKey: [...getListGuideTutorialsQueryKey({ mine: true }), userId], enabled: !!isSignedIn && tab === 'mine' } });
  const saved = useQueries({
    queries: isSignedIn && tab === 'saved' ? bookmarks.ids.map(id => {
      const options = getGetGuideTutorialQueryOptions(id);
      return { ...options, queryKey: [...options.queryKey, userId], retry: false };
    }) : [],
  });

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;
  if (!isLoaded) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const listQuery = tab === 'explore' ? explore : tab === 'mine' ? mine : null;
  const rows: { id: string; tutorial: GuideTutorial | null; failed: boolean; loading: boolean }[] = tab === 'saved'
    ? bookmarks.ids.map((id, i) => ({ id, tutorial: saved[i]?.data ?? null, failed: !!saved[i]?.isError, loading: !!saved[i]?.isLoading }))
    : (listQuery?.data ?? []).map(item => ({ id: item.id, tutorial: item, failed: false, loading: false }));
  const isLoading = tab === 'saved' ? bookmarks.isLoading : !!listQuery?.isLoading;
  const isError = tab !== 'saved' && !!listQuery?.isError;

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>Tutorials</Text>
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>Step-by-step guides written by Sky guides</Text>
        </View>
        <TouchableOpacity testID="library-new-tutorial" accessibilityLabel="Write a tutorial" onPress={() => router.push('/create-guide-tutorial')}
          style={[s.iconBtn, { backgroundColor: `${colors.primary}14` }]}>
          <Icon name="edit-3" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={[s.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([['explore', 'Explore', 'compass'], ['mine', 'My tutorials', 'edit-3'], ['saved', 'Saved on this device', 'bookmark']] as const).map(([key, label, icon]) => {
          const on = tab === key;
          return (
            <TouchableOpacity key={key} testID={`library-tab-${key}`} onPress={() => setTab(key)} style={[s.tab, on && { backgroundColor: colors.primary }]}>
              <Icon name={icon} size={13} color={on ? colors.primaryForeground : colors.mutedForeground} />
              <Text numberOfLines={1} style={[s.tabText, { color: on ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {bookmarks.error && <View style={{ paddingHorizontal: 18 }}><Notice colors={colors} icon="alert-circle" tone="danger" text={bookmarks.error} /></View>}
      {isLoading ? (
        <View style={{ padding: 18, gap: 10 }}>{[0, 1, 2].map(i => <View key={i} style={[s.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]} />)}</View>
      ) : isError ? (
        <View style={s.center}>
          <Icon name="cloud-off" size={26} color={colors.mutedForeground} />
          <Text style={[gs.body, { color: colors.mutedForeground }]}>Tutorials could not be loaded.</Text>
          <PillButton testID="library-retry" colors={colors} variant="secondary" icon="refresh-cw" label="Retry" onPress={() => void listQuery?.refetch()} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.id}
          scrollEnabled={rows.length > 0}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottom + 30, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Icon name={tab === 'saved' ? 'bookmark' : 'book-open'} size={26} color={colors.primary} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {tab === 'saved' ? 'Nothing saved on this device' : tab === 'mine' ? 'You have not written a tutorial yet' : 'No tutorials yet'}
              </Text>
              <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>
                {tab === 'saved' ? 'Open a tutorial and tap Save on this device to keep it here.' : tab === 'mine' ? 'Share what you know in steps, with images, videos and tips.' : 'Check back soon, or write the first one.'}
              </Text>
              {tab !== 'saved' && <PillButton colors={colors} icon="edit-3" label="Write a tutorial" onPress={() => router.push('/create-guide-tutorial')} />}
            </View>
          }
          renderItem={({ item }) => {
            if (!item.tutorial) {
              return (
                <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                  <Icon name={item.loading ? 'clock' : 'eye-off'} size={16} color={colors.mutedForeground} />
                  <Text style={[gs.body, { flex: 1, color: colors.mutedForeground }]}>
                    {item.loading ? 'Loading saved tutorial…' : 'This tutorial was removed or is no longer visible to you.'}
                  </Text>
                  {item.failed && (
                    <TouchableOpacity testID={`library-remove-${item.id}`} disabled={bookmarks.isLoading || bookmarks.isSaving} onPress={() => { void bookmarks.toggle(item.id).catch(() => {}); }}>
                      <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            const tut = item.tutorial;
            const cover = tut.steps.find(st => st.type === 'image' && st.mediaUri)?.mediaUri;
            const isSaved = bookmarks.ids.includes(tut.id);
            return (
              <TouchableOpacity testID={`library-item-${tut.id}`} activeOpacity={0.85} onPress={() => router.push(`/guide-tutorial/${tut.id}` as Href)}
                style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[s.thumb, { backgroundColor: `${colors.primary}14` }]}>
                    {cover ? <SecureImage source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="book-open" size={20} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={[gs.cardTitle, { color: colors.foreground }]}>{tut.title}</Text>
                    <Text numberOfLines={1} style={[gs.meta, { color: colors.mutedForeground, marginTop: 3 }]}>
                      {tut.guideName}{tut.topic ? ` · ${tut.topic}` : ''} · {tut.steps.length} steps
                    </Text>
                    <View style={[gs.row, { marginTop: 7 }]}>
                      {tab === 'mine' && (
                        <View style={[s.chip, { backgroundColor: tut.status === 'published' ? `${colors.tint}18` : `${colors.mutedForeground}16` }]}>
                          <Text style={[gs.eyebrow, { color: tut.status === 'published' ? colors.tint : colors.mutedForeground }]}>{tut.status.toUpperCase()}</Text>
                        </View>
                      )}
                      {tut.visibility !== 'public' && <Text style={[gs.meta, { color: colors.mutedForeground }]}>{tut.visibility === 'followers' ? 'Followers' : 'Link only'}</Text>}
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity testID={`library-bookmark-${tut.id}`} disabled={bookmarks.isLoading || bookmarks.isSaving} onPress={() => { void bookmarks.toggle(tut.id).catch(() => {}); }}
                        accessibilityLabel={isSaved ? 'Saved on this device. Tap to remove.' : 'Save on this device'} style={gs.row}>
                        <Icon name="bookmark" size={14} color={isSaved ? colors.primary : colors.mutedForeground} />
                        <Text style={[gs.meta, { color: isSaved ? colors.primary : colors.mutedForeground }]}>{isSaved ? 'Saved on this device' : 'Save on this device'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  title: { fontFamily: 'Satoshi-Black', fontSize: 24 },
  iconBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 18, marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 4 },
  tab: { flex: 1, minHeight: 38, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
  tabText: { fontFamily: 'Satoshi-Bold', fontSize: 10.5, flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 10 },
  thumb: { width: 76, height: 76, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  skeleton: { height: 100, borderRadius: 18, borderWidth: 1, opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 },
  emptyTitle: { fontFamily: 'Satoshi-Bold', fontSize: 16, textAlign: 'center' },
});
