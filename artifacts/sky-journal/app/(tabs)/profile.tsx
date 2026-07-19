import { Images } from '@/assets/images';
import { ConstellationStarSheet } from '@/components/ConstellationStarSheet';
import { ShopModal } from '@/components/ShopModal';
import { SkeletonProfileCard } from '@/components/Skeleton';
import { WeatherWidget } from '@/components/WeatherWidget';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '@/context/AppContext';

import { CharacterAuraHeader } from '@/components/profile/CharacterAuraHeader';
import { GalleryLightboxModal } from '@/components/profile/GalleryLightboxModal';
import { MoodPickerModal } from '@/components/profile/MoodPickerModal';
import { OutfitDetailModal } from '@/components/profile/OutfitDetailModal';
import { PingFriendsCard } from '@/components/profile/PingFriendsCard';
import { ProfileAboutSection } from '@/components/profile/ProfileAboutSection';
import { ProfileHeaderSection } from '@/components/profile/ProfileHeaderSection';
import { ProfileJourneySection } from '@/components/profile/ProfileJourneySection';
import { ProfileSettingsDrawer } from '@/components/profile/ProfileSettingsDrawer';
import { ProfileStyleSection } from '@/components/profile/ProfileStyleSection';
import { TitlePickerModal } from '@/components/profile/TitlePickerModal';
import { MOOD_COLORS } from '@/components/profile/profileConstants';
import { useGalleryState } from '@/hooks/useGalleryState';
import { usePingState } from '@/hooks/usePingState';

const STAR_TITLES: Record<number, string> = {
  1: 'Star Wanderer', 2: 'Memory Keeper',   3: 'Rising Star',
  4: 'Dreamer', 5: 'Guiding Light', 6: 'Legend',
};
const XP_PER_LEVEL = 300;

function CorruptionBanner({ onRefresh }: { onRefresh: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <View style={offlineS.row}>
      <View style={[offlineS.dot, { backgroundColor: '#9B78E8' }]} />
      <Text style={offlineS.msg}>Some stories couldn't be loaded — pull to refresh</Text>
      <TouchableOpacity style={offlineS.btn} onPress={() => { onRefresh(); setDismissed(true); }} activeOpacity={0.75}>
        <Text style={offlineS.btnText}>Refresh</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setDismissed(true)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }} activeOpacity={0.75}>
        <Icon name="x" size={13} color="rgba(200,184,232,0.5)" />
      </TouchableOpacity>
    </View>
  );
}

export default function CharacterScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { signOut } = useAuth();
  const { user }    = useUser();

  const {
    character, setCharacter, outfits, stories, journalEntries,
    activeOutfitId, setActiveOutfitId, deleteOutfit,
    gallery, galleryUsage, addGalleryPhoto, deleteGalleryPhoto,
    isLoading, apiOnline, storiesLoadError, outfitsLoadError, hasCorruptedStories, reloadData,
    constellation, rewardBalance, reloadConstellation,
    activeCosmetics, shopCatalog, purchasedIds, setActiveCosmetic,
  } = useApp();

  const activeFrame  = activeCosmetics['frame']  as string | undefined;
  const activeAccent = activeCosmetics['accent'] as string | undefined;
  const activeEffect = activeCosmetics['effect'] as string | undefined;
  const moodAccent   = MOOD_COLORS[character.mood ?? 'Dreamy'] ?? '#9B7AB5';
  const activeOutfit = activeOutfitId ? outfits.find(o => o.id === activeOutfitId) ?? null : null;
  const topPad       = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad    = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  // Computed values
  const totalWitnessed  = stories.reduce((sum, s) => sum + s.witnessedCount, 0);
  const xpBase          = rewardBalance?.stars ?? 0;
  const profileLevel    = Math.max(1, Math.floor(xpBase / XP_PER_LEVEL) + 1);
  const profileXpPct    = (xpBase % XP_PER_LEVEL) / XP_PER_LEVEL;
  const profileTitle    = constellation?.activeTitle ?? (
    (constellation?.unlockedStars.length ?? 0) >= 5 ? 'Guiding Light'  :
    (constellation?.unlockedStars.length ?? 0) >= 3 ? 'Dreamwalker'    :
    (constellation?.unlockedStars.length ?? 0) >= 1 ? 'Star Wanderer'  : 'Newcomer'
  );
  const availableTitles = constellation
    ? (Array.from({ length: constellation.unlockedStars.length }, (_, i) => STAR_TITLES[i + 1]).filter(Boolean) as string[])
    : [];
  const avatarSource = character.avatarUri
    ? { uri: character.avatarUri }
    : activeOutfit?.imageUri ? { uri: activeOutfit.imageUri } : Images.character_default;

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const [animTrigger, setAnimTrigger] = useState(0);
  useFocusEffect(useCallback(() => { setAnimTrigger(n => n + 1); }, []));

  const { weatherQuery, pingState, cooldownText, bellAnim, handlePing } = usePingState(character.country);
  const { galleryUploading, galleryError, selectedPhoto, deletingPhoto,
          handleAddGalleryPhoto, openPhoto, closePhoto, handleDeletePhoto,
  } = useGalleryState({ galleryUsage, addGalleryPhoto, deleteGalleryPhoto });

  // ── UI state ───────────────────────────────────────────────────────────────
  const [profileTab,      setProfileTab]      = useState<'journey' | 'style' | 'about'>('journey');
  const [showShop,        setShowShop]        = useState(false);
  const [showMoodPicker,  setShowMoodPicker]  = useState(false);
  const [showTitlePicker, setShowTitlePicker] = useState(false);
  const [savingTitle,     setSavingTitle]     = useState(false);
  const [selectedStarKey, setSelectedStarKey] = useState<string | null>(null);

  const saveTitle = useCallback(async (title: string) => {
    setSavingTitle(true);
    try {
      await apiFetch('/constellation/title', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      await reloadConstellation();
    } catch { /* skip */ }
    setSavingTitle(false); setShowTitlePicker(false);
  }, [reloadConstellation]);

  const handleSetActiveTitle = useCallback((title: string | null) => {
    setCharacter({ ...character, activeTitle: title });
  }, [character, setCharacter]);

  // ── Settings drawer ────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerWidth = screenW * 0.82;
  const drawerX     = useRef(new Animated.Value(drawerWidth)).current;
  function openDrawer() {
    setDrawerOpen(true);
    Animated.spring(drawerX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  }
  function closeDrawer() {
    Animated.timing(drawerX, { toValue: drawerWidth, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => setDrawerOpen(false));
  }

  // ── Sign-out ───────────────────────────────────────────────────────────────
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

  // ── Outfit modal ───────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {(!apiOnline || storiesLoadError || outfitsLoadError) && !isLoading && (
        <View style={offlineS.row}>
          <View style={offlineS.dot} />
          <Text style={offlineS.msg}>{(storiesLoadError || outfitsLoadError) && apiOnline ? "Couldn't load some data" : 'Offline — saved locally'}</Text>
          <TouchableOpacity style={offlineS.btn} onPress={reloadData} activeOpacity={0.75}>
            <Text style={offlineS.btnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasCorruptedStories && !isLoading && (
        <CorruptionBanner onRefresh={reloadData} />
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPad + 40 }} scrollEventThrottle={16}>

        <CharacterAuraHeader mood={character.mood || 'Dreamy'} paddingTop={topPad + 8} activeEffect={activeEffect}>
          <ProfileHeaderSection
            character={character} setCharacter={setCharacter}
            constellation={constellation} availableTitles={availableTitles}
            setShowTitlePicker={setShowTitlePicker} rewardBalance={rewardBalance}
            activeFrame={activeFrame} activeAccent={activeAccent} activeOutfit={activeOutfit}
            openDrawer={openDrawer} toggleVisibility={toggleVisibility}
            profileTitle={profileTitle} profileLevel={profileLevel} profileXpPct={profileXpPct}
          />
        </CharacterAuraHeader>

        {/* Stats row */}
        <View style={s.statsRow}>
          {[
            { icon: 'book-open', count: stories.length,   label: 'Stories',   tab: 'journey' },
            { icon: 'star',      count: outfits.length,   label: 'Outfits',   tab: 'style'   },
            { icon: 'eye',       count: totalWitnessed,   label: 'Likes',     tab: null       },
          ].map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <View style={s.statDot} />}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TouchableOpacity style={s.statPill} onPress={() => item.tab && (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), setProfileTab(item.tab as any))} activeOpacity={item.tab ? 0.75 : 1} disabled={!item.tab}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Icon name={item.icon as any} size={13} color={moodAccent} style={{ marginBottom: 2 }} />
                <Text style={s.statNum}>{item.count}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Tab bar */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 2, backgroundColor: 'rgba(200,184,232,0.05)', borderRadius: 14, padding: 3, gap: 2, borderWidth: 1, borderColor: 'rgba(200,184,232,0.10)' }}>
          {(['journey', 'style', 'about'] as const).map(tab => (
            <TouchableOpacity key={tab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setProfileTab(tab); }} style={{ flex: 1, paddingVertical: 8, borderRadius: 11, alignItems: 'center', backgroundColor: profileTab === tab ? 'rgba(107,91,149,0.60)' : 'transparent' }} activeOpacity={0.75}>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3, color: profileTab === tab ? '#fff' : 'rgba(200,184,232,0.50)' }}>
                {tab === 'journey' ? '✦ Progress' : tab === 'style' ? '✨ Style' : '◌ About'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Currently worn outfit hero (Style tab) */}
        {profileTab === 'style' && activeOutfit && (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <TouchableOpacity style={[s.outfitHero, { borderColor: `${moodAccent}35` }]} onPress={() => openOutfit(activeOutfit.id)} activeOpacity={0.88}>
              {activeOutfit.imageUri
                ? (
                  <View style={s.outfitHeroImg}>
                    <Image source={{ uri: activeOutfit.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
                    <LinearGradient colors={['transparent', 'rgba(8,6,22,0.88)']} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 130 }} pointerEvents="none" />
                  </View>
                )
                : <View style={[s.outfitHeroImg, { backgroundColor: 'rgba(200,184,232,0.07)', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 52 }}>✨</Text></View>}
              <View style={[s.outfitHeroBadge, { backgroundColor: `${moodAccent}22`, borderColor: `${moodAccent}55` }]}>
                <Text style={[{ fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 1.4 }, { color: moodAccent }]}>CURRENTLY WORN</Text>
              </View>
              <View style={s.outfitHeroBottom}>
                <Text style={s.outfitHeroName} numberOfLines={1}>{activeOutfit.name}</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Weather + ping (About tab) */}
        {profileTab === 'about' && weatherQuery && (
          <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
            <WeatherWidget query={weatherQuery} accentColor={moodAccent} />
          </View>
        )}
        {profileTab === 'about' && (
          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <PingFriendsCard pingState={pingState} cooldownText={cooldownText} bellAnim={bellAnim} moodAccent={moodAccent} onPing={handlePing} />
          </View>
        )}

        {/* Section content */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          {isLoading && character.name === 'Player' && (<><SkeletonProfileCard /><SkeletonProfileCard /></>)}
          {profileTab === 'about' && (!isLoading || character.name !== 'Player') && (
            <ProfileAboutSection character={character} setCharacter={setCharacter} />
          )}
          {profileTab === 'journey' && (!isLoading || character.name !== 'Player') && (
            <ProfileJourneySection
              constellation={constellation} stories={stories} journalEntries={journalEntries}
              character={character} animTrigger={animTrigger}
              setSelectedStarKey={setSelectedStarKey} setShowTitlePicker={setShowTitlePicker}
              availableTitles={availableTitles} onSetActiveTitle={handleSetActiveTitle}
            />
          )}
          {profileTab === 'style' && (!isLoading || character.name !== 'Player') && (
            <ProfileStyleSection
              outfits={outfits} openOutfit={openOutfit} gallery={gallery}
              openPhoto={openPhoto} handleAddGalleryPhoto={handleAddGalleryPhoto}
              galleryUploading={galleryUploading} galleryError={galleryError}
              setShowShop={setShowShop} rewardBalance={rewardBalance}
              purchasedIds={purchasedIds} shopCatalog={shopCatalog}
              activeCosmetics={activeCosmetics} setActiveCosmetic={setActiveCosmetic}
              activeOutfitId={activeOutfitId} moodAccent={moodAccent}
            />
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
        handleSignOut={handleSignOut} confirmingSignOut={confirmingSignOut}
        closeDrawer={closeDrawer} user={user} avatarSource={avatarSource} topPad={topPad} colors={colors}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1 },
  statsRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 24 },
  statPill:       { flex: 1, alignItems: 'center', gap: 3 },
  statNum:        { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.5 },
  statLabel:      { fontSize: 10, fontFamily: 'Satoshi-Medium', color: 'rgba(200,180,255,0.50)', letterSpacing: 0.4, textTransform: 'uppercase' },
  statDot:        { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(155,120,255,0.30)', marginHorizontal: 4 },
  outfitHero:     { borderRadius: 20, overflow: 'hidden', borderWidth: 1, backgroundColor: 'rgba(107,91,149,0.10)' },
  outfitHeroImg:  { width: '100%', height: 216 },
  outfitHeroBadge:  { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  outfitHeroBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 18 },
  outfitHeroName:   { fontSize: 20, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: 0.1 },
});

const offlineS = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(14,10,32,0.88)', borderColor: 'rgba(200,168,75,0.35)', zIndex: 10 },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8A84B', flexShrink: 0 },
  msg:     { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,240,0.78)' },
  btn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(107,91,149,0.40)' },
  btnText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },
});
