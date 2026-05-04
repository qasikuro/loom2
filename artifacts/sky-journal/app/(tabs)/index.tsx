import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
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
import { RewardBanner } from '@/components/RewardBanner';
import { TraitTag } from '@/components/TraitTag';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { getTimeVariant } from '@/components/GradientSky';

const GRADIENT_CONFIGS = {
  dawn: ['#F8E0D8', '#EDD0F0', '#C8B8E8', '#B8C8E8'] as const,
  day: ['#F0EAF8', '#E4DCED', '#D8E8F4', '#EDE8F8'] as const,
  dusk: ['#F0D8C8', '#D8B8D8', '#B0A0CC', '#9080B8'] as const,
  night: ['#1A1630', '#2A1E50', '#1E2E4A', '#0C0A20'] as const,
  card: ['rgba(255,255,255,0.95)', 'rgba(245,240,252,0.95)'] as const,
  overlay: ['rgba(42,32,64,0.0)', 'rgba(42,32,64,0.7)'] as const,
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { character, rewards, dismissReward } = useApp();
  const variant = getTimeVariant();
  const isNight = variant === 'night' || variant === 'dusk';
  const gradColors = GRADIENT_CONFIGS[variant];
  const textColor = isNight ? '#F0EAF8' : colors.foreground;
  const mutedColor = isNight ? 'rgba(240,234,248,0.65)' : colors.mutedForeground;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function handleNewLog() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start(() => router.push('/(tabs)/create'));
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradColors as unknown as [string, string, ...string[]]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative light orbs */}
      <View style={[styles.orb, styles.orb1, { backgroundColor: `${colors.lavender}40` }]} />
      <View style={[styles.orb, styles.orb2, { backgroundColor: `${colors.gold}30` }]} />
      <View style={[styles.orb, styles.orb3, { backgroundColor: `${colors.skyBlue}35` }]} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 8 }]}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="menu" size={20} color={isNight ? '#F0EAF8' : colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.topLabel, { color: mutedColor }]}>My Sky Kid</Text>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: `${colors.primary}18` }]}>
            <Feather name="bell" size={20} color={isNight ? '#F0EAF8' : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Character section */}
        <View style={styles.characterSection}>
          <View style={styles.glowRing}>
            <View style={[styles.glowOuter, { backgroundColor: `${colors.primary}20` }]} />
            <View style={[styles.glowMid, { backgroundColor: `${colors.primary}15` }]} />
            <View style={styles.avatarContainer}>
              <Image
                source={Images.character_default}
                style={styles.characterImg}
                resizeMode="cover"
              />
            </View>
          </View>
          <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="edit-2" size={11} color={colors.primary} />
            <Text style={[styles.editText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Character info */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={[styles.charName, { color: textColor }]}>{character.name}</Text>
            <Feather name="star" size={16} color={colors.gold} style={{ marginLeft: 6 }} />
          </View>
          <Text style={[styles.bio, { color: mutedColor }]}>{character.bio}</Text>

          {/* Mood */}
          <View style={styles.moodRow}>
            <View style={[styles.moodChip, { backgroundColor: `${colors.accent}20`, borderColor: `${colors.accent}35` }]}>
              <Feather name="sun" size={11} color={colors.accent} />
              <Text style={[styles.moodText, { color: colors.accent }]}>{character.mood}</Text>
            </View>
          </View>

          {/* Traits */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.traitsRow}
          >
            {character.traits.map(trait => (
              <TraitTag key={trait} label={trait} />
            ))}
          </ScrollView>

          {/* Stats */}
          <View style={[styles.statsRow, { borderColor: `${colors.primary}20`, backgroundColor: `${colors.primary}08` }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: textColor }]}>{character.storiesCount}</Text>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Stories</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: `${colors.primary}25` }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: textColor }]}>{character.outfitsCount}</Text>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Outfits</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: `${colors.primary}25` }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statNum, { color: textColor }]}>{character.memoriesCount}</Text>
              <Text style={[styles.statLabel, { color: mutedColor }]}>Memories</Text>
            </View>
          </View>

          {/* New Log Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity onPress={handleNewLog} activeOpacity={0.85}>
              <LinearGradient
                colors={['#7B6BA8', '#6B5B95', '#5A4A80']}
                style={styles.newLogBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={styles.newLogText}>New Log</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Rewards section */}
        {rewards.length > 0 && (
          <View style={styles.rewardsSection}>
            <View style={styles.rewardsHeader}>
              <Text style={[styles.rewardsSectionTitle, { color: mutedColor }]}>Your Journey</Text>
              <Text style={[styles.rewardsSubtitle, { color: mutedColor }]}>Keep creating, your story matters</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rewardsList}
            >
              {rewards.map(reward => (
                <RewardBanner key={reward.id} reward={reward} onDismiss={() => dismissReward(reward.id)} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: Platform.OS === 'web' ? 100 : 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 200, height: 200, top: -60, right: -60 },
  orb2: { width: 150, height: 150, top: 300, left: -50 },
  orb3: { width: 120, height: 120, bottom: 200, right: -20 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.5,
  },
  characterSection: {
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  glowRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  glowMid: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  avatarContainer: {
    width: 160,
    height: 200,
    borderRadius: 80,
    overflow: 'hidden',
  },
  characterImg: {
    width: '100%',
    height: '100%',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  editText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  infoSection: {
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  charName: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  moodRow: { flexDirection: 'row' },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  moodText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  traitsRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
  },
  newLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    shadowColor: '#6B5B95',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  newLogText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  rewardsSection: {
    marginTop: 16,
    gap: 10,
    width: '100%',
  },
  rewardsHeader: { gap: 2 },
  rewardsSectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  rewardsSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  rewardsList: {
    paddingVertical: 4,
  },
});
