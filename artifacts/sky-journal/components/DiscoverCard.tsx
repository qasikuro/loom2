import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import type { DiscoverPost } from '@/context/AppContext';

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
  post: DiscoverPost;
  onPress?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onAuthorPress?: () => void;
  delay?: number;
}

export function DiscoverCard({ post, onPress, onSave, onDelete, onReport, onAuthorPress, delay = 0 }: DiscoverCardProps) {
  const colors   = useColors();
  const initial  = post.authorName.charAt(0).toUpperCase();
  const gradient = getGradient(post.mood);

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
        {/* ── Image hero area ── */}
        <View style={styles.imageWrap}>
          {post.imageUri ? (
            <Image
              source={{ uri: post.imageUri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient colors={gradient} style={styles.image} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}>
              {/* subtle star pattern */}
              {[
                { t: 18, l: 22, s: 2.5, o: 0.3 },
                { t: 38, r: 32,  s: 2,   o: 0.22 },
                { t: 70, l: 55,  s: 1.5, o: 0.18 },
                { t: 90, r: 18,  s: 3,   o: 0.25 },
                { t: 120, l: 30, s: 2,   o: 0.2 },
              ].map((s, i) => (
                <View key={i} style={{
                  position: 'absolute', top: s.t,
                  left: 'l' in s ? (s as any).l : undefined,
                  right: 'r' in s ? (s as any).r : undefined,
                  width: s.s, height: s.s, borderRadius: s.s,
                  backgroundColor: '#C8B8E8', opacity: s.o,
                }} />
              ))}
            </LinearGradient>
          )}

          {/* Top gradient scrim for author row */}
          <LinearGradient
            colors={['rgba(0,0,0,0.58)', 'rgba(0,0,0,0.18)', 'transparent']}
            style={[StyleSheet.absoluteFill, { height: '55%' }]}
            pointerEvents="none"
          />
          {/* Bottom gradient scrim for title */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.72)']}
            style={[StyleSheet.absoluteFill, { top: '45%' }]}
            pointerEvents="none"
          />

          {/* Author row — overlaid on image top */}
          <View style={styles.imageHeader}>
            <TouchableOpacity
              style={styles.avatarRow}
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
              <View style={styles.authorMeta}>
                <Text style={styles.authorName}>{post.authorName}</Text>
                <Text style={styles.authorSub}>
                  {post.authorHandle ? `${post.authorHandle} · ` : ''}{post.timeAgo}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.chapterBadge}>
              <Text style={styles.chapterText}>Ch. {post.chapterNumber}</Text>
            </View>
          </View>

          {/* Title + snippet — overlaid on image bottom */}
          <View style={styles.imageFooter}>
            <Text style={styles.titleOverlay} numberOfLines={2}>{post.chapterTitle}</Text>
            {!!post.storySnippet && (
              <Text style={styles.snippetOverlay} numberOfLines={1}>{post.storySnippet}</Text>
            )}
          </View>
        </View>

        {/* ── Action bar below image ── */}
        <View style={styles.actionBar}>
          {/* Left: stats */}
          <View style={styles.statsGroup}>
            <View style={styles.statPill}>
              <Icon name="eye" size={10} color="rgba(200,184,232,0.55)" />
              <Text style={styles.statText}>
                {post.witnessedCount >= 1000
                  ? `${(post.witnessedCount / 1000).toFixed(1)}k`
                  : post.witnessedCount}
              </Text>
            </View>
            <MoodBadge mood={post.vibe} size="sm" />
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

  /* Image hero */
  imageWrap: { position: 'relative' },
  image:     { width: '100%', aspectRatio: 4 / 3 },

  imageHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(107,91,149,0.5)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText:   { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#E8E0FF' },
  authorMeta:   { flex: 1, gap: 1 },
  authorName:   { fontSize: 12, fontFamily: 'Satoshi-Bold', color: '#F0ECFF', letterSpacing: 0.1 },
  authorSub:    { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(220,210,255,0.65)' },

  chapterBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 0.75, borderColor: 'rgba(255,255,255,0.18)',
  },
  chapterText: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(220,210,255,0.9)', letterSpacing: 0.3 },

  imageFooter: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 13,
    paddingBottom: 13,
    paddingTop: 24,
    gap: 3,
  },
  titleOverlay: {
    fontSize: 16,
    fontFamily: 'Satoshi-Bold',
    color: '#F8F4FF',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  snippetOverlay: {
    fontSize: 11,
    fontFamily: 'Satoshi-Regular',
    color: 'rgba(210,200,255,0.65)',
    fontStyle: 'italic',
    lineHeight: 15,
  },

  /* Action bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(107,91,149,0.2)',
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  statsGroup:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statPill:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText:     { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)' },

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
