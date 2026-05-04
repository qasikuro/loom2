import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
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

const PURPLE      = '#6B5B95';
const TAB_BAR_BG  = '#FDFAF7';
const INACTIVE    = '#A09AB5';
const BAR_HEIGHT  = 60;
const BTN_SIZE    = 52;

// ─── Regular tab icon ────────────────────────────────────────────────────────
function TabIcon({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather name={name} size={22} color={color} />
    </View>
  );
}

// ─── Floating centre button ───────────────────────────────────────────────────
function CreateIcon() {
  return (
    <View style={styles.createBtn}>
      <Feather name="plus" size={26} color="#fff" />
    </View>
  );
}

// ─── Main tab layout ──────────────────────────────────────────────────────────
function ClassicTabLayout() {
  const scheme  = useColorScheme();
  const insets  = useSafeAreaInsets();
  const isDark  = scheme === 'dark';
  const isIOS   = Platform.OS === 'ios';
  const isWeb   = Platform.OS === 'web';

  // Bottom safe-area gap (home bar on iPhone X+)
  const bottomGap = isWeb ? 0 : Math.max(insets.bottom, 8);
  // Pill sits 8 px above the home bar
  const pillBottom = isWeb ? 0 : bottomGap + 8;
  // Total bar height includes the pill itself
  const barHeight = isWeb ? 64 : BAR_HEIGHT;
  // Horizontal margin gives the pill its floating look
  const pillH = isWeb ? 0 : 16;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   PURPLE,
        tabBarInactiveTintColor: INACTIVE,

        tabBarStyle: {
          position:         'absolute',
          left:             pillH,
          right:            pillH,
          bottom:           pillBottom,
          height:           barHeight,
          borderRadius:     isWeb ? 0 : 28,
          backgroundColor:  isIOS ? 'transparent' : TAB_BAR_BG,
          borderTopWidth:   0,
          // NO overflow:hidden — lets the centre button float above the bar
          elevation:        20,
          shadowColor:      '#1E1830',
          shadowOffset:     { width: 0, height: 6 },
          shadowOpacity:    0.14,
          shadowRadius:     20,
        },

        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={88}
              tint={isDark ? 'dark' : 'extraLight'}
              style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}
            />
          ) : null,

        tabBarLabelStyle: {
          fontSize:      10,
          fontFamily:    'Inter_600SemiBold',
          letterSpacing: 0.2,
          marginBottom:  Platform.OS === 'ios' ? 6 : 4,
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
          // Give the centre item enough tap area without extra padding
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

// ─── Guard ────────────────────────────────────────────────────────────────────
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
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
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
    // Float it above the bar
    marginBottom: 18,
    // Shadow
    shadowColor: PURPLE,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
});
