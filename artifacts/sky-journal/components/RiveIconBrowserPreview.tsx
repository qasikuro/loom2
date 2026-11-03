import React, { useState } from 'react';
import { ArrowLeft, Compass, Film, House, Settings, Sparkles, UserRound } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorigamRiveIcon, type StorigamRiveIconName } from '@/components/StorigamRiveIcon';

const ICONS: {
  name: StorigamRiveIconName;
  label: string;
  Fallback: typeof ArrowLeft;
}[] = [
  { name: 'back', label: 'Back', Fallback: ArrowLeft },
  { name: 'settings', label: 'Settings', Fallback: Settings },
  { name: 'home', label: 'Home', Fallback: House },
  { name: 'reels', label: 'Reels', Fallback: Film },
  { name: 'create', label: 'Create', Fallback: Sparkles },
  { name: 'discover', label: 'Discover', Fallback: Compass },
  { name: 'profile', label: 'Profile', Fallback: UserRound },
];

export function RiveIconBrowserPreview() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeIcon, setActiveIcon] = useState<StorigamRiveIconName>('home');
  const [replay, setReplay] = useState(0);
  const columns = width < 500 ? 3 : 4;
  const gap = 12;
  const tileWidth = (Math.min(width - 32, 760) - gap * (columns - 1)) / columns;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>STORIGAM · RIVE</Text>
      <Text style={styles.title}>Animated icons</Text>
      <Text style={styles.subtitle}>Tap an icon to replay its soft halo sweep.</Text>

      <View style={[styles.grid, { gap }]}>
        {ICONS.map(({ name, label, Fallback }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Preview ${label} icon animation`}
            key={name}
            onPress={() => {
              setActiveIcon(name);
              setReplay(value => value + 1);
            }}
            style={({ pressed }) => [
              styles.tile,
              { width: tileWidth, minHeight: tileWidth + 25 },
              activeIcon === name && styles.tileActive,
              pressed && styles.tilePressed,
            ]}
          >
            <StorigamRiveIcon
              key={`${name}-${activeIcon === name ? replay : 0}`}
              name={name}
              size={40}
              active={activeIcon === name}
              fallback={<Fallback size={25} color="#E7DFFF" strokeWidth={1.8} />}
            />
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0818' },
  content: { alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  eyebrow: {
    color: '#B9A8D9',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { color: '#F7F4FF', fontSize: 26, fontWeight: '700', marginTop: 4 },
  subtitle: { color: '#AAA2BC', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  grid: { width: '100%', maxWidth: 760, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(191,166,255,0.16)',
    backgroundColor: 'rgba(31,25,52,0.92)',
  },
  tileActive: {
    borderColor: 'rgba(178,142,255,0.62)',
    backgroundColor: 'rgba(48,35,76,0.96)',
  },
  tilePressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  label: { color: '#E7DFFF', fontSize: 13, fontWeight: '600' },
});
