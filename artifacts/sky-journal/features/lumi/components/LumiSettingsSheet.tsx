import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useLumiMusic } from '../music/LumiMusicProvider';
import { useColors } from '@/hooks/useColors';
import { LumiPreferences } from '../types';

export function LumiSettingsSheet({ visible, onClose, remember, preferences, saving, onSave, onClear }: {
  visible: boolean;
  onClose: () => void;
  remember: boolean;
  preferences: LumiPreferences;
  saving: boolean;
  onSave: (remember: boolean, prefs: LumiPreferences) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}) {
  const c = useColors();
  const { t } = useTranslation();
  const lumiMusic = useLumiMusic();
  const insets = useSafeAreaInsets();
  const [rem, setRem] = useState(remember);
  const [game, setGame] = useState(preferences.game ?? '');
  const [music, setMusic] = useState(preferences.musicStyle ?? '');
  const [dur, setDur] = useState<5 | 15 | 30 | undefined>(preferences.duration);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRem(remember); setGame(preferences.game ?? ''); setMusic(preferences.musicStyle ?? '');
    setDur(preferences.duration); setStatus(null);
  }, [visible, remember, preferences]);

  async function save() {
    const ok = await onSave(rem, {
      game: game.trim().slice(0, 60) || undefined,
      musicStyle: music.trim().slice(0, 40) || undefined,
      duration: dur,
    });
    setStatus(ok ? t('lumi.saved', 'Saved.') : t('lumi.saveFailed', 'Could not save. Please try again.'));
    if (ok) onClose();
  }

  function confirmClear() {
    const run = async () => {
      const ok = await onClear();
      setStatus(ok ? t('lumi.cleared', 'Conversation history deleted.') : t('lumi.clearFailed', 'Could not delete history. Please try again.'));
    };
    const title = t('lumi.clearTitle', 'Delete conversation history?');
    const body = t('lumi.clearBody', 'This removes your saved Lumi messages from this device and your account. It cannot be undone.');
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) void run();
      return;
    }
    Alert.alert(title, body, [
      { text: t('lumi.cancel', 'Cancel'), style: 'cancel' },
      { text: t('lumi.delete', 'Delete'), style: 'destructive', onPress: () => { void run(); } },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[s.backdrop, { backgroundColor: c.overlay }]}>
        <View style={[s.sheet, { backgroundColor: c.card, paddingBottom: insets.bottom + 18 }]}>
          <View style={s.headRow}>
            <Text style={[s.h, { color: c.foreground }]}>{t('lumi.settings', 'Lumi and your privacy')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel={t('lumi.close', 'Close')}>
              <Icon name="x" size={20} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[s.notice, { backgroundColor: c.glowPurple }]}>
              <Icon name="shield" size={16} color={c.tint} />
              <Text style={[s.noticeText, { color: c.text }]}>
                {t('lumi.disclosure', 'Messages you send to Lumi are processed by an AI service to write replies. Lumi cannot see your games or your other chats. Suggestions are ideas only; nothing is posted, sent, or joined unless you choose to.')}
              </Text>
            </View>

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: c.foreground }]}>{t('lumi.remember', 'Save conversation history')}</Text>
                <Text style={[s.sub, { color: c.mutedForeground }]}>{t('lumi.rememberSub', 'Off by default. When on, Lumi keeps recent messages on your account so you can continue later.')}</Text>
              </View>
              <Switch value={rem} onValueChange={setRem} trackColor={{ true: c.tint, false: c.muted }} />
            </View>

            <Text style={[s.section, { color: c.mutedForeground }]}>{t('lumi.prefs', 'PREFERENCES')}</Text>
            <Field c={c} label={t('lumi.prefGame', 'Game you play most')} value={game} onChange={setGame} />
            <Field c={c} label={t('lumi.prefMusic', 'Music style')} value={music} onChange={setMusic} />
            <View>
              <Text style={[s.label, { color: c.foreground, marginBottom: 8 }]}>{t('lumi.prefDuration', 'Usual session length')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {([5, 15, 30] as const).map(m => (
                  <TouchableOpacity key={m} onPress={() => setDur(dur === m ? undefined : m)}
                    style={[s.pill, { borderColor: dur === m ? c.tint : c.border, backgroundColor: dur === m ? c.glowPurple : 'transparent' }]}>
                    <Text style={{ color: dur === m ? c.tint : c.text, fontFamily: 'Satoshi-Bold', fontSize: 12.5 }}>{t('lumi.minutes', '{{n}} min', { n: m })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!!status && <Text style={[s.sub, { color: c.text }]}>{status}</Text>}

            <TouchableOpacity disabled={saving} onPress={() => { void save(); }}
              style={[s.solid, { backgroundColor: c.secondary, opacity: saving ? 0.6 : 1 }]}>
              <Text style={[s.solidText, { color: c.secondaryForeground }]}>{saving ? t('lumi.saving', 'Saving...') : t('lumi.save', 'Save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmClear} style={s.dangerRow}>
              <Icon name="trash-2" size={15} color={c.destructive} />
              <Text style={[s.label, { color: c.destructive }]}>{t('lumi.deleteHistory', 'Delete conversation history')}</Text>
            </TouchableOpacity>
            <Text style={[s.sub, { color: c.mutedForeground }]}>
              {t('lumi.music.favDisclosure', 'Saved tracks stay only on this device, for your account. Saved: {{n}}', { n: lumiMusic.favorites.length })}
            </Text>
            {lumiMusic.favorites.length > 0 && (
              <TouchableOpacity onPress={lumiMusic.clearFavorites} style={s.dangerRow}>
                <Icon name="heart" size={15} color={c.destructive} />
                <Text style={[s.label, { color: c.destructive }]}>{t('lumi.music.clearFavs', 'Clear saved tracks')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({ c, label, value, onChange }: { c: ReturnType<typeof useColors>; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Text style={[s.label, { color: c.foreground, marginBottom: 6 }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} maxLength={60}
        style={[s.input, { color: c.foreground, borderColor: c.border, backgroundColor: c.background }]} />
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '88%' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  h: { fontFamily: 'Satoshi-Bold', fontSize: 18 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14 },
  noticeText: { flex: 1, fontFamily: 'Satoshi-Regular', fontSize: 12.5, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  sub: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 2, lineHeight: 17 },
  section: { fontFamily: 'Satoshi-Bold', fontSize: 10.5, letterSpacing: 1.3 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontFamily: 'Satoshi-Regular', fontSize: 14 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  solid: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  solidText: { fontFamily: 'Satoshi-Bold', fontSize: 14 },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 6 },
});
