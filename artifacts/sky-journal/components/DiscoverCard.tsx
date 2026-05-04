import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { Images, type ImageKey } from '@/assets/images';
import { useColors } from '@/hooks/useColors';
import { SHADOW } from '@/constants/colors';
import type { DiscoverPost } from '@/context/AppContext';

interface DiscoverCardProps {
  post: DiscoverPost;
  onPress?: () => void;
  onSave?: () => void;
}

export function DiscoverCard({ post, onPress, onSave }: DiscoverCardProps) {
  const colors = useColors();
  const imageSource = Images[post.imageKey as ImageKey] ?? Images.story_bg1;
  const initial = post.authorName.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, SHADOW.sm]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Author header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28`, borderWidth: 1.5 }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        </View>
        <View style={styles.authorMeta}>
          <Text style={[styles.authorName, { color: colors.foreground }]}>{post.authorName}</Text>
          <Text style={[styles.authorHandle, { color: colors.mutedForeground }]}>{post.authorHandle} · {post.timeAgo}</Text>
        </View>
        <View style={[styles.chapterBadge, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}22` }]}>
          <Text style={[styles.chapterText, { color: colors.primary }]}>Ch. {post.chapterNumber}</Text>
        </View>
      </View>

      {/* Cover image */}
      <View style={styles.imageWrap}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" />
        <View style={[styles.imageOverlay]} />
      </View>

      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{post.chapterTitle}</Text>
        <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>
          {post.storySnippet}
        </Text>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.statsGroup}>
            <View style={styles.statItem}>
              <Feather name="eye" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                {post.witnessedCount >= 1000
                  ? `${(post.witnessedCount / 1000).toFixed(1)}k`
                  : post.witnessedCount} witnessed
              </Text>
            </View>
            <View style={[styles.statDot, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Feather name="bookmark" size={12} color={colors.mutedForeground} />
              <Text style={[styles.statText, { color: colors.mutedForeground }]}>{post.savedCount}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <MoodBadge mood={post.vibe} size="sm" />
            <TouchableOpacity
              onPress={onSave}
              style={[styles.saveBtn, { backgroundColor: post.saved ? `${colors.primary}15` : colors.muted, borderColor: post.saved ? `${colors.primary}30` : colors.border }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather
                name={post.saved ? 'bookmark' : 'bookmark'}
                size={15}
                color={post.saved ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
  authorMeta: { flex: 1, gap: 1 },
  authorName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  authorHandle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  chapterBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  chapterText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 16 / 9 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(30,24,48,0.04)',
  },
  body: { padding: 14, paddingTop: 12, gap: 6 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  snippet: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot: { width: 3, height: 3, borderRadius: 1.5 },
  statText: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtn: {
    width: 32, height: 32, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
