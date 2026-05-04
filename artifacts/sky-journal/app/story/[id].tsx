import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MoodBadge } from '@/components/MoodBadge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOOD_GRADIENTS: Record<string, [string, string, string]> = {
  Hopeful:     ['#2A2060', '#3A3080', '#2E285A'],
  Peaceful:    ['#1A2840', '#243860', '#1E304E'],
  Lonely:      ['#1A1E38', '#24284E', '#1E2244'],
  Romantic:    ['#2A1830', '#3E2448', '#301A3C'],
  Chaotic:     ['#2A1A14', '#3E2418', '#301C16'],
  Dreamy:      ['#221840', '#342860', '#2A1E50'],
  Soft:        ['#201828', '#302240', '#281C34'],
  Adventurous: ['#142214', '#1E3420', '#182818'],
};

function getGradient(mood: string): [string, string, string] {
  return MOOD_GRADIENTS[mood] ?? ['#1A1630', '#252070', '#1E1A4A'];
}

export default function StoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const { stories, discoverPosts, toggleSavePost } = useApp();
  const [witnessed, setWitnessed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  // Both own stories and discover stories use the same `stories` array now
  // since discoverPosts is derived from stories
  const story = stories.find(s => s.id === id)
    ?? (discoverPosts.find(p => p.id === id) ? stories.find(s => s.id === id) : null);
  const post = discoverPosts.find(p => p.id === id) ?? null;

  const entry = story ?? null;

  const title       = entry?.chapterTitle ?? post?.chapterTitle ?? 'Untitled Chapter';
  const mood        = entry?.mood         ?? post?.mood         ?? 'Peaceful';
  const authorName  = post?.authorName    ?? 'You';
  const chapterNum  = post?.chapterNumber ?? 1;
  const isSaved     = post?.saved         ?? false;

  const witnessedCount = (entry?.witnessedCount ?? post?.witnessedCount ?? 0) + (witnessed ? 1 : 0);
  const savedCount     = entry?.savedCount      ?? post?.savedCount      ?? 0;

  const panels: { imageUri?: string; text: string }[] =
    entry
      ? entry.panels.map(p => ({ imageUri: p.imageUri, text: p.text }))
      : post
        ? (post.panels ?? [{ text: post.storySnippet }]).map(p => ({ imageUri: p.imageUri, text: p.text }))
        : [{ text: 'Story not found.' }];

  const heroImageUri = panels[0]?.imageUri;
  const gradient     = getGradient(mood);

  function handleWitness() {
    if (!witnessed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWitnessed(true);
    }
  }

  function handleSave() {
    if (post) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleSavePost(post.id);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.night }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 90 }]}
      >
        {/* Hero banner */}
        <View style={styles.heroWrap}>
          {heroImageUri ? (
            <Image source={{ uri: heroImageUri }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={gradient} style={styles.heroImage} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Feather name="star" size={14} color="rgba(200,184,232,0.2)" style={{ position:'absolute', top:40, left:36 }} />
              <Feather name="star" size={9}  color="rgba(200,184,232,0.14)" style={{ position:'absolute', top:70, right:64 }} />
              <Feather name="moon" size={40} color="rgba(200,184,232,0.08)" style={{ position:'absolute', top:30, right:30 }} />
            </LinearGradient>
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(26,22,48,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Buttons */}
          <TouchableOpacity style={[styles.backBtn, { top: topPad + 12 }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.moreBtn, { top: topPad + 12 }]}>
            <Feather name="more-horizontal" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Hero info */}
          <View style={styles.heroOverlay}>
            <View style={styles.heroMeta}>
              <View style={[styles.heroAvatar, { backgroundColor: `${colors.primary}50` }]}>
                <Text style={styles.heroAvatarText}>{authorName.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.heroAuthor}>{authorName}</Text>
                <Text style={styles.heroChapter}>Chapter {chapterNum}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{title}</Text>
            <View style={styles.heroMoodRow}>
              <MoodBadge mood={mood} size="sm" />
              <View style={[styles.panelCountBadge, { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }]}>
                <Feather name="layers" size={11} color="rgba(255,255,255,0.8)" />
                <Text style={styles.panelCountText}>{panels.length} panels</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Divider hint */}
        <View style={[styles.readingHint, { backgroundColor: `${colors.primary}22` }]}>
          <Feather name="arrow-down" size={13} color={`${colors.lavender}`} />
          <Text style={[styles.readingHintText, { color: colors.lavender }]}>Scroll to read the story</Text>
        </View>

        {/* Manga panels */}
        {panels.map((panel, idx) => {
          const isLast = idx === panels.length - 1;

          return (
            <View key={idx} style={[styles.panel, isLast && styles.panelLast]}>
              {/* Image or gradient placeholder */}
              {panel.imageUri ? (
                <Image source={{ uri: panel.imageUri }} style={styles.panelImage} resizeMode="cover" />
              ) : (
                <LinearGradient colors={gradient} style={styles.panelImage} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }}>
                  <Feather name="star" size={10} color="rgba(200,184,232,0.18)" style={{ position:'absolute', top:20, left:24 }} />
                  <Feather name="star" size={7}  color="rgba(200,184,232,0.12)" style={{ position:'absolute', top:50, right:44 }} />
                  <Feather name="moon" size={30} color="rgba(200,184,232,0.07)" style={{ position:'absolute', bottom:40, right:24 }} />
                </LinearGradient>
              )}

              {/* Dark gradient over bottom of image */}
              <LinearGradient
                colors={['rgba(26,22,48,0)', 'rgba(26,22,48,0.88)']}
                style={styles.panelGradient}
              />

              {/* Panel number badge */}
              <View style={[styles.panelNumBadge, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.panelNumText}>{idx + 1} / {panels.length}</Text>
              </View>

              {/* Narration text box */}
              {panel.text.trim().length > 0 && (
                <View style={[styles.textBox, { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' }]}>
                  <Text style={styles.panelText}>{panel.text}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* End card */}
        <View style={[styles.endCard, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
          <Feather name="star" size={22} color={colors.gold} />
          <Text style={[styles.endTitle, { color: '#F0EAF8' }]}>End of Chapter {chapterNum}</Text>
          <Text style={[styles.endSub, { color: 'rgba(200,184,232,0.7)' }]}>
            {post ? `by ${authorName}` : 'Your story'}
          </Text>
          <View style={styles.endStats}>
            <Feather name="eye" size={14} color="rgba(200,184,232,0.6)" />
            <Text style={[styles.endStatText, { color: 'rgba(200,184,232,0.6)' }]}>{witnessedCount} witnessed</Text>
            <Feather name="bookmark" size={14} color="rgba(200,184,232,0.6)" style={{ marginLeft: 12 }} />
            <Text style={[styles.endStatText, { color: 'rgba(200,184,232,0.6)' }]}>{savedCount} saved</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: `${colors.night}F0`,
            paddingBottom: bottomPad + 8,
            borderTopColor: 'rgba(255,255,255,0.08)',
          },
        ]}
      >
        <View style={styles.witnessedRow}>
          <Feather name="eye" size={15} color="rgba(240,234,248,0.6)" />
          <Text style={styles.witnessedNum}>{witnessedCount}</Text>
          <View style={styles.dotDivider} />
          <Feather name="bookmark" size={14} color="rgba(240,234,248,0.6)" />
          <Text style={styles.witnessedNum}>{savedCount}</Text>
        </View>

        <View style={styles.actionRow}>
          {!!post && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isSaved ? `${colors.primary}30` : 'rgba(255,255,255,0.08)',
                  borderColor: isSaved ? colors.primary : 'rgba(255,255,255,0.18)',
                },
              ]}
              onPress={handleSave}
            >
              <Feather name="bookmark" size={15} color={isSaved ? colors.primary : 'rgba(240,234,248,0.75)'} />
              <Text style={[styles.actionBtnText, { color: isSaved ? colors.primary : 'rgba(240,234,248,0.75)' }]}>
                {isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.witnessBtn,
              {
                backgroundColor: witnessed ? `${colors.gold}22` : `${colors.primary}30`,
                borderColor: witnessed ? `${colors.gold}55` : `${colors.primary}55`,
              },
            ]}
            onPress={handleWitness}
          >
            <Feather name="eye" size={15} color={witnessed ? colors.gold : colors.lavender} />
            <Text style={[styles.actionBtnText, { color: witnessed ? colors.gold : colors.lavender }]}>
              {witnessed ? 'Witnessed ✦' : 'Witness'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {},
  heroWrap: { width: '100%', height: 420, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    gap: 10,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  heroAuthor: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  heroChapter: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  heroTitle: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 32 },
  heroMoodRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  panelCountText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Inter_400Regular' },
  readingHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  readingHintText: { fontSize: 12, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },
  panel: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 3,
  },
  panelLast: { marginBottom: 0 },
  panelImage: { width: '100%', height: '100%' },
  panelGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  panelNumBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  panelNumText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  textBox: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  panelText: {
    color: 'rgba(255,255,255,0.93)',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
  },
  endCard: {
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  endTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  endSub: { fontSize: 13, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  endStats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  endStatText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  witnessedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  witnessedNum: { color: 'rgba(240,234,248,0.6)', fontSize: 14, fontFamily: 'Inter_400Regular' },
  dotDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(240,234,248,0.3)',
    marginHorizontal: 4,
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  witnessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
