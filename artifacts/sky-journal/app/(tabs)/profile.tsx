import { Images } from '@/assets/images';
import { ConstellationStarSheet } from '@/components/ConstellationStarSheet';
import { ShopModal } from '@/components/ShopModal';
import { SkeletonProfileCard } from '@/components/Skeleton';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '@/context/AppContext';
import { useTranslation } from 'react-i18next';

import { CharacterAuraHeader } from '@/components/profile/CharacterAuraHeader';
import { MoonlitMuseIntro } from '@/components/profile/MoonlitMuseIntro';
import { GalleryLightboxModal } from '@/components/profile/GalleryLightboxModal';
import { MoodPickerModal } from '@/components/profile/MoodPickerModal';
import { OutfitDetailModal } from '@/components/profile/OutfitDetailModal';
import { ProfileAboutSection } from '@/components/profile/ProfileAboutSection';
import { ProfileVibeSection } from '@/components/profile/ProfileVibeSection';
import { OWN_AVATAR_BOX, OWN_AVATAR_SIZE, OwnProfileAvatar, ProfileHeaderSection } from '@/components/profile/ProfileHeaderSection';
import { AvatarFlightOverlay, useAvatarAnchor } from '@/components/profile/ProfileAvatarFlight';
import { ProfileStyleSection } from '@/components/profile/ProfileStyleSection';
import { ProfileSettingsDrawer } from '@/components/profile/ProfileSettingsDrawer';
import { TitlePickerModal } from '@/components/profile/TitlePickerModal';
import { ProfileCollapseBar, useProfileCollapse } from '@/components/profile/ProfileCollapseBar';
import { getAvailableProfileTitles } from '@/components/profile/profileTitles';
import { useGalleryState } from '@/hooks/useGalleryState';
import { loadOnboardingProgress, saveOnboardingProgress, type OnboardingProgress, type OnboardingStep } from '@/utils/onboardingProgress';
import { prepareNativeOutfitAudio } from '@/utils/prepareNativeOutfitAudio';

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
    isLoading, apiOnline, hasCheckedApi, storiesLoadError, outfitsLoadError, hasCorruptedStories, reloadData,
    constellation, rewardBalance, reloadConstellation,
    activeCosmetics,
  } = useApp();

  const activeFrame  = activeCosmetics['frame']  as string | undefined;
  const activeEffect = activeCosmetics['effect'] as string | undefined;
  const activeOutfit = activeOutfitId ? outfits.find(o => o.id === activeOutfitId) ?? null : null;
  const topPad       = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad    = Platform.OS === 'web' ? 100 : insets.bottom + 120;
  const [profileCollapseAt, setProfileCollapseAt] = useState(150);
  // Travel completes exactly when the bio panel reaches the sticky bar's bottom edge.
  const handleBioLayout = useCallback((y: number) => {
    const next = Math.max(90, Math.round(y - (topPad + 56) - 8));
    setProfileCollapseAt(prev => (Math.abs(prev - next) > 1 ? next : prev));
  }, [topPad]);
  const compactBarAt = Math.max(0, profileCollapseAt - 36);
  const { scrollY, compactVisible, onScroll, offsetRef } = useProfileCollapse(compactBarAt);
  const { rootRef, slotRef, anchor, measure } = useAvatarAnchor(offsetRef);

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
  const [moonlitMuseIntroVisible, setMoonlitMuseIntroVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;
    void prepareNativeOutfitAudio().catch(() => null);
  }, []));

  useFocusEffect(useCallback(() => {
    setMoonlitMuseIntroVisible(activeEffect === 'effect_moonlit_muse');
    return () => setMoonlitMuseIntroVisible(false);
  }, [activeEffect]));

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    loadOnboardingProgress(userId, stories.length, outfits.length, character.username)
      .then(progress => { if (active) setOnboardingProgress(progress); })
      .catch(() => null);
    return () => { active = false; };
  }, [userId, stories.length, outfits.length, character.username]));

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
    <View ref={rootRef} collapsable={false} onLayout={measure} style={[s.container, { backgroundColor: colors.background }]}>
      {((hasCheckedApi && !apiOnline) || storiesLoadError || outfitsLoadError) && !isLoading && (
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

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        // Keep profile cosmetics and expo-image tiles attached while the
        // separately transformed avatar flight crosses the scroll content.
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={measure}
        testID="own-profile-scroll"
      >
        <CharacterAuraHeader
          mood={character.mood || 'Dreamy'}
          paddingTop={topPad + 4}
          activeEffect={activeEffect}
          coverImageUri={null}
        >
          <ProfileHeaderSection
            character={character} setCharacter={setCharacter}
            constellation={constellation} availableTitles={availableTitles}
            setShowTitlePicker={setShowTitlePicker} rewardBalance={rewardBalance}
            activeFrame={activeFrame} activeOutfit={activeOutfit}
            openDrawer={openDrawer} toggleVisibility={toggleVisibility}
            profileLevel={profileLevel} profileXpPct={profileXpPct}
            collapseScrollY={scrollY} collapseAt={profileCollapseAt}
            avatarSlotRef={slotRef} onAvatarSlotLayout={measure}
            avatarInOverlay={!!anchor}
            onBioLayout={handleBioLayout}
          />
        </CharacterAuraHeader>

        {/* Section content - completely un-tabbed */}
        <View style={[{ paddingHorizontal: 14, paddingTop: 2 }, screenW >= 760 && { maxWidth: 800, alignSelf: 'center', width: '100%' }]}>
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
              <ProfileAboutSection
                character={character}
                setCharacter={setCharacter}
                betweenAboutAndGuide={
                  <ProfileVibeSection
                    character={character}
                    setCharacter={setCharacter}
                    onOpenMoodPicker={() => setShowMoodPicker(true)}
                  />
                }
              />
              <ProfileStyleSection
                userId={userId}
                outfits={outfits} stories={stories} openOutfit={openOutfit} deleteStory={deleteStory}
                gallery={gallery} openPhoto={openPhoto} handleAddGalleryPhoto={handleAddGalleryPhoto}
                galleryUploading={galleryUploading} galleryError={galleryError}
                activeOutfitId={activeOutfitId}
              />
            </>
          )}

        </View>
      </Animated.ScrollView>

      <ProfileCollapseBar
        scrollY={scrollY}
        collapseAt={compactBarAt}
        compactVisible={compactVisible}
        topInset={topPad}
        name={character.name}
        avatarSlotOnly={!!anchor}
        levelLabel={`${t('publicProfile.levelShort')} ${profileLevel}`}
        goldColor={colors.gold}
        subtitle={character.username ? `@${character.username}` : null}
        avatarUri={character.avatarUri ?? activeOutfit?.imageUri}
        backgroundColor={colors.background}
        foregroundColor={colors.foreground}
        mutedColor={colors.mutedForeground}
        borderColor={colors.border}
        rightActions={
          <>
            <TouchableOpacity
              style={[s.compactAction, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={openDrawer}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              testID="profile-compact-settings"
              hitSlop={6}
            >
              <Icon name="settings" size={17} color={colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.compactAction, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => router.push('/messages' as never)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Messages"
              testID="profile-compact-messages"
              hitSlop={6}
            >
              <Icon name="message-circle" size={17} color={colors.foreground} />
            </TouchableOpacity>
          </>
        }
      />

      <AvatarFlightOverlay
        anchor={anchor}
        scrollY={scrollY}
        range={profileCollapseAt}
        topInset={topPad}
        boxSize={OWN_AVATAR_BOX}
        avatarSize={OWN_AVATAR_SIZE}
        hidden={drawerOpen || moonlitMuseIntroVisible}
      >
        {decorationOpacity => <OwnProfileAvatar
          avatarSource={avatarSource}
          contain={Boolean(character.avatarUri)}
          activeFrame={activeFrame}
          mood={character.mood || 'Dreamy'}
          decorationOpacity={decorationOpacity}
        />}
      </AvatarFlightOverlay>

      {/* ── Modals & overlays ──────────────────────────────────────────── */}
      <OutfitDetailModal
        outfit={selectedOutfit} isActiveOutfit={activeOutfitId === selectedOutfit?.id}
        character={character} deletingConfirm={deletingOutfitInModal} avatarSource={avatarSource}
        onClose={closeOutfit} onSetDisplay={handleSetDisplay} onDelete={handleModalDelete}
      />
      <GalleryLightboxModal
        photo={selectedPhoto}
        deletingConfirm={deletingPhoto}
        onClose={closePhoto}
        onDelete={handleDeletePhoto}
        onUseAsOutfit={(photo) => {
          closePhoto();
          setTimeout(() => {
            router.push({
              pathname: '/create-outfit',
              params: { initialImageUri: photo.imageUri },
            } as never);
          }, Platform.OS === 'ios' ? 400 : 50);
        }}
      />
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
      {moonlitMuseIntroVisible && (
        <MoonlitMuseIntro
          closeLabel={t('common.cancel')}
          onComplete={() => setMoonlitMuseIntroVisible(false)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  compactAction: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  setupCard: { minHeight: 52, borderRadius: 18, borderWidth: 1, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  setupIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(181,140,255,0.14)' },
  setupTitle: { fontFamily: 'Satoshi-Bold', fontSize: 13.5 },
  setupSubtitle: { fontFamily: 'Satoshi-Regular', fontSize: 11.5, marginTop: 1 },
  setupButton: { paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', borderRadius: 9, backgroundColor: '#8C68D8' },
  setupButtonText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
});

const offlineS = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginHorizontal: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(14,10,32,0.88)', borderColor: 'rgba(200,168,75,0.35)', zIndex: 10 },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8A84B', flexShrink: 0 },
  msg:     { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,240,0.78)' },
  btn:     { paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(107,91,149,0.40)' },
  btnText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },
});
