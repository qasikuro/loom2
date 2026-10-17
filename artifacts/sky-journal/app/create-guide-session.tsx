import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { persistImageUri } from '@/utils/persistImage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

function defaultDate(): string {
  const value = new Date(Date.now() + 24 * 60 * 60_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

interface GuideTutorialChoice {
  id: string; title: string; description: string; topic: string | null;
  status: 'draft' | 'published'; steps: { id: string; title: string }[];
}

export default function CreateGuideSessionScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tutorialId?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('30');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [tutorials, setTutorials] = useState<GuideTutorialChoice[]>([]);
  const [tutorialId, setTutorialId] = useState<string | null>(typeof params.tutorialId === 'string' ? params.tutorialId : null);
  const [tutorialsState, setTutorialsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const startsAt = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);

  useEffect(() => {
    let live = true;
    setTutorialsState('loading');
    apiFetch<GuideTutorialChoice[]>('/guide-tutorials?mine=true')
      .then(rows => {
        if (!live) return;
        const published = rows.filter(row => row.status === 'published');
        setTutorials(published);
        setTutorialsState('ready');
        const preset = typeof params.tutorialId === 'string' ? published.find(row => row.id === params.tutorialId) : undefined;
        if (preset) {
          setTitle(cur => cur || preset.title);
          setDescription(cur => cur || preset.description);
          setTopic(cur => cur || (preset.topic ?? ''));
        } else if (typeof params.tutorialId === 'string') {
          setTutorialId(cur => cur === params.tutorialId ? null : cur);
        }
      })
      .catch(() => { if (live) { setTutorials([]); setTutorialsState('error'); } });
    return () => { live = false; };
  }, [params.tutorialId, reloadKey]);

  async function chooseCover() {
    setFormError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFormError(t('discoverLog.coverPermission'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) setCoverUri(result.assets[0].uri);
    } catch {
      setFormError(t('discoverLog.coverPickError'));
    }
  }

  async function createSession() {
    if (!title.trim() || description.trim().length < 10 || Number.isNaN(startsAt.getTime())) {
      setFormError(t('social.checkSessionBody'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const managedCoverUri = coverUri ? await persistImageUri(coverUri) : null;
      const session = await apiFetch<{ id: string }>('/guide-sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          topic: topic.trim() || null,
          startsAt: startsAt.toISOString(),
          durationMinutes: Number(duration),
          capacity: Number(capacity),
          coverImageUri: managedCoverUri,
          tutorialId,
        }),
      });
      Alert.alert(t('social.sessionScheduled'), t('social.sessionScheduledBody'));
      router.replace(`/guide-session/${session.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('social.tryAgain');
      setFormError(message || t('discoverLog.coverSaveError'));
    } finally {
      setSaving(false);
    }
  }

  const top = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>{t('social.createGuideSession')}</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{t('social.sessionJoinInfo')}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <View style={[s.coverPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={s.coverHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>{t('discoverLog.sessionCover')}</Text>
              <Text style={[s.coverHint, { color: colors.mutedForeground }]}>{t('discoverLog.sessionCoverHint')}</Text>
            </View>
            {coverUri ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('discoverLog.removeCover')} onPress={() => setCoverUri(null)} style={s.removeCover}>
                <Icon name="x" size={17} color={colors.foreground} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={chooseCover} activeOpacity={0.85} style={[s.coverPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={s.coverEditPill}><Icon name="image" size={14} color="#fff" /><Text style={s.coverEditText}>{t('discoverLog.changeCover')}</Text></View>
              </>
            ) : (
              <View style={s.coverEmpty}>
                <View style={[s.coverIcon, { backgroundColor: `${colors.tint}18` }]}><Icon name="image" size={22} color={colors.tint} /></View>
                <Text style={[s.coverEmptyTitle, { color: colors.foreground }]}>{t('discoverLog.addCover')}</Text>
                <Text style={[s.coverEmptySub, { color: colors.mutedForeground }]}>{t('discoverLog.coverOptional')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={[s.tutorialPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={s.coverHead}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>Session tutorial</Text>
              <Text style={[s.coverHint, { color: colors.mutedForeground }]}>Participants can follow the steps during the session.</Text>
            </View>
            <Icon name="book-open" size={18} color={colors.primary} />
          </View>
          <TouchableOpacity onPress={() => setTutorialId(null)} style={[
            s.tutorialOption,
            { borderColor: tutorialId === null ? colors.primary : colors.border, backgroundColor: tutorialId === null ? `${colors.primary}10` : colors.background },
          ]}>
            <Icon name={tutorialId === null ? 'check-circle' : 'circle'} size={16} color={tutorialId === null ? colors.primary : colors.mutedForeground} />
            <Text style={[s.tutorialOptionTitle, { color: colors.foreground }]}>Create without a tutorial</Text>
          </TouchableOpacity>
          {tutorials.map(tutorial => (
            <TouchableOpacity key={tutorial.id} onPress={() => {
              setTutorialId(tutorial.id);
              if (!title.trim()) setTitle(tutorial.title);
              if (!description.trim()) setDescription(tutorial.description);
              if (!topic.trim() && tutorial.topic) setTopic(tutorial.topic);
            }} style={[
              s.tutorialOption,
              { borderColor: tutorialId === tutorial.id ? colors.primary : colors.border, backgroundColor: tutorialId === tutorial.id ? `${colors.primary}10` : colors.background },
            ]}>
              <Icon name={tutorialId === tutorial.id ? 'check-circle' : 'circle'} size={16} color={tutorialId === tutorial.id ? colors.primary : colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[s.tutorialOptionTitle, { color: colors.foreground }]} numberOfLines={1}>{tutorial.title}</Text>
                <Text style={[s.tutorialOptionHint, { color: colors.mutedForeground }]}>{tutorial.steps.length} steps · {tutorial.topic ?? 'General'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {tutorialsState === 'loading' && <Text style={[s.tutorialOptionHint, { color: colors.mutedForeground, marginTop: 8 }]}>Loading your published tutorials…</Text>}
          {tutorialsState === 'error' && (
            <TouchableOpacity testID="tutorials-retry" onPress={() => setReloadKey(k => k + 1)} style={[s.tutorialEmpty, { borderColor: colors.destructive }]}>
              <Icon name="refresh-cw" size={14} color={colors.destructive} />
              <Text style={[s.tutorialEmptyText, { color: colors.destructive }]}>Tutorials could not load. Tap to retry.</Text>
            </TouchableOpacity>
          )}
          {tutorialsState === 'ready' && tutorials.length === 0 && (
            <TouchableOpacity onPress={() => router.push('/create-guide-tutorial')} style={[s.tutorialEmpty, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}28` }]}>
              <Icon name="plus" size={15} color={colors.primary} />
              <Text style={[s.tutorialEmptyText, { color: colors.primary }]}>Create and publish a tutorial first</Text>
            </TouchableOpacity>
          )}
        </View>
        <Field label={t('social.sessionTitle')} value={title} onChangeText={setTitle} placeholder={t('social.titleExample')} colors={colors} />
        <Field label={t('social.sessionAbout')} value={description} onChangeText={setDescription} placeholder={t('social.descriptionExample')} colors={colors} multiline />
        <Field label={t('social.topicOptional')} value={topic} onChangeText={setTopic} placeholder={t('social.topicExample')} colors={colors} />
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field label={t('social.date')} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" colors={colors} /></View>
          <View style={{ width: 110 }}><Field label={t('social.time')} value={time} onChangeText={setTime} placeholder="19:00" colors={colors} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field label={t('social.minutes')} value={duration} onChangeText={setDuration} placeholder="60" colors={colors} numeric /></View>
          <View style={{ flex: 1 }}><Field label={t('social.maximumPeople')} value={capacity} onChangeText={setCapacity} placeholder="30" colors={colors} numeric /></View>
        </View>
        <View testID="session-review" style={[s.tutorialPanel, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[s.label, { color: colors.foreground }]}>Review before scheduling</Text>
          {([
            ['type', title.trim() || 'Add a title', !!title.trim()],
            ['align-left', description.trim().length >= 10 ? 'Description ready' : 'Description needs at least 10 characters', description.trim().length >= 10],
            ['calendar', Number.isNaN(startsAt.getTime()) ? 'Date or time is not valid' : startsAt.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }), !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now()],
            ['clock', `${duration || '?'} minutes · up to ${capacity || '?'} people`, Number(duration) > 0 && Number(capacity) > 0],
            ['book-open', tutorialId ? `Tutorial: ${tutorials.find(row => row.id === tutorialId)?.title ?? 'selected'}` : 'No tutorial attached', true],
            ['image', coverUri ? 'Cover image added' : 'No cover image', true],
          ] as [string, string, boolean][]).map(([icon, text, ok]) => (
            <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 }}>
              <Icon name={ok ? icon : 'alert-circle'} size={14} color={ok ? colors.primary : colors.destructive} />
              <Text style={[s.tutorialOptionTitle, { flex: 1, color: ok ? colors.foreground : colors.destructive }]}>{text}</Text>
            </View>
          ))}
          <Text style={[s.tutorialOptionHint, { color: colors.mutedForeground, marginTop: 10 }]}>After scheduling you get a waiting room with a shared Campfire chat, and can prepare polls before it starts. Reschedule or cancel later from Upcoming sessions in your profile.</Text>
        </View>
        {formError ? (
          <View style={[s.errorBox, { borderColor: colors.destructive ?? '#C85555', backgroundColor: `${colors.destructive ?? '#C85555'}12` }]}>
            <Icon name="alert-circle" size={16} color={colors.destructive ?? '#C85555'} />
            <Text style={[s.errorText, { color: colors.destructive ?? '#C85555' }]}>{formError}</Text>
          </View>
        ) : null}
        <TouchableOpacity testID="session-schedule" style={[s.create, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1 }]} disabled={saving} onPress={createSession}>
          <Icon name={saving ? 'clock' : 'calendar'} size={17} color={colors.primaryForeground} />
          <Text style={[s.createText, { color: colors.primaryForeground }]}>{saving ? t('social.scheduling') : t('social.scheduleSession')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, colors, multiline, numeric, ...props }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; multiline?: boolean; numeric?: boolean;
}) {
  return <View style={s.field}>
    <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
    <TextInput
      {...props}
      multiline={multiline}
      keyboardType={numeric ? 'number-pad' : 'default'}
      placeholderTextColor={colors.mutedForeground}
      style={[s.input, multiline && s.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
    />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 22 },
  subtitle: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 2, maxWidth: 280 },
  field: { marginBottom: 16 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 13, marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Satoshi-Regular', fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  coverPanel: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 20 },
  tutorialPanel: { borderWidth: 1, borderRadius: 18, padding: 13, marginBottom: 20 },
  tutorialOption: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  tutorialOptionTitle: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  tutorialOptionHint: { fontFamily: 'Satoshi-Regular', fontSize: 10, marginTop: 3 },
  tutorialEmpty: { minHeight: 42, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, marginTop: 7, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  tutorialEmptyText: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  coverHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  coverHint: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: -3 },
  removeCover: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  coverPicker: { height: 166, borderWidth: 1, borderStyle: 'dashed', borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverEmpty: { alignItems: 'center', gap: 5 },
  coverIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  coverEmptyTitle: { fontFamily: 'Satoshi-Bold', fontSize: 14 },
  coverEmptySub: { fontFamily: 'Satoshi-Regular', fontSize: 12 },
  coverEditPill: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(25,20,36,0.75)' },
  coverEditText: { color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 11 },
  errorBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 1, marginBottom: 8 },
  errorText: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 17 },
  create: { marginTop: 8, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  createText: { fontFamily: 'Satoshi-Bold', fontSize: 15 },
});
