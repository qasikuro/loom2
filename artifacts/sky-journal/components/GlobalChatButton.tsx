import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { useApp } from '@/context/AppContext';
import { useFriendsDrawer } from '@/context/FriendsDrawerContext';
import { useColors } from '@/hooks/useColors';
import { useChatAccent } from '@/hooks/useChatAccent';
import { useGlobalChatButtonSettings } from '@/context/GlobalChatButtonSettingsContext';
import { shouldShowGlobalChat } from '@/utils/chatButtonVisibility';
import {
  clampChatButtonPoint, getChatButtonFractions, getDefaultChatButtonPoint,
  pointFromChatButtonFractions, type ChatButtonPoint,
} from '@/utils/globalChatButtonPosition';
import '@/i18n/drawerTranslations';

const POSITION_KEY = 'storigam:global-chat-button-position:v1';
const BUTTON_SIZE = 60;
const DRAG_THRESHOLD = 12;

export function GlobalChatButton() {
  const { t } = useTranslation();
  const colors = useColors();
  const { accent, onAccent } = useChatAccent();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const segments = useSegments();
  const { isSignedIn } = useAuth();
  const { dmUnread } = useApp();
  const { open, isOpen } = useFriendsDrawer();
  const { enabled: buttonEnabled, isLoaded: buttonPreferenceLoaded } = useGlobalChatButtonSettings();
  const [kb, setKb] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const insetsValue = useMemo(
    () => ({ top: insets.top, right: insets.right, bottom: insets.bottom, left: insets.left }),
    [insets.top, insets.right, insets.bottom, insets.left],
  );
  const initialPosition = getDefaultChatButtonPoint(width, height, BUTTON_SIZE, insetsValue);
  const positionRef = useRef<Animated.ValueXY | null>(null);
  if (!positionRef.current) positionRef.current = new Animated.ValueXY(initialPosition);
  const position = positionRef.current;
  const currentPoint = useRef<ChatButtonPoint>(initialPosition);
  const dragOrigin = useRef<ChatButtonPoint>(initialPosition);
  const dragged = useRef(false);
  const userMoved = useRef(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKb(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(false));
    let mounted = true;
    AsyncStorage.getItem(POSITION_KEY).then(raw => {
      if (!mounted || !raw || userMoved.current || dragged.current) return;
      const saved = JSON.parse(raw) as Partial<ChatButtonPoint>;
      if (typeof saved.x !== 'number' || typeof saved.y !== 'number') return;
      const restored = pointFromChatButtonFractions(saved as ChatButtonPoint, width, height, BUTTON_SIZE, insetsValue);
      currentPoint.current = restored;
      position.setValue(restored);
    }).catch(() => null);
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => null);
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; show.remove(); hide.remove(); motion.remove(); };
  }, [height, insetsValue, position, width]);

  useEffect(() => {
    const bounded = clampChatButtonPoint(currentPoint.current, width, height, BUTTON_SIZE, insetsValue);
    currentPoint.current = bounded;
    position.setValue(bounded);
  }, [width, height, insetsValue, position]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, gesture) =>
      !kb && !isOpen && Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
    onPanResponderGrant: () => {
      position.stopAnimation();
      dragOrigin.current = currentPoint.current;
      dragged.current = false;
    },
    onPanResponderMove: (_, gesture) => {
      const next = clampChatButtonPoint({
        x: dragOrigin.current.x + gesture.dx,
        y: dragOrigin.current.y + gesture.dy,
      }, width, height, BUTTON_SIZE, insetsValue);
      dragged.current = true;
      currentPoint.current = next;
      position.setValue(next);
    },
    onPanResponderRelease: () => {
      if (!dragged.current) return;
      userMoved.current = true;
      const fractions = getChatButtonFractions(currentPoint.current, width, height, BUTTON_SIZE, insetsValue);
      AsyncStorage.setItem(POSITION_KEY, JSON.stringify(fractions)).catch(() => null);
      if (!reduceMotion) {
        const target = clampChatButtonPoint(currentPoint.current, width, height, BUTTON_SIZE, insetsValue);
        Animated.spring(position, { toValue: target, useNativeDriver: true, speed: 22, bounciness: 4 }).start();
      }
    },
    onPanResponderTerminate: () => {
      dragged.current = false;
      position.setValue(currentPoint.current);
    },
    onPanResponderTerminationRequest: () => false,
  }), [height, insetsValue, isOpen, kb, position, reduceMotion, width]);

  if (!buttonPreferenceLoaded || !buttonEnabled || !shouldShowGlobalChat(segments as string[], !!isSignedIn) || kb || isOpen) return null;
  const label = dmUnread > 0 ? `${t('social.openMessages')}, ${t('social.unreadCount', { count: dmUnread })}` : t('social.openMessages');

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[styles.positioned, { transform: position.getTranslateTransform() }]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('social.moveChatButtonHint', { defaultValue: 'Drag to move this button' })}
        hitSlop={8}
        pressRetentionOffset={12}
        testID="global-chat-button"
        onPress={() => { Keyboard.dismiss(); open('all'); }}
        activeOpacity={0.86}
        style={[styles.btn, { backgroundColor: accent, borderColor: colors.card }]}
      >
        <Icon name="message-circle" size={27} color={onAccent} />
        {dmUnread > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.destructive, borderColor: colors.card }]}>
            <Text style={[styles.badgeText, { color: colors.destructiveForeground }]}>{dmUnread > 9 ? '9+' : dmUnread}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioned: { position: 'absolute', top: 0, left: 0, width: BUTTON_SIZE, height: BUTTON_SIZE, zIndex: 30 },
  btn: {
    width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 9,
  },
  badge: {
    position: 'absolute', top: -4, right: -5, minWidth: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  badgeText: {
    fontSize: 10, lineHeight: 14, fontFamily: 'Satoshi-Bold', paddingHorizontal: 3,
  },
});
