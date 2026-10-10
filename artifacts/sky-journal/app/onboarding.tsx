import { Images } from '@/assets/images';
import { Icon } from '@/components/Icon';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { persistImageUri } from '@/utils/persistImage';
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  type OnboardingProgress,
  type OnboardingStep,
} from '@/utils/onboardingProgress';
import { markOnboardingDone } from '@/components/OnboardingOverlay';
import { StorigamActivityIndicator as ActivityIndicator } from '@/components/SkyLoading';
import { useAuth } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { character, setCharacter, stories, outfits } = useApp();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [username, setUsername] = useState(character.username ?? '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    loadOnboardingProgress(userId, stories.length, outfits.length, character.username)
      .then(next => { if (active) setProgress(next); });
    return () => { active = false; };
  }, [userId, stories.length, outfits.length, character.username]));

  const update = useCallback((next: OnboardingProgress) => {
    setProgress(next);
    if (userId) saveOnboardingProgress(userId, next).catch(() => null);
  }, [userId]);

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarUploading(true);
    try {
      const avatarUri = await persistImageUri(result.assets[0].uri);
      setCharacter({ ...character, avatarUri });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    const value = username.trim().toLowerCase();
    setUsernameError(null);
    if (!USERNAME_REGEX.test(value)) {
      setUsernameError(t('onboarding.usernameRules'));
      return;
    }
    setSaving(true);
    try {
      if (value !== character.username) {
        const result = await apiFetch<{ available: boolean }>(`/users/check-username?username=${encodeURIComponent(value)}`);
        if (!result.available) {
          setUsernameError(t('onboarding.usernameTaken'));
          return;
        }
      }
      setCharacter({ ...character, username: value });
      if (progress) update({ ...complete(progress, 1), currentStep: 2 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setUsernameError(t('onboarding.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    if (!progress || progress.currentStep === 4) return;
    const step = progress.currentStep;
    update({
      ...progress,
      currentStep: (step + 1) as OnboardingStep,
      skipped: unique([...progress.skipped, step]),
    });
  }

  async function finish() {
    if (!userId) return;
    if (progress && [1, 2, 3].every(step => progress.completed.includes(step as OnboardingStep))) {
      await saveOnboardingProgress(userId, complete(progress, 4));
    }
    await markOnboardingDone(userId);
    router.replace('/(tabs)/reels' as never);
  }

  if (!progress) return <View style={s.loading}><ActivityIndicator color={colors.primary} /></View>;
  const step = progress.currentStep;
  const justCreated = progress.completed.includes(step);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#070418', '#10092A', '#06030F']} style={StyleSheet.absoluteFill} />
      <View style={[s.top, { paddingTop: Platform.OS === 'web' ? 72 : insets.top + 14 }]}>
        <Text style={s.count}>{t('onboarding.stepCount', { step })}</Text>
        <View style={s.dots}>
          {[1, 2, 3, 4].map(n => <View key={n} style={[s.dot, n <= step && s.dotOn]} />)}
        </View>
      </View>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Heading title={t('onboarding.setupTitle')} subtitle={t('onboarding.setupSubtitle')} />
            <View style={s.previewCard}>
              <TouchableOpacity style={s.avatar} onPress={pickAvatar} activeOpacity={0.8}>
                <Image source={character.avatarUri ? { uri: character.avatarUri } : Images.character_default} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={s.camera}><Icon name="camera" size={14} color="#fff" /></View>
                {avatarUploading && <View style={s.avatarBusy}><ActivityIndicator color="#fff" /></View>}
              </TouchableOpacity>
              <Text style={s.previewName}>@{username || t('onboarding.yourUsername')}</Text>
              <Text style={s.previewHint}>{t('onboarding.tapPicture')}</Text>
            </View>
            <View style={s.inputWrap}>
              <Text style={s.at}>@</Text>
              <TextInput
                value={username}
                onChangeText={v => { setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError(null); }}
                style={s.input}
                placeholder={t('onboarding.yourUsername')}
                placeholderTextColor="rgba(210,198,240,0.35)"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
              />
            </View>
            {!!usernameError && <Text style={s.error}>{usernameError}</Text>}
            <MainButton label={saving ? t('onboarding.saving') : t('auth.continue')} onPress={saveProfile} disabled={saving || avatarUploading} />
          </>
        )}

        {step === 2 && (
          <>
            <Heading
              title={justCreated ? t('onboarding.firstPostReady') : t('onboarding.makeFirstPost')}
              subtitle={justCreated ? t('onboarding.findPost') : t('onboarding.postPrompt')}
            />
            <FeatureCard icon="star" label={t('onboarding.quickWithAi')} detail={t('onboarding.quickWithAiDetail')} />
            <MainButton
              label={justCreated ? t('auth.continue') : t('onboarding.createPost')}
              onPress={() => justCreated ? update({ ...progress, currentStep: 3 }) : router.push('/quick-moment' as never)}
            />
            {!justCreated && <Skip onPress={skip} />}
          </>
        )}

        {step === 3 && (
          <>
            <Heading
              title={justCreated ? t('onboarding.firstOutfitReady') : t('onboarding.createFirstOutfit')}
              subtitle={justCreated ? t('onboarding.outfitReadySubtitle') : t('onboarding.outfitPrompt')}
            />
            <FeatureCard icon="camera" label={t('onboarding.addYourLook')} detail={t('onboarding.outfitDetail')} />
            <MainButton
              label={justCreated ? t('auth.continue') : t('onboarding.createOutfit')}
              onPress={() => justCreated ? update({ ...progress, currentStep: 4 }) : router.push('/create-outfit' as never)}
            />
            {!justCreated && <Skip onPress={skip} />}
          </>
        )}

        {step === 4 && (
          <>
            <Heading title={t('onboarding.allSet')} subtitle={t('onboarding.allSetSubtitle')} />
            <View style={s.summary}>
              <Image source={character.avatarUri ? { uri: character.avatarUri } : Images.character_default} style={s.summaryAvatar} contentFit="cover" />
              <Text style={s.summaryUser}>@{character.username || username || t('onboarding.yourUsername')}</Text>
              <View style={s.summaryRow}>
                <SummaryItem icon="image" label={stories[0]?.chapterTitle || t('onboarding.firstPost')} done={progress.completed.includes(2)} />
                <SummaryItem icon="star" label={outfits[0]?.name || t('onboarding.firstOutfit')} done={progress.completed.includes(3)} />
              </View>
            </View>
            <MainButton label={t('onboarding.explore')} onPress={finish} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function complete(progress: OnboardingProgress, step: OnboardingStep): OnboardingProgress {
  return { ...progress, completed: unique([...progress.completed, step]) };
}
function unique<T>(items: T[]) { return Array.from(new Set(items)); }
function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={s.heading}><Text style={s.title}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>;
}
function MainButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <TouchableOpacity style={[s.mainButton, disabled && { opacity: 0.55 }]} onPress={onPress} disabled={disabled} activeOpacity={0.84}><Text style={s.mainButtonText}>{label}</Text><Icon name="arrow-right" size={18} color="#10091F" /></TouchableOpacity>;
}
function Skip({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return <TouchableOpacity onPress={onPress} style={s.skip}><Text style={s.skipText}>{t('onboarding.skip')}</Text></TouchableOpacity>;
}
function FeatureCard({ icon, label, detail }: { icon: 'star' | 'camera'; label: string; detail: string }) {
  return <View style={s.feature}><View style={s.featureIcon}><Icon name={icon} size={25} color="#CDB7FF" /></View><Text style={s.featureTitle}>{label}</Text><Text style={s.featureDetail}>{detail}</Text></View>;
}
function SummaryItem({ icon, label, done }: { icon: 'image' | 'star'; label: string; done: boolean }) {
  const { t } = useTranslation();
  return <View style={s.summaryItem}><Icon name={icon} size={20} color={done ? '#CDB7FF' : 'rgba(205,183,255,0.35)'} /><Text style={s.summaryLabel} numberOfLines={2}>{done ? label : t('onboarding.skipped')}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06030F' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#06030F' },
  top: { paddingHorizontal: 24, alignItems: 'center', gap: 10 },
  count: { color: 'rgba(218,205,248,0.58)', fontFamily: 'Satoshi-Bold', fontSize: 12 },
  dots: { flexDirection: 'row', gap: 7 }, dot: { width: 22, height: 3, borderRadius: 2, backgroundColor: 'rgba(205,183,255,0.16)' }, dotOn: { backgroundColor: '#A986F4' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  heading: { marginBottom: 28 }, title: { color: '#F7F1FF', fontFamily: 'Satoshi-Black', fontSize: 31, letterSpacing: -0.8, textAlign: 'center' }, subtitle: { color: 'rgba(218,205,248,0.62)', fontFamily: 'Satoshi-Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 9 },
  previewCard: { alignItems: 'center', borderRadius: 24, padding: 22, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(181,140,255,0.18)', marginBottom: 18 },
  avatar: { width: 92, height: 92, borderRadius: 46, overflow: 'hidden', borderWidth: 2, borderColor: '#A986F4' },
  camera: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7B52CF' },
  avatarBusy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,4,20,0.65)' },
  previewName: { color: '#F3ECFF', fontFamily: 'Satoshi-Bold', fontSize: 17, marginTop: 12 }, previewHint: { color: 'rgba(218,205,248,0.42)', fontFamily: 'Satoshi-Regular', fontSize: 11, marginTop: 4 },
  inputWrap: { height: 54, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(181,140,255,0.35)', backgroundColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  at: { color: '#B99AF6', fontFamily: 'Satoshi-Bold', fontSize: 16 }, input: { flex: 1, color: '#fff', fontFamily: 'Satoshi-Medium', fontSize: 16, paddingHorizontal: 5 },
  error: { color: '#FF8D9D', fontFamily: 'Satoshi-Medium', fontSize: 12, marginTop: 8 },
  mainButton: { minHeight: 56, borderRadius: 18, backgroundColor: '#D7C05D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22 },
  mainButtonText: { color: '#10091F', fontFamily: 'Satoshi-Bold', fontSize: 16 },
  skip: { alignItems: 'center', paddingVertical: 18 }, skipText: { color: 'rgba(218,205,248,0.52)', fontFamily: 'Satoshi-Medium', fontSize: 13 },
  feature: { minHeight: 230, borderRadius: 26, alignItems: 'center', justifyContent: 'center', padding: 26, backgroundColor: 'rgba(141,99,225,0.10)', borderWidth: 1, borderColor: 'rgba(181,140,255,0.23)' },
  featureIcon: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(181,140,255,0.14)', marginBottom: 18 },
  featureTitle: { color: '#F5EEFF', fontFamily: 'Satoshi-Bold', fontSize: 18 }, featureDetail: { color: 'rgba(218,205,248,0.55)', fontFamily: 'Satoshi-Regular', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
  summary: { alignItems: 'center', borderRadius: 26, padding: 24, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(181,140,255,0.20)' },
  summaryAvatar: { width: 82, height: 82, borderRadius: 41, borderWidth: 2, borderColor: '#A986F4' }, summaryUser: { color: '#F5EEFF', fontFamily: 'Satoshi-Bold', fontSize: 17, marginTop: 12 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' }, summaryItem: { flex: 1, minHeight: 90, borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(181,140,255,0.08)' },
  summaryLabel: { color: 'rgba(235,225,255,0.72)', fontFamily: 'Satoshi-Medium', fontSize: 11, textAlign: 'center' },
});