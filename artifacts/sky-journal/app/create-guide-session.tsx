import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { apiFetch } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function defaultDate(): string {
  const value = new Date(Date.now() + 24 * 60 * 60_000);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export default function CreateGuideSessionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('19:00');
  const [duration, setDuration] = useState('60');
  const [capacity, setCapacity] = useState('30');
  const [saving, setSaving] = useState(false);
  const startsAt = useMemo(() => new Date(`${date}T${time}:00`), [date, time]);

  async function createSession() {
    if (!title.trim() || description.trim().length < 10 || Number.isNaN(startsAt.getTime())) {
      Alert.alert('Check session details', 'Add a title, a description of at least 10 characters, and a valid date and time.');
      return;
    }
    setSaving(true);
    try {
      const session = await apiFetch<{ id: string }>('/guide-sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          topic: topic.trim() || null,
          startsAt: startsAt.toISOString(),
          durationMinutes: Number(duration),
          capacity: Number(capacity),
        }),
      });
      Alert.alert('Session scheduled', 'People can now discover and join it from your guide profile.', [
        { text: 'View session', onPress: () => router.replace(`/guide-session/${session.id}`) },
      ]);
    } catch (error) {
      Alert.alert('Could not schedule session', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const top = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <View>
          <Text style={[s.title, { color: colors.foreground }]}>Create a guide session</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Everyone joins one shared chat at the start time.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Field label="Session title" value={title} onChangeText={setTitle} placeholder="Finding calm together" colors={colors} />
        <Field label="What the session is about" value={description} onChangeText={setDescription} placeholder="Explain what you will discuss and what people can expect…" colors={colors} multiline />
        <Field label="Topic (optional)" value={topic} onChangeText={setTopic} placeholder="Anxiety & Stress" colors={colors} />
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" colors={colors} /></View>
          <View style={{ width: 110 }}><Field label="Time" value={time} onChangeText={setTime} placeholder="19:00" colors={colors} /></View>
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Field label="Minutes" value={duration} onChangeText={setDuration} placeholder="60" colors={colors} numeric /></View>
          <View style={{ flex: 1 }}><Field label="Maximum people" value={capacity} onChangeText={setCapacity} placeholder="30" colors={colors} numeric /></View>
        </View>
        <TouchableOpacity style={[s.create, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]} disabled={saving} onPress={createSession}>
          <Icon name="calendar" size={17} color="#fff" />
          <Text style={s.createText}>{saving ? 'Scheduling…' : 'Schedule session'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, colors, multiline, numeric, ...props }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; multiline?: boolean; numeric?: boolean;
}) {
  return <View style={s.field}>
    <Text style={[s.label, { color: colors.foreground }]}>{label}</Text>
    <TextInput
      {...props}
      multiline={multiline}
      keyboardType={numeric ? 'number-pad' : 'default'}
      placeholderTextColor={colors.mutedForeground}
      style={[s.input, multiline && s.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
    />
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 22 },
  subtitle: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 2, maxWidth: 280 },
  field: { marginBottom: 16 },
  label: { fontFamily: 'Satoshi-Bold', fontSize: 13, marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontFamily: 'Satoshi-Regular', fontSize: 15 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  create: { marginTop: 8, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  createText: { color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 15 },
});