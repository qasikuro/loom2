import { Images } from '@/assets/images';
import { ConstellationStarSheet } from '@/components/ConstellationStarSheet';
import { ShopModal } from '@/components/ShopModal';
import { SkeletonProfileCard } from '@/components/Skeleton';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth, useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '@/context/AppContext';

import { CharacterAuraHeader } from '@/components/profile/CharacterAuraHeader';
import { GalleryLightboxModal } from '@/components/profile/GalleryLightboxModal';
import { MoodPickerModal } from '@/components/profile/MoodPickerModal';
import { OutfitDetailModal } from '@/components/profile/OutfitDetailModal';
import { ProfileHeaderSection } from '@/components/profile/ProfileHeaderSection';
import { ProfileStyleSection } from '@/components/profile/ProfileStyleSection';
import { ProfileSettingsDrawer } from '@/components/profile/ProfileSettingsDrawer';
import { TitlePickerModal } from '@/components/profile/TitlePickerModal';
import { useGalleryState } from '@/hooks/useGalleryState';

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
  const topPad       = Platform.OS === 'web' ? 10 : insets.top;
  const bottomPad    = Platform.OS === 'web' ? 100 : insets.bottom + 120;

  const totalWitnessed  = stories.reduce((sum, s) => sum + s.witnessedCount, 0);
  const xpBase          = rewardBalance?.stars ?? 0;
  const profileLevel    = Math.max(1, Math.floor(xpBase / XP_PER_LEVEL) + 1);
  const profileXpPct    = (xpBase % XP_PER_LEVEL) / XP_PER_LEVEL;
  const availableTitles = constellation
    ? (Array.from({ length: constellation.unlockedStars.length }, (_, i) => STAR_TITLES[i + 1]).filter(Boolean) as string[])
    : [];
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

  const saveTitle = useCallback(async (title: string) => {
    setSavingTitle(true);
    try {
      await apiFetch('/constellation/title', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) });
      await reloadConstellation();
    } catch { /* skip */ }
    setSavingTitle(false); setShowTitlePicker(false);
  }, [reloadConstellation]);

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
    <View style={[s.container, { backgroundColor: '#05030A' }]}>
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
        <View style={s.statsCard}>
          {([
            { icon: 'book-open', count: stories.length,  label: 'STORIES' },
            { icon: 'user',      count: outfits.length,  label: 'OUTFITS' },
            { icon: 'heart',     count: totalWitnessed,  label: 'LIKES'   },
          ] as const).map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <View style={s.statDivider} />}
              <View style={s.statCol}>
                <Text style={s.statNum}>{item.count}</Text>
                <View style={s.statMeta}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Icon name={item.icon as any} size={11} color="rgba(200,184,232,0.5)" />
                  <Text style={s.statLabel}>{item.label}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Section content - completely un-tabbed */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          {isLoading && character.name === 'Player' && (<><SkeletonProfileCard /><SkeletonProfileCard /></>)}
          {(!isLoading || character.name !== 'Player') && (
            <ProfileStyleSection
              outfits={outfits} stories={stories} openOutfit={openOutfit} deleteStory={deleteStory}
              gallery={gallery} openPhoto={openPhoto} handleAddGalleryPhoto={handleAddGalleryPhoto}
              galleryUploading={galleryUploading} galleryError={galleryError}
              activeOutfitId={activeOutfitId}
            />
          )}

          {activeOutfit && (
            <TouchableOpacity style={s.wornBanner} onPress={() => openOutfit(activeOutfit.id)} activeOpacity={0.88}>
              {activeOutfit.imageUri && (
                <Image source={{ uri: activeOutfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
              <LinearGradient
                colors={['rgba(10,6,22,0.98)', 'rgba(14,9,30,0.76)', 'rgba(14,9,30,0.28)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={{ flex: 1, zIndex: 1 }}>
                <View style={s.wornBadge}>
                  <Text style={s.wornBadgeText}>CURRENTLY WORN</Text>
                </View>
                <Text style={s.wornTitleText} numberOfLines={1}>{activeOutfit.name}</Text>
              </View>
              <View style={s.wornBtn}>
                <Icon name="user" size={13} color="rgba(235,225,255,0.88)" />
                <Text style={s.wornBtnText}>Change outfit</Text>
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
  statsCard:    { flexDirection: 'row', marginHorizontal: 20, marginTop: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statCol:      { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  statNum:      { fontSize: 21, fontFamily: 'Satoshi-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  statMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel:    { fontSize: 9, fontFamily: 'Satoshi-Bold', color: 'rgba(200,184,232,0.5)', letterSpacing: 1.0 },
  statDivider:  { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },
  wornBanner:   { height: 72, marginBottom: 8, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(193,151,255,0.18)', backgroundColor: '#130F24' },
  wornBadge:    { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, marginBottom: 5, backgroundColor: 'rgba(232,120,156,0.13)', borderWidth: 1, borderColor: 'rgba(232,120,156,0.25)' },
  wornBadgeText:{ fontSize: 7, fontFamily: 'Satoshi-Bold', color: '#E88EAE', letterSpacing: 1.0 },
  wornTitleText:{ fontSize: 15, fontFamily: 'Satoshi-Bold', color: '#FFF' },
  wornBtn:      { zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(9,6,20,0.58)' },
  wornBtnText:  { fontSize: 10.5, fontFamily: 'Satoshi-Medium', color: 'rgba(235,225,255,0.88)' },
});

const offlineS = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 8, marginBottom: 2, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(14,10,32,0.88)', borderColor: 'rgba(200,168,75,0.35)', zIndex: 10 },
  dot:     { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8A84B', flexShrink: 0 },
  msg:     { flex: 1, fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(220,210,240,0.78)' },
  btn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(107,91,149,0.40)' },
  btnText: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9B78E8' },
});
