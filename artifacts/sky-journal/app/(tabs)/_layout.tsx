import { Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';

const PURPLE     = '#7856FF';
const TAB_BAR_BG = '#0E0B1E';
const INACTIVE   = 'rgba(200,184,232,0.42)';
const BAR_HEIGHT = 64;
const BTN_SIZE   = 54;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: string;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.1 : 0.92)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.1 : 0.92,
      useNativeDriver: true,
      tension: 70,
      friction: 6,
    }).start();
  }, [focused]);

  return (
    <Animated.View
      style={[
        styles.iconWrap,
        focused && styles.iconWrapActive,
        { transform: [{ scale }] },
      ]}
    >
      <Icon name={name} size={20} color={color} />
    </Animated.View>
  );
}

function CreateIcon() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 1800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(scale, {
          toValue: 0.96,
          duration: 1800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    );
    breathe.start();
    return () => { breathe.stop(); };
  }, []);

  return (
    <Animated.View style={[styles.createBtn, { transform: [{ scale }] }]}>
      <Icon name="plus" size={24} color="#fff" />
    </Animated.View>
  );
}

function ClassicTabLayout() {
  const insets = useSafeAreaInsets();
  const isWeb  = Platform.OS === 'web';

  const barMarginBottom = isWeb ? 0 : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   PURPLE,
        tabBarInactiveTintColor: INACTIVE,

        tabBarStyle: {
          marginHorizontal: isWeb ? 0 : 12,
          marginBottom: barMarginBottom,
          height: isWeb ? 64 : BAR_HEIGHT,
          borderRadius: isWeb ? 0 : 28,
          backgroundColor: TAB_BAR_BG,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(200,184,232,0.1)',
          overflow: 'hidden',
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.55,
          shadowRadius: 20,
        },

        tabBarLabelStyle: {
          fontSize:      10,
          fontFamily:    'Inter_600SemiBold',
          letterSpacing: 0.3,
          marginBottom:  5,
          marginTop:     1,
        },

        tabBarIconStyle: {
          marginTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="book-open" color={color} focused={focused} />
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
          title: 'Discover',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="compass" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="user" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded || !isSignedIn) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#C8A84B" size="large" />
      </View>
    );
  }

  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#080714',
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(120,86,255,0.22)',
  },

  createBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: PURPLE,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 14,
  },
});
