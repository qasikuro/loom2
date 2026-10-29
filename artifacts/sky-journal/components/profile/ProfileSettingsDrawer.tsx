import { Icon } from '@/components/Icon';
import { SettingsArtworkIcon } from './SettingsArtworkIcon';
import type { Character } from '@/context/AppContext';
import { useApp } from '@/context/AppContext';
import { useSound } from '@/context/SoundContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';
import { setAppLanguage, supportedLanguages } from '@/i18n';
import i18n from '@/i18n';
import * as Haptics from 'expo-haptics';
import { SecureImage as Image } from '@/components/SecureImage';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Animated, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGlobalChatButtonSettings } from '@/context/GlobalChatButtonSettingsContext';
import { useClerk } from '@clerk/expo';
import { useDeleteMyAccount } from '@workspace/api-client-react';

const HELP_CENTER_URL = 'https://www.storigam.com/storigam/help';
const FEEDBACK_URL = 'https://www.storigam.com/storigam/help#feedback';
const ABOUT_URL = 'https://www.storigam.com/storigam/about';

// ── SoundToggle ────────────────────────────────────────────────────────────────

function SoundToggle() {
  const { t } = useTranslation();
  const { soundEnabled, setSoundEnabled } = useSound();
  const colors = useColors();
  return (
    <TouchableOpacity
      style={s.drawerItem}
      onPress={() => { Haptics.selectionAsync(); setSoundEnabled(!soundEnabled); }}
      activeOpacity={0.75}
    >
      <View style={s.drawerItemIcon}>
        <SettingsArtworkIcon name="animation_sounds" fallback={soundEnabled ? 'volume-2' : 'volume-x'} color={colors.mutedForeground} />
      </View>
      <Text style={[s.drawerItemLabel, { flex: 1, color: colors.foreground }]}>{t('settings.animationSounds')}</Text>
      <View style={[s.soundPill, soundEnabled ? s.soundPillOn : s.soundPillOff, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={[s.soundKnob, {
          backgroundColor: soundEnabled ? colors.primary : colors.mutedForeground,
          transform: [{ translateX: soundEnabled ? 16 : 0 }],
        }]} />
      </View>
    </TouchableOpacity>
  );
}

function FloatingChatToggle() {
  const { t } = useTranslation();
  const colors = useColors();
  const { enabled, isLoaded, setEnabled } = useGlobalChatButtonSettings();
  return (
    <TouchableOpacity
      style={s.drawerItem}
      accessibilityRole="switch"
      accessibilityLabel={t('social.floatingChatButton')}
      accessibilityHint={t('social.floatingChatButtonHint')}
      accessibilityState={{ checked: enabled, disabled: !isLoaded }}
      testID="floating-chat-button-setting"
      disabled={!isLoaded}
      onPress={() => { Haptics.selectionAsync(); setEnabled(!enabled); }}
      activeOpacity={0.75}
    >
      <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}>
        <SettingsArtworkIcon name="floating_chat" fallback="message-circle" color={colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('social.floatingChatButton')}</Text>
        <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, marginTop: 1 }}>
          {t('social.floatingChatButtonHint')}
        </Text>
      </View>
      <View style={[s.soundPill, enabled ? s.soundPillOn : s.soundPillOff, { borderColor: colors.border }]}>
        <View style={[s.soundKnob, {
          backgroundColor: enabled ? colors.primary : colors.mutedForeground,
          transform: [{ translateX: enabled ? 16 : 0 }],
        }]} />
      </View>
    </TouchableOpacity>
  );
}

// ── ThemeToggle ────────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();
  const colors = useColors();
  const OPTIONS: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light',  icon: 'sun',     label: t('settings.light') },
    { mode: 'system', icon: 'monitor', label: t('settings.auto') },
    { mode: 'dark',   icon: 'moon',    label: t('settings.dark') },
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
            <SettingsArtworkIcon name={opt.mode === 'system' ? 'auto_mode' : opt.mode === 'light' ? 'light_mode' : 'dark_mode'} fallback={opt.icon as 'sun' | 'monitor' | 'moon'} size={18} color={active ? colors.primary : colors.mutedForeground} />
            <Text style={[s.themeOptionText, { color: active ? colors.primary : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', ja: '日本語', es: 'Español', tr: 'Türkçe', fr: 'Français',
  de: 'Deutsch', pt: 'Português', ko: '한국어', zh: '中文', ru: 'Русский',
  ar: 'العربية', it: 'Italiano',
};

function LanguageChooser() {
  const { t } = useTranslation();
  const colors = useColors();
  const [languageError, setLanguageError] = React.useState(false);
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text style={[s.drawerItemLabel, { color: colors.foreground, marginBottom: 10 }]}>{t('common.language')}</Text>
      <View style={s.languageOptions}>
        {supportedLanguages.map(language => (
          <TouchableOpacity
            key={language}
            accessibilityRole="button"
            accessibilityState={{ selected: i18n.language === language }}
            onPress={() => {
              setLanguageError(false);
              void setAppLanguage(language).catch(() => setLanguageError(true));
            }}
            style={[s.languageOption, { backgroundColor: colors.card }, i18n.language === language && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}
          >
            <Text style={[s.languageText, { color: colors.foreground }]}>{LANGUAGE_NAMES[language] ?? language}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {languageError && <Text style={[s.languageError, { color: colors.destructive }]}>{t('settings.languageSaveError')}</Text>}
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
  toggleOnlineStatus: () => void;
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
  drawerOpen, drawerX, drawerWidth, character, toggleVisibility, toggleOnlineStatus,
  handleSignOut, confirmingSignOut, closeDrawer, user, avatarSource, topPad, colors,
}: Props) {
  const { t } = useTranslation();
  const { signOut } = useClerk();
  const { clearUserData } = useApp();
  const deleteAccountMutation = useDeleteMyAccount();
  const [deletingAccount, setDeletingAccount] = React.useState(false);
  const openSupportPage = (url: string) => {
    closeDrawer();
    setTimeout(() => {
      void Linking.openURL(url).catch(() => {
        Alert.alert(
          t('settings.support'),
          `Unable to open the page. Visit ${url} or email shpport@gmail.com.`,
        );
      });
    }, 260);
  };
  const confirmDeleteAccount = () => {
    if (deletingAccount) return;
    Alert.alert(
      t('settings.requestAccountDeletion'),
      'This permanently deletes your profile, stories, outfits, gallery, journal, tutorials, and friendships. Text already delivered in chats may remain for other participants as “Deleted account”; photos you uploaded will be removed. This cannot be undone.',
      [
        { text: t('social.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('settings.requestAccountDeletion'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccountMutation.mutateAsync(undefined);
              await clearUserData();
              closeDrawer();
              await signOut().catch(() => undefined);
              router.replace('/(auth)/sign-in' as any);
              Alert.alert(
                t('settings.requestAccountDeletion'),
                'Your account data has been removed. Authentication and uploaded-file cleanup are finishing securely.',
              );
            } catch {
              setDeletingAccount(false);
              Alert.alert(
                t('settings.requestAccountDeletion'),
                'We could not confirm the deletion result. Check your connection and try again, or contact support if you can no longer sign in.',
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  };
  return (
    <>
      {drawerOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.52)', zIndex: 20 }]}
          onPress={closeDrawer}
        />
      )}

      <Animated.View
        style={[s.drawer, { width: drawerWidth, paddingTop: topPad, backgroundColor: colors.card }, { transform: [{ translateX: drawerX }] }]}
        pointerEvents={drawerOpen ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

          <View style={[s.drawerHeader, { borderBottomColor: colors.border }]}>
            <View style={[s.drawerAvatar, { borderColor: `${colors.primary}60` }]}>
              <Image source={avatarSource} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
            <Text style={[s.drawerName, { color: colors.foreground }]}>{character.name}</Text>
            {character.username && <Text style={[s.drawerHandle, { color: colors.mutedForeground }]}>@{character.username}</Text>}
          </View>

          <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>{t('settings.account')}</Text>
          <View style={[s.drawerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={s.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.push('/messages' as any), 260); }} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="messages" fallback="message-circle" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { flex: 1, color: colors.foreground }]}>{t('settings.messages')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <FloatingChatToggle />
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={toggleVisibility} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="privacy" fallback="shield" color={colors.mutedForeground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.privacy')}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, marginTop: 1 }}>
                  Profile visibility · Private means friends only
                </Text>
              </View>
              <View style={{ backgroundColor: character.isPublic ? `${colors.primary}18` : colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: character.isPublic ? `${colors.primary}40` : colors.border }}>
                <Text style={{ fontSize: 11, fontFamily: 'Satoshi-Bold', color: character.isPublic ? colors.primary : colors.mutedForeground }}>
                  {t(character.isPublic ? 'common.public' : 'common.private')}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={s.drawerItem}
              accessibilityRole="button"
              accessibilityLabel="Post privacy"
              testID="settings-post-privacy"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => { closeDrawer(); setTimeout(() => router.push('/post-privacy' as any), 260); }}
              activeOpacity={0.7}
            >
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="post_privacy" fallback="eye" color={colors.mutedForeground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>Post privacy</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, marginTop: 1 }}>
                  Choose who sees each story, outfit, book and tutorial
                </Text>
              </View>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} onPress={toggleOnlineStatus} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="online_status" fallback="circle" color={colors.mutedForeground} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.onlineStatus')}</Text>
                <Text style={{ fontSize: 10, fontFamily: 'Satoshi-Regular', color: colors.mutedForeground, marginTop: 1 }}>
                  {(character.showOnlineStatus ?? true) ? t('settings.onlineVisible') : t('settings.onlineHidden')}
                </Text>
              </View>
              <View style={[s.soundPill, (character.showOnlineStatus ?? true) ? s.soundPillOn : s.soundPillOff]}>
                <View style={[s.soundKnob, {
                  backgroundColor: (character.showOnlineStatus ?? true) ? '#4EC87A' : 'rgba(200,184,232,0.35)',
                  transform: [{ translateX: (character.showOnlineStatus ?? true) ? 16 : 0 }],
                }]} />
              </View>
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={s.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.push('/blocked-users' as any), 260); }} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="blocked_users" fallback="slash" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { flex: 1, color: colors.foreground }]}>{t('settings.blockedUsers')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TouchableOpacity style={s.drawerItem} onPress={() => { closeDrawer(); setTimeout(() => router.push('/purchase-history' as any), 260); }} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="purchase_history" fallback="shopping-bag" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { flex: 1, color: colors.foreground }]}>{t('settings.purchaseHistory')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>{t('settings.appearance')}</Text>
          <View style={[s.drawerGroup, { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemeToggle />
          </View>

          <View style={[s.drawerGroup, { marginTop: 8, backgroundColor: colors.card, borderColor: colors.border }]}>
            <LanguageChooser />
          </View>

          <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>{t('settings.sound')}</Text>
          <View style={[s.drawerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SoundToggle />
          </View>

          <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>{t('settings.myAccount')}</Text>
          <View style={[s.drawerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.drawerItem}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="email" fallback="mail" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { flex: 1, color: colors.foreground }]} numberOfLines={1}>{user?.primaryEmailAddress?.emailAddress ?? '—'}</Text>
            </View>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="change_email" fallback="mail" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.changeEmail')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity style={s.drawerItem} activeOpacity={0.7}>
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="change_password" fallback="lock" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.changePassword')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={s.drawerItem}
              accessibilityRole="button"
              accessibilityLabel={t('settings.requestAccountDeletion')}
              accessibilityState={{ disabled: deletingAccount }}
              testID="settings-delete-account"
              onPress={confirmDeleteAccount}
              disabled={deletingAccount}
              activeOpacity={0.7}
            >
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="delete_account" fallback="trash-2" color={colors.destructive} /></View>
              <Text style={[s.drawerItemLabel, { flex: 1, color: colors.destructive }]}>{deletingAccount ? 'Deleting…' : t('settings.requestAccountDeletion')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={[s.drawerItem, confirmingSignOut && { backgroundColor: `${colors.destructive}18` }]}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <View style={s.drawerItemIcon}><SettingsArtworkIcon name="sign_out" fallback="log-out" color={colors.destructive} /></View>
              <Text style={[s.drawerItemLabel, { color: '#EF4444' }]}>
                {confirmingSignOut ? t('settings.confirmSignOut') : t('settings.signOut')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[s.drawerSectionLabel, { color: colors.mutedForeground }]}>{t('settings.support')}</Text>
          <View style={[s.drawerGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={s.drawerItem}
              accessibilityRole="link"
              testID="settings-help-center"
              onPress={() => openSupportPage(HELP_CENTER_URL)}
              activeOpacity={0.7}
            >
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="help_center" fallback="help-circle" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.helpCenter')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={s.drawerItem}
              accessibilityRole="link"
              testID="settings-send-feedback"
              onPress={() => openSupportPage(FEEDBACK_URL)}
              activeOpacity={0.7}
            >
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="send_feedback" fallback="edit-2" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.sendFeedback')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={s.drawerDivider} />
            <TouchableOpacity
              style={s.drawerItem}
              accessibilityRole="link"
              testID="settings-about"
              onPress={() => openSupportPage(ABOUT_URL)}
              activeOpacity={0.7}
            >
              <View style={[s.drawerItemIcon, { backgroundColor: colors.muted }]}><SettingsArtworkIcon name="about" fallback="info" color={colors.mutedForeground} /></View>
              <Text style={[s.drawerItemLabel, { color: colors.foreground }]}>{t('settings.about')}</Text>
              <Icon name="chevron-right" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[s.drawerVersion, { color: colors.mutedForeground }]}>{t('settings.appVersion', { version: '1.0.0' })}</Text>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  drawer:           { position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 30, shadowColor: '#000', shadowOpacity: 0.16, shadowOffset: { width: -8, height: 0 }, shadowRadius: 24, elevation: 20 },
  drawerHeader:     { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, borderBottomWidth: 1, gap: 6 },
  drawerAvatar:     { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, overflow: 'hidden', marginBottom: 4 },
  drawerName:       { fontSize: 18, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  drawerHandle:     { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  drawerSectionLabel: { fontSize: 9, fontFamily: 'Satoshi-Bold', letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  drawerGroup:      { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  drawerItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12, minHeight: 48 },
  drawerItemIcon:   { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  drawerItemLabel:  { fontSize: 13, fontFamily: 'Satoshi-Medium' },
  drawerDivider:    { height: 1, backgroundColor: 'rgba(107,91,149,0.14)', marginHorizontal: 14 },
  drawerVersion:    { fontSize: 11, fontFamily: 'Satoshi-Regular', textAlign: 'center', marginTop: 28, marginBottom: 8 },
  soundPill:        { width: 36, height: 20, borderRadius: 10, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 2 },
  soundPillOn:      { backgroundColor: 'rgba(120,70,255,0.22)', borderColor: 'rgba(120,70,255,0.55)' },
  soundPillOff:     { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(200,184,232,0.20)' },
  soundKnob:        { width: 14, height: 14, borderRadius: 7 },
  themeRow:         { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4, marginBottom: 4 },
  themeOption:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  themeOptionText:  { fontSize: 12, fontFamily: 'Satoshi-Bold' },
  languageOptions:  { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  languageOption:   { borderWidth: 1, borderColor: 'rgba(200,184,232,0.16)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  languageText:     { color: '#EDE8FF', fontSize: 11, fontFamily: 'Satoshi-Medium' },
  languageError:    { color: '#FF8D9D', fontSize: 11, marginTop: 8 },
});
