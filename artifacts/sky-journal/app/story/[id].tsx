import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Images } from '@/assets/images';
import { MoodBadge } from '@/components/MoodBadge';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const STORY_PANELS_BY_POST: Record<string, { text: string; imageKey: string }[]> = {
  p1: [
    { text: 'I sat under the stars and made a wish...', imageKey: 'story_bg1' },
    { text: 'The light that carried it was soft and small,\nlike a firefly on a summer night.', imageKey: 'story_bg1' },
    { text: 'I wonder if it reached you.', imageKey: 'story_bg3' },
  ],
  p2: [
    { text: 'Every adventure starts with a single step forward.', imageKey: 'story_bg2' },
    { text: 'I did not know where the path led.\nBut the sky was open,\nand my heart was lighter than air.', imageKey: 'story_bg2' },
  ],
  p3: [
    { text: 'The wind carries memories\nof the ones who came before.', imageKey: 'story_bg3' },
    { text: 'I listen to them\nwhen the world gets too quiet.', imageKey: 'story_bg1' },
    { text: 'And I keep walking,\ntoward a place I belong.', imageKey: 'story_bg2' },
  ],
};

export default function StoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<{ id: string; source: string }>();
  const { logs, discoverPosts, toggleSavePost } = useApp();
  const [witnessed, setWitnessed] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  const isDiscover = source === 'discover';
  const post = isDiscover ? discoverPosts.find(p => p.id === id) : null;
  const logEntry = !isDiscover ? logs.find(l => l.id === id) : null;

  const title = post?.chapterTitle ?? logEntry?.chapterTitle ?? 'Untitled Chapter';
  const mood = post?.mood ?? logEntry?.mood ?? 'Peaceful';
  const authorName = post?.authorName ?? 'You';
  const chapterNum = post?.chapterNumber ?? 1;
  const witnessedCount = post
    ? post.witnessedCount + (witnessed ? 1 : 0)
    : (logEntry?.witnessedCount ?? 0) + (witnessed ? 1 : 0);
  const isSaved = post?.saved ?? false;

  const panels: { text: string; imageKey: string }[] = isDiscover && post
    ? STORY_PANELS_BY_POST[id] ?? [
        { text: post.storySnippet, imageKey: post.imageKey },
        { text: 'The journey continues...', imageKey: post.imageKey },
      ]
    : logEntry
      ? [
          {
            text: logEntry.storyText,
            imageKey: 'story_bg1',
          },
        ]
      : [{ text: 'Story not found.', imageKey: 'story_bg1' }];

  const heroImageKey = post?.imageKey ?? 'story_bg1';
  const heroImage = Images[heroImageKey as keyof typeof Images] ?? Images.story_bg1;

  function handleWitness() {
    if (!witnessed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWitnessed(true);
    }
  }

  function handleSave() {
    if (isDiscover && post) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleSavePost(post.id);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.night }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 80 }]}
      >
        {/* Hero image */}
        <View style={styles.heroWrap}>
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(26,22,48,0.85)']}
            style={StyleSheet.absoluteFill}
          />
          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: topPad + 12 }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          {/* More */}
          <TouchableOpacity
            style={[styles.moreBtn, { top: topPad + 12 }]}
          >
            <Feather name="more-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Hero overlay text */}
          <View style={styles.heroOverlay}>
            <View style={styles.heroAuthorRow}>
              <View style={[styles.heroAvatar, { backgroundColor: `${colors.primary}50` }]}>
                <Text style={styles.heroAvatarText}>{authorName.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.heroAuthor}>{authorName}</Text>
                <Text style={styles.heroChapter}>Chapter {chapterNum}</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{title}</Text>
            <MoodBadge mood={mood} size="sm" />
          </View>
        </View>

        {/* Manga panels */}
        <View style={[styles.panelsContainer, { backgroundColor: colors.night }]}>
          {panels.map((panel, idx) => {
            const panelImage = Images[panel.imageKey as keyof typeof Images] ?? Images.story_bg1;
            return (
              <View key={idx} style={styles.panel}>
                <Image source={panelImage} style={styles.panelImage} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(26,22,48,0.0)', 'rgba(26,22,48,0.92)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.panelTextBox, { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }]}>
                  <Text style={styles.panelText}>{panel.text}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { backgroundColor: `${colors.night}EE`, paddingBottom: bottomPad + 8, borderTopColor: 'rgba(255,255,255,0.1)' }]}>
        <View style={styles.witnessedRow}>
          <Feather name="eye" size={15} color="rgba(240,234,248,0.7)" />
          <Text style={styles.witnessedCount}>{witnessedCount}</Text>
          <Feather name="star" size={15} color={colors.gold} style={{ marginLeft: 12 }} />
          <Text style={styles.witnessedCount}>{(post?.savedCount ?? logEntry?.savedCount ?? 0) + (isSaved ? 1 : 0)}</Text>
        </View>
        <View style={styles.bottomActions}>
          {isDiscover && (
            <TouchableOpacity
              style={[
                styles.saveBtn,
                {
                  backgroundColor: isSaved ? `${colors.primary}35` : 'rgba(255,255,255,0.1)',
                  borderColor: isSaved ? colors.primary : 'rgba(255,255,255,0.25)',
                },
              ]}
              onPress={handleSave}
            >
              <Feather name="bookmark" size={15} color={isSaved ? colors.primary : 'rgba(240,234,248,0.8)'} />
              <Text style={[styles.saveBtnText, { color: isSaved ? colors.primary : 'rgba(240,234,248,0.8)' }]}>
                {isSaved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.witnessBtn,
              {
                backgroundColor: witnessed ? `${colors.gold}25` : 'rgba(255,255,255,0.12)',
                borderColor: witnessed ? `${colors.gold}60` : 'rgba(255,255,255,0.25)',
              },
            ]}
            onPress={handleWitness}
          >
            <Feather name="eye" size={15} color={witnessed ? colors.gold : 'rgba(240,234,248,0.8)'} />
            <Text style={[styles.witnessBtnText, { color: witnessed ? colors.gold : 'rgba(240,234,248,0.8)' }]}>
              {witnessed ? 'Witnessed' : 'Witness'}
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
  heroWrap: {
    width: '100%',
    height: 400,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
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
    gap: 8,
  },
  heroAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  heroAuthor: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  heroChapter: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    lineHeight: 30,
  },
  panelsContainer: {
    gap: 3,
  },
  panel: {
    width: '100%',
    height: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  panelImage: {
    width: '100%',
    height: '100%',
  },
  panelTextBox: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  panelText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    lineHeight: 24,
    textAlign: 'center',
  },
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
  witnessedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  witnessedCount: {
    color: 'rgba(240,234,248,0.7)',
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  saveBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
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
  witnessBtnText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
});
