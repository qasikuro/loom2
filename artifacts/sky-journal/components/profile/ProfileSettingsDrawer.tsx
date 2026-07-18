import { Icon } from '@/components/Icon';
import type { Character } from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ── SoundToggle ────────────────────────────────────────────────────────────────

function SoundToggle() {
  const { soundEnabled, setSoundEnabled } = useSound();
  return (
    <TouchableOpacity
      style={s.drawerItem}
      onPress={() => { Haptics.selectionAsync(); setSoundEnabled(!soundEnabled); }}
      activeOpacity={0.75}
    >
      <View style={s.drawerItemIcon}>
        <Icon name={soundEnabled ? 'volume-2' : 'volume-x'} size={15} color="rgba(200,184,232,0.75)" />
      </View>
      <Text style={[s.drawerItemLabel, { flex: 1 }]}>Animation Sounds</Text>
      <View style={[s.soundPill, soundEnabled ? s.soundPillOn : s.soundPillOff]}>
        <View style={[s.soundKnob, {
          backgroundColor: soundEnabled ? '#A080F8' : 'rgba(200,184,232,0.35)',
          transform: [{ translateX: soundEnabled ? 16 : 0 }],
        }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── ThemeToggle ────────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();
  const colors = useColors();
  const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light',  icon: 'sun',     label: 'Light' },
    { mode: 'system', icon: 'monitor', label: 'Auto'  },
    { mode: 'dark',   icon: 'moon',    label: 'Dark'  },
  ];
  return (
    <View style={[s.themeRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      {OPTIONS.map(opt => {
        const active = themeMode === opt.mode;
        return (
          <TouchableOpacity
            key={opt.mode}
            style={[s.themeOption, active && { backgroundColor: colors.card, borderColor: `${colors.primary}40` }, !active && { borderColor: 'transparent' }]}
            onPress={() => { Haptics.selectionAsync(); setThemeMode(opt.mode); }}
            activeOpacity={0.75}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Icon name={opt.icon as any} size={14} color={active ? colors.primary : colors.mutedForeground} />
            <Text style={[s.themeOptionText, { color: active ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── ProfileSettingsDrawer ──────────────────────────────────────────────────────

interface Props {
  drawerOpen: boolean;
  drawerX: Animated.AnimatedInterpolation<string | number>;
  drawerWidth: number;
  character: Character;
  toggleVisibility: () => void;
  handleSignOut: () => void;
  confirmingSignOut: boolean;
  closeDrawer: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  avatarSource: any;
  topPad: number;
  colors: ReturnType<typeof useColors>;
}

export function ProfileSettingsDrawer({
  drawerOpen, drawerX, drawerWidth, character, toggleVisibility,
  handleSignOut, confirmingSignOut, closeDrawer, user, avatarSource, topPad, colors,
}: Props) {
  return (
    <>
      {drawerOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 20 }]}
          onPress={closeDrawer}
        />
      )}

      <Animated.View
        style={[s.drawer, { width: drawerWidth, paddingTop: topPad, backgroundColor: '#100E20' }, { transform: [{ translateX: drawerX }] }]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          <View style={s.drawerHeader}>
            <View style={[s.drawerAvatar, { borderColor: `${colors.primary}60` }]}>
              <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <Text style={s.drawerName}>{character.name}</Text>
            {character.username && <Text style={s.drawerHandle}>@{character.username}</Text>}
          </View>

          <Text style={s.drawerSectionLabel}>ACCOUNT</Text>
          <View style={s.drawerGroup}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={s.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.push('/messages' as any), 260); }} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="message-circle" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[s.drawerItemLabel, { flex: 1 }]}>Messages</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={toggleVisibility} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="lock" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[s.drawerItemLabel, { flex: 1 }]}>Privacy</Text>
              <View style={{ backgroundColor: character.isPublic ? 'rgba(107,91,149,0.30)' : 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: character.isPublic ? 'rgba(107,91,149,0.45)' : 'rgba(255,255,255,0.12)' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: character.isPublic ? colors.primary : 'rgba(200,184,232,0.55)' }}>
                  {character.isPublic ? 'Public' : 'Private'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={s.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.push('/purchase-history' as any), 260); }} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="shopping-bag" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[s.drawerItemLabel, { flex: 1 }]}>Purchase History</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
          </View>

          <Text style={s.drawerSectionLabel}>APPEARANCE</Text>
          <View style={[s.drawerGroup, { paddingVertical: 4, paddingHorizontal: 8 }]}>
            <ThemeToggle />
          </View>

          <Text style={s.drawerSectionLabel}>SOUND</Text>
          <View style={s.drawerGroup}>
            <SoundToggle />
          </View>

          <Text style={s.drawerSectionLabel}>MY ACCOUNT</Text>
          <View style={s.drawerGroup}>
            <View style={s.drawerItem}>
              <View style={s.drawerItemIcon}><Icon name="mail" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={[s.drawerItemLabel, { flex: 1 }]} numberOfLines={1}>{user?.primaryEmailAddress?.emailAddress ?? '—'}</Text>
            </View>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="mail" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={s.drawerItemLabel}>Change Email</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="lock" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={s.drawerItemLabel}>Change Password</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={[s.drawerItem, confirmingSignOut && { backgroundColor: '#EF444418' }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <View style={s.drawerItemIcon}><Icon name="log-out" size={15} color="#EF4444" /></View>
              <Text style={[s.drawerItemLabel, { color: '#EF4444' }]}>
                {confirmingSignOut ? 'Tap again to sign out' : 'Sign out'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={s.drawerSectionLabel}>SUPPORT</Text>
          <View style={s.drawerGroup}>
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="help-circle" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={s.drawerItemLabel}>Help Center</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="message-square" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={s.drawerItemLabel}>Send Feedback</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={s.drawerItemIcon}><Icon name="info" size={15} color="rgba(200,184,232,0.75)" /></View>
              <Text style={s.drawerItemLabel}>About</Text>
              <Icon name="chevron-right" size={13} color="rgba(200,184,232,0.3)" />
            </TouchableOpacity>
          </View>

          <Text style={s.drawerVersion}>App version 1.0.0</Text>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  drawer:           { position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30, shadowColor: '#000', shadowOpacity: 0.5, shadowOffset: { width: -8, height: 0 }, shadowRadius: 24, elevation: 20 },
  drawerHeader:     { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(155,120,255,0.12)', gap: 6 },
  drawerAvatar:     { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, overflow: 'hidden', marginBottom: 4 },
  drawerName:       { fontSize: 18, fontFamily: 'Satoshi-Bold', color: '#EDE8FF', letterSpacing: -0.3 },
  drawerHandle:     { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,184,232,0.60)' },
  drawerSectionLabel: { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, color: 'rgba(200,184,232,0.40)', textTransform: 'uppercase', paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  drawerGroup:      { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(155,120,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)' },
  drawerItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12, minHeight: 48 },
  drawerItemIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(155,120,255,0.12)' },
  drawerItemLabel:  { fontSize: 13, fontFamily: 'Satoshi-Medium', color: '#EDE8FF' },
  drawerDivider:    { height: 1, backgroundColor: 'rgba(155,120,255,0.10)', marginHorizontal: 14 },
  drawerVersion:    { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.30)', textAlign: 'center', marginTop: 28, marginBottom: 8 },
  soundPill:        { width: 36, height: 20, borderRadius: 10, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 2 },
  soundPillOn:      { backgroundColor: 'rgba(120,70,255,0.22)', borderColor: 'rgba(120,70,255,0.55)' },
  soundPillOff:     { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(200,184,232,0.20)' },
  soundKnob:        { width: 14, height: 14, borderRadius: 7 },
  themeRow:         { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 4 },
  themeOption:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  themeOptionText:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
});
