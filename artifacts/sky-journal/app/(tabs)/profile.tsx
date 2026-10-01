import { Images } from '@/assets/images';
import { ConstellationStarSheet } from '@/components/ConstellationStarSheet';
import { ShopModal } from '@/components/ShopModal';
import { SkeletonProfileCard } from '@/components/Skeleton';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';

import { CharacterAuraHeader } from '@/components/profile/CharacterAuraHeader';
import { GalleryLightboxModal } from '@/components/profile/GalleryLightboxModal';
import { MoodPickerModal } from '@/components/profile/MoodPickerModal';
import { OutfitDetailModal } from '@/components/profile/OutfitDetailModal';
import { ProfileAboutSection } from '@/components/profile/ProfileAboutSection';
import { ProfileHeaderSection } from '@/components/profile/ProfileHeaderSection';
import { ProfileStyleSection } from '@/components/profile/ProfileStyleSection';
import { ProfileSettingsDrawer } from '@/components/profile/ProfileSettingsDrawer';
import { TitlePickerModal } from '@/components/profile/TitlePickerModal';
import { getAvailableProfileTitles } from '@/components/profile/profileTitles';
import { useGalleryState } from '@/hooks/useGalleryState';
import { loadOnboardingProgress, saveOnboardingProgress, type OnboardingProgress, type OnboardingStep } from '@/utils/onboardingProgress';

const XP_PER_LEVEL = 300;

function CorruptionBanner({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <View style={offlineS.row}>
      <View style={[offlineS.dot, { backgroundColor: '#9B78E8' }]} />
      <Text style={offlineS.msg}>{t('components.profileSection.corruptionMessage')}</Text>
      <TouchableOpacity style={offlineS.btn} onPress={() => { onRefresh(); setDismissed(true); }} activeOpacity={0.75}>
        <Text style={offlineS.btnText}>{t('components.profileSection.refresh')}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }} activeOpacity={0.75}>
        <Icon name="x" size={13} color="rgba(200,184,232,0.5)" />
      </TouchableOpacity>
    </View>
  );
}

export default function CharacterScreen() {
  const { t } = useTranslation();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { signOut, userId } = useAuth();
  const { user }    = useUser();

  const {
    character, setCharacter, outfits, stories,
    activeOutfitId, setActiveOutfitId, deleteOutfit, deleteStory,
    gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto,
    isLoading, apiOnline, storiesLoadError, outfitsLoadError, hasCorruptedStories, reloadData,
    constellation, rewardBalance, reloadConstellation,
    activeCosmetics,
  } = useApp();

  const activeFrame  = activeCosmetics['frame']  as string | undefined;
  const activeEffect = activeCosmetics['effect'] as string | undefined;
  const activeOutfit = activeOutfitId ? outfits.find(o => o.id === activeOutfitId) ?? null : null;
  const topPad       = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad    = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  const totalWitnessed  = stories.reduce((sum, s) => sum + s.witnessedCount, 0);
  const xpBase          = rewardBalance?.stars ?? 0;
  const profileLevel    = Math.max(1, Math.floor(xpBase / XP_PER_LEVEL) + 1);
  const profileXpPct    = (xpBase % XP_PER_LEVEL) / XP_PER_LEVEL;
  const availableTitles = getAvailableProfileTitles(constellation?.unlockedStars.length ?? 0);
  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri ? { uri: activeOutfit.imageUri } : Images.character_default;

  const { galleryUploading, galleryError, selectedPhoto, deletingPhoto,
          handleAddGalleryPhoto, openPhoto, closePhoto, handleDeletePhoto,
  } = useGalleryState({ galleryUsage, addGalleryPhoto, deleteGalleryPhoto });

  const [showShop,        setShowShop]        = useState(false);
  const [showMoodPicker,  setShowMoodPicker]  = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [savingTitle,     setSavingTitle]     = useState(false);
  const [selectedStarKey, setSelectedStarKey] = useState<string | null>(null);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [profileLikeCount, setProfileLikeCount] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    loadOnboardingProgress(userId, stories.length, outfits.length)
      .then(setOnboardingProgress)
      .catch(() => null);
  }, [userId, stories.length, outfits.length]));

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    apiFetch<{ profileLikeCount?: number }>(`/users/${userId}`)
      .then(profile => {
        if (active) setProfileLikeCount(Math.max(0, profile.profileLikeCount ?? 0));
      })
      .catch(() => {
        if (active) setProfileLikeCount(0);
      });
    return () => { active = false; };
  }, [userId]));

  const saveTitle = useCallback(async (title: string) => {
    setSavingTitle(true);
    try {
      await apiFetch('/constellation/title', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      await reloadConstellation();
    } catch { /* skip */ }
    setSavingTitle(false); setShowTitlePicker(false);
  }, [reloadConstellation]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = Math.min(Math.max(screenW * 0.82, 280), 420);
  const drawerX     = useRef(new Animated.Value(drawerWidth)).current;
  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }
  function closeDrawer() {
    Animated.timing(drawerX, { toValue: drawerWidth, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setDrawerOpen(false));
  }

  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const signOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function handleSignOut() {
    if (confirmingSignOut) {
      if (signOutTimer.current) clearTimeout(signOutTimer.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await signOut(); router.replace('/(auth)/sign-in' as any);
    } else {
      setConfirmingSignOut(true);
      signOutTimer.current = setTimeout(() => setConfirmingSignOut(false), 3000);
    }
  }
  function toggleVisibility() {
    Haptics.selectionAsync();
    setCharacter({ ...character, isPublic: !character.isPublic });
  }
  function toggleOnlineStatus() {
    Haptics.selectionAsync();
    setCharacter({ ...character, showOnlineStatus: !(character.showOnlineStatus ?? true) });
  }
  async function continueOnboarding() {
    if (!onboardingProgress || !userId) return;
    const firstIncomplete = ([1, 2, 3] as OnboardingStep[]).find(step => !onboardingProgress.completed.includes(step)) ?? 4;
    const next = { ...onboardingProgress, currentStep: firstIncomplete as OnboardingStep };
    await saveOnboardingProgress(userId, next);
    router.push('/onboarding' as never);
  }

  const [selectedOutfitId,      setSelectedOutfitId]      = useState<string | null>(null);
  const [deletingOutfitInModal, setDeletingOutfitInModal] = useState(false);
  const deleteTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedOutfit = outfits.find(o => o.id === selectedOutfitId) ?? null;
  function openOutfit(id: string) { setSelectedOutfitId(id); setDeletingOutfitInModal(false); }
  function closeOutfit() { setSelectedOutfitId(null); setDeletingOutfitInModal(false); }
  function handleModalDelete() {
    if (!selectedOutfit) return;
    if (deletingOutfitInModal) {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
      deleteOutfit(selectedOutfit.id);
      if (activeOutfitId === selectedOutfit.id) setActiveOutfitId(null);
      closeOutfit();
    } else {
      setDeletingOutfitInModal(true);
      deleteTimer.current = setTimeout(() => setDeletingOutfitInModal(false), 3000);
    }
  }
  function handleSetDisplay() {
    if (!selectedOutfit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveOutfitId(activeOutfitId === selectedOutfit.id ? null : selectedOutfit.id);
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {(!apiOnline || storiesLoadError || outfitsLoadError) && !isLoading && (
        <View style={[offlineS.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={offlineS.dot} />
          <Text style={[offlineS.msg, { color: colors.mutedForeground }]}>{(storiesLoadError || outfitsLoadError) && apiOnline ? t('components.profileSection.loadSomeError') : t('components.profileSection.offlineSaved')}</Text>
          <TouchableOpacity style={offlineS.btn} onPress={reloadData} activeOpacity={0.75}>
            <Text style={[offlineS.btnText, { color: colors.primary }]}>{t('components.profileSection.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasCorruptedStories && !isLoading && (
        <CorruptionBanner onRefresh={reloadData} />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad }} scrollEventThrottle={16}>
        <CharacterAuraHeader mood={character.mood || 'Dreamy'} paddingTop={topPad + 4} activeEffect={activeEffect}>
          <ProfileHeaderSection
            character={character} setCharacter={setCharacter}
            constellation={constellation} availableTitles={availableTitles}
            setShowTitlePicker={setShowTitlePicker} rewardBalance={rewardBalance}
            activeFrame={activeFrame} activeOutfit={activeOutfit}
            openDrawer={openDrawer} toggleVisibility={toggleVisibility}
            profileLevel={profileLevel} profileXpPct={profileXpPct}
          />
        </CharacterAuraHeader>

        {/* Stats card */}
        <View style={[s.statsCard, { backgroundColor: colors.card, borderColor: colors.border }, screenW >= 760 && { maxWidth: 760, alignSelf: 'center' }]}>
          {([
            { icon: 'book-open', count: stories.length,  label: t('components.profile.stats.stories') },
            { icon: 'user',      count: outfits.length,  label: t('components.profile.stats.outfits') },
            { icon: 'heart',     count: totalWitnessed,  label: t('components.profile.stats.likes')   },
            { icon: 'heart',     count: profileLikeCount, label: t('components.profile.stats.profileLikes') },
          ] as const).map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <View style={[s.statDivider, { backgroundColor: colors.border }]} />}
              <View style={s.statCol}>
                <Text style={[s.statNum, { color: colors.foreground }]}>{item.count}</Text>
                <View style={s.statMeta}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Icon name={item.icon as any} size={11} color={colors.mutedForeground} />
                  <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Section content - completely un-tabbed */}
        <View style={[{ paddingHorizontal: 20, paddingTop: 18 }, screenW >= 760 && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
          {onboardingProgress && onboardingProgress.completed.length < 4 && (
            <TouchableOpacity
              style={[s.setupCard, { borderColor: colors.border, backgroundColor: `${colors.primary}0D` }]}
              onPress={continueOnboarding}
              activeOpacity={0.82}
            >
              <View style={[s.setupIcon, { backgroundColor: `${colors.primary}18` }]}><Icon name="check-circle" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.setupTitle, { color: colors.foreground }]}>{t('components.profileSection.finishSetup')}</Text>
                <Text style={[s.setupSubtitle, { color: colors.mutedForeground }]}>{t('components.profileSection.setupProgress', { count: onboardingProgress.completed.length })}</Text>
              </View>
              <View style={[s.setupButton, { backgroundColor: colors.primary }]}><Text style={[s.setupButtonText, { color: colors.primaryForeground }]}>{t('components.profileSection.continue')}</Text></View>
            </TouchableOpacity>
          )}
          {isLoading && character.name === 'Player' && (<><SkeletonProfileCard /><SkeletonProfileCard /></>)}
          {(!isLoading || character.name !== 'Player') && (
            <>
              <ProfileAboutSection character={character} setCharacter={setCharacter} />
              <ProfileStyleSection
                outfits={outfits} stories={stories} openOutfit={openOutfit} deleteStory={deleteStory}
                gallery={gallery} openPhoto={openPhoto} handleAddGalleryPhoto={handleAddGalleryPhoto}
                galleryUploading={galleryUploading} galleryError={galleryError}
                activeOutfitId={activeOutfitId}
              />
            </>
          )}

          {activeOutfit && (
            <TouchableOpacity style={[s.wornBanner, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => openOutfit(activeOutfit.id)} activeOpacity={0.88}>
              {activeOutfit.imageUri && (
                <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
              {activeOutfit.imageUri && (
                <LinearGradient
                  colors={['rgba(10,6,22,0.98)', 'rgba(14,9,30,0.76)', 'rgba(14,9,30,0.28)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
              <View style={[s.wornBadge, !activeOutfit.imageUri && { backgroundColor: `${colors.accent}20`, borderColor: `${colors.accent}40` }]}>
                  <Text style={s.wornBadgeText}>{t('components.profileSection.currentlyWorn')}</Text>
                </View>
                <Text style={[s.wornTitleText, !activeOutfit.imageUri && { color: colors.foreground }]} numberOfLines={1}>{activeOutfit.name}</Text>
              </View>
              <View style={[s.wornBtn, !activeOutfit.imageUri && { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Icon name="user" size={13} color={activeOutfit.imageUri ? 'rgba(235,225,255,0.88)' : colors.foreground} />
                <Text style={[s.wornBtnText, !activeOutfit.imageUri && { color: colors.foreground }]}>{t('components.profileSection.changeOutfit')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ── Modals & overlays ──────────────────────────────────────────── */}
      <OutfitDetailModal
        outfit={selectedOutfit} isActiveOutfit={activeOutfitId === selectedOutfit?.id}
        character={character} deletingConfirm={deletingOutfitInModal} avatarSource={avatarSource}
        onClose={closeOutfit} onSetDisplay={handleSetDisplay} onDelete={handleModalDelete}
      />
      <GalleryLightboxModal photo={selectedPhoto} deletingConfirm={deletingPhoto} onClose={closePhoto} onDelete={handleDeletePhoto} />
      <MoodPickerModal visible={showMoodPicker} currentMood={character.mood ?? 'Dreamy'} onSelect={mood => setCharacter({ ...character, mood })} onClose={() => setShowMoodPicker(false)} />
      <TitlePickerModal visible={showTitlePicker} constellation={constellation} availableTitles={availableTitles} saving={savingTitle} onSelect={saveTitle} onClose={() => setShowTitlePicker(false)} />
      <ShopModal visible={showShop} onClose={() => setShowShop(false)} />
      {constellation && <ConstellationStarSheet starKey={selectedStarKey} constellation={constellation} onClose={() => setSelectedStarKey(null)} />}
      <ProfileSettingsDrawer
        drawerOpen={drawerOpen}
        drawerX={drawerX.interpolate({ inputRange: [0, drawerWidth], outputRange: [0, drawerWidth] })}
        drawerWidth={drawerWidth} character={character} toggleVisibility={toggleVisibility}
        toggleOnlineStatus={toggleOnlineStatus}
        handleSignOut={handleSignOut} confirmingSignOut={confirmingSignOut}
        closeDrawer={closeDrawer} user={user} avatarSource={avatarSource} topPad={topPad} colors={colors}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  statsCard:    { flexDirection: 'row', marginHorizontal: 20, marginTop: 14, borderRadius: 18, borderWidth: 1, minWidth: 0 },
  statCol:      { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 14, gap: 4 },
  statNum:      { fontSize: 21, fontFamily: 'Satoshi-Bold', letterSpacing: -0.5 },
  statMeta:     { flexDirection: 'column', alignItems: 'center', gap: 4 },
  statLabel:    { fontSize: 10, fontFamily: 'Satoshi-Bold', letterSpacing: 0.2, textAlign: 'center' },
  statDivider:  { width: 1, marginVertical: 10 },
  setupCard: { minHeight: 76, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  setupIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(181,140,255,0.14)' },
  setupTitle: { fontFamily: 'Satoshi-Bold', fontSize: 14 },
  setupSubtitle: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 3 },
  setupButton: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 11, backgroundColor: '#8C68D8' },
  setupButtonText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  wornBanner:   { minHeight: 72, marginBottom: 8, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1 },
  wornBadge:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, marginBottom: 5, backgroundColor: 'rgba(232,120,156,0.13)', borderWidth: 1, borderColor: 'rgba(232,120,156,0.25)' },
  wornBadgeText:{ fontSize: 7, fontFamily: 'Satoshi-Bold', color: '#E88EAE', letterSpacing: 1.0 },
  wornTitleText:{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#FFF', flexShrink: 1 },
  wornBtn:      { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(9,6,20,0.58)', flexShrink: 1 },
  wornBtnText:  { fontSize: 10.5, fontFamily: 'Satoshi-Medium', color: 'rgba(235,225,255,0.88)' },
});

const offlineS = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginHorizontal: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(14,10,32,0.88)', borderColor: 'rgba(200,168,75,0.35)', zIndex: 10 },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8A84B', flexShrink: 0 },
  msg:     { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,240,0.78)' },
  btn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(107,91,149,0.40)' },
  btnText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },
});
