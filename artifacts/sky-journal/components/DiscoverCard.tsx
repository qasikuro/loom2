import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { ResonateButton } from '@/components/ResonateButton';
import { useColors } from '@/hooks/useColors';
import type { DiscoverPost } from '@/context/AppContext';
import { extractPullQuote } from '@/utils/storyUtils';

const MOOD_GRADIENTS: Record<string, [string, string, string]> = {
  Hopeful:     ['#1C1A50', '#2A2870', '#221E5C'],
  Peaceful:    ['#0E2030', '#183050', '#142840'],
  Lonely:      ['#141630', '#1E2046', '#181C3C'],
  Romantic:    ['#200F28', '#341840', '#2A1234'],
  Chaotic:     ['#200C0A', '#341610', '#2A100E'],
  Dreamy:      ['#180E34', '#281850', '#201240'],
  Soft:        ['#180E20', '#281830', '#201428'],
  Adventurous: ['#0C1A0C', '#142614', '#101E10'],
};

function getGradient(mood: string): [string, string, string] {
  return MOOD_GRADIENTS[mood] ?? ['#131028', '#1E1A50', '#181440'];
}

interface DiscoverCardProps {
  post:              DiscoverPost;
  onPress?:          () => void;
  onSave?:           () => void;
  onDelete?:         () => void;
  onReport?:         () => void;
  onAuthorPress?:    () => void;
  delay?:            number;
}

export function DiscoverCard({
  post, onPress, onSave, onDelete, onReport, onAuthorPress, delay = 0,
}: DiscoverCardProps) {
  useColors();
  const initial  = post.authorName.charAt(0).toUpperCase();
  const gradient = getGradient(post.mood);

  const pullQuote = extractPullQuote(post.panels ?? []) || post.storySnippet || '';
  const heroPanelImage = post.panels?.[0]?.imageUri ?? null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountY       = useRef(new Animated.Value(20)).current;
  const pressScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, {
        toValue: 1, duration: 380, delay, useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.spring(mountY, {
        toValue: 0, delay, tension: 65, friction: 11, useNativeDriver: true,
      }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePressIn() {
    Animated.spring(pressScale, { toValue: 0.976, useNativeDriver: true, tension: 220, friction: 15 }).start();
  }
  function handlePressOut() {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, tension: 180, friction: 10 }).start();
  }

  function handleDeletePress() {
    if (confirmingDelete) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      onDelete?.();
    } else {
      setConfirmingDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  }

  return (
    <Animated.View style={{ opacity: mountOpacity, transform: [{ translateY: mountY }, { scale: pressScale }] }}>
      <Pressable
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* ── Full-bleed hero image (16:9) ── */}
        <View style={styles.imageWrap}>
          {heroPanelImage ? (
            <Image
              source={{ uri: heroPanelImage }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={gradient} style={styles.image} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
              {[
                { t: 18, l: 22, s: 2.5, o: 0.3 },
                { t: 38, r: 32,  s: 2,   o: 0.22 },
                { t: 70, l: 55,  s: 1.5, o: 0.18 },
                { t: 90, r: 18,  s: 3,   o: 0.25 },
                { t: 120, l: 30, s: 2,   o: 0.2 },
              ].map((s, i) => (
                <View key={i} style={{
                  position: 'absolute', top: s.t,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  left: 'l' in s ? (s as any).l : undefined,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  right: 'r' in s ? (s as any).r : undefined,
                  width: s.s, height: s.s, borderRadius: s.s,
                  backgroundColor: '#C8B8E8', opacity: s.o,
                }} />
              ))}
            </LinearGradient>
          )}

          {/* Gradient scrim — top */}
          <LinearGradient
            colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.08)', 'transparent']}
            style={[StyleSheet.absoluteFill, { height: '45%' }]}
            pointerEvents="none"
          />

          {/* Author avatar + name overlay at top-left of image */}
          <TouchableOpacity
            style={styles.imageAuthorRow}
            onPress={onAuthorPress}
            activeOpacity={onAuthorPress ? 0.75 : 1}
            disabled={!onAuthorPress}
          >
            <View style={styles.avatar}>
              {post.authorAvatarUri ? (
                <Image
                  source={{ uri: post.authorAvatarUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
            </View>
            <Text style={styles.imageAuthorName} numberOfLines={1}>{post.authorName}</Text>
          </TouchableOpacity>

          {/* Chapter badge at top-right */}
          <View style={styles.chapterBadge}>
            <Text style={styles.chapterText}>Ch. {post.chapterNumber}</Text>
          </View>
        </View>

        {/* ── Below-image content block ── */}
        <View style={styles.contentBlock}>
          {/* Title */}
          <Text style={styles.chapterTitle} numberOfLines={2}>{post.chapterTitle}</Text>

          {/* @handle row */}
          <Text style={styles.handleText} numberOfLines={1}>
            {post.authorHandle || post.authorName}
            {!!post.authorTitle && <Text style={styles.titleBadge}> · {post.authorTitle}</Text>}
          </Text>

          {/* Mood badge */}
          <View style={styles.moodRow}>
            <MoodBadge mood={post.vibe} size="sm" />
          </View>

          {/* Pull quote */}
          {!!pullQuote && (
            <Text style={styles.pullQuote} numberOfLines={2}>{pullQuote}</Text>
          )}
        </View>

        {/* ── Action bar ── */}
        <View style={styles.actionBar}>
          {/* Left: witness count */}
          <View style={styles.statsGroup}>
            <View style={styles.statPill}>
              <Icon name="eye" size={10} color="rgba(200,184,232,0.55)" />
              <Text style={styles.statText}>
                {post.witnessedCount >= 1000
                  ? `${(post.witnessedCount / 1000).toFixed(1)}k`
                  : post.witnessedCount}
              </Text>
            </View>
          </View>

          {/* Right: actions */}
          <View style={styles.actionsGroup}>
            {onDelete && (
              <TouchableOpacity
                onPress={handleDeletePress}
                style={[
                  styles.iconBtn,
                  confirmingDelete && { backgroundColor: 'rgba(224,68,85,0.18)', borderColor: 'rgba(224,68,85,0.4)' },
                ]}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                activeOpacity={0.75}
              >
                {confirmingDelete
                  ? <Text style={styles.deleteText}>Delete?</Text>
                  : <Icon name="trash-2" size={13} color="rgba(200,184,232,0.4)" />
                }
              </TouchableOpacity>
            )}

            <ResonateButton storyId={post.id} />

            <TouchableOpacity
              onPress={onSave}
              style={[
                styles.iconBtn,
                post.saved && { backgroundColor: 'rgba(107,91,149,0.2)', borderColor: 'rgba(107,91,149,0.45)' },
              ]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Icon
                name="bookmark"
                size={13}
                color={post.saved ? '#9B8DC4' : 'rgba(200,184,232,0.4)'}
              />
            </TouchableOpacity>
            {onReport && (
              <TouchableOpacity
                onPress={onReport}
                style={styles.iconBtn}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Icon name="flag" size={13} color="rgba(200,184,232,0.35)" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onPress} style={styles.readBtn} activeOpacity={0.82}>
              <Text style={styles.readBtnText}>Read</Text>
              <Icon name="chevron-right" size={11} color="#B8A8E0" />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#161228',
    borderWidth: 0.75,
    borderColor: 'rgba(107,91,149,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },

  // ── Hero image ──
  imageWrap: { position: 'relative' },
  image:     { width: '100%', aspectRatio: 16 / 9 },

  imageAuthorRow: {
    position: 'absolute',
    top: 10, left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(107,91,149,0.5)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText:       { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#E8E0FF' },
  imageAuthorName:  {
    fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#F0ECFF',
    textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  chapterBadge: {
    position: 'absolute',
    top: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.75, borderColor: 'rgba(255,255,255,0.18)',
  },
  chapterText: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.9)', letterSpacing: 0.3 },

  // ── Below-image content block ──
  contentBlock: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(107,91,149,0.18)',
  },
  chapterTitle: {
    fontSize: 17,
    fontFamily: 'Satoshi-Bold',
    color: '#F0EAFF',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  handleText: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(200,184,232,0.65)',
  },
  titleBadge: {
    fontStyle: 'italic',
    color: 'rgba(200,184,232,0.45)',
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pullQuote: {
    fontSize: 12,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(210,198,255,0.70)',
    fontStyle: 'italic',
    lineHeight: 17,
    marginTop: 2,
  },

  // ── Action bar ──
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  statsGroup: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  statPill:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:   { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' },

  actionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.75, borderColor: 'rgba(107,91,149,0.25)',
  },
  deleteText: { color: '#E04455', fontSize: 9, fontFamily: 'Satoshi-Bold' },

  readBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    height: 30, paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: 'rgba(107,91,149,0.2)',
    borderWidth: 0.75, borderColor: 'rgba(107,91,149,0.45)',
  },
  readBtnText: { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#B8A8E0' },
});
