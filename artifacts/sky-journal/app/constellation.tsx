/**
 * /constellation  — Dedicated Constellation page.
 *
 * Presents the full ConstellationMap + star progress + titles so the user
 * can explore their progression without navigating to the Profile tab.
 */
import { ConstellationStarSheet } from '@/components/ConstellationStarSheet';
import { Icon } from '@/components/Icon';
import { ConstellationMap } from '@/components/ConstellationMap';
import { ConstellationProgressCard } from '@/components/profile/ConstellationProgressCard';
import { TitlesGallerySection } from '@/components/profile/TitlesGallerySection';
import { TitlePickerModal } from '@/components/profile/TitlePickerModal';
import { useApp, apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, Easing, Platform, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ConstellationScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { constellation, character, stories, journalEntries, reloadConstellation } = useApp();

  const [selectedStarKey, setSelectedStarKey] = useState<string | null>(null);
  const [showTitlePicker, setShowTitlePicker]  = useState(false);
  const [savingTitle,     setSavingTitle]      = useState(false);
  const [animKey,         setAnimKey]          = useState(0);

  useFocusEffect(useCallback(() => {
    setAnimKey(n => n + 1);
    reloadConstellation().catch(() => null);
  }, [reloadConstellation]));

  async function handleSetActiveTitle(title: string) {
    setSavingTitle(true);
    try {
      await apiFetch('/character', {
        method: 'PUT',
        body: JSON.stringify({ activeTitle: title }),
      });
      await reloadConstellation();
    } catch { /* stale UI is acceptable */ } finally {
      setSavingTitle(false);
      setShowTitlePicker(false);
    }
  }

  // Entrance animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, {
      toValue: 1, duration: 500,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [fadeIn]));

  const topPad    = Platform.OS === 'web' ? 60 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 80 : insets.bottom + 40;

  return (
    <Animated.View style={[s.root, { opacity: fadeIn }]}>
      {/* Background */}
      <LinearGradient
        colors={['#100A28', '#08061A', '#04030C']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        pointerEvents="none"
      />

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.75}
        >
          <Icon name="chevron-left" size={18} color="rgba(242,232,255,0.80)" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>My Constellation</Text>
          {constellation?.activeTitle && (
            <Text style={s.headerSub}>{constellation.activeTitle}</Text>
          )}
        </View>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); reloadConstellation().catch(() => null); }}
          activeOpacity={0.75}
        >
          <Icon name="refresh-cw" size={15} color="rgba(200,184,232,0.45)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
      >
        {/* Constellation map */}
        <View style={s.mapWrap}>
          <ConstellationMap
            state={constellation}
            onStarPress={key => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedStarKey(key);
            }}
            animKey={animKey}
          />
        </View>

        {/* Progress card */}
        {constellation && (
          <View style={s.cardWrap}>
            <ConstellationProgressCard
              constellation={constellation}
              triggerAnim={animKey}
            />
          </View>
        )}

        {/* Titles */}
        {constellation && (
          <View style={s.cardWrap}>
            <TitlesGallerySection
              constellation={constellation}
              character={character}
              stories={stories}
              journalEntries={journalEntries}
              onSetActiveTitle={title => {
                if (title) handleSetActiveTitle(title);
              }}
            />
          </View>
        )}

        {/* Empty state */}
        {!constellation && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>✦</Text>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>
              Your journey begins here
            </Text>
            <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
              Write journal entries, share stories, and connect with wanderers to unlock your constellation stars.
            </Text>
            <TouchableOpacity
              style={s.emptyCTA}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/(tabs)/create'); }}
              activeOpacity={0.80}
            >
              <Text style={s.emptyCTATxt}>Start Writing  →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Star detail sheet */}
      {selectedStarKey && constellation && (
        <ConstellationStarSheet
          starKey={selectedStarKey}
          constellation={constellation}
          onClose={() => setSelectedStarKey(null)}
        />
      )}

      {/* Title picker */}
      <TitlePickerModal
        visible={showTitlePicker}
        constellation={constellation ?? null}
        availableTitles={
          constellation
            ? constellation.unlockedStars.map((_, i) => {
                const titles: Record<number, string> = {
                  1: 'Star Wanderer', 2: 'Memory Keeper', 3: 'Rising Star',
                  4: 'Dreamer',       5: 'Guiding Light', 6: 'Legend',
                };
                return titles[i + 1] ?? '';
              }).filter(Boolean)
            : []
        }
        saving={savingTitle}
        onSelect={handleSetActiveTitle}
        onClose={() => setShowTitlePicker(false)}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04030C' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 17, fontFamily: 'Satoshi-Bold',
    color: 'rgba(242,232,255,0.95)', letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11, fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,168,75,0.70)', marginTop: 1, fontStyle: 'italic',
  },

  mapWrap:  { paddingHorizontal: 16, marginTop: 4, marginBottom: 8 },
  cardWrap: { paddingHorizontal: 16, marginBottom: 8 },

  empty: {
    alignItems: 'center', paddingHorizontal: 36, paddingTop: 48, gap: 12,
  },
  emptyIcon:  { fontSize: 36, color: 'rgba(155,120,255,0.40)', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3, textAlign: 'center' },
  emptyHint:  { fontSize: 13, fontFamily: 'Satoshi-Regular', lineHeight: 20, textAlign: 'center' },
  emptyCTA:   {
    marginTop: 8, paddingHorizontal: 22, paddingVertical: 11,
    borderRadius: 22, borderWidth: 1, borderColor: 'rgba(155,120,255,0.35)',
    backgroundColor: 'rgba(155,120,255,0.10)',
  },
  emptyCTATxt: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#9B78FF' },
});
