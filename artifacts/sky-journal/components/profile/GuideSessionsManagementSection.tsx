import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import {
  getListGuideSessionsQueryKey,
  useCancelGuideSession,
  useListGuideSessions,
  useRescheduleGuideSession,
  type GuideSession,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  guideId: string | null;
}

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatSessionDate(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  };
}

function participantCount(session: GuideSession) {
  return Math.max(0, session.attendeeCount - 1);
}

export function GuideSessionsManagementSection({ guideId }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState('');
  const [timeValue, setTimeValue] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [mutationMessage, setMutationMessage] = useState('');

  const queryKey = getListGuideSessionsQueryKey({ guideId: guideId ?? undefined });
  const { data, isLoading, isFetching, isError, refetch } = useListGuideSessions(
    { guideId: guideId ?? undefined },
    { query: { queryKey, enabled: !!guideId, staleTime: 30_000 } },
  );

  const upcomingSessions = useMemo(
    () => (data ?? [])
      .filter(session => session.status === 'scheduled' && new Date(session.startsAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [data],
  );

  const refreshSessions = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const cancelMutation = useCancelGuideSession({
    mutation: {
      onSuccess: async () => {
        setCancelId(null);
        setMutationMessage('');
        await refreshSessions();
      },
      onError: error => setMutationMessage(error.message || 'Could not cancel this session. Please try again.'),
    },
  });

  const rescheduleMutation = useRescheduleGuideSession({
    mutation: {
      onSuccess: async () => {
        setRescheduleId(null);
        setValidationMessage('');
        setMutationMessage('');
        await refreshSessions();
      },
      onError: error => setMutationMessage(error.message || 'Could not reschedule this session. Please try again.'),
    },
  });

  const beginReschedule = (session: GuideSession) => {
    const startsAt = new Date(session.startsAt);
    setRescheduleId(session.id);
    setCancelId(null);
    setDateValue(localDateValue(startsAt));
    setTimeValue(localTimeValue(startsAt));
    setValidationMessage('');
    setMutationMessage('');
  };

  const saveReschedule = (sessionId: string) => {
    setMutationMessage('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
      setValidationMessage('Enter a date as YYYY-MM-DD and a time as HH:MM.');
      return;
    }
    const [year, month, day] = dateValue.split('-').map(Number);
    const [hour, minute] = timeValue.split(':').map(Number);
    const startsAt = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      startsAt.getFullYear() !== year ||
      startsAt.getMonth() !== month - 1 ||
      startsAt.getDate() !== day ||
      hour > 23 ||
      minute > 59
    ) {
      setValidationMessage('That date or time is not valid.');
      return;
    }
    if (startsAt.getTime() < Date.now() + 5 * 60_000) {
      setValidationMessage('Choose a time at least 5 minutes from now.');
      return;
    }
    setValidationMessage('');
    rescheduleMutation.mutate({ sessionId, data: { startsAt: startsAt.toISOString() } });
  };

  if (!guideId) return null;

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.primary}15` }}>
            <Icon name="calendar" size={15} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 15 }}>Upcoming sessions</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 11, lineHeight: 16, marginTop: 1 }}>
              Reschedule or cancel · participants are notified
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ minHeight: 68, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.primary}06`, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 12 }}>Loading your sessions…</Text>
        </View>
      ) : isError ? (
        <View style={{ padding: 12, borderRadius: 14, borderWidth: 1, borderColor: `${colors.destructive}35`, backgroundColor: `${colors.destructive}08`, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 12, flex: 1 }}>Your upcoming sessions could not be loaded.</Text>
          <TouchableOpacity onPress={() => { void refetch(); }} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: `${colors.primary}14` }}>
            <Text style={{ color: colors.primary, fontFamily: 'Satoshi-Bold', fontSize: 12 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : upcomingSessions.length === 0 ? (
        <View style={{ minHeight: 74, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.primary}06`, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="clock" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 12 }}>No upcoming sessions yet</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 11, marginTop: 2 }}>Use Host session above to create one.</Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {upcomingSessions.map(session => {
            const date = formatSessionDate(session.startsAt);
            const participants = participantCount(session);
            const isRescheduling = rescheduleId === session.id;
            const isConfirmingCancel = cancelId === session.id;
            const isBusy = cancelMutation.isPending || rescheduleMutation.isPending;
            return (
              <View key={session.id} style={{ padding: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 37, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="calendar" size={17} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 13 }}>{session.title}</Text>
                    <Text style={{ color: colors.secondary, fontFamily: 'Satoshi-Bold', fontSize: 11, marginTop: 3 }}>
                      {date.date} · {date.time}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <Icon name="users" size={12} color={colors.mutedForeground} />
                      <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Medium', fontSize: 11 }}>
                        {participants} {participants === 1 ? 'participant' : 'participants'} joined
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity testID={`manage-open-${session.id}`} accessibilityRole="button" accessibilityLabel="Open session room"
                    onPress={() => router.push(`/guide-session/${session.id}`)}
                    style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: `${colors.primary}12`, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: colors.primary, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Open</Text>
                    <Icon name="arrow-right" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                {isRescheduling && (
                  <View style={{ marginTop: 10, padding: 9, borderRadius: 12, backgroundColor: `${colors.primary}08`, borderWidth: 1, borderColor: `${colors.primary}22` }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 11, marginBottom: 7 }}>New local date and time</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        value={dateValue}
                        onChangeText={setDateValue}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.mutedForeground}
                        autoCapitalize="none"
                        accessibilityLabel="New session date"
                        style={{ flex: 1, minWidth: 0, color: colors.foreground, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, fontFamily: 'Satoshi-Medium', fontSize: 12 }}
                      />
                      <TextInput
                        value={timeValue}
                        onChangeText={setTimeValue}
                        placeholder="HH:MM"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="numbers-and-punctuation"
                        accessibilityLabel="New session time"
                        style={{ width: 86, color: colors.foreground, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8, fontFamily: 'Satoshi-Medium', fontSize: 12 }}
                      />
                    </View>
                    {!!validationMessage && <Text style={{ color: colors.destructive, fontFamily: 'Satoshi-Medium', fontSize: 11, marginTop: 6 }}>{validationMessage}</Text>}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 7, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => { setRescheduleId(null); setValidationMessage(''); }} disabled={isBusy} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Keep current time</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => saveReschedule(session.id)} disabled={isBusy} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {rescheduleMutation.isPending && <ActivityIndicator size="small" color="#fff" />}
                        <Text style={{ color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Save time</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {isConfirmingCancel && (
                  <View style={{ marginTop: 9, padding: 9, borderRadius: 12, backgroundColor: `${colors.destructive}08`, borderWidth: 1, borderColor: `${colors.destructive}28` }}>
                    <Text style={{ color: colors.foreground, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>
                      Cancel this session? {participants ? `${participants} joined ${participants === 1 ? 'participant will' : 'participants will'} be notified.` : 'Any joined participants will be notified.'}
                    </Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 7, marginTop: 8 }}>
                      <TouchableOpacity onPress={() => setCancelId(null)} disabled={isBusy} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Keep session</Text>
                      </TouchableOpacity>
                      <TouchableOpacity testID={`manage-cancel-confirm-${session.id}`} onPress={() => cancelMutation.mutate({ sessionId: session.id })} disabled={isBusy} style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.destructive, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {cancelMutation.isPending && <ActivityIndicator size="small" color="#fff" />}
                        <Text style={{ color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Confirm cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!isRescheduling && !isConfirmingCancel && (
                  <View style={{ flexDirection: 'row', gap: 7, marginTop: 9, paddingLeft: 47 }}>
                    <TouchableOpacity
                      testID={`manage-reschedule-${session.id}`} onPress={() => beginReschedule(session)}
                      disabled={isBusy}
                      accessibilityRole="button"
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 10, backgroundColor: `${colors.primary}12` }}
                    >
                      <Icon name="edit-2" size={12} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Reschedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setCancelId(session.id); setRescheduleId(null); setMutationMessage(''); }}
                      disabled={isBusy}
                      accessibilityRole="button"
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 10, backgroundColor: `${colors.destructive}0C` }}
                    >
                      <Icon name="x" size={12} color={colors.destructive} />
                      <Text style={{ color: colors.destructive, fontFamily: 'Satoshi-Bold', fontSize: 11 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {!!mutationMessage && (
        <View style={{ marginTop: 8, padding: 10, borderRadius: 11, backgroundColor: `${colors.destructive}08`, borderWidth: 1, borderColor: `${colors.destructive}25` }}>
          <Text style={{ color: colors.destructive, fontFamily: 'Satoshi-Medium', fontSize: 12 }}>{mutationMessage}</Text>
        </View>
      )}

      {isFetching && !isLoading && (
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}
