import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Redirect, Tabs } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@clerk/expo';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="log">
        <Icon sf={{ default: 'book', selected: 'book.fill' }} />
        <Label>Journal</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create">
        <Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} />
        <Label>Create</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
        <Label>Discover</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>Character</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors   = useColors();
  const scheme   = useColorScheme();
  const insets   = useSafeAreaInsets();
  const isDark   = scheme === 'dark';
  const isIOS    = Platform.OS === 'ios';
  const isWeb    = Platform.OS === 'web';

  const pillBottom = isWeb ? 0 : Math.max(insets.bottom + 4, 12);
  const barHeight  = isWeb ? 84 : 66;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   colors.primary,
        tabBarInactiveTintColor: `${colors.mutedForeground}99`,
        headerShown: false,

        tabBarStyle: {
          position:        'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.tabBar,
          borderTopWidth:  0,
          borderRadius:    isWeb ? 0 : 30,
          marginHorizontal: isWeb ? 0 : 14,
          marginBottom:    pillBottom,
          height:          barHeight,
          paddingBottom:   isWeb ? 34 : 0,
          elevation:       24,
          shadowColor:     '#1E1830',
          shadowOffset:    { width: 0, height: 8 },
          shadowOpacity:   0.18,
          shadowRadius:    24,
          overflow:        'hidden',
        },

        tabBarLabelStyle: {
          fontSize:    10,
          fontFamily:  'Inter_600SemiBold',
          marginBottom: isWeb ? 0 : 7,
          letterSpacing: 0.1,
        },

        tabBarIconStyle: {
          marginTop: isWeb ? 0 : 6,
        },

        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={92}
              tint={isDark ? 'dark' : 'extraLight'}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={22} />
            ) : (
              <TabIcon name={focused ? 'home' : 'home'} color={color} focused={focused} />
            ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="book" tintColor={color} size={22} />
            ) : (
              <TabIcon name="book-open" color={color} focused={focused} />
            ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={styles.createBtn}>
              <Feather name="plus" size={22} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="safari" tintColor={color} size={22} />
            ) : (
              <TabIcon name="compass" color={color} focused={focused} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Character',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={22} />
            ) : (
              <TabIcon name="user" color={color} focused={focused} />
            ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Feather name={name} size={20} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#C8A84B" size="large" />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href={'/(auth)/sign-in' as any} />;

  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#1A1630',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    backgroundColor: '#6B5B95',
    borderRadius: 22,
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#6B5B95',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabIconWrap: {
    width: 38,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(107,91,149,0.12)',
  },
});
