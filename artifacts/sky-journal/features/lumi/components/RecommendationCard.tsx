import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LumiRecommendation, LumiRecType } from '../types';
import { useLumiChat } from './LumiChatContext';
import { CampfireDiscovery, FriendsDiscovery, GuidesDiscovery, MusicDiscovery } from './DiscoveryCards';

const ICONS: Record<LumiRecType, IconName> = {
  music: 'volume-2', guides: 'compass', friends: 'users', campfire: 'sunrise',
  outfit: 'layers', manga: 'book-open', journal: 'feather', session: 'clock', chat: 'message-circle',
};

/** Fixed, allow-listed route targets. AI output never supplies URLs. */
const CREATOR_ROUTES: Partial<Record<LumiRecType, string>> = {
  outfit: '/create-outfit',
  manga: '/chapter-editor',
};

export function RecommendationCard({ rec, onStartSession, onCheckIn }: {
  rec: LumiRecommendation;
  onStartSession: (minutes: 5 | 15 | 30) => void;
  onCheckIn: () => void;
}) {
  const c = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const chat = useLumiChat();
  const running = !!chat.activeSession;
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(rec.draft ?? '');
  const [minutes, setMinutes] = useState<5 | 15 | 30>(rec.duration ?? 15);

  const label: Record<LumiRecType, string> = {
    music: t('lumi.tag.music', 'Music'), guides: t('lumi.tag.guides', 'Mentor guides'),
    friends: t('lumi.tag.friends', 'Friends'), campfire: t('lumi.tag.campfire', 'Campfire'),
    outfit: t('lumi.tag.outfit', 'Outfit'), manga: t('lumi.tag.manga', 'Manga'),
    journal: t('lumi.tag.journal', 'Journal'), session: t('lumi.tag.session', 'Guided session'),
    chat: t('lumi.tag.chat', 'Chat'),
  };
  const cta: Record<LumiRecType, string> = {
    music: t('lumi.cta.music', 'Find tracks'), guides: t('lumi.cta.guides', 'Show guides'),
    friends: t('lumi.cta.friends', 'Pick a friend'), campfire: t('lumi.cta.campfire', 'Browse rooms'),
    outfit: t('lumi.cta.outfit', 'Open outfit creator'), manga: t('lumi.cta.manga', 'Open manga creator'),
    journal: t('lumi.cta.journal', 'Write it'), session: t('lumi.cta.session', 'Set it up'),
    chat: '',
  };

  function primary() {
    const route = CREATOR_ROUTES[rec.type];
    if (route) { router.push(route as never); return; }
    setExpanded(e => !e);
  }

  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={s.head}>
        <View style={[s.icon, { backgroundColor: c.glowPurple }]}>
          <Icon name={ICONS[rec.type]} size={15} color={c.tint} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.tag, { color: c.tint }]}>{label[rec.type].toUpperCase()}</Text>
          <Text style={[s.title, { color: c.foreground }]} numberOfLines={2}>{rec.title}</Text>
        </View>
      </View>
      {!!rec.reason && <Text style={[s.reason, { color: c.text }]}>{rec.reason}</Text>}

      {expanded && (
        <View style={{ marginTop: 10 }}>
          {rec.type === 'music' && <MusicDiscovery query={rec.query || 'cozy'} />}
          {rec.type === 'guides' && <GuidesDiscovery query={rec.query} />}
          {rec.type === 'friends' && <FriendsDiscovery draft={rec.draft} />}
          {rec.type === 'campfire' && <CampfireDiscovery query={rec.query} />}
          {rec.type === 'journal' && (
            <View style={{ gap: 8 }}>
              <TextInput
                value={draft}
                onChangeText={v => setDraft(v.slice(0, 1000))}
                multiline
                placeholder={t('lumi.journalPh', 'A few words about today...')}
                placeholderTextColor={c.mutedForeground}
                style={[s.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]}
              />
              <Text style={[s.hint, { color: c.mutedForeground }]}>
                {t('lumi.journalHint', 'Nothing is saved yet. You will review it in the journal editor first.')}
              </Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/create-journal-entry', params: { type: 'diary', initialPrompt: draft } } as never)}
                style={[s.solid, { backgroundColor: c.secondary }]} accessibilityRole="button">
                <Text style={[s.solidText, { color: c.secondaryForeground }]}>{t('lumi.reviewJournal', 'Review in journal')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {rec.type === 'session' && (
            <View style={{ gap: 10 }}>
              <View style={s.pills}>
                {([5, 15, 30] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => setMinutes(m)}
                    style={[s.pill, { borderColor: minutes === m ? c.tint : c.border, backgroundColor: minutes === m ? c.glowPurple : 'transparent' }]}>
                    <Text style={[s.pillText, { color: minutes === m ? c.tint : c.text }]}>{t('lumi.minutes', '{{n}} min', { n: m })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {running ? (
                <Text style={[s.hint, { color: c.mutedForeground }]}>{t('lumi.gs.already', 'A guided session is already running below.')}</Text>
              ) : (
                <TouchableOpacity onPress={() => onStartSession(minutes)} style={[s.solid, { backgroundColor: c.secondary }]}>
                  <Text style={[s.solidText, { color: c.secondaryForeground }]}>{t('lumi.startSession', 'Start {{n}} minute session', { n: minutes })}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onCheckIn} style={[s.ghost, { borderColor: c.border, marginTop: 0 }]} accessibilityRole="button">
                <Text style={[s.ghostText, { color: c.tint }]}>{t('lumi.checkIn', 'Or answer a short check-in first')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {!expanded && rec.type !== 'chat' && (
        <TouchableOpacity onPress={primary} style={[s.ghost, { borderColor: c.border }]} accessibilityRole="button">
          <Text style={[s.ghostText, { color: c.tint }]}>{cta[rec.type]}</Text>
          <Icon name="arrow-right" size={13} color={c.tint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 12, marginTop: 8 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tag: { fontFamily: 'Satoshi-Bold', fontSize: 9.5, letterSpacing: 1.2 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 14.5, marginTop: 1 },
  reason: { fontFamily: 'Satoshi-Regular', fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  ghost: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 10 },
  ghostText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
  input: { minHeight: 90, borderWidth: 1, borderRadius: 12, padding: 10, fontFamily: 'Satoshi-Regular', fontSize: 13.5, textAlignVertical: 'top' },
  hint: { fontFamily: 'Satoshi-Regular', fontSize: 11 },
  solid: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  solidText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  pills: { flexDirection: 'row', gap: 8 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontFamily: 'Satoshi-Bold', fontSize: 12.5 },
});
