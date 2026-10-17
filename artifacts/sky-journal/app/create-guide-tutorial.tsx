import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { persistImageUri, persistVideoUri } from '@/utils/persistImage';
import { Image } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type StepType = 'text' | 'image' | 'video' | 'tip' | 'question';
interface TutorialStep { id: string; type: StepType; title: string; body: string; mediaUri?: string | null }
interface GuideTutorial {
  id: string; title: string; description: string; topic: string | null;
  visibility: 'public' | 'followers' | 'unlisted'; status: 'draft' | 'published';
  steps: TutorialStep[]; createdAt: string; updatedAt: string;
}

const STEP_TYPES: { type: StepType; label: string; icon: string; tint: 'primary' | 'secondary' | 'tint' | 'gold' }[] = [
  { type: 'text', label: 'Step', icon: 'file-text', tint: 'primary' },
  { type: 'image', label: 'Image', icon: 'image', tint: 'tint' },
  { type: 'video', label: 'Video', icon: 'video', tint: 'secondary' },
  { type: 'tip', label: 'Tip', icon: 'star', tint: 'gold' },
  { type: 'question', label: 'Question', icon: 'message-circle', tint: 'secondary' },
];

function makeStep(type: StepType = 'text'): TutorialStep {
  return { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, type, title: '', body: '', mediaUri: null };
}

export default function CreateGuideTutorialScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ tutorialId?: string }>();
  const insets = useSafeAreaInsets();
  const [tutorials, setTutorials] = useState<GuideTutorial[]>([]);
  const [tutorialId, setTutorialId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [visibility, setVisibility] = useState<GuideTutorial['visibility']>('public');
  const [steps, setSteps] = useState<TutorialStep[]>([makeStep(), makeStep('tip')]);
  const [busy, setBusy] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewStepIndex, setPreviewStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadTutorials = useCallback(async () => {
    try {
      setTutorials(await apiFetch<GuideTutorial[]>('/guide-tutorials?mine=true'));
    } catch {
      setTutorials([]);
    }
  }, []);
  useEffect(() => { void loadTutorials(); }, [loadTutorials]);
  useEffect(() => {
    if (typeof params.tutorialId === 'string' && params.tutorialId) void editTutorial({ id: params.tutorialId } as GuideTutorial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tutorialId]);

  function moveStep(index: number, delta: -1 | 1) {
    setSteps(current => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function startNew() {
    setTutorialId(null);
    setTitle('');
    setDescription('');
    setTopic('');
    setVisibility('public');
    setSteps([makeStep(), makeStep('tip')]);
    setError(null);
  }

  async function editTutorial(tutorial: GuideTutorial) {
    setBusy(true);
    setError(null);
    try {
      const loaded = await apiFetch<GuideTutorial>(`/guide-tutorials/${tutorial.id}`);
      setTutorialId(loaded.id);
      setTitle(loaded.title);
      setDescription(loaded.description);
      setTopic(loaded.topic ?? '');
      setVisibility(loaded.visibility);
      setSteps(loaded.steps.length ? loaded.steps : [makeStep()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open that tutorial.');
    } finally {
      setBusy(false);
    }
  }

  function updateStep(index: number, updates: Partial<TutorialStep>) {
    setSteps(current => current.map((step, i) => i === index ? { ...step, ...updates } : step));
  }

  async function chooseStepMedia(index: number, type: 'image' | 'video') {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Allow photo access to add an image to this step.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' ? ['images'] : ['videos'],
        allowsEditing: type === 'image', ...(type === 'image' ? { aspect: [16, 9] as [number, number], quality: 0.85 } : {}),
      });
      const asset = result.canceled ? null : result.assets[0];
      if (asset?.uri) {
        const mediaUri = type === 'image'
          ? await persistImageUri(asset.uri)
          : await persistVideoUri(asset.uri, { fileName: asset.fileName, mimeType: asset.mimeType });
        updateStep(index, { mediaUri });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The image could not be added.');
    }
  }

  async function saveTutorial(status: GuideTutorial['status']) {
    if (!title.trim() || description.trim().length < 10 || steps.some(step => !step.title.trim())) {
      setError('Add a title, a short description, and a heading for each step.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        topic: topic.trim() || null,
        visibility,
        status,
        steps: steps.map(step => ({ ...step, title: step.title.trim(), body: step.body.trim(), mediaUri: step.mediaUri ?? null })),
      };
      const saved = tutorialId
        ? await apiFetch<GuideTutorial>(`/guide-tutorials/${tutorialId}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch<GuideTutorial>('/guide-tutorials', { method: 'POST', body: JSON.stringify(payload) });
      setTutorialId(saved.id);
      await loadTutorials();
      if (status === 'published') {
        Alert.alert('Tutorial published', 'Readers can find it in the tutorial library, and you can host a session with it.', [
          { text: 'Done', style: 'cancel' },
          { text: 'Open reader', onPress: () => router.push(`/guide-tutorial/${saved.id}` as Href) },
          { text: 'Host a session', onPress: () => router.push({ pathname: '/create-guide-session', params: { tutorialId: saved.id } } as Href) },
        ]);
      } else {
        Alert.alert('Draft saved', 'You can come back and publish it when it is ready.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save your tutorial.');
    } finally {
      setBusy(false);
    }
  }

  const top = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={[s.heading, { color: colors.foreground }]}>Tutorial studio</Text>
          <Text style={[s.subheading, { color: colors.mutedForeground }]}>Build a clear, step-by-step guide for your next session.</Text>
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 32 }}>
        <View style={[s.banner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.bannerIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name="book-open" size={21} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: colors.foreground }]}>A good tutorial feels easy to follow</Text>
            <Text style={[s.bannerCopy, { color: colors.mutedForeground }]}>Keep each step focused. Add images when they make an instruction clearer.</Text>
          </View>
        </View>

        <View style={s.sectionHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{tutorialId ? 'Edit tutorial' : 'Your tutorials'}</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{tutorials.length} saved · drafts stay private</Text>
          </View>
          <TouchableOpacity onPress={startNew} style={[s.smallAction, { backgroundColor: colors.primary }]}>
            <Icon name="plus" size={14} color={colors.primaryForeground} />
            <Text style={[s.smallActionText, { color: colors.primaryForeground }]}>New</Text>
          </TouchableOpacity>
        </View>
        {tutorials.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tutorialChips}>
            {tutorials.map(item => (
              <TouchableOpacity key={item.id} onPress={() => void editTutorial(item)}
                style={[s.tutorialChip, { borderColor: tutorialId === item.id ? colors.primary : colors.border, backgroundColor: colors.card }]}>
                <Icon name={item.status === 'published' ? 'book-open' : 'file-text'} size={13} color={colors.primary} />
                <Text numberOfLines={1} style={[s.tutorialChipText, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[s.status, { color: item.status === 'published' ? colors.tint : colors.mutedForeground }]}>{item.status}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={[s.sectionTitle, { color: colors.foreground, marginTop: 22, marginBottom: 10 }]}>Tutorial details</Text>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="How to get started…" colors={colors} />
        <Field label="Short description" value={description} onChangeText={setDescription} placeholder="What will someone learn?" colors={colors} multiline />
        <Field label="Topic (optional)" value={topic} onChangeText={setTopic} placeholder="Creative play, outfit design…" colors={colors} />

        <View style={[s.visibilityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.foreground }]}>Who can find this tutorial?</Text>
          <View style={s.visibilityOptions}>
            {([
              ['public', 'Everyone', 'globe'],
              ['followers', 'Followers', 'users'],
              ['unlisted', 'Link only', 'link'],
            ] as const).map(([value, label, icon]) => (
              <TouchableOpacity key={value} onPress={() => setVisibility(value)}
                style={[s.visibilityOption, { backgroundColor: visibility === value ? `${colors.primary}14` : colors.background, borderColor: visibility === value ? colors.primary : colors.border }]}>
                <Icon name={icon} size={14} color={visibility === value ? colors.primary : colors.mutedForeground} />
                <Text style={[s.visibilityText, { color: visibility === value ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.sectionHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Learning path</Text>
            <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Participants follow these in order.</Text>
          </View>
          <TouchableOpacity onPress={() => { setPreviewMode(value => !value); setPreviewStepIndex(0); }}
            style={[s.previewToggle, { backgroundColor: previewMode ? colors.primary : colors.card, borderColor: colors.border }]}>
            <Icon name={previewMode ? 'edit-3' : 'eye'} size={13} color={previewMode ? colors.primaryForeground : colors.primary} />
            <Text style={[s.previewToggleText, { color: previewMode ? colors.primaryForeground : colors.primary }]}>{previewMode ? 'Edit steps' : 'Preview'}</Text>
          </TouchableOpacity>
          {!previewMode && <Text style={[s.counter, { color: colors.mutedForeground }]}>{steps.length}/24</Text>}
        </View>

        {previewMode ? (
          <View style={[s.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.previewTop}>
              <Text style={[s.previewEyebrow, { color: colors.primary }]}>TUTORIAL PREVIEW</Text>
              <Text style={[s.previewCounter, { color: colors.mutedForeground }]}>{previewStepIndex + 1} / {steps.length}</Text>
            </View>
            <Text style={[s.previewTitle, { color: colors.foreground }]}>{steps[previewStepIndex]?.title || 'Step heading'}</Text>
            {!!steps[previewStepIndex]?.body && <Text style={[s.previewBody, { color: colors.mutedForeground }]}>{steps[previewStepIndex].body}</Text>}
            {steps[previewStepIndex]?.type === 'image' && steps[previewStepIndex].mediaUri && (
              <Image source={{ uri: steps[previewStepIndex].mediaUri ?? undefined }} style={s.previewMedia} contentFit="cover" />
            )}
            {steps[previewStepIndex]?.type === 'video' && steps[previewStepIndex].mediaUri && (
              <Video source={{ uri: steps[previewStepIndex].mediaUri! }} style={s.previewMedia}
                useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false} />
            )}
            {steps[previewStepIndex]?.type === 'question' && (
              <View style={[s.previewQuestion, { backgroundColor: `${colors.primary}10` }]}>
                <Icon name="message-circle" size={14} color={colors.primary} />
                <Text style={[s.previewQuestionText, { color: colors.primary }]}>Participants can answer in the live group chat.</Text>
              </View>
            )}
            <View style={s.previewNavigation}>
              <TouchableOpacity disabled={previewStepIndex === 0} onPress={() => setPreviewStepIndex(index => Math.max(0, index - 1))}
                style={[s.previewNavButton, { borderColor: colors.border, opacity: previewStepIndex === 0 ? 0.45 : 1 }]}>
                <Icon name="chevron-left" size={15} color={colors.foreground} /><Text style={[s.previewNavText, { color: colors.foreground }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={previewStepIndex >= steps.length - 1} onPress={() => setPreviewStepIndex(index => Math.min(steps.length - 1, index + 1))}
                style={[s.previewNavButton, { borderColor: colors.primary, backgroundColor: `${colors.primary}10`, opacity: previewStepIndex >= steps.length - 1 ? 0.45 : 1 }]}>
                <Text style={[s.previewNavText, { color: colors.primary }]}>Next step</Text><Icon name="chevron-right" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ) : steps.map((step, index) => {
          const typeInfo = STEP_TYPES.find(option => option.type === step.type) ?? STEP_TYPES[0];
          const typeColor = colors[typeInfo.tint] as string;
          return (
            <View key={step.id} style={[s.stepCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.stepTop}>
                <View style={[s.stepIcon, { backgroundColor: `${typeColor}18` }]}>
                  <Icon name={typeInfo.icon} size={15} color={typeColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.stepLabel, { color: colors.mutedForeground }]}>STEP {String(index + 1).padStart(2, '0')} · {typeInfo.label.toUpperCase()}</Text>
                </View>
                <TouchableOpacity testID={`step-up-${index}`} disabled={index === 0} onPress={() => moveStep(index, -1)}
                  accessibilityRole="button" accessibilityLabel={`Move step ${index + 1} up`} style={s.iconButton}>
                  <Icon name="arrow-up" size={15} color={index === 0 ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity testID={`step-down-${index}`} disabled={index === steps.length - 1} onPress={() => moveStep(index, 1)}
                  accessibilityRole="button" accessibilityLabel={`Move step ${index + 1} down`} style={s.iconButton}>
                  <Icon name="arrow-down" size={15} color={index === steps.length - 1 ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity disabled={steps.length <= 1} onPress={() => setSteps(current => current.filter((_, i) => i !== index))}
                  accessibilityRole="button" accessibilityLabel={`Remove step ${index + 1}`} style={s.iconButton}>
                  <Icon name="trash-2" size={15} color={steps.length <= 1 ? colors.border : colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <TextInput value={step.title} onChangeText={value => updateStep(index, { title: value })}
                placeholder="Add a clear step heading" placeholderTextColor={colors.mutedForeground}
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              <TextInput value={step.body} onChangeText={value => updateStep(index, { body: value })}
                placeholder={step.type === 'question' ? 'Ask participants what they noticed…' : 'Explain this step in a few sentences…'}
                placeholderTextColor={colors.mutedForeground} multiline
                style={[s.input, s.bodyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              {(step.type === 'image' || step.type === 'video') && (
                <TouchableOpacity onPress={() => void chooseStepMedia(index, step.type as 'image' | 'video')}
                  style={[s.mediaButton, { borderColor: colors.border, backgroundColor: `${colors.primary}08` }]}>
                  {step.mediaUri
                    ? step.type === 'image'
                      ? <Image source={{ uri: step.mediaUri }} style={s.stepImage} contentFit="cover" />
                      : <View style={s.attachedVideo}><Icon name="video" size={17} color={colors.primary} /><Text style={[s.mediaButtonText, { color: colors.primary }]}>Video attached · tap to replace</Text></View>
                    : <><Icon name={step.type === 'image' ? 'image' : 'video'} size={17} color={colors.primary} /><Text style={[s.mediaButtonText, { color: colors.primary }]}>Add a step {step.type}</Text></>}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {!previewMode && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.addTypes}>
          {STEP_TYPES.map(item => (
            <TouchableOpacity key={item.type} disabled={steps.length >= 24}
              onPress={() => setSteps(current => [...current, makeStep(item.type)])}
              style={[s.addTypeButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: steps.length >= 24 ? 0.5 : 1 }]}>
              <Icon name={item.icon} size={14} color={colors.primary} />
              <Text style={[s.addTypeText, { color: colors.foreground }]}>Add {item.label.toLowerCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>}

        {error && <View style={[s.errorBox, { backgroundColor: `${colors.destructive ?? colors.primary}12` }]}>
          <Icon name="alert-circle" size={15} color={colors.destructive ?? colors.primary} />
          <Text style={[s.errorText, { color: colors.destructive ?? colors.primary }]}>{error}</Text>
        </View>}
        {tutorialId && (
          <View style={[s.footerActions, { marginTop: 12 }]}>
            <TouchableOpacity onPress={() => router.push(`/guide-tutorial/${tutorialId}` as Href)} style={[s.secondaryAction, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Icon name="eye" size={15} color={colors.primary} /><Text style={[s.secondaryActionText, { color: colors.foreground }]}>Open saved version</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/guide-tutorials' as Href)} style={[s.secondaryAction, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Icon name="book" size={15} color={colors.primary} /><Text style={[s.secondaryActionText, { color: colors.foreground }]}>Library</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.footerActions}>
          <TouchableOpacity testID="tutorial-save-draft" disabled={busy} onPress={() => void saveTutorial('draft')}
            style={[s.secondaryAction, { borderColor: colors.border, backgroundColor: colors.card, opacity: busy ? 0.6 : 1 }]}>
            <Icon name="save" size={16} color={colors.primary} />
            <Text style={[s.secondaryActionText, { color: colors.foreground }]}>{busy ? 'Saving…' : 'Save draft'}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tutorial-publish" disabled={busy} onPress={() => void saveTutorial('published')}
            style={[s.primaryAction, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}>
            <Icon name="send" size={16} color={colors.primaryForeground} />
            <Text style={[s.primaryActionText, { color: colors.primaryForeground }]}>{busy ? 'Saving…' : 'Publish'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, colors, multiline, ...props }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; multiline?: boolean;
}) {
  return <View style={s.field}>
    <Text style={[s.fieldLabel, { color: colors.foreground }]}>{label}</Text>
    <TextInput {...props} multiline={multiline} placeholderTextColor={colors.mutedForeground}
      style={[s.input, multiline && s.fieldMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 13 },
  heading: { fontFamily: 'Satoshi-Bold', fontSize: 21 },
  subheading: { fontFamily: 'Satoshi-Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 17, borderWidth: 1, padding: 14, marginTop: 5 },
  bannerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  bannerTitle: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  bannerCopy: { fontFamily: 'Satoshi-Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontFamily: 'Satoshi-Bold', fontSize: 16 },
  sectionSub: { fontFamily: 'Satoshi-Regular', fontSize: 11, marginTop: 2 },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  smallActionText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  tutorialChips: { gap: 8, paddingVertical: 2 },
  tutorialChip: { minHeight: 37, maxWidth: 235, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10 },
  tutorialChipText: { fontFamily: 'Satoshi-Medium', fontSize: 11, maxWidth: 112 },
  status: { fontFamily: 'Satoshi-Bold', fontSize: 9, textTransform: 'capitalize' },
  field: { marginBottom: 13 },
  fieldLabel: { fontFamily: 'Satoshi-Bold', fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Satoshi-Regular', fontSize: 14 },
  fieldMultiline: { minHeight: 76, textAlignVertical: 'top' },
  visibilityCard: { borderWidth: 1, borderRadius: 15, padding: 12, marginTop: 1 },
  visibilityOptions: { flexDirection: 'row', gap: 7 },
  visibilityOption: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  visibilityText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  counter: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  stepCard: { borderWidth: 1, borderRadius: 17, padding: 12, marginBottom: 10, gap: 9 },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.7 },
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bodyInput: { minHeight: 75, textAlignVertical: 'top' },
  mediaButton: { minHeight: 48, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, overflow: 'hidden' },
  stepImage: { width: '100%', height: 160 },
  attachedVideo: { minHeight: 55, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewToggle: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 11, paddingHorizontal: 9, marginRight: 6 },
  previewToggleText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  previewCard: { borderRadius: 17, borderWidth: 1, padding: 15, marginBottom: 10 },
  previewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewEyebrow: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.8 },
  previewCounter: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  previewTitle: { fontFamily: 'Satoshi-Bold', fontSize: 18, marginTop: 12 },
  previewBody: { fontFamily: 'Satoshi-Regular', fontSize: 13, lineHeight: 19, marginTop: 6 },
  previewMedia: { height: 165, borderRadius: 12, overflow: 'hidden', marginTop: 11 },
  previewQuestion: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, padding: 10, marginTop: 12 },
  previewQuestionText: { fontFamily: 'Satoshi-Medium', fontSize: 11 },
  previewNavigation: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  previewNavButton: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10 },
  previewNavText: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  mediaButtonText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  addTypes: { gap: 7, paddingVertical: 4 },
  addTypeButton: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10 },
  addTypeText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, padding: 10, marginTop: 10 },
  errorText: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 17 },
  footerActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  secondaryAction: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  secondaryActionText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
  primaryAction: { flex: 1, minHeight: 48, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  primaryActionText: { fontFamily: 'Satoshi-Bold', fontSize: 13 },
});
