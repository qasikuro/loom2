import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
}

export function DiscoverCard({ post, onPress, onSave, onDelete }: DiscoverCardProps) {
  const colors   = useColors();
  const initial  = post.authorName.charAt(0).toUpperCase();
  const gradient = getGradient(post.mood);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          <Text style={[styles.authorHandle, { color: colors.mutedForeground }]}>
            {post.authorHandle} · {post.timeAgo}
          </Text>
        </View>
        <View style={[styles.chapterBadge, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}22` }]}>
          <Text style={[styles.chapterText, { color: colors.primary }]}>Ch. {post.chapterNumber}</Text>
        </View>
      </View>

      {/* Cover — real image if available, dark gradient placeholder otherwise */}
      <View style={styles.imageWrap}>
        {post.imageUri ? (
          <>
            <Image source={{ uri: post.imageUri }} style={styles.image} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(20,16,40,0.55)']}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <LinearGradient colors={gradient} style={styles.image} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {/* Star particles for atmosphere */}
            <View style={styles.placeholderInner}>
              <Feather name="star" size={11} color="rgba(200,184,232,0.25)" style={{ position:'absolute', top:18, left:28 }} />
              <Feather name="star" size={7}  color="rgba(200,184,232,0.18)" style={{ position:'absolute', top:30, right:44 }} />
              <Feather name="star" size={9}  color="rgba(200,184,232,0.20)" style={{ position:'absolute', bottom:24, left:60 }} />
              <Feather name="moon" size={28} color="rgba(200,184,232,0.10)" style={{ position:'absolute', top:14, right:20 }} />
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
            {onDelete && (
              <TouchableOpacity
                onPress={handleDeletePress}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: confirmingDelete ? '#E04455' : colors.muted,
                    borderColor:     confirmingDelete ? '#E04455' : colors.border,
                    width: confirmingDelete ? 'auto' : 32,
                    paddingHorizontal: confirmingDelete ? 8 : 0,
                  },
                ]}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                activeOpacity={0.75}
              >
                {confirmingDelete
                  ? <Text style={styles.deleteConfirmText}>Delete?</Text>
                  : <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onSave}
              style={[styles.saveBtn, {
                backgroundColor: post.saved ? `${colors.primary}15` : colors.muted,
                borderColor:     post.saved ? `${colors.primary}30` : colors.border,
              }]}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Feather
                name="bookmark"
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
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.3 },
  authorMeta: { flex: 1, gap: 1 },
  authorName:   { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  authorHandle: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  chapterBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  chapterText:  { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.2 },
  imageWrap:    { position: 'relative' },
  image:        { width: '100%', aspectRatio: 16 / 9 },
  placeholderInner: { flex: 1, position: 'relative' },
  body:    { padding: 14, paddingTop: 12, gap: 6 },
  title:   { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: -0.2 },
  snippet: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, fontStyle: 'italic' },
  footer:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  statsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statItem:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statDot:    { width: 3, height: 3, borderRadius: 1.5 },
  statText:   { fontSize: 11, fontFamily: 'Inter_400Regular' },
  actions:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtn:    { height: 32, minWidth: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
