/**
 * Shared two-Lumi stage above the DM composer. Own Lumi on the RIGHT (tap →
 * send-reaction palette), partner Lumi on the LEFT (non-interactive). Emotes
 * are sent as chat reactions; performances only play from acknowledged
 * events via useSharedChatLumis (parent schedules one at a time).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing, FadeIn, FadeOut, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn, ZoomOut,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { LumiRigView } from '@/features/lumi/home/LumiCharacter';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { CHAT_EMOTES, type ChatEmote, type ChatEmoteId } from './chatEmotes';
import type { SharedLumiEvent } from './sharedChatReactions';
import { useSharedChatLumis } from './useSharedChatLumis';

type Props = {
  enabled?: boolean;
  externalPickerOpen?: boolean;
  onOpenPalette?: () => void;
  busy?: boolean;
  partnerName?: string;
  events: readonly SharedLumiEvent[];
  onSendReaction: (id: ChatEmoteId) => Promise<boolean>;
};
type LumiSide = ReturnType<typeof useSharedChatLumis>['own'];

// ── Emote-specific SVG detail (tears, anger, hush, salute, dizzy…) ───────────
function EmoteDetail({ id, size }: { id: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => cancelAnimation(p);
  }, [id, p]);

  const drip = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ translateY: p.value * size * 0.22 }] }));
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: 0.8 + Math.sin(p.value * Math.PI) * 0.35 }] }));
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 360}deg` }] }));
  const rise = useAnimatedStyle(() => ({ opacity: Math.sin(p.value * Math.PI), transform: [{ translateY: -p.value * size * 0.25 }] }));

  const s = size;
  const box = (style: object, left: number, top: number, w: number, children: React.ReactNode) => (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: s * left, top: s * top, width: s * w, height: s * w }, style]}>
      <Svg viewBox="0 0 24 24" width="100%" height="100%">{children}</Svg>
    </Animated.View>
  );
  const tear = <Path d="M12 3C9 8 7 11 7 14a5 5 0 0 0 10 0c0-3-2-6-5-11z" fill="#8FD0FF" opacity={0.95} />;

  switch (id) {
    case 'teary':
      return <>{box(drip, 0.28, 0.48, 0.14, tear)}{box(drip, 0.6, 0.48, 0.14, tear)}</>;
    case 'angry':
      return box(pulse, 0.66, 0.08, 0.24,
        <Path d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" stroke="#FF5A6E" strokeWidth={3.2} strokeLinecap="round" />);
    case 'hush':
      return box(pulse, 0.66, 0.12, 0.22,
        <><Circle cx={5} cy={12} r={2} fill="#C8B8E8" /><Circle cx={12} cy={12} r={2} fill="#C8B8E8" /><Circle cx={19} cy={12} r={2} fill="#C8B8E8" /></>);
    case 'salute':
      return box(pulse, 0.7, 0.1, 0.2,
        <Path d="M12 2l2.6 6.4L21 9l-5 4.3L17.6 20 12 16.6 6.4 20 8 13.3 3 9l6.4-.6z" fill="#FFD66B" />);
    case 'dizzy':
      return box(spin, 0.32, -0.02, 0.36,
        <>
          <Circle cx={12} cy={12} r={9} stroke="#FFD66B" strokeWidth={1.4} strokeDasharray="3 3" fill="none" />
          <Path d="M12 2l1 2-1 2-1-2z" fill="#FFD66B" />
          <Path d="M21 12l-2 1-2-1 2-1z" fill="#B890FF" />
        </>);
    case 'laugh':
      return <>{box(drip, 0.18, 0.4, 0.12, tear)}{box(drip, 0.7, 0.4, 0.12, tear)}</>;
    case 'flustered':
    case 'peek':
    case 'hug':
    case 'heart':
      return box(rise, 0.68, 0.14, 0.2,
        <Path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z" fill="#FF7FA8" />);
    default:
      return box(rise, 0.7, 0.12, 0.16,
        <Path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#E9D8FF" />);
  }
}

function Mascot({ side, size, children }: { side: LumiSide; size: number; children: React.ReactNode }) {
  const { x } = side;
  const xStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[styles.character, { width: size, height: size }, xStyle]}>{children}</Animated.View>;
}

export function ChatLumiCompanion({
  enabled = true, externalPickerOpen = false, onOpenPalette, busy = false, partnerName, events, onSendReaction,
}: Props) {
  const { t } = useTranslation();
  const c = useColors();
  const { isDark } = useTheme();
  const [stageW, setStageW] = useState(0);
  const [kbOpen, setKbOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sendingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (externalPickerOpen || !enabled) setPaletteOpen(false);
  }, [externalPickerOpen, enabled]);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKbOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKbOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Keep the stage geometry steady while the native keyboard moves the screen.
  // Resizing on keyboardDidShow caused a second, abrupt jump at the end.
  const base = 60;
  // Three distinct spots (left, center, right) must fit: ~3.4 sizes + insets.
  const size = stageW > 0 ? Math.max(36, Math.min(base, Math.floor((stageW - 24) / 3.4))) : base;
  const { own, other, playing } = useSharedChatLumis({ width: stageW, size, enabled: enabled && stageW > 0, events });
  const labelH = 14;
  const stageH = size + 6 + labelH;

  const label = (e: ChatEmote) => t(`lumiChat.emote_${e.id}`, { defaultValue: e.label });
  const desc = (e: ChatEmote) => t(`lumiChat.emote_${e.id}_desc`, { defaultValue: e.description });
  const partner = partnerName?.trim() || t('lumiChat.partner', { defaultValue: 'Partner' });

  const blocked = !enabled || busy || sending;
  const onEmote = async (id: ChatEmoteId) => {
    if (blocked || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    Haptics.selectionAsync().catch(() => null);
    let ok: boolean;
    try { ok = await onSendReaction(id); } catch { ok = false; }
    sendingRef.current = false;
    if (!mountedRef.current) return;
    setSending(false);
    if (ok) setPaletteOpen(false);
    else setFailed(true);
  };

  const ink = c.foreground;
  const sheetBg = c.card;
  const accent = c.tint;
  const reduced = own.reducedMotion;
  const playingSide: LumiSide | null = playing ? (own.phase !== 'idle' && own.selected ? own : other.phase !== 'idle' && other.selected ? other : null) : null;
  const shown = playingSide && playingSide.phase === 'reacting' ? playingSide.selected : null;
  const shownFromOwn = playingSide === own;
  const cardEmote = shown ?? null;

  const renderDetail = (side: LumiSide) =>
    side.phase === 'reacting' && side.selected && !side.reducedMotion ? <EmoteDetail id={side.selected.id} size={size} /> : null;

  return (
    <View pointerEvents="box-none">
      {paletteOpen && (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(160)} exiting={reduced ? undefined : FadeOut.duration(120)}
          style={[styles.palette, { backgroundColor: sheetBg, borderColor: c.border }]}>
          <View style={styles.paletteHead}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[styles.paletteTitle, { color: ink }]}>{t('lumiChat.sendTitle', { defaultValue: 'Send a Lumi reaction' })}</Text>
              <Text style={[styles.paletteNote, { color: c.mutedForeground }]}>
                {t('lumiChat.sharedNote', { defaultValue: 'Both of you will see this. It sends a chat reaction.' })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPaletteOpen(false)} style={styles.closeBtn}
              accessibilityRole="button" accessibilityLabel={t('lumiChat.close', { defaultValue: 'Close Lumi reactions' })}>
              <Icon name="x" size={18} color={c.mutedForeground} />
            </TouchableOpacity>
          </View>
          {(sending || busy || failed) && (
            <View style={styles.status} accessibilityLiveRegion="polite">
              {(sending || busy) ? (
                <>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={[styles.statusText, { color: c.mutedForeground }]}>{t('lumiChat.sending', { defaultValue: 'Sending reaction…' })}</Text>
                </>
              ) : (
                <Text style={[styles.statusText, { color: c.destructive ?? '#D9466A' }]}>{t('lumiChat.sendFailed', { defaultValue: "Couldn't send. Try again." })}</Text>
              )}
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.emoteRow}>
            {CHAT_EMOTES.map(e => (
              <TouchableOpacity key={e.id} onPress={() => { void onEmote(e.id); }} activeOpacity={0.7}
                disabled={blocked}
                accessibilityState={{ disabled: blocked, busy: sending || busy }}
                accessibilityRole="button"
                accessibilityLabel={t('lumiChat.sendEmote', { defaultValue: 'Send {{label}} to {{name}}', label: label(e), name: partner })}
                accessibilityHint={desc(e)}
                style={[styles.emoteBtn, {
                  opacity: blocked ? 0.5 : 1,
                   backgroundColor: isDark ? 'rgba(155,120,255,0.14)' : 'rgba(95,59,186,0.09)',
                   borderColor: `${accent}55`,
                }]}>
                <Text style={styles.emoteEmoji}>{e.emoji}</Text>
                <Text numberOfLines={1} style={[styles.emoteLabel, { color: c.mutedForeground }]}>{label(e)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      <View style={[styles.stage, { height: stageH }]} pointerEvents="box-none"
        onLayout={e => setStageW(e.nativeEvent.layout.width)}>
        <View pointerEvents="none" style={[styles.floor, { bottom: labelH + 2, backgroundColor: isDark ? 'rgba(155,120,255,0.10)' : 'rgba(107,78,232,0.08)' }]} />

        {stageW > 0 && (
          <>
            <Text pointerEvents="none" numberOfLines={1} style={[styles.nameTag, { left: 8, maxWidth: Math.max(48, stageW / 3), color: c.mutedForeground, opacity: kbOpen ? 0 : 1 }]}>{partner}</Text>
            <Text pointerEvents="none" numberOfLines={1} style={[styles.nameTag, { right: 8, textAlign: 'right', color: accent, opacity: kbOpen ? 0 : 1 }]}>{t('lumiChat.you', { defaultValue: 'You' })}</Text>
          </>
        )}

        {stageW > 0 && (
          <View style={[styles.row, { bottom: labelH }]} pointerEvents="box-none">
            <Mascot side={other} size={size}>
              <View accessible accessibilityRole="image"
                accessibilityLabel={t('lumiChat.partnerLumi', { defaultValue: "{{name}}'s Lumi (partner)", name: partner })}
                style={{ width: size, height: size }} pointerEvents="none">
                <LumiRigView v={other.values} size={size} />
                {renderDetail(other)}
              </View>
            </Mascot>
            <Mascot side={own} size={size}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => {
                Haptics.selectionAsync().catch(() => null);
                if (!paletteOpen) {
                  setFailed(false);
                  onOpenPalette?.();
                }
                setPaletteOpen(o => !o);
              }}
                disabled={!enabled}
                hitSlop={size < 44 ? { top: 6, bottom: 6, left: 6, right: 6 } : undefined}
                accessibilityState={{ disabled: !enabled, expanded: paletteOpen }}
                accessibilityRole="button"
                accessibilityLabel={t('lumiChat.openShared', { defaultValue: 'Your Lumi' })}
                accessibilityHint={t('lumiChat.openSharedHint', { defaultValue: 'Opens reactions that are sent to {{name}}', name: partner })}
                style={{ width: Math.max(size, 44), height: Math.max(size, 44) }}>
                <LumiRigView v={own.values} size={size} />
                {renderDetail(own)}
                {own.phase === 'idle' && !paletteOpen && (
                  <View style={[styles.hint, { backgroundColor: accent, borderColor: sheetBg }]}>
                    <Icon name="star" size={9} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </Mascot>
          </View>
        )}

        {cardEmote && (
          <Animated.View key={`${shownFromOwn ? 'o' : 'p'}-${cardEmote.id}`}
            entering={reduced ? undefined : ZoomIn.springify().damping(12)} exiting={reduced ? undefined : ZoomOut.duration(160)}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${shownFromOwn ? t('lumiChat.you', { defaultValue: 'You' }) : partner}: ${label(cardEmote)}`}
            style={[styles.card, {
              top: -34,
              paddingVertical: 3,
              backgroundColor: isDark ? 'rgba(255,244,230,0.96)' : '#FFF6EC', borderColor: c.gold,
            }]}>
            <Text style={styles.cardEmoji}>{cardEmote.emoji}</Text>
            <Text style={styles.cardLabel} numberOfLines={1}>{label(cardEmote)}</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', position: 'relative', overflow: 'visible' },
  floor: { position: 'absolute', left: '10%', right: '10%', bottom: 2, height: 10, borderRadius: 10 },
  character: { position: 'absolute', left: 0, bottom: 0 },
  row: { position: 'absolute', left: 0, right: 0, top: 0 },
  nameTag: { position: 'absolute', bottom: 0, fontSize: 10, lineHeight: 13, fontFamily: 'Satoshi-Bold', letterSpacing: 0.3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, marginBottom: 6 },
  statusText: { fontSize: 11, fontFamily: 'Satoshi-Medium' },
  hint: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute', alignSelf: 'center', alignItems: 'center', flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, minWidth: 56, zIndex: 2,
    shadowColor: '#3B2A8C', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  cardEmoji: { fontSize: 30, lineHeight: 36 },
  cardLabel: { fontSize: 11, fontFamily: 'Satoshi-Bold', color: '#5B3FC4', letterSpacing: 0.3 },
  palette: { marginHorizontal: 12, marginBottom: 6, borderRadius: 18, borderWidth: 1, paddingTop: 10, paddingBottom: 8 },
  paletteHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 6 },
  paletteTitle: { fontSize: 13, fontFamily: 'Satoshi-Bold' },
  paletteNote: { fontSize: 11, fontFamily: 'Satoshi-Regular', marginTop: 1 },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emoteRow: { paddingHorizontal: 10, gap: 6 },
  emoteBtn: { minWidth: 56, minHeight: 56, paddingHorizontal: 6, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emoteEmoji: { fontSize: 22, lineHeight: 26 },
  emoteLabel: { fontSize: 9, fontFamily: 'Satoshi-Bold', marginTop: 2, maxWidth: 64 },
});

export default ChatLumiCompanion;
