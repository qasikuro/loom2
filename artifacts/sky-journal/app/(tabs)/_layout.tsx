import { Tabs } from 'expo-router';
import { useAuth } from '@clerk/expo';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';

const PURPLE     = '#6B5B95';
const TAB_BAR_BG = '#FDFAF7';
const INACTIVE   = '#A09AB5';
const BAR_HEIGHT = 60;
const BTN_SIZE   = 52;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: IconName;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Icon name={name} size={20} color={color} />
    </View>
  );
}

function CreateIcon() {
  return (
    <View style={styles.createBtn}>
      <Icon name="plus" size={24} color="#fff" />
    </View>
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
          overflow: 'hidden',
          elevation: 16,
          shadowColor: '#1E1830',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        },

        tabBarLabelStyle: {
          fontSize:      10,
          fontFamily:    'Inter_600SemiBold',
          letterSpacing: 0.2,
          marginBottom:  4,
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
    backgroundColor: '#1A1630',
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
    backgroundColor: 'rgba(107,91,149,0.12)',
  },

  createBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: PURPLE,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
});
