import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
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

function TabIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      <Feather name={name} size={20} color={color} />
    </View>
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
          position:         'absolute',
          backgroundColor:  isIOS ? 'transparent' : colors.tabBar,
          borderTopWidth:   0,
          borderRadius:     isWeb ? 0 : 30,
          marginHorizontal: isWeb ? 0 : 14,
          marginBottom:     pillBottom,
          height:           barHeight,
          paddingBottom:    isWeb ? 34 : 0,
          elevation:        24,
          shadowColor:      '#1E1830',
          shadowOffset:     { width: 0, height: 8 },
          shadowOpacity:    0.18,
          shadowRadius:     24,
          overflow:         'hidden',
        },

        tabBarLabelStyle: {
          fontSize:     10,
          fontFamily:   'Inter_600SemiBold',
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
          tabBarIcon: () => (
            <View style={styles.createBtn}>
              <Feather name="plus" size={24} color="#fff" />
            </View>
          ),
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
          title: 'Character',
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

  if (!isLoaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#C8A84B" size="large" />
      </View>
    );
  }

  if (!isSignedIn) return <Redirect href={'/(auth)/sign-in' as any} />;

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
    borderRadius: 24,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#6B5B95',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  tabIconWrap: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(107,91,149,0.13)',
  },
});
