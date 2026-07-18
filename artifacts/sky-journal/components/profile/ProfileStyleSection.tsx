import { Icon } from '@/components/Icon';
import type { GalleryPhoto, Outfit } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fmtBal } from './profileConstants';

interface Props {
  outfits: Outfit[];
  openOutfit: (id: string) => void;
  gallery: GalleryPhoto[];
  openPhoto: (photo: GalleryPhoto) => void;
  handleAddGalleryPhoto: () => Promise<void>;
  galleryUploading: boolean;
  galleryError: string | null;
  setShowShop: (v: boolean) => void;
  rewardBalance: { stars: number; auraEnergy: number; memoryShards: number } | null;
  purchasedIds: string[];
  shopCatalog: Array<{ id: string; name: string; category: string; icon: string }>;
  activeCosmetics: Record<string, string>;
  setActiveCosmetic: (id: string) => void;
  activeOutfitId: string | null;
  moodAccent: string;
}

export function ProfileStyleSection({
  outfits, openOutfit, gallery, openPhoto,
  handleAddGalleryPhoto, galleryUploading, galleryError,
  setShowShop, rewardBalance, purchasedIds, shopCatalog,
  activeCosmetics, setActiveCosmetic, activeOutfitId, moodAccent: _moodAccent,
}: Props) {
  const colors = useColors();
  const { t }  = useTranslation();

  const CATEGORY_ICON:  Record<string, string> = { frame: '⬡', accent: '◈', theme: '◇', effect: '✦' };
  const CATEGORY_COLOR: Record<string, string> = { frame: '#C8A84B', accent: '#9878C8', theme: '#78B8E8', effect: '#70C8A0' };

  return (
    <>
      {/* ── Sky Shop entry ─── */}
      <View style={s.section}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowShop(true); }}
          activeOpacity={0.82}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(107,91,149,0.08)', borderColor: 'rgba(107,91,149,0.22)', borderWidth: 1, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16 }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(107,91,149,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>🛍</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontFamily: 'Satoshi-Bold', color: colors.foreground, letterSpacing: -0.2 }}>Sky Shop</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, marginTop: 1 }}>Browse frames, accents & themes</Text>
          </View>
          {rewardBalance && (
            <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', flexShrink: 1 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#C8A84B' }} numberOfLines={1}>✦ {fmtBal(rewardBalance.stars)}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#9878D8' }} numberOfLines={1}>◈ {fmtBal(rewardBalance.auraEnergy)}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#78B4DC' }} numberOfLines={1}>◇ {fmtBal(rewardBalance.memoryShards)}</Text>
            </View>
          )}
          <Icon name="chevron-right" size={16} color="rgba(107,91,149,0.55)" />
        </TouchableOpacity>
      </View>

      {/* ── Owned Cosmetics ─── */}
      {(() => {
        const owned = shopCatalog.filter(item => purchasedIds.includes(item.id));
        if (owned.length === 0) return null;
        return (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Owned Cosmetics</Text>
                <View style={[s.countPill, { backgroundColor: 'rgba(200,168,75,0.12)', borderColor: 'rgba(200,168,75,0.25)' }]}>
                  <Text style={[s.countPillText, { color: '#C8A84B' }]}>{owned.length}</Text>
                </View>
              </View>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TouchableOpacity onPress={() => router.push('/purchase-history' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.75}>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Medium', color: colors.mutedForeground }}>History</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
              {owned.map(item => {
                const cat     = item.category;
                const isActive = activeCosmetics[cat] === item.id;
                const iconChar = CATEGORY_ICON[cat] ?? '✦';
                const catColor = CATEGORY_COLOR[cat] ?? '#C8B8E8';
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveCosmetic(item.id); }}
                    activeOpacity={0.8}
                    style={{ width: 90, marginRight: 8, borderRadius: 14, borderWidth: 1.5, borderColor: isActive ? catColor : 'rgba(255,255,255,0.08)', backgroundColor: isActive ? `${catColor}12` : 'rgba(255,255,255,0.04)', padding: 10, alignItems: 'center', gap: 6 }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${catColor}18`, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                    </View>
                    <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Bold', color: isActive ? catColor : 'rgba(200,184,232,0.70)', textAlign: 'center' }} numberOfLines={2}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${catColor}18` }}>
                      <Text style={{ fontSize: 9, color: catColor }}>{iconChar}</Text>
                      <Text style={{ fontSize: 9, fontFamily: 'Satoshi-Bold', color: catColor, textTransform: 'capitalize' }}>{cat}</Text>
                    </View>
                    {isActive && <View style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: catColor }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })()}

      {/* ── Wardrobe ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>{t('profile.wardrobe')}</Text>
            {outfits.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                <Text style={[s.countPillText, { color: colors.primary }]}>{outfits.length}</Text>
              </View>
            )}
          </View>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TouchableOpacity style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]} onPress={() => router.push('/create-outfit' as any)} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="plus" size={13} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>New outfit</Text>
          </TouchableOpacity>
        </View>

        {outfits.length === 0 ? (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <TouchableOpacity style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]} onPress={() => router.push('/create-outfit' as any)} activeOpacity={0.75}>
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name="camera" size={20} color={`${colors.primary}70`} /></View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No outfits yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Log your first sky look</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {outfits.slice(0, 8).map(outfit => {
              const isActive = outfit.id === activeOutfitId;
              return (
                <TouchableOpacity key={outfit.id} style={[s.outfitCard, { backgroundColor: colors.card, borderColor: isActive ? colors.primary : colors.border }]} onPress={() => openOutfit(outfit.id)} activeOpacity={0.85}>
                  {outfit.imageUri ? (
                    <Image source={{ uri: outfit.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.primary}14`, alignItems: 'center', justifyContent: 'center' }]}>
                      <Icon name="camera" size={22} color={`${colors.primary}50`} />
                    </View>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(8,6,22,0.90)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
                    <Text style={s.outfitName} numberOfLines={2}>{outfit.name}</Text>
                    {isActive && <View style={[s.activePill, { backgroundColor: colors.primary }]}><Text style={s.activePillText}>Worn</Text></View>}
                  </LinearGradient>
                  {(outfit.tags ?? []).length > 0 && (
                    <View style={[s.rarityPill, { backgroundColor: 'rgba(8,6,22,0.75)', top: 7, left: 7 }]}>
                      <Text style={[s.rarityText, { color: 'rgba(220,200,255,0.9)' }]}>{outfit.tags[0]}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Gallery ─── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Gallery</Text>
            {gallery.length > 0 && (
              <View style={[s.countPill, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}28` }]}>
                <Text style={[s.countPillText, { color: colors.primary }]}>{gallery.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: `${colors.primary}14`, borderColor: `${colors.primary}28` }]} onPress={handleAddGalleryPhoto} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {galleryUploading ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="plus" size={13} color={colors.primary} />}
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add photo</Text>
          </TouchableOpacity>
        </View>

        {gallery.length === 0 ? (
          <TouchableOpacity style={[s.emptyCard, { backgroundColor: `${colors.primary}08`, borderColor: `${colors.primary}18` }]} onPress={handleAddGalleryPhoto} activeOpacity={0.75}>
            <View style={[s.emptyIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name="image" size={20} color={`${colors.primary}70`} /></View>
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No photos yet</Text>
            <Text style={[s.emptySub, { color: colors.mutedForeground }]}>Tap to add your first sky memory</Text>
          </TouchableOpacity>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scrollPad}>
            {gallery.slice(0, 8).map(photo => (
              <TouchableOpacity key={photo.id} style={s.galleryThumb} onPress={() => openPhoto(photo)} activeOpacity={0.88}>
                <Image source={{ uri: photo.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {galleryError && <Text style={[s.galError, { color: colors.destructive, marginTop: 6 }]}>{galleryError}</Text>}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  section:      { marginBottom: 24 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontFamily: 'Satoshi-Bold', letterSpacing: 0.1 },
  countPill:    { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  countPillText:{ fontSize: 10, fontFamily: 'Satoshi-Bold' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  addBtnText:   { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  scrollPad:    { paddingRight: 16, gap: 10 },
  outfitCard:   { width: 100, height: 130, borderRadius: 14, overflow: 'hidden', borderWidth: 1, position: 'relative' },
  outfitName:   { fontSize: 10, fontFamily: 'Satoshi-Bold', color: 'rgba(240,234,255,0.95)', lineHeight: 13 },
  activePill:   { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  activePillText:{ fontSize: 9, fontFamily: 'Satoshi-Bold', color: '#fff' },
  rarityPill:   { position: 'absolute', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rarityText:   { fontSize: 9, fontFamily: 'Satoshi-Bold' },
  galleryThumb: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1630' },
  galError:     { fontSize: 12, fontFamily: 'Satoshi-Regular' },
  emptyCard:    { borderRadius: 16, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  emptyIcon:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyTitle:   { fontSize: 14, fontFamily: 'Satoshi-Bold', textAlign: 'center' },
  emptySub:     { fontSize: 12, fontFamily: 'Satoshi-Regular', textAlign: 'center', fontStyle: 'italic', lineHeight: 17 },
});
