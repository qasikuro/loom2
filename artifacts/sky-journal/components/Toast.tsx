import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastLevel = 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  level: ToastLevel;
  retry?: () => void;
}

// ── Module-level emitter — callable from outside React (e.g. AppContext) ──────
let _emitter: ((message: string, level: ToastLevel, retry?: () => void) => void) | null = null;

export function showToastGlobal(message: string, level: ToastLevel = 'error', retry?: () => void): void {
  _emitter?.(message, level, retry);
}

// ── Per-toast colours ─────────────────────────────────────────────────────────
const LEVEL_STYLE: Record<ToastLevel, { border: string; icon: string; label: string }> = {
  error:   { border: 'rgba(224, 68, 85, 0.55)',  icon: '✕', label: '#E04455' },
  warning: { border: 'rgba(200, 168, 75, 0.55)', icon: '!', label: '#C8A84B' },
  info:    { border: 'rgba(107, 91, 149, 0.55)', icon: '✦', label: '#9B78E8' },
};

// ── Single toast banner ───────────────────────────────────────────────────────
function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const cfg         = LEVEL_STYLE[toast.level];
  const slideY      = useRef(new Animated.Value(24)).current;
  const opacity     = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.parallel([
      Animated.timing(slideY,  { toValue: 16, duration: 200, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(opacity, { toValue: 0,  duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [onDismiss, slideY, opacity]);

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    // Auto-dismiss after 4 s (longer if there's a retry button)
    const ms = toast.retry ? 6000 : 4000;
    const t  = setTimeout(dismiss, ms);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={[
        s.banner,
        { borderColor: cfg.border, transform: [{ translateY: slideY }], opacity },
      ]}
    >
      {/* Colour accent dot */}
      <View style={[s.dot, { backgroundColor: cfg.label }]} />

      {/* Message */}
      <Text style={s.msg} numberOfLines={2}>{toast.message}</Text>

      {/* Retry button */}
      {toast.retry && (
        <TouchableOpacity
          style={[s.retryBtn, { borderColor: cfg.border }]}
          onPress={() => { toast.retry!(); dismiss(); }}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.72}
        >
          <Text style={[s.retryText, { color: cfg.label }]}>Retry</Text>
        </TouchableOpacity>
      )}

      {/* Dismiss × */}
      <Pressable
        onPress={dismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={s.closeBtn}
      >
        <Text style={s.closeText}>{cfg.icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Provider — mount once at the root ────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    _emitter = (message, level, retry) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts(prev => {
        // Cap at 3 visible toasts — drop the oldest if needed
        const trimmed = prev.length >= 3 ? prev.slice(1) : prev;
        return [...trimmed, { id, message, level, retry }];
      });
    };
    return () => { _emitter = null; };
  }, []);

  // Bottom offset: sit just above the tab bar
  const bottomOffset = Platform.OS === 'web'
    ? 96
    : Math.max(insets.bottom, 8) + 88;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toasts.length > 0 && (
        <View
          style={[s.stack, { bottom: bottomOffset }]}
          pointerEvents="box-none"
        >
          {toasts.map(t => (
            <ToastBanner key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Hook (for components that need to show toasts directly) ──────────────────
export function useToast() {
  return { showToast: showToastGlobal };
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  stack: {
    position:  'absolute',
    left:      16,
    right:     16,
    gap:       8,
    zIndex:    9999,
    elevation: 99,
  },
  banner: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    paddingHorizontal: 14,
    paddingVertical:  11,
    borderRadius:     14,
    borderWidth:      1,
    backgroundColor:  'rgba(14, 10, 32, 0.96)',
    // Soft shadow
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    flexShrink:   0,
  },
  msg: {
    flex:        1,
    fontSize:    13,
    fontFamily:  'Satoshi-Medium',
    color:       'rgba(220, 210, 240, 0.92)',
    lineHeight:  18,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:       8,
    borderWidth:        1,
    flexShrink:         0,
  },
  retryText: {
    fontSize:   12,
    fontFamily: 'Satoshi-Bold',
  },
  closeBtn: {
    flexShrink: 0,
    width:      20,
    height:     20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize:   11,
    fontFamily: 'Satoshi-Bold',
    color:      'rgba(200, 184, 232, 0.45)',
  },
});
