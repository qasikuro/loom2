import { Icon } from '@/components/Icon';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { DiscoverPost } from '@/context/AppContext';

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

interface DiscoverCardProps {
  post: DiscoverPost;
  onPress?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onAuthorPress?: () => void;
}

export function DiscoverCard({ post, onPress, onSave, onDelete, onReport, onAuthorPress }: DiscoverCardProps) {
  const colors   = useColors();
  const initial  = post.authorName.charAt(0).toUpperCase();
  const gradient = getGradient(post.mood);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Entrance animation — card drifts up from below and fades in
  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountY       = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.spring(mountY, {
        toValue: 0,
        tension: 55,
        friction: 9,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    <Animated.View style={{ opacity: mountOpacity, transform: [{ translateY: mountY }] }}>
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {/* Author header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.avatar, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28`, borderWidth: 1.5 }]}
          onPress={onAuthorPress}
          activeOpacity={onAuthorPress ? 0.75 : 1}
          disabled={!onAuthorPress}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.authorMeta}
          onPress={onAuthorPress}
          activeOpacity={onAuthorPress ? 0.75 : 1}
          disabled={!onAuthorPress}
        >
          <Text style={[styles.authorName, { color: colors.foreground }]}>{post.authorName}</Text>
          <Text style={[styles.authorHandle, { color: colors.mutedForeground }]}>
            {post.authorHandle} · {post.timeAgo}
          </Text>
        </TouchableOpacity>
        <View style={[styles.chapterBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}28` }]}>
          <Text style={[styles.chapterText, { color: colors.primary }]}>Ch. {post.chapterNumber}</Text>
        </View>
      </View>

      {/* Cover image */}
      <View style={styles.imageWrap}>
        {post.imageUri ? (
          <>
            <Image source={{ uri: post.imageUri }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(20,16,40,0.6)']}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <LinearGradient colors={gradient} style={styles.image} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.placeholderInner}>
              <Icon name="star" size={11} color="rgba(200,184,232,0.25)" style={{ position: 'absolute', top: 18, left: 28 }} />
              <Icon name="star" size={7}  color="rgba(200,184,232,0.18)" style={{ position: 'absolute', top: 30, right: 44 }} />
              <Icon name="star" size={9}  color="rgba(200,184,232,0.20)" style={{ position: 'absolute', bottom: 24, left: 60 }} />
              <Icon name="moon" size={28} color="rgba(200,184,232,0.10)" style={{ position: 'absolute', top: 14, right: 20 }} />
            </View>
          </LinearGradient>
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{post.chapterTitle}</Text>
        {post.storySnippet ? (
          <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>
            {post.storySnippet}
          </Text>
        ) : null}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.statsGroup}>
            <View style={styles.statItem}>
              <Icon name="eye" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {post.witnessedCount >= 1000
                  ? `${(post.witnessedCount / 1000).toFixed(1)}k`
                  : post.witnessedCount} witnessed
              </Text>
            </View>
            <View style={[styles.statDot, { backgroundColor: colors.border }]} />
            <MoodBadge mood={post.vibe} size="sm" />
          </View>

          <View style={styles.actions}>
            {onDelete && (
              <TouchableOpacity
                onPress={handleDeletePress}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: confirmingDelete ? '#E04455' : colors.muted,
                    borderColor:     confirmingDelete ? '#E04455' : colors.border,
                    width: confirmingDelete ? undefined : 36,
                    paddingHorizontal: confirmingDelete ? 10 : 0,
                  },
                ]}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                activeOpacity={0.75}
              >
                {confirmingDelete
                  ? <Text style={styles.deleteConfirmText}>Delete?</Text>
                  : <Icon name="trash-2" size={14} color={colors.mutedForeground} />
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onSave}
              style={[styles.actionBtn, {
                backgroundColor: post.saved ? `${colors.primary}18` : colors.muted,
                borderColor:     post.saved ? `${colors.primary}35` : colors.border,
                width: 36,
              }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Icon
                name="bookmark"
                size={15}
                color={post.saved ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            {onReport && (
              <TouchableOpacity
                onPress={onReport}
                style={[styles.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border, width: 36 }]}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Icon name="flag" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            {/* Read CTA */}
            <TouchableOpacity
              onPress={onPress}
              style={[styles.readBtn, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}35` }]}
              activeOpacity={0.82}
            >
              <Text style={[styles.readBtnText, { color: colors.primary }]}>Read</Text>
              <Icon name="chevron-right" size={13} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 10,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText:   { fontSize: 16, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  authorMeta:   { flex: 1, gap: 2 },
  authorName:   { fontSize: 14, fontFamily: 'Satoshi-Bold' },
  authorHandle: { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  chapterBadge: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1,
  },
  chapterText: { fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },

  imageWrap:       { position: 'relative' },
  image:           { width: '100%', aspectRatio: 16 / 9 },
  placeholderInner: { flex: 1, position: 'relative' },

  body:    { padding: 14, paddingTop: 13, gap: 8 },
  title:   { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  snippet: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    lineHeight: 20, fontStyle: 'italic', opacity: 0.82,
  },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 2,
  },
  statsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot:    { width: 3, height: 3, borderRadius: 1.5 },
  statText:   { fontSize: 11, fontFamily: 'Satoshi-Regular' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: {
    height: 36, minWidth: 36, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteConfirmText: { color: '#fff', fontSize: 11, fontFamily: 'Satoshi-Bold' },

  readBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    height: 36, paddingHorizontal: 13,
    borderRadius: 11, borderWidth: 1,
  },
  readBtnText: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
});
