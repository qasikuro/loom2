/**
 * FloatingMenu — edge-docked expandable action button.
 *
 * Renders a circular FAB pinned to the right edge of its parent.
 * On tap, pill items fan out upward with a spring animation.
 * Each item navigates to its own dedicated page.
 *
 * Usage:
 *   <View style={{ position:'absolute', right:0, bottom:220, zIndex:100 }}
 *         pointerEvents="box-none">
 *     <FloatingMenu items={[...]} />
 *   </View>
 */

import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';
import React, { useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface FloatingMenuItem {
  id: string;
  label: string;
  icon:  string;
  onPress: () => void;
}

interface Props {
  items: FloatingMenuItem[];
}

const FAB_SIZE = 46;

export function FloatingMenu({ items }: Props) {
  const [open, setOpen] = useState(false);
  const colors = useColors();

  // Per-item animation values (index 0 = bottom-most / closest to FAB)
  const anims       = useRef(items.map(() => new Animated.Value(0))).current;
  const chevronAnim = useRef(new Animated.Value(0)).current;

  function openMenu() {
    setOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(chevronAnim, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
      ...anims.map((anim, i) =>
        Animated.spring(anim, {
          toValue:  1,
          delay:    i * 55,
          tension:  80,
          friction: 12,
          useNativeDriver: true,
        }),
      ),
    ]).start();
  }

  function closeMenu(then?: () => void) {
    setOpen(false);
    Animated.parallel([
      Animated.timing(chevronAnim, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ...anims.map(anim =>
        Animated.timing(anim, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ),
    ]).start(() => then?.());
  }

  function handleItemPress(item: FloatingMenuItem) {
    // Collapse first, then navigate so the animation isn't cut short
    closeMenu(() => item.onPress());
  }

  const chevronRotate = chevronAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={s.container} pointerEvents="box-none">
      {/* Items — rendered in reverse order so index-0 sits closest to the FAB */}
      {[...items].reverse().map((item, revIdx) => {
        const origIdx = items.length - 1 - revIdx;
        const anim    = anims[origIdx];
        return (
          <Animated.View
            key={item.id}
            style={[
              s.pillWrap,
              {
                opacity:   anim,
                transform: [
                  {
                    translateX: anim.interpolate({
                      inputRange:  [0, 1],
                      outputRange: [52, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents={open ? 'auto' : 'none'}
          >
            <TouchableOpacity
              testID={`floating-menu-item-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.78}
            >
              <Text style={[s.pillLabel, { color: colors.foreground }]}>{item.label}</Text>
              <Icon name={item.icon as never} size={16} color={colors.primary} />
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* FAB trigger */}
      <TouchableOpacity
        testID="floating-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close shortcuts' : 'Open shortcuts'}
        style={[s.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => (open ? closeMenu() : openMenu())}
        activeOpacity={0.82}
      >
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Icon name="chevron-right" size={20} color={colors.primaryForeground} />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: 10,
  },

  // ── FAB button ───────────────────────────────────────────────────────────────
  fab: {
    width:           FAB_SIZE,
    height:          FAB_SIZE,
    borderRadius:    FAB_SIZE / 2,
    backgroundColor: '#7B68EE',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     12,
    // Glow
    shadowColor:    '#7B68EE',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.42,
    shadowRadius:   10,
    elevation:      8,
  },

  // ── Item pills ───────────────────────────────────────────────────────────────
  pillWrap: {
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             10,
    paddingHorizontal: 18,
    paddingVertical:   10,
    borderRadius:    26,
    backgroundColor: 'rgba(14, 10, 36, 0.96)',
    borderWidth:     1,
    borderColor:     'rgba(155, 120, 255, 0.26)',
    marginRight:     12,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.36,
    shadowRadius:    8,
    elevation:       6,
  },
  pillLabel: {
    fontSize:     14,
    fontFamily:   'Satoshi-Medium',
    color:        'rgba(242, 232, 255, 0.93)',
    letterSpacing: -0.1,
  },
  pillIcon: {
    fontSize:   16,
    lineHeight: 20,
  },
});
