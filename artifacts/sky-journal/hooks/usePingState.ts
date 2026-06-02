import { apiFetch } from '@/context/AppContext';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PING_KEY      = 'ping_cooldown_v1';
const PING_COOLDOWN = 60 * 60 * 1000;

export function usePingState(country?: string) {
  const [weatherQuery,    setWeatherQuery]    = useState<string | null>(null);
  const [pingState,       setPingState]       = useState<'idle'|'sending'|'sent'|'cooldown'>('idle');
  const [pingCooldownEnd, setPingCooldownEnd] = useState<number | null>(null);
  const [cooldownText,    setCooldownText]    = useState('');
  const bellAnim = useRef(new Animated.Value(0)).current;

  function shakeBell() {
    Animated.sequence([
      Animated.timing(bellAnim, { toValue:  1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue: -1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue:  1, duration: 70, useNativeDriver: true }),
      Animated.timing(bellAnim, { toValue:  0, duration: 70, useNativeDriver: true }),
    ]).start();
  }

  async function handlePing() {
    shakeBell(); setPingState('sending');
    try {
      await apiFetch<{ sent: number }>('/notify/ping-friends', { method: 'POST' });
      const now = Date.now();
      await AsyncStorage.setItem(PING_KEY, String(now));
      setPingCooldownEnd(now + PING_COOLDOWN); setPingState('sent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setPingState('cooldown'), 3000);
    } catch { setPingState('idle'); }
  }

  useEffect(() => {
    AsyncStorage.getItem(PING_KEY).then(stored => {
      if (!stored) return;
      const end = parseInt(stored, 10) + PING_COOLDOWN;
      if (Date.now() < end) { setPingCooldownEnd(end); setPingState('cooldown'); }
    });
  }, []);

  useEffect(() => {
    if (!pingCooldownEnd) return;
    const tick = () => {
      const ms = pingCooldownEnd - Date.now();
      if (ms <= 0) { setPingState('idle'); setPingCooldownEnd(null); setCooldownText(''); return; }
      const m = Math.ceil(ms / 60000); const h = Math.floor(m / 60);
      setCooldownText(h > 0 ? `${h}h ${m % 60}m` : `${m}m`);
    };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, [pingCooldownEnd]);

  useEffect(() => {
    if (Platform.OS === 'web') { if (country) setWeatherQuery(country); return; }
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { if (country) setWeatherQuery(country); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setWeatherQuery(`${loc.coords.latitude.toFixed(2)},${loc.coords.longitude.toFixed(2)}`);
      } catch { if (country) setWeatherQuery(country); }
    })();
  }, []);

  return { weatherQuery, pingState, cooldownText, bellAnim, handlePing };
}
