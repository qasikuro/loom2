/**
 * ImageSourceSheet — animated bottom sheet for picking image source.
 *
 * Camera | Photo Library | Remove (optional) | Cancel
 * Slides up from the bottom with a dimmed backdrop.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';

export interface ImageSourceSheetProps {
  visible:   boolean;
  hasPhoto?: boolean;
  title?:    string;
  onCamera:  () => void;
  onLibrary: () => void;
  onRemove?: () => void;
  onCancel:  () => void;
}

export function ImageSourceSheet({
  visible,
  hasPhoto = false,
  title = 'Add Photo',
  onCamera,
  onLibrary,
  onRemove,
  onCancel,
}: ImageSourceSheetProps) {
  const insets     = useSafeAreaInsets();
  const [shown, setShown]   = useState(visible);
  const slideY     = useRef(new Animated.Value(420)).current;
  const bgOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShown(true);
      Animated.parallel([
        Animated.spring(slideY, {
          toValue:       0,
          useNativeDriver: true,
          tension:       72,
          friction:      11,
        }),
        Animated.timing(bgOpacity, {
          toValue:       1,
          duration:      200,
          easing:        Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue:       420,
          duration:      250,
          easing:        Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bgOpacity, {
          toValue:       0,
          duration:      200,
          easing:        Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setShown(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const bottomPad = Platform.OS === 'web' ? 28 : insets.bottom + 10;

  if (!shown) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Dim backdrop */}
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View style={[styles.backdrop, { opacity: bgOpacity }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: bottomPad, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Pull handle */}
        <View style={styles.handle} />

        <Text style={styles.sheetTitle}>{title}</Text>

        {/* ── Camera ── */}
        <Option
          iconName="camera"
          iconBg="rgba(107,91,149,0.18)"
          iconColor="#C8B8E8"
          label="Take Photo"
          sub="Open camera"
          onPress={onCamera}
        />

        {/* ── Library ── */}
        <Option
          iconName="image"
          iconBg="rgba(184,212,240,0.14)"
          iconColor="#B8D4F0"
          label="Photo Library"
          sub="Choose from gallery"
          onPress={onLibrary}
        />

        {/* ── Remove (conditional) ── */}
        {hasPhoto && onRemove && (
          <Option
            iconName="trash-2"
            iconBg="rgba(224,85,104,0.13)"
            iconColor="#E05568"
            label="Remove Photo"
            labelColor="#E05568"
            sub="Clear the current image"
            onPress={onRemove}
          />
        )}

        <View style={styles.divider} />

        {/* ── Cancel ── */}
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onCancel}
          activeOpacity={0.72}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ── Option row ─────────────────────────────────────────────────────────────────

interface OptionProps {
  iconName:   string;
  iconBg:     string;
  iconColor:  string;
  label:      string;
  labelColor?: string;
  sub:        string;
  onPress:    () => void;
}

function Option({ iconName, iconBg, iconColor, label, labelColor, sub, onPress }: OptionProps) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.72}>
      <View style={[styles.optionIconBg, { backgroundColor: iconBg }]}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Icon name={iconName as any} size={21} color={iconColor} />
      </View>
      <View style={styles.optionBody}>
        <Text style={[styles.optionLabel, labelColor ? { color: labelColor } : undefined]}>
          {label}
        </Text>
        <Text style={styles.optionSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={15} color="rgba(200,184,232,0.28)" />
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,4,14,0.72)',
  },
  sheet: {
    position:              'absolute',
    bottom:                0,
    left:                  0,
    right:                 0,
    backgroundColor:       '#1C1836',
    borderTopLeftRadius:   26,
    borderTopRightRadius:  26,
    borderTopWidth:        1,
    borderColor:           'rgba(200,184,232,0.12)',
    paddingTop:            10,
    paddingHorizontal:     14,
    gap:                   2,
  },
  handle: {
    alignSelf:       'center',
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: 'rgba(200,184,232,0.22)',
    marginBottom:    8,
  },
  sheetTitle: {
    fontSize:       12,
    fontFamily:     'Satoshi-Bold',
    color:          'rgba(200,184,232,0.45)',
    textAlign:      'center',
    letterSpacing:  0.7,
    textTransform:  'uppercase',
    marginBottom:   8,
  },
  option: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    paddingHorizontal: 6,
    paddingVertical:   13,
  },
  optionIconBg: {
    width:           48,
    height:          48,
    borderRadius:    15,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  optionBody: { flex: 1, gap: 3 },
  optionLabel: {
    fontSize:   16,
    fontFamily: 'Satoshi-Bold',
    color:      '#EBE8FF',
  },
  optionSub: {
    fontSize:   12,
    fontFamily: 'Satoshi-Regular',
    color:      'rgba(200,184,232,0.48)',
  },
  divider: {
    height:          1,
    backgroundColor: 'rgba(200,184,232,0.09)',
    marginTop:       8,
    marginBottom:    6,
  },
  cancelBtn: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 15,
    borderRadius:    16,
    backgroundColor: 'rgba(200,184,232,0.07)',
  },
  cancelText: {
    fontSize:   16,
    fontFamily: 'Satoshi-Bold',
    color:      'rgba(200,184,232,0.55)',
  },
});
