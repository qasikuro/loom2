import { Icon } from '@/components/Icon';
import { ConstellationMap, type ConstellationState } from '@/components/ConstellationMap';
import type { Story } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConstellationProgressCard } from './ConstellationProgressCard';
import { getCover } from './profileConstants';

interface Props {
  constellation: ConstellationState | null;
  stories: Story[];
  animTrigger: number;
  setSelectedStarKey: (k: string | null) => void;
  setShowTitlePicker: (v: boolean) => void;
  availableTitles: string[];
}

export function ProfileJourneySection({
  constellation, stories, animTrigger,
  setSelectedStarKey, setShowTitlePicker, availableTitles,
}: Props) {
  const colors = useColors();

  return (
    <>
      {/* ── My Constellation ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>My Constellation</Text>
            {constellation?.activeTitle && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(200,168,75,0.14)', borderWidth: 1, borderColor: 'rgba(200,168,75,0.28)' }}
                onPress={() => availableTitles.length > 1 && setShowTitlePicker(true)}
                activeOpacity={availableTitles.length > 1 ? 0.7 : 1}
                disabled={availableTitles.length <= 1}
              >
                <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.2 }}>
                  {constellation.activeTitle}
                </Text>
                {availableTitles.length > 1 && <Icon name="chevron-down" size={8} color="rgba(200,168,75,0.55)" />}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <ConstellationMap
            state={constellation}
            onStarPress={key => setSelectedStarKey(key)}
            animKey={animTrigger}
          />
        </View>

        {constellation && <ConstellationProgressCard constellation={constellation} triggerAnim={animTrigger} />}

        {!constellation && (
          <View style={[s.emptyCard, { marginHorizontal: 16, backgroundColor: 'rgba(107,91,149,0.06)', borderColor: 'rgba(107,91,149,0.15)' }]}>
            <View style={[s.emptyIcon, { backgroundColor: 'rgba(107,91,149,0.10)' }]}>
              <Text style={{ fontSize: 20 }}>✦</Text>
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>Stars await you</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Journal, create stories, and connect with others to unlock your constellation</Text>
          </View>
        )}
      </View>

      {/* ── My Stories ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>My Stories</Text>
            {stories.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                <Text style={[s.countPillText, { color: colors.primary }]}>{stories.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]}
            onPress={() => router.push('/my-stories' as any)}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="book-open" size={12} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {stories.length === 0 ? (
          <TouchableOpacity
            style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]}
            onPress={() => router.push('/(tabs)/create' as any)}
            activeOpacity={0.75}
          >
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}>
              <Icon name="book-open" size={20} color={`${colors.primary}70`} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No chapters yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Tap to write your first sky chapter</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {stories.slice(0, 8).map(story => {
              const cover = getCover(story);
              return (
                <TouchableOpacity
                  key={story.id}
                  style={[s.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => { Haptics.selectionAsync(); router.push(`/story/${story.id}` as any); }}
                  activeOpacity={0.85}
                >
                  {cover ? (
                    <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={['#2E2260', '#1A1040']} style={StyleSheet.absoluteFill}>
                      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Icon name="star" size={18} color="rgba(200,184,232,0.25)" />
                      </View>
                    </LinearGradient>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                    <Text style={s.storyTitle} numberOfLines={2}>{story.chapterTitle}</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {story.witnessedCount > 0 && (
                        <View style={[s.viewCount, { backgroundColor: 'rgba(8,6,22,0.60)' }]}>
                          <Icon name="eye" size={9} color="rgba(220,200,255,0.85)" />
                          <Text style={s.viewCountText}>{story.witnessedCount}</Text>
                        </View>
                      )}
                      {(story.stickerCount ?? 0) > 0 && (
                        <View style={[s.viewCount, { backgroundColor: 'rgba(8,6,22,0.60)' }]}>
                          <Text style={{ fontSize: 9, color: 'rgba(255,210,100,0.85)', lineHeight: 12 }}>✦</Text>
                          <Text style={s.viewCountText}>{story.stickerCount}</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                  {!story.isPublic && (
                    <View style={{ position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(8,6,22,0.65)', borderRadius: 6, padding: 3 }}>
                      <Icon name="lock" size={9} color="rgba(200,184,232,0.7)" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[s.addCard, { borderColor: `${colors.primary}28`, backgroundColor: `${colors.primary}08` }]}
              onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/create' as any); }}
              activeOpacity={0.75}
            >
              <Icon name="plus" size={18} color={`${colors.primary}70`} />
              <Text style={[s.addCardText, { color: `${colors.primary}70` }]}>New</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  countPill:    { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  countPillText:{ fontSize: 10, fontFamily: 'Satoshi-Bold' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  addBtnText:   { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  scrollPad:    { paddingRight: 16, gap: 10 },
  storyCard:    { width: 110, height: 150, borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  storyTitle:   { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)', lineHeight: 13 },
  viewCount:    { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  viewCountText:{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(220,200,255,0.9)' },
  addCard:      { width: 80, height: 150, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addCardText:  { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  emptyCard:    { borderRadius: 16, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyIcon:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle:   { fontSize: 14, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptySub:     { fontSize: 12, fontFamily: 'Satoshi-Regular', textAlign: 'center', fontStyle: 'italic', lineHeight: 17 },
});
