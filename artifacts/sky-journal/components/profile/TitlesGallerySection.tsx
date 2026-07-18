import { Icon } from '@/components/Icon';
import { TITLE_CATALOGUE, isTitleEarned, type TitleDef } from '@/constants/titleCatalogue';
import type { Character, Story, JournalEntry } from '@/context/AppContext';
import type { ConstellationState } from '@/components/ConstellationMap';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';


interface Props {
  character:    Character;
  stories:      Story[];
  journalEntries: JournalEntry[];
  constellation: ConstellationState | null;
  onSetActiveTitle: (title: string | null) => void;
}

export function TitlesGallerySection({
  character,
  stories,
  journalEntries,
  constellation,
  onSetActiveTitle,
}: Props) {
  const colors = useColors();
  const [collapsed, setCollapsed] = useState(false);

  const totalWitnessed    = stories.reduce((sum, s) => sum + (s.witnessedCount ?? 0), 0);
  const storyCount        = stories.length;
  const journalCount      = journalEntries.length;
  const constellationStars = constellation?.unlockedStars?.length ?? 0;

  const stats = { totalWitnessed, storyCount, journalCount, constellationStars };

  const earned  = TITLE_CATALOGUE.filter(t => isTitleEarned(t, stats));
  const locked  = TITLE_CATALOGUE.filter(t => !isTitleEarned(t, stats));

  const activeTitle = character.activeTitle;

  function handleSet(title: TitleDef) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTitle === title.name) {
      onSetActiveTitle(null);
    } else {
      onSetActiveTitle(title.name);
    }
  }

  const milestoneEarned = earned.filter(t => t.category === 'milestone');
  const activityEarned  = earned.filter(t => t.category === 'activity');

  return (
    <View style={s.section}>
      <TouchableOpacity
        style={s.sectionHeader}
        onPress={() => setCollapsed(v => !v)}
        activeOpacity={0.75}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Titles</Text>
          <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
            <Text style={[s.countPillText, { color: colors.primary }]}>{earned.length}/{TITLE_CATALOGUE.length}</Text>
          </View>
        </View>
        <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      {!collapsed && (
        <View style={s.content}>
          {/* Active title indicator */}
          {activeTitle && (
            <View style={[s.activeBanner, { backgroundColor: 'rgba(200,168,75,0.10)', borderColor: 'rgba(200,168,75,0.25)' }]}>
              <Text style={s.activeBannerText}>✦ {activeTitle}</Text>
              <Text style={[s.activeBannerSub, { color: colors.mutedForeground }]}>Displayed on your profile</Text>
            </View>
          )}

          {/* Earned titles */}
          {earned.length > 0 && (
            <>
              <Text style={[s.groupLabel, { color: colors.mutedForeground }]}>
                {milestoneEarned.length > 0 && activityEarned.length > 0
                  ? 'EARNED'
                  : milestoneEarned.length > 0
                    ? 'MILESTONE'
                    : 'ACTIVITY'}
              </Text>
              <View style={s.grid}>
                {earned.map(title => {
                  const isActive = activeTitle === title.name;
                  return (
                    <TouchableOpacity
                      key={title.id}
                      style={[
                        s.card,
                        {
                          backgroundColor: isActive
                            ? `${title.color}20`
                            : `${title.color}0E`,
                          borderColor: isActive ? title.color + '70' : title.color + '28',
                        },
                        isActive && {
                          shadowColor: title.color,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 8,
                          elevation: 4,
                        },
                      ]}
                      onPress={() => handleSet(title)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.cardEmoji}>{title.emoji}</Text>
                      <Text style={[s.cardName, { color: title.color }]}>{title.name}</Text>
                      <Text style={[s.cardFlavour, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {title.flavour}
                      </Text>
                      {isActive ? (
                        <View style={[s.activeTag, { backgroundColor: title.color + '22', borderColor: title.color + '55' }]}>
                          <Icon name="check" size={9} color={title.color} />
                          <Text style={[s.activeTagText, { color: title.color }]}>Active</Text>
                        </View>
                      ) : (
                        <View style={[s.setTag, { borderColor: title.color + '40' }]}>
                          <Text style={[s.setTagText, { color: title.color + 'CC' }]}>Set active</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Locked titles */}
          {locked.length > 0 && (
            <>
              <Text style={[s.groupLabel, { color: colors.mutedForeground, marginTop: earned.length > 0 ? 14 : 0 }]}>
                LOCKED
              </Text>
              <View style={s.grid}>
                {locked.map(title => (
                  <View
                    key={title.id}
                    style={[s.card, s.cardLocked, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }]}
                  >
                    <Text style={[s.cardEmoji, { opacity: 0.25 }]}>{title.emoji}</Text>
                    <Text style={[s.cardName, { color: 'rgba(200,184,232,0.35)' }]}>{title.name}</Text>
                    <View style={s.lockRow}>
                      <Icon name="lock" size={9} color="rgba(200,184,232,0.25)" />
                      <Text style={[s.cardFlavour, { color: 'rgba(200,184,232,0.28)', flex: 1 }]} numberOfLines={2}>
                        {title.unlockHint}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {earned.length === 0 && (
            <View style={[s.emptyHint, { borderColor: 'rgba(200,184,232,0.10)', backgroundColor: 'rgba(200,184,232,0.04)' }]}>
              <Text style={{ fontSize: 22, marginBottom: 4 }}>✦</Text>
              <Text style={[s.emptyHintText, { color: colors.mutedForeground }]}>
                Write stories and collect witnesses to earn your first title
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  countPill:    { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  countPillText:{ fontSize: 10, fontFamily: 'Satoshi-Bold' },
  content:      { gap: 0 },
  activeBanner: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 14, gap: 2 },
  activeBannerText: { fontSize: 13, fontFamily: 'Satoshi-Bold', color: '#C8A84B', letterSpacing: 0.3 },
  activeBannerSub:  { fontSize: 11, fontFamily: 'Satoshi-Regular' },
  groupLabel:   { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card:         { width: '47.5%', borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 5 },
  cardLocked:   {},
  cardEmoji:    { fontSize: 22 },
  cardName:     { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  cardFlavour:  { fontSize: 11, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', lineHeight: 15, marginTop: 2 },
  activeTag:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  activeTagText:{ fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2 },
  setTag:       { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
  setTagText:   { fontSize: 10, fontFamily: 'Satoshi-Regular', letterSpacing: 0.2 },
  lockRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 },
  emptyHint:    { borderRadius: 14, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 16, alignItems: 'center', gap: 4, marginTop: 4 },
  emptyHintText:{ fontSize: 12, fontFamily: 'Satoshi-Regular', fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
});
