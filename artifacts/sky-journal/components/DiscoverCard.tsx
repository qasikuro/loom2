import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MoodBadge } from '@/components/MoodBadge';
import { Images, type ImageKey } from '@/assets/images';
import { useColors } from '@/hooks/useColors';
import type { DiscoverPost } from '@/context/AppContext';

interface DiscoverCardProps {
  post: DiscoverPost;
  onPress?: () => void;
  onSave?: () => void;
}

export function DiscoverCard({ post, onPress, onSave }: DiscoverCardProps) {
  const colors = useColors();
  const imageSource = Images[post.imageKey as ImageKey] ?? Images.story_bg1;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {post.authorName.charAt(0)}
          </Text>
        </View>
        <View style={styles.authorInfo}>
          <Text style={[styles.authorName, { color: colors.foreground }]}>{post.authorName}</Text>
          <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{post.timeAgo}</Text>
        </View>
        <View style={[styles.chapterBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}30` }]}>
          <Text style={[styles.chapterText, { color: colors.primary }]}>Chapter {post.chapterNumber}</Text>
        </View>
      </View>
      <Image source={imageSource} style={styles.image} resizeMode="cover" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]}>{post.chapterTitle}</Text>
        <Text style={[styles.snippet, { color: colors.mutedForeground }]} numberOfLines={2}>
          {post.storySnippet}
        </Text>
        <View style={styles.footer}>
          <View style={styles.statsRow}>
            <Feather name="eye" size={13} color={colors.mutedForeground} />
            <Text style={[styles.statNum, { color: colors.mutedForeground }]}>{post.witnessedCount}</Text>
            <Feather name="star" size={13} color={colors.accent} style={{ marginLeft: 10 }} />
            <Text style={[styles.statNum, { color: colors.mutedForeground }]}>{post.savedCount}</Text>
          </View>
          <View style={styles.actions}>
            <MoodBadge mood={post.vibe} size="sm" />
            <TouchableOpacity
              onPress={onSave}
              style={[
                styles.saveBtn,
                {
                  backgroundColor: post.saved ? `${colors.primary}20` : 'transparent',
                },
              ]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather
                name="bookmark"
                size={16}
                color={post.saved ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginLeft: 4 }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  timeAgo: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  chapterBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  chapterText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  image: {
    width: '100%',
    height: 200,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  snippet: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNum: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtn: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
});
