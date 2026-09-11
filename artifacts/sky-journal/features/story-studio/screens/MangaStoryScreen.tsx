import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '@/utils/navigation';
import { Icon } from '@/components/Icon';
import { Images } from '@/assets/images';
import { apiFetch, ApiError, resolveUri } from '@/context/AppContext';
import { ImageUploadError, persistImageUri } from '@/utils/persistImage';

type MangaStyle = 'manga' | 'color' | 'chibi' | 'cinematic' | 'webtoon';
type PendingAttempt = {
  requestId: string;
  imageUris: string[];
  prompt: string;
  style: MangaStyle;
};

const PENDING_ATTEMPT_KEY = 'pending_manga_generation_v1';

const STYLES: Array<{
  id: MangaStyle;
  label: string;
  promptInstruction: string;
  image: (typeof Images)[keyof typeof Images];
  tint?: string;
}> = [
  { id: 'manga', label: 'Manga\n(B&W)', promptInstruction: 'black-and-white Japanese manga with expressive ink lines, screentones, and readable panel composition', image: Images.create_quick, tint: 'rgba(15,10,28,0.38)' },
  { id: 'color', label: 'Color Manga', promptInstruction: 'full-color manga with clean line art, vivid lighting, and readable panel composition', image: Images.create_quick },
  { id: 'chibi', label: 'Chibi', promptInstruction: 'cute chibi manga with small bodies, oversized expressive faces, and playful colorful panels', image: Images.story_bg3, tint: 'rgba(255,186,220,0.18)' },
  { id: 'cinematic', label: 'Cinematic', promptInstruction: 'cinematic manga with dramatic framing, detailed lighting, strong depth, and film-like panels', image: Images.story_bg2, tint: 'rgba(62,38,105,0.18)' },
  { id: 'webtoon', label: 'Webtoon', promptInstruction: 'polished color webtoon with clean digital line art, expressive characters, and vertical-comic storytelling', image: Images.create_video, tint: 'rgba(238,84,155,0.14)' },
];

export default function MangaStoryScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 14 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 30 : insets.bottom + 24;

  const [images, setImages] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<MangaStyle>('manga');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<PendingAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedStyle = useMemo(() => STYLES.find(item => item.id === style) ?? STYLES[0], [style]);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_ATTEMPT_KEY)
      .then(raw => {
        if (raw) setPendingAttempt(JSON.parse(raw) as PendingAttempt);
      })
      .catch(() => undefined);
  }, []);

  async function addPhotos() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const remaining = 10 - images.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.9,
    });

    if (result.canceled) return;
    const next = result.assets.map(asset => asset.uri).filter(Boolean);
    setImages(current => [...current, ...next].slice(0, 10));
    setGenerated(false);
    setGeneratedImageUri(null);
    setError(null);
  }

  function removePhoto(uri: string) {
    Haptics.selectionAsync();
    setImages(current => current.filter(image => image !== uri));
    setGenerated(false);
    setGeneratedImageUri(null);
  }

  function chooseStyle(next: MangaStyle) {
    Haptics.selectionAsync();
    setStyle(next);
    setGenerated(false);
    setGeneratedImageUri(null);
  }

  async function generateStory() {
    if (generating) return;
    if (!images.length) {
      setError('Add at least one photo to create your manga story.');
      return;
    }
    const finalPrompt =
      `Create one ${selectedStyle.promptInstruction} story page. ` +
      'Use the uploaded images as references for characters, environments, events, poses, and visual continuity. ' +
      `Story: ${prompt.trim() || 'Create a warm, coherent adventure from these moments.'}`;
    setError(null);
    setGenerating(true);
    setGenerated(false);
    setGeneratedImageUri(null);
    setGeneratedPrompt(finalPrompt);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let attempt = pendingAttempt;
      if (!attempt) {
        const imageUris = await Promise.all(images.map(uri => persistImageUri(uri)));
        attempt = {
          requestId: `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          imageUris,
          prompt,
          style,
        };
        setPendingAttempt(attempt);
        await AsyncStorage.setItem(PENDING_ATTEMPT_KEY, JSON.stringify(attempt));
      }
      const result = await apiFetch<{ imageUri: string; remainingToday: number }>('/manga/generate', {
        method: 'POST',
        body: JSON.stringify(attempt),
      });
      const resolved = resolveUri(result.imageUri);
      if (!resolved) throw new Error('The generated image could not be loaded.');
      setGeneratedImageUri(resolved);
      setRemainingToday(result.remainingToday);
      setGenerated(true);
      setPendingAttempt(null);
      await AsyncStorage.removeItem(PENDING_ATTEMPT_KEY);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      if (err instanceof ImageUploadError) {
        setError(err.userMessage);
      } else if (err instanceof ApiError && err.status === 429) {
        setError('You have reached today’s manga limit. Please come back tomorrow.');
        setPendingAttempt(null);
        await AsyncStorage.removeItem(PENDING_ATTEMPT_KEY);
      } else if (err instanceof ApiError && err.status === 409) {
        setError('Your previous manga request is still being checked. Wait a moment, then tap Generate again.');
      } else if (err instanceof ApiError && [400, 401, 403, 502].includes(err.status)) {
        setError('Something went wrong creating your manga. Please try again.');
        setPendingAttempt(null);
        await AsyncStorage.removeItem(PENDING_ATTEMPT_KEY);
      } else {
        setError('The result could not be confirmed. Tap Generate again to safely check the same request.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={['#08051A', '#0A071C', '#05040F']} style={StyleSheet.absoluteFill} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad + 88 }}
      >
        <View style={s.hero}>
          <Image source={Images.create_video} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right center" />
          <LinearGradient
            colors={['rgba(7,5,20,0.99)', 'rgba(8,5,25,0.76)', 'rgba(9,5,24,0.20)']}
            locations={[0, 0.58, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={s.heroTop}>
            <TouchableOpacity style={s.backBtn} onPress={() => safeBack()}>
              <Icon name="arrow-left" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={s.howBtn}>
              <Icon name="circle" size={14} color="#E8E0FF" />
              <Text style={s.howText}>How it works?</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.title}>Create <Text style={s.titleAccent}>Manga Story</Text></Text>
          <Text style={s.subtitle}>Turn your screenshots and moments into{'\n'}beautiful manga pages with AI ✦</Text>

          <View style={s.steps}>
            <MiniStep icon="image" title="Upload" caption="up to 10 images" />
            <MiniStep icon="star" title="Add a prompt" caption="and style" />
            <MiniStep icon="book-open" title="Get a manga" caption="story page" />
          </View>
        </View>

        <View style={s.content}>
          <SectionCard icon="image" title="1. Upload Images (Max 10)" rightText={`${images.length}/10`}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
              {images.length < 10 && (
                <TouchableOpacity style={s.addPhoto} onPress={addPhotos} activeOpacity={0.8}>
                  <Icon name="plus" size={28} color="#B891FF" />
                  <Text style={s.addPhotoText}>Add Photos</Text>
                </TouchableOpacity>
              )}
              {images.map(uri => (
                <View key={uri} style={s.photoWrap}>
                  <Image source={{ uri }} style={s.photo} contentFit="cover" />
                  <TouchableOpacity style={s.removePhoto} onPress={() => removePhoto(uri)}>
                    <Icon name="x" size={13} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </SectionCard>

          <SectionCard icon="star" title="2. Tell AI Your Story">
            <View style={s.promptWrap}>
              <TextInput
                value={prompt}
                onChangeText={value => {
                  setPrompt(value.slice(0, 500));
                  setGenerated(false);
                }}
                style={s.prompt}
                placeholder={'Write a short prompt...\ne.g. “Turn these images into a heartwarming story about two friends exploring a new world, in a cute manga style.”'}
                placeholderTextColor="rgba(215,202,244,0.42)"
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={s.count}>{prompt.length}/500</Text>
            </View>
          </SectionCard>

          <SectionCard icon="smile" title="3. Choose Style" optional="(Optional)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.styleRow}>
              {STYLES.map(item => {
                const active = item.id === style;
                return (
                  <TouchableOpacity key={item.id} style={s.styleChoice} onPress={() => chooseStyle(item.id)} activeOpacity={0.82}>
                    <View style={[s.styleImageWrap, active && s.styleImageActive]}>
                      <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {item.id === 'manga' && <View style={s.mangaWash} />}
                      {!!item.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: item.tint }]} />}
                      {active && (
                        <View style={s.check}>
                          <Icon name="check" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>
                    <Text style={[s.styleLabel, active && s.styleLabelActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SectionCard>

          <SectionCard icon="image" title="4. Your Manga Page">
            <View style={[s.result, generated && s.resultReady]}>
              {generating ? (
                <View style={s.resultEmpty}>
                  <ActivityIndicator size="large" color="#B55CFF" />
                  <Text style={s.resultTitle}>Creating your manga page…</Text>
                  <Text style={s.resultText}>Applying the {selectedStyle.label.replace('\n', ' ')} style</Text>
                </View>
              ) : generated ? (
                <View
                  style={s.generatedGrid}
                  accessibilityLabel={`Generated manga page. ${generatedPrompt}`}
                >
                  {!!generatedImageUri && (
                    <Image source={{ uri: generatedImageUri }} style={s.generatedImage} contentFit="contain" />
                  )}
                </View>
              ) : (
                <View style={s.resultEmpty}>
                  <Icon name="image" size={44} color="rgba(190,155,255,0.48)" />
                  <Text style={s.resultTitle}>Your manga story will appear here</Text>
                  <Text style={s.resultText}>Upload images, add a prompt and click generate{'\n'}to create your manga page.</Text>
                </View>
              )}
            </View>
          </SectionCard>

          {!!error && (
            <View style={s.error}>
              <Icon name="alert-circle" size={15} color="#FF8FA9" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
          {remainingToday !== null && generated && (
            <Text style={s.remainingText}>{remainingToday} AI manga pages remaining today</Text>
          )}
        </View>
      </ScrollView>

      <View style={[s.generateBar, { paddingBottom: bottomPad }]}>
        <TouchableOpacity style={s.generateBtn} onPress={generateStory} disabled={generating} activeOpacity={0.86}>
          <LinearGradient
            colors={['#D22DF1', '#8D35FF', '#633CFF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          {generating ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="star" size={20} color="#FFFFFF" />}
          <Text style={s.generateText}>{generating ? 'Generating…' : generated ? 'Generate Again' : 'Generate Manga Story'}</Text>
          {!generating && (
            <View style={s.generateArrow}>
              <Icon name="arrow-right" size={18} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MiniStep({ icon, title, caption }: { icon: string; title: string; caption: string }) {
  return (
    <View style={s.miniStep}>
      <View style={s.miniIcon}><Icon name={icon} size={18} color="#C99BFF" /></View>
      <View>
        <Text style={s.miniTitle}>{title}</Text>
        <Text style={s.miniCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function SectionCard({ icon, title, optional, rightText, children }: {
  icon: string;
  title: string;
  optional?: string;
  rightText?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Icon name={icon} size={16} color="#C08AFF" />
        <Text style={s.sectionTitle}>{title}</Text>
        {!!optional && <Text style={s.optional}>{optional}</Text>}
        <View style={{ flex: 1 }} />
        {!!rightText && <Text style={s.rightText}>{rightText}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060410' },
  hero: { minHeight: 238, paddingHorizontal: 20, paddingBottom: 16, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  howBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, height: 34, borderRadius: 17, backgroundColor: 'rgba(8,5,25,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  howText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#EEE7FF' },
  title: { fontSize: 28, fontFamily: 'Satoshi-Black', color: '#FFFFFF', letterSpacing: -0.7 },
  titleAccent: { color: '#C453E8' },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: 'Satoshi-Regular', color: 'rgba(222,211,244,0.68)' },
  steps: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 20 },
  miniStep: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  miniIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(138,74,226,0.18)', borderWidth: 1, borderColor: 'rgba(188,125,255,0.28)' },
  miniTitle: { fontSize: 10, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
  miniCaption: { fontSize: 8.5, lineHeight: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(220,208,242,0.64)' },
  content: { paddingHorizontal: 14, gap: 10, marginTop: -2 },
  section: { padding: 11, borderRadius: 17, backgroundColor: 'rgba(27,20,53,0.82)', borderWidth: 1, borderColor: 'rgba(184,130,255,0.10)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  sectionTitle: { fontSize: 13.5, fontFamily: 'Satoshi-Bold', color: '#F3EEFF' },
  optional: { fontSize: 10, fontFamily: 'Satoshi-Regular', color: 'rgba(213,199,239,0.55)' },
  rightText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#B994E9' },
  photoRow: { gap: 8 },
  addPhoto: { width: 92, height: 92, borderRadius: 11, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#8651C2', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: 'rgba(113,59,182,0.06)' },
  addPhotoText: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#D8C9F1' },
  photoWrap: { width: 92, height: 92, borderRadius: 10, overflow: 'hidden', backgroundColor: '#18122C' },
  photo: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7,4,18,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  promptWrap: { height: 100, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(160,104,232,0.42)', backgroundColor: 'rgba(8,6,22,0.40)', overflow: 'hidden' },
  prompt: { flex: 1, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 22, fontSize: 11.5, lineHeight: 17, fontFamily: 'Satoshi-Regular', color: '#F4EEFF' },
  count: { position: 'absolute', bottom: 6, right: 9, fontSize: 8.5, fontFamily: 'Satoshi-Regular', color: 'rgba(205,187,233,0.34)' },
  styleRow: { gap: 8 },
  styleChoice: { width: 73, alignItems: 'center' },
  styleImageWrap: { width: 73, height: 65, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#130E25' },
  styleImageActive: { borderWidth: 2, borderColor: '#B64CFF' },
  mangaWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(25,17,39,0.18)' },
  check: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7546DB' },
  styleLabel: { marginTop: 4, textAlign: 'center', fontSize: 9, lineHeight: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(220,207,242,0.66)' },
  styleLabelActive: { color: '#F0E7FF' },
  result: { minHeight: 156, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(155,94,226,0.46)', overflow: 'hidden', backgroundColor: 'rgba(7,5,18,0.38)' },
  resultReady: { borderStyle: 'solid', borderColor: 'rgba(186,99,255,0.58)' },
  resultEmpty: { minHeight: 156, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  resultTitle: { fontSize: 11, fontFamily: 'Satoshi-Medium', color: 'rgba(218,201,240,0.62)', textAlign: 'center' },
  resultText: { fontSize: 9.5, lineHeight: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(201,184,226,0.42)', textAlign: 'center' },
  generatedGrid: { width: '100%', aspectRatio: 1, padding: 3 },
  generatedImage: { width: '100%', height: '100%', borderRadius: 9, backgroundColor: '#171126' },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(255,83,126,0.10)', borderWidth: 1, borderColor: 'rgba(255,83,126,0.22)' },
  errorText: { flex: 1, fontSize: 11, fontFamily: 'Satoshi-Medium', color: '#FFB0C1' },
  remainingText: { textAlign: 'center', fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(205,187,233,0.56)' },
  generateBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, backgroundColor: 'rgba(5,4,15,0.94)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  generateBtn: { height: 54, borderRadius: 27, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#B82EFF', shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  generateText: { fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#FFFFFF' },
  generateArrow: { position: 'absolute', right: 10, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(36,24,174,0.72)' },
});