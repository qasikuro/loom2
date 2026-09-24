import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GuideSession {
  id: string; guideId: string; roomId: string; title: string; description: string; topic: string | null;
  startsAt: string; endsAt: string; capacity: number; attendeeCount: number; isJoined: boolean;
}

export default function GuideSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<GuideSession | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch<GuideSession>(`/guide-sessions/${sessionId}`).then(setSession)
      .catch(() => Alert.alert('Session unavailable', 'This session may have ended or been cancelled.'))
      .finally(() => setLoading(false));
  }, [sessionId]);
  useEffect(load, [load]);

  async function join() {
    if (!session) return;
    try {
      const updated = await apiFetch<GuideSession>(`/guide-sessions/${session.id}/join`, { method: 'POST' });
      setSession(updated);
      Alert.alert('You joined', 'We will notify you when the session starts.');
    } catch (error) {
      Alert.alert('Could not join', error instanceof Error ? error.message : 'Please try again.');
    }
  }
  const top = Platform.OS === 'web' ? 67 : insets.top;
  if (loading || !session) return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}><BackButton /><SkyLoadingOverlay message="Loading session…" /></View>;
  const start = new Date(session.startsAt);
  const started = Date.now() >= start.getTime();
  return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
    <View style={s.header}><BackButton /><Text style={[s.heading, { color: colors.foreground }]}>Guide session</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
      {session.topic && <Text style={[s.topic, { color: colors.primary }]}>{session.topic}</Text>}
      <Text style={[s.title, { color: colors.foreground }]}>{session.title}</Text>
      <View style={[s.timeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="clock" size={18} color={colors.primary} />
        <View><Text style={[s.time, { color: colors.foreground }]}>{start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]}>{session.attendeeCount} of {session.capacity} joined</Text></View>
      </View>
      <Text style={[s.section, { color: colors.foreground }]}>What this session is about</Text>
      <Text style={[s.body, { color: colors.mutedForeground }]}>{session.description}</Text>
      <TouchableOpacity style={[s.primary, { backgroundColor: colors.primary }]} onPress={session.isJoined && started ? () => router.push(`/campfire/${session.roomId}`) : join}>
        <Icon name={session.isJoined && started ? 'message-circle' : 'user-plus'} size={17} color="#fff" />
        <Text style={s.primaryText}>{session.isJoined ? (started ? 'Enter shared chat' : 'Joined — remind me') : 'Join session'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.secondary, { borderColor: colors.border }]} onPress={() => router.push(`/messages/${session.guideId}`)}>
        <Icon name="message-circle" size={17} color={colors.primary} /><Text style={[s.secondaryText, { color: colors.primary }]}>Message guide</Text>
      </TouchableOpacity>
      {session.isJoined && !started && <Text style={[s.note, { color: colors.mutedForeground }]}>You’ll receive a notification when it is time to enter the shared chat.</Text>}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 18 },
  heading: { fontFamily: 'Satoshi-Bold', fontSize: 18 }, topic: { fontFamily: 'Satoshi-Bold', fontSize: 13, marginBottom: 8 },
  title: { fontFamily: 'Satoshi-Black', fontSize: 30, lineHeight: 36, marginBottom: 20 },
  timeCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  time: { fontFamily: 'Satoshi-Bold', fontSize: 15 }, meta: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 3 },
  section: { fontFamily: 'Satoshi-Bold', fontSize: 16, marginTop: 24, marginBottom: 8 },
  body: { fontFamily: 'Satoshi-Regular', fontSize: 15, lineHeight: 23 },
  primary: { marginTop: 28, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 15 },
  secondary: { marginTop: 10, padding: 15, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  secondaryText: { fontFamily: 'Satoshi-Bold', fontSize: 15 }, note: { fontFamily: 'Satoshi-Regular', fontSize: 12, textAlign: 'center', marginTop: 12 },
});