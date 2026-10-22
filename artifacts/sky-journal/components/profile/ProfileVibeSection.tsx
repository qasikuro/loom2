import { Icon } from '@/components/Icon';
import type { Character } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ATTRIBUTE_SUGGESTIONS, MOOD_ORBS } from './profileConstants';
import { useTranslation } from 'react-i18next';

interface Props {
  character: Character;
  setCharacter: (character: Character) => void;
  onOpenMoodPicker: () => void;
}

export function ProfileVibeSection({ character, setCharacter, onOpenMoodPicker }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const [newTrait, setNewTrait] = useState('');
  const [addingTrait, setAddingTrait] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const currentMood = character.mood || 'Dreamy';
  const moodAccent = MOOD_ORBS.find(mood => mood.key === currentMood)?.accent ?? colors.primary;
  const suggestions = ATTRIBUTE_SUGGESTIONS.filter(
    trait => !character.traits.includes(trait) && trait.toLowerCase().includes(newTrait.toLowerCase()),
  );

  function addTrait(value: string) {
    const trait = value.trim();
    if (!trait || character.traits.includes(trait)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCharacter({ ...character, traits: [...character.traits, trait] });
    setNewTrait('');
    setAddingTrait(false);
    setShowSuggestions(false);
  }

  function removeTrait(trait: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCharacter({ ...character, traits: character.traits.filter(item => item !== trait) });
  }

  return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: `${moodAccent}42` }]}>
      <View style={s.head}>
        <View style={s.heading}>
          <Icon name="star" size={15} color={moodAccent} />
            <Text style={[s.label, { color: colors.foreground }]}>{t('profile.vibeTitle')}</Text>
        </View>
        <View style={s.controls}>
          <TouchableOpacity
            style={[s.moodButton, { backgroundColor: `${moodAccent}18`, borderColor: `${moodAccent}66` }]}
            onPress={onOpenMoodPicker}
            hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Change vibe, currently ${currentMood}`}
          >
            <View style={[s.dot, { backgroundColor: moodAccent }]} />
            <Text style={[s.moodText, { color: colors.foreground }]} numberOfLines={1}>{currentMood}</Text>
            <Icon name="chevron-down" size={12} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.addButton, { backgroundColor: `${colors.tint}0D`, borderColor: `${colors.tint}55` }]}
            onPress={() => { setAddingTrait(true); setShowSuggestions(true); }}
            hitSlop={{ top: 5, bottom: 5, left: 4, right: 4 }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Add trait"
          >
            <Icon name="plus" size={13} color={colors.primary} />
            <Text style={[s.addText, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {addingTrait ? (
        <View style={[s.traitEditor, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            value={newTrait}
            onChangeText={value => { setNewTrait(value); setShowSuggestions(true); }}
            placeholder="Add a trait"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => addTrait(newTrait)}
            onBlur={() => setTimeout(() => {
              if (!newTrait.trim()) { setAddingTrait(false); setShowSuggestions(false); }
            }, 200)}
            accessibilityLabel="New profile trait"
          />
          <TouchableOpacity
            onPress={() => { setAddingTrait(false); setNewTrait(''); setShowSuggestions(false); }}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel adding trait"
          >
            <Icon name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.traits}>
          {character.traits.length > 0 ? character.traits.map((trait, i) => { const tc = [colors.lavender, colors.skyBlue, colors.blush][i % 3]; return (
            <View key={trait} style={[s.traitChip, { backgroundColor: `${tc}1F`, borderColor: `${tc}40` }]}>
              <Text style={[s.traitText, { color: colors.foreground }]} numberOfLines={1}>{trait}</Text>
              <TouchableOpacity
                onPress={() => removeTrait(trait)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${trait} trait`}
              >
                <Icon name="x" size={12} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          ); }) : (
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Add a few traits that feel like you</Text>
          )}
        </ScrollView>
      )}

      {addingTrait && showSuggestions && suggestions.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestions}>
          {suggestions.slice(0, 8).map(trait => (
            <TouchableOpacity
              key={trait}
              style={[s.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => addTrait(trait)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${trait} trait`}
            >
              <Icon name="plus" size={10} color={colors.primary} />
              <Text style={[s.suggestionText, { color: colors.foreground }]}>{trait}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, gap: 10, marginBottom: 10 },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, rowGap: 8, minHeight: 34 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1, minWidth: 96 },
  label: { flexShrink: 1, fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 'auto', flexShrink: 0 },
  moodButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderWidth: 1, borderRadius: 17 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  moodText: { maxWidth: 110, fontSize: 12, fontFamily: 'Satoshi-Bold' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 17 },
  addText: { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  traits: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34, paddingRight: 4 },
  traitChip: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 34, paddingLeft: 13, paddingRight: 10, borderWidth: 1, borderRadius: 17, maxWidth: 160 },
  traitText: { fontSize: 12.5, fontFamily: 'Satoshi-Medium', flexShrink: 1 },
  emptyText: { fontSize: 12.5, fontFamily: 'Satoshi-Regular' },
  traitEditor: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, gap: 8 },
  input: { flex: 1, minWidth: 80, fontSize: 13.5, fontFamily: 'Satoshi-Regular', paddingVertical: 4 },
  suggestions: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 4 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingHorizontal: 12, borderWidth: 1, borderRadius: 17 },
  suggestionText: { fontSize: 12, fontFamily: 'Satoshi-Medium' },
});
