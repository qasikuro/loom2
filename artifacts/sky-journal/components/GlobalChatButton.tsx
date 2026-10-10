import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useFriendsDrawer } from '@/context/FriendsDrawerContext';
import { useColors } from '@/hooks/useColors';
import { useChatAccent } from '@/hooks/useChatAccent';
import { shouldShowGlobalChat } from '@/utils/chatButtonVisibility';
import '@/i18n/drawerTranslations';

export function GlobalChatButton() {
  const { t } = useTranslation();
  const colors = useColors();
  const { accent, onAccent } = useChatAccent();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const segments = useSegments();
  const { isSignedIn } = useAuth();
  const { dmUnread } = useApp();
  const { open, isOpen } = useFriendsDrawer();
  const [kb, setKb] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (!shouldShowGlobalChat(segments as string[], !!isSignedIn) || kb || isOpen) return null;
  // Float just above mid-screen while staying clear of the status bar and bottom navigation.
  const top = Math.max(
    insets.top + 48,
    Math.min(Math.round(height * 0.49), height - insets.bottom - 72),
  );
  const right = Math.max(16, insets.right + 12);
  const label = dmUnread > 0 ? `${t('social.openMessages')}, ${t('social.unreadCount', { count: dmUnread })}` : t('social.openMessages');

  return (
    <TouchableOpacity
      accessibilityRole="button" accessibilityLabel={label} testID="global-chat-button"
      onPress={() => { Keyboard.dismiss(); open('all'); }}
      activeOpacity={0.86}
      style={[styles.btn, { top, right, backgroundColor: accent, borderColor: colors.card }]}
    >
      <Icon name="message-circle" size={27} color={onAccent} />
      {dmUnread > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.destructive, borderColor: colors.card }]}>
          <Text style={[styles.badgeText, { color: colors.destructiveForeground }]}>{dmUnread > 9 ? '9+' : dmUnread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 9, zIndex: 30,
  },
  badge: {
    position: 'absolute', top: -4, right: -5, minWidth: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  badgeText: {
    fontSize: 10, lineHeight: 14, fontFamily: 'Satoshi-Bold', paddingHorizontal: 3,
  },
});
