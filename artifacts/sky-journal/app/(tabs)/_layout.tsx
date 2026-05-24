import { Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { SkyIcon, type SkyIconName } from '@/components/SkyIcon';

const BAR_HEIGHT = 66;
const BTN_SIZE   = 56;

function TabIcon({
  name,
  color,
  focused,
  primaryColor,
}: {
  name:         SkyIconName;
  color:        string;
  focused:      boolean;
  primaryColor: string;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.12 : 0.90)).current;
  const glow  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.12 : 0.90,
      useNativeDriver: true,
      tension: 80,
      friction: 7,
    }).start();
    Animated.timing(glow, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
      easing: Easing.out(Easing.quad),
    }).start();
  }, [focused]);

  const bgOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        focused && styles.iconWrapFocused,
        { transform: [{ scale }] },
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.iconGlowBg, { opacity: bgOpacity, backgroundColor: `${primaryColor}2A` }]}
        pointerEvents="none"
      />
      <SkyIcon
        name={name}
        size={22}
        color={color}
        accentColor={focused ? primaryColor : color}
        strokeWidth={focused ? 1.9 : 1.5}
      />
    </Animated.View>
  );
}

function CreateIcon() {
  const colors = useColors();
  const scale  = useRef(new Animated.Value(1)).current;
  const aura   = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.10,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(scale, {
          toValue: 0.94,
          duration: 2000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(aura, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(aura, {
          toValue: 0.4,
          duration: 1600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    breathe.start();
    pulse.start();
    return () => { breathe.stop(); pulse.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.createOuter, { transform: [{ scale }] }]}>
      {/* Outer aura ring */}
      <Animated.View
        style={[
          styles.createAura,
          { borderColor: colors.primary, opacity: aura },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.createBtn,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          },
        ]}
      >
        <SkyIcon name="sky-star" size={26} color="#fff" accentColor="#F8D060" strokeWidth={1.6} />
      </View>
    </Animated.View>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb  = Platform.OS === 'web';
  const { t }  = useTranslation();

  const barMarginBottom = isWeb ? 0 : Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   '#D0B4FF',
        tabBarInactiveTintColor: 'rgba(200,184,232,0.45)',

        tabBarStyle: {
          marginHorizontal: isWeb ? 0 : 16,
          marginBottom: barMarginBottom,
          height: isWeb ? 64 : BAR_HEIGHT,
          borderRadius: isWeb ? 0 : 32,
          backgroundColor: colors.tabBar,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(180,140,255,0.12)',
          elevation: 20,
          shadowColor: '#7840D0',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.55,
          shadowRadius: 22,
        },

        tabBarLabelStyle: {
          fontSize:      10,
          fontFamily:    'Satoshi-Medium',
          letterSpacing: 0.2,
          marginBottom:  Platform.OS === 'android' ? 4 : 5,
          marginTop:     Platform.OS === 'android' ? -2 : 0,
        },

        tabBarActiveLabelStyle: {
          fontFamily: 'Satoshi-Bold',
          color: '#D0B4FF',
        },

        tabBarIconStyle: {
          marginTop: Platform.OS === 'android' ? 2 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sky-home" color={color} focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: t('nav.journal'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sky-journal" color={color} focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => <CreateIcon />,
          tabBarItemStyle: { flex: 1 },
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: t('nav.discover'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sky-lantern" color={color} focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sky-profile" color={color} focused={focused} primaryColor={colors.primary} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();

  if (!isLoaded || !isSignedIn) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },

  iconWrapFocused: {
    borderWidth: 1,
    borderColor: 'rgba(190,150,255,0.32)',
  },

  iconGlowBg: {
    borderRadius: 14,
  },

  createOuter: {
    width: BTN_SIZE + 16,
    height: BTN_SIZE + 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  createAura: {
    position: 'absolute',
    width: BTN_SIZE + 14,
    height: BTN_SIZE + 14,
    borderRadius: (BTN_SIZE + 14) / 2,
    borderWidth: 2,
  },

  createBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.75,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 18,
  },
});
