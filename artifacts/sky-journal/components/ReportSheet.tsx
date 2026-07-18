import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const REASONS = [
  { key: 'Inappropriate content',    icon: 'alert-triangle' as const },
  { key: 'Spam or misleading',       icon: 'slash'          as const },
  { key: 'Harassment or hate speech',icon: 'user-x'         as const },
  { key: 'Copyright infringement',   icon: 'shield-off'     as const },
  { key: 'Other',                    icon: 'more-horizontal' as const },
] as const;

type Reason = typeof REASONS[number]['key'];

export interface ReportSheetProps {
  visible:     boolean;
  onClose:     () => void;
  targetType:  'story' | 'outfit' | 'user';
  targetId:    string;
  targetLabel?: string;
}

export function ReportSheet({ visible, onClose, targetType, targetId, targetLabel }: ReportSheetProps) {
  const colors  = useColors();
  const slideY  = useRef(new Animated.Value(400)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  const [selected,  setSelected]  = useState<Reason | null>(null);
  const [details,   setDetails]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setDetails('');
      setSubmitted(false);
      setLoading(false);
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideY, { toValue: 400, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleSubmit() {
    if (!selected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason: selected, details }),
      });
      setSubmitted(true);
    } catch {
      // still show success — don't reveal failures to avoid manipulation
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  const typeLabel =
    targetType === 'story'  ? 'this story' :
    targetType === 'outfit' ? 'this outfit' :
    targetLabel ?? 'this user';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeIn }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
            { transform: [{ translateY: slideY }] },
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={[styles.flagIconWrap, { backgroundColor: 'rgba(224,68,85,0.12)' }]}>
              <Icon name="flag" size={18} color="#E04455" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Report</Text>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                You're reporting {typeLabel}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.muted }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {submitted ? (
            /* ── Success state ─────────────────────────────── */
            <View style={styles.successWrap}>
              <View style={[styles.successIcon, { backgroundColor: 'rgba(107,165,122,0.15)' }]}>
                <Icon name="check-circle" size={32} color="#6BA57A" />
              </View>
              <Text style={[styles.successTitle, { color: colors.foreground }]}>
                Report received
              </Text>
              <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
                Thank you for keeping the sky safe. We'll review this shortly.
              </Text>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
                onPress={onClose}
              >
                <Text style={styles.submitBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Report form ───────────────────────────────── */
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Why are you reporting this?
              </Text>

              <View style={styles.reasons}>
                {REASONS.map(r => {
                  const active = selected === r.key;
                  return (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        styles.reasonRow,
                        { borderColor: active ? colors.primary : colors.border },
                        active && { backgroundColor: `${colors.primary}10` },
                      ]}
                      onPress={() => { setSelected(r.key); Haptics.selectionAsync(); }}
                      activeOpacity={0.8}
                    >
                      <View style={[
                        styles.reasonIcon,
                        { backgroundColor: active ? `${colors.primary}18` : colors.muted },
                      ]}>
                        <Icon name={r.icon} size={14} color={active ? colors.primary : colors.mutedForeground} />
                      </View>
                      <Text style={[
                        styles.reasonText,
                        { color: active ? colors.foreground : colors.mutedForeground },
                        active && { fontFamily: 'Satoshi-Bold' },
                      ]}>
                        {r.key}
                      </Text>
                      {active && (
                        <View style={[styles.reasonCheck, { backgroundColor: colors.primary }]}>
                          <Icon name="check" size={10} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional details */}
              <TextInput
                style={[
                  styles.detailsInput,
                  { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
                value={details}
                onChangeText={setDetails}
                placeholder="Additional details (optional)"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                maxLength={500}
                textAlignVertical="top"
              />

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: selected ? '#E04455' : colors.muted,
                    borderColor: selected ? '#E04455' : colors.border,
                    opacity: loading ? 0.7 : 1,
                  },
                ]}
                onPress={handleSubmit}
                disabled={!selected || loading}
                activeOpacity={0.85}
              >
                <Icon name={loading ? 'loader' : 'flag'} size={15} color={selected ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.submitBtnText, { color: selected ? '#fff' : colors.mutedForeground }]}>
                  {loading ? 'Submitting…' : 'Submit Report'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
                Reports are anonymous and reviewed by our team.
              </Text>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,7,20,0.72)',
  },

  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0,
    paddingHorizontal: 20, paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 18,
  },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  flagIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetTitle: { fontSize: 17, fontFamily: 'Satoshi-Bold', letterSpacing: -0.3 },
  sheetSub:   { fontSize: 12, fontFamily: 'Satoshi-Regular', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionLabel: { fontSize: 12, fontFamily: 'Satoshi-Medium', letterSpacing: 0.4, marginBottom: 10 },

  reasons:    { gap: 8, marginBottom: 16 },
  reasonRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1.5,
  },
  reasonIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  reasonText:  { flex: 1, fontSize: 14, fontFamily: 'Satoshi-Regular' },
  reasonCheck: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  detailsInput: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    minHeight: 80, marginBottom: 16,
  },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 16, borderWidth: 1.5,
    marginBottom: 10,
  },
  submitBtnText: { fontSize: 15, fontFamily: 'Satoshi-Bold' },

  disclaimer: { fontSize: 11, fontFamily: 'Satoshi-Regular', textAlign: 'center', fontStyle: 'italic' },

  // Success
  successWrap: { alignItems: 'center', paddingVertical: 12, gap: 10 },
  successIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  successTitle: { fontSize: 19, fontFamily: 'Satoshi-Bold', letterSpacing: -0.4 },
  successBody:  {
    fontSize: 14, fontFamily: 'Satoshi-Regular',
    textAlign: 'center', lineHeight: 21, fontStyle: 'italic',
    paddingHorizontal: 16,
  },
});
