import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { SecureImage } from '@/components/SecureImage';
import { ActivitiesPanel, PollsPanel, QuestionsPanel, RecapPanel } from '@/components/guide-session/EngagementPanels';
import { SessionDiscussionPanel } from '@/components/guide-session/SessionDiscussionPanel';
import { TutorialStepper } from '@/components/guide-session/TutorialStepper';
import {
  Initials, Notice, PillButton, SectionCard, errorMessage, formatSessionCountdown, getSessionPhase, gs,
} from '@/components/guide-session/shared';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { getGetGuideSessionEngagementQueryKey, useGetGuideSessionEngagement } from '@workspace/api-client-react';
import { Image } from 'expo-image';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

interface GuideSession {
  id: string; guideId: string; roomId: string; title: string; description: string; topic: string | null;
  startsAt: string; endsAt: string; capacity: number; attendeeCount: number; isJoined: boolean;
  coverImageUri: string | null; status: string; tutorialId: string | null;
  tutorial: {
    id: string; title: string; description: string; topic: string | null;
    steps: { id: string; type: 'text' | 'image' | 'video' | 'tip' | 'question'; title: string; body: string; mediaUri?: string | null }[];
  } | null;
  tutorialProgress: number; tutorialCompletedAt: string | null;
}
interface GuideSessionParticipant {
  userId: string; name: string | null; username: string | null; avatarUri: string | null;
  joinedAt: string; tutorialProgress: number; tutorialCompletedAt: string | null;
}
type Tab = 'activity' | 'polls' | 'qa' | 'chat' | 'people';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'activity', label: 'Activity', icon: 'book-open' },
  { key: 'polls', label: 'Polls', icon: 'bar-chart-2' },
  { key: 'qa', label: 'Q&A', icon: 'help-circle' },
  { key: 'chat', label: 'Chat', icon: 'message-circle' },
  { key: 'people', label: 'People', icon: 'users' },
];

export default function GuideSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { followingIds, followUser } = useApp();
  const [session, setSession] = useState<GuideSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusRefreshError, setStatusRefreshError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>('activity');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set(['activity']));
  const [activeStep, setActiveStep] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ending, setEnding] = useState(false);
  const [participants, setParticipants] = useState<GuideSessionParticipant[] | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const loadController = useRef<AbortController | null>(null);
  const identityRef = useRef('');
  identityRef.current = JSON.stringify([userId, sessionId]);

  const isOwner = !!session && userId === session.guideId;
  const phase = session ? getSessionPhase(session.status, session.startsAt, session.endsAt, now) : 'upcoming';
  const member = !!session && (session.isJoined || isOwner);
  const sessionStatus = session?.status;

  const engagementQuery = useGetGuideSessionEngagement(sessionId ?? '', {
    query: {
      queryKey: [...getGetGuideSessionEngagementQueryKey(sessionId ?? ''), userId],
      enabled: member && phase !== 'cancelled',
      retry: false,
      refetchInterval: phase === 'live' ? 5000 : false,
      refetchIntervalInBackground: false,
    },
  });
  const refetchRef = useRef(engagementQuery.refetch);
  refetchRef.current = engagementQuery.refetch;
  const refreshEngagement = useCallback(() => { void refetchRef.current(); }, []);

  const switchTab = useCallback((next: Tab) => {
    setTab(next);
    setVisitedTabs(current => current.has(next) ? current : new Set([...current, next]));
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [fade]);

  useEffect(() => {
    setSession(null);
    setParticipants(null);
    setParticipantsLoading(false);
    setParticipantsError(null);
    setTab('activity');
    setVisitedTabs(new Set(['activity']));
  }, [sessionId, userId]);

  const load = useCallback(() => {
    if (!sessionId || !userId) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setLoadError(null);
    apiFetch<GuideSession>(`/guide-sessions/${sessionId}`, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted) return;
      setSession(value);
      setActiveStep(Math.min(value.tutorialProgress ?? 0, Math.max((value.tutorial?.steps.length ?? 1) - 1, 0)));
    })
      .catch(error => { if (!controller.signal.aborted) setLoadError(errorMessage(error, t('social.sessionUnavailableBody'))); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sessionId, userId, t]);
  useEffect(load, [load]);

  // Engagement polling cannot announce cancellation, rescheduling or an early end.
  useEffect(() => {
    if (!sessionId || sessionStatus !== 'scheduled') return;
    let disposed = false;
    let inFlight = false;
    const refreshStatus = async () => {
      if (inFlight || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      inFlight = true;
      try {
        const updated = await apiFetch<GuideSession>(`/guide-sessions/${sessionId}`);
        if (!disposed) { setSession(updated); setStatusRefreshError(false); }
      } catch {
        if (!disposed) setStatusRefreshError(true);
      } finally { inFlight = false; }
    };
    const timer = setInterval(() => { void refreshStatus(); }, 10_000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refreshStatus(); });
    return () => { disposed = true; clearInterval(timer); subscription.remove(); };
  }, [sessionId, sessionStatus]);

  useEffect(() => {
    if (!session) return;
    const endsAt = new Date(session.endsAt).getTime();
    setNow(Date.now());
    if (session.status !== 'scheduled' || !Number.isFinite(endsAt) || endsAt <= Date.now()) return;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= endsAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const loadParticipants = useCallback(async (id: string, silent = false) => {
    const identity = identityRef.current;
    if (!silent) { setParticipantsLoading(true); setParticipantsError(null); }
    try {
      const people = await apiFetch<GuideSessionParticipant[]>(`/guide-sessions/${id}/participants`);
      if (identityRef.current !== identity) return;
      setParticipants(people);
      setParticipantsError(null);
    } catch (error) {
      if (!silent && identityRef.current === identity) setParticipantsError(errorMessage(error, 'Could not load participants.'));
    } finally { if (!silent && identityRef.current === identity) setParticipantsLoading(false); }
  }, []);
  useEffect(() => {
    if (tab === 'people' && isOwner && session && participants === null && !participantsLoading && !participantsError) void loadParticipants(session.id);
  }, [tab, isOwner, session, participants, participantsLoading, participantsError, loadParticipants]);
  // Quiet roster refresh while the host watches People in an active session.
  const sessionIdLoaded = session?.id;
  const rosterActive = tab === 'people' && isOwner && (phase === 'live' || phase === 'upcoming');
  useEffect(() => {
    if (!rosterActive || !sessionIdLoaded) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void loadParticipants(sessionIdLoaded, true);
    }, 12_000);
    return () => clearInterval(timer);
  }, [rosterActive, sessionIdLoaded, loadParticipants]);

  async function join() {
    if (!session) return;
    setJoining(true);
    try {
      const updated = await apiFetch<GuideSession>(`/guide-sessions/${session.id}/join`, { method: 'POST' });
      setSession(updated);
      setActiveStep(Math.min(updated.tutorialProgress ?? 0, Math.max((updated.tutorial?.steps.length ?? 1) - 1, 0)));
      switchTab('activity');
    } catch (error) {
      Alert.alert(t('social.joinError'), errorMessage(error, t('social.tryAgain')));
    } finally { setJoining(false); }
  }

  async function advanceTutorial() {
    if (!session?.tutorial || savingProgress) return;
    const stepCount = session.tutorial.steps.length;
    const completedSteps = Math.min(activeStep + 1, stepCount);
    setSavingProgress(true);
    try {
      const updated = await apiFetch<GuideSession>(`/guide-sessions/${session.id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ completedSteps: Math.max(session.tutorialProgress, completedSteps) }),
      });
      setSession(updated);
      if (completedSteps < stepCount) setActiveStep(completedSteps);
    } catch (error) {
      Alert.alert('Progress not saved', errorMessage(error, t('social.tryAgain')));
    } finally { setSavingProgress(false); }
  }

  function confirmEnd() {
    if (!session) return;
    Alert.alert('End this session for everyone?', 'Polls and activities close and participants move to the recap. The session chat stays readable. This cannot be undone.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: async () => {
        setEnding(true);
        try {
          await apiFetch(`/guide-sessions/${session.id}/end`, { method: 'POST' });
          setSession(current => current ? { ...current, status: 'completed' } : current);
          refreshEngagement();
        } catch (error) {
          Alert.alert('Could not end session', errorMessage(error, t('social.tryAgain')));
        } finally { setEnding(false); }
      } },
    ]);
  }

  const top = Platform.OS === 'web' ? 67 : insets.top;
  const bottom = Platform.OS === 'web' ? 34 : insets.bottom;

  if (loading && !session) {
    return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}><View style={s.headerRow}><BackButton /></View><SkyLoadingOverlay message={t('social.loadingSession')} /></View>;
  }
  if (!session) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: top, paddingHorizontal: 20 }]}>
        <View style={s.headerRow}><BackButton /></View>
        <View style={s.centerState}>
          <View style={[s.stateIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name="cloud-off" size={26} color={colors.primary} /></View>
          <Text style={[s.stateTitle, { color: colors.foreground }]}>{t('social.sessionUnavailable')}</Text>
          <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center', maxWidth: 300 }]}>{loadError ?? t('social.sessionUnavailableBody')}</Text>
          <PillButton testID="session-retry" colors={colors} icon="refresh-cw" label="Try again" onPress={load} />
        </View>
      </View>
    );
  }

  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const engagement = engagementQuery.data;
  const isFollowing = followingIds.includes(session.guideId);
  const tutorial = session.tutorial;
  const stepCount = tutorial?.steps.length ?? 0;
  const progressComplete = !!tutorial && session.tutorialProgress >= stepCount;
  const showRoom = member && phase !== 'cancelled';
  const isFull = session.attendeeCount >= session.capacity;
  const phaseMeta = {
    upcoming: { label: member ? 'Waiting room' : 'Upcoming', color: colors.primary, icon: 'calendar' },
    live: { label: 'Live', color: colors.tint, icon: 'radio' },
    ended: { label: 'Ended', color: colors.mutedForeground, icon: 'check-circle' },
    cancelled: { label: 'Cancelled', color: colors.destructive, icon: 'x-circle' },
  }[phase];
  const openPolls = engagement?.polls.filter(p => !p.closedAt).length ?? 0;
  const unanswered = engagement?.questions.filter(q => !q.answer).length ?? 0;
  const activeActivities = engagement?.activities.filter(a => a.status === 'active').length ?? 0;
  const tabBadge: Record<Tab, number | null> = {
    activity: phase === 'live' && activeActivities ? activeActivities : null,
    polls: phase !== 'ended' && openPolls ? openPolls : null,
    qa: isOwner && unanswered ? unanswered : null,
    chat: null,
    people: null,
  };
  const roleLabel = isOwner ? 'Host' : session.isJoined ? 'Participant' : 'Guest';
  const timeLine = `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${start.toLocaleTimeString([], { timeStyle: 'short' })}–${end.toLocaleTimeString([], { timeStyle: 'short' })}`;

  const shortcuts: { key: string; icon: string; label: string; tab: Tab }[] = phase === 'live'
    ? isOwner ? [
      { key: 'poll', icon: 'bar-chart-2', label: openPolls ? `${openPolls} open poll${openPolls === 1 ? '' : 's'}` : 'Launch a poll', tab: 'polls' },
      { key: 'qa', icon: 'help-circle', label: unanswered ? `Answer ${unanswered}` : 'Q&A', tab: 'qa' },
      { key: 'people', icon: 'users', label: 'Roster', tab: 'people' },
      { key: 'chat', icon: 'message-circle', label: 'Chat', tab: 'chat' },
    ] : [
      ...(openPolls ? [{ key: 'vote', icon: 'bar-chart-2', label: `Vote (${openPolls})`, tab: 'polls' as Tab }] : []),
      { key: 'ask', icon: 'help-circle', label: 'Ask the guide', tab: 'qa' },
      { key: 'chat', icon: 'message-circle', label: 'Say something', tab: 'chat' },
    ]
    : phase === 'upcoming' ? isOwner ? [
      { key: 'poll', icon: 'bar-chart-2', label: 'Prepare polls', tab: 'polls' },
      { key: 'people', icon: 'users', label: 'Who joined', tab: 'people' },
      { key: 'chat', icon: 'message-circle', label: 'Greet early arrivals', tab: 'chat' },
    ] : [
      { key: 'chat', icon: 'message-circle', label: 'Say hello', tab: 'chat' },
      { key: 'polls', icon: 'bar-chart-2', label: 'Preview polls', tab: 'polls' },
    ]
    : [
      { key: 'qa', icon: 'help-circle', label: 'Q&A history', tab: 'qa' },
      { key: 'polls', icon: 'bar-chart-2', label: 'Poll results', tab: 'polls' },
      { key: 'chat', icon: 'message-circle', label: 'Chat history', tab: 'chat' },
    ];

  const header = (
    <View style={[s.header, { borderBottomColor: colors.border }]}>
      <View style={s.headerRow}>
        <BackButton />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[gs.row, { gap: 6 }]}>
            <View testID="session-phase" style={[s.phasePill, { backgroundColor: `${phaseMeta.color}18` }]}>
              {phase === 'live' ? <View style={[s.dot, { backgroundColor: phaseMeta.color }]} /> : <Icon name={phaseMeta.icon} size={10} color={phaseMeta.color} />}
              <Text style={[s.phaseText, { color: phaseMeta.color }]}>{phaseMeta.label.toUpperCase()}</Text>
            </View>
            <Text style={[s.rolePill, { color: colors.primary, borderColor: `${colors.primary}33` }]}>{roleLabel}</Text>
            {phase === 'upcoming' && <Text testID="session-countdown-inline" style={[gs.meta, { color: colors.mutedForeground }]} numberOfLines={1}>in {formatSessionCountdown(start.getTime() - now)}</Text>}
          </View>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>{session.title}</Text>
        </View>
        <View testID="session-attendance" style={[s.attendance, { backgroundColor: `${colors.primary}10` }]}>
          <Icon name="users" size={12} color={colors.primary} />
          <Text style={[s.attendanceText, { color: colors.primary }]}>{session.attendeeCount}/{session.capacity}</Text>
        </View>
      </View>
      {showRoom && (
        <View style={[s.tabs, { backgroundColor: `${colors.primary}0B`, borderColor: `${colors.primary}1F` }]} accessibilityRole="tablist">
          {TABS.map(item => {
            const on = tab === item.key;
            const badge = tabBadge[item.key];
            return (
              <TouchableOpacity key={item.key} testID={`session-tab-${item.key}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label}
                activeOpacity={0.8} onPress={() => switchTab(item.key)} style={[s.tab, on && { backgroundColor: colors.card, borderColor: `${colors.primary}33` }]}>
                <View>
                  <Icon name={item.icon} size={16} color={on ? colors.primary : colors.mutedForeground} />
                  {!!badge && <View style={[s.badge, { backgroundColor: colors.primary, borderColor: colors.background }]}><Text style={[s.badgeText, { color: colors.primaryForeground }]}>{badge > 9 ? '9+' : badge}</Text></View>}
                </View>
                <Text style={[s.tabText, { color: on ? colors.primary : colors.mutedForeground }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const refreshBanner = statusRefreshError
    ? <Notice colors={colors} icon="cloud-off" text="Could not refresh the session status. Showing the last update and retrying." />
    : null;

  /* -------- Overview for guests, cancelled sessions -------- */
  const overview = (
    <>
      {refreshBanner}
      {!!session.coverImageUri && (
        <View style={[s.cover, { backgroundColor: colors.muted }]}>
          <Image source={{ uri: session.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      )}
      <View style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {!!session.topic && <Text style={[gs.eyebrow, { color: colors.primary, marginBottom: 4 }]}>{session.topic.toUpperCase()}</Text>}
        <Text style={[s.detailTitle, { color: colors.foreground }]}>{session.title}</Text>
        <View style={[gs.row, { flexWrap: 'wrap', marginTop: 8 }]}>
          <Icon name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>{timeLine}</Text>
          <Icon name="users" size={12} color={colors.mutedForeground} />
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>{isFull ? 'Full' : `${session.capacity - session.attendeeCount} seats left`}</Text>
        </View>
        {phase === 'upcoming' && (
          <View style={[s.countRow, { backgroundColor: `${colors.primary}0D` }]}>
            <Text style={[gs.meta, { color: colors.mutedForeground }]}>Starts in</Text>
            <Text style={[s.countSmall, { color: colors.foreground }]}>{formatSessionCountdown(start.getTime() - now)}</Text>
          </View>
        )}
        {!!session.description && <Text style={[gs.body, { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 10 }]}>{session.description}</Text>}
      </View>
      {phase === 'cancelled' && (
        <SectionCard colors={colors} icon="x-circle" eyebrow="SESSION CANCELLED" title="This session will not take place">
          <Text style={[gs.body, { color: colors.mutedForeground }]}>{isOwner ? 'You cancelled this session. Joined participants were notified.' : 'The guide cancelled this session and joined participants were notified. Their other sessions are on their profile.'}</Text>
          {!isOwner && (
            <View style={[gs.row, { marginTop: 12 }]}>
              <PillButton colors={colors} flex variant="secondary" icon="calendar" label="Other sessions" onPress={() => router.push(`/guide/${session.guideId}` as Href)} />
              <PillButton colors={colors} flex variant="secondary" icon="mail" label={t('social.messageGuide')} onPress={() => router.push(`/messages/${session.guideId}` as Href)} />
            </View>
          )}
        </SectionCard>
      )}
      {phase !== 'cancelled' && tutorial && (
        <SectionCard colors={colors} icon="book-open" eyebrow="THIS SESSION USES" title={tutorial.title}>
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>{stepCount} steps · {phase === 'ended' ? 'open it in the tutorial reader' : 'join to follow along and save your progress'}</Text>
          {phase === 'ended' && <View style={{ marginTop: 10 }}><PillButton colors={colors} variant="secondary" icon="book-open" label="Read the tutorial" onPress={() => router.push(`/guide-tutorial/${tutorial.id}` as Href)} /></View>}
        </SectionCard>
      )}
      {phase !== 'cancelled' && phase !== 'ended' && (
        <View style={[s.lockCard, { borderColor: `${colors.primary}33`, backgroundColor: `${colors.primary}08` }]}>
          <Icon name="lock" size={14} color={colors.primary} />
          <Text style={[gs.body, { flex: 1, color: colors.foreground }]}>Join to unlock the session room: tutorial, polls, Q&A and the group chat.</Text>
        </View>
      )}
      {phase === 'ended' && (
        <SectionCard colors={colors} icon="clock" eyebrow="SESSION ENDED" title="You missed this one">
          <Text style={[gs.body, { color: colors.mutedForeground, marginBottom: isFollowing ? 0 : 12 }]}>{isFollowing ? 'You follow this guide. Their next sessions show on their profile.' : 'Follow the guide to hear about the next session.'}</Text>
          {!isFollowing && !isOwner && <PillButton testID="follow-guide" colors={colors} icon="user-plus" label="Follow this guide" onPress={() => followUser(session.guideId)} />}
        </SectionCard>
      )}
      {!isOwner && phase !== 'cancelled' && (
        <TouchableOpacity style={[gs.row, { justifyContent: 'center', marginTop: 8, padding: 8 }]} onPress={() => router.push(`/messages/${session.guideId}` as Href)}>
          <Icon name="mail" size={14} color={colors.primary} />
          <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>{t('social.messageGuide')}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  /* -------- Room tab content -------- */
  const shortcutRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
      {shortcuts.map(sc => (
        <TouchableOpacity key={sc.key} testID={`session-shortcut-${sc.key}`} activeOpacity={0.75} onPress={() => switchTab(sc.tab)}
          style={[s.chip, { backgroundColor: colors.card, borderColor: `${colors.primary}2A` }]}>
          <Icon name={sc.icon} size={13} color={colors.primary} />
          <Text style={[s.chipText, { color: colors.foreground }]}>{sc.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const phaseBlock = phase === 'upcoming' ? (
    <View testID="waiting-room" style={[s.waiting, { backgroundColor: colors.card, borderColor: `${colors.primary}26` }]}>
      <View style={[gs.row, { alignItems: 'flex-end' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[gs.eyebrow, { color: colors.primary }]}>{isOwner ? 'YOU ARE HOSTING' : 'YOUR SEAT IS SAVED'}</Text>
          <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 4 }]}>Starts {timeLine}</Text>
        </View>
        <Text style={[s.countdown, { color: colors.foreground }]}>{formatSessionCountdown(start.getTime() - now)}</Text>
      </View>
      <View style={[s.checklist, { borderTopColor: colors.border }]}>
        {(isOwner ? [
          ['bar-chart-2', `${engagement?.polls.length ?? 0} poll${(engagement?.polls.length ?? 0) === 1 ? '' : 's'} prepared`, (engagement?.polls.length ?? 0) > 0],
          ['book-open', tutorial ? `Tutorial: ${tutorial.title}` : 'No tutorial attached', !!tutorial],
          ['users', `${Math.max(0, session.attendeeCount - 1)} joined so far`, session.attendeeCount > 1],
        ] : [
          ['book-open', tutorial ? 'Preview the tutorial below' : 'No tutorial, just bring questions', !!tutorial],
          ['help-circle', 'Q&A and voting open at the start', false],
        ] as [string, string, boolean][]).map(([icon, label, done]) => (
          <View key={label as string} style={gs.row}>
            <Icon name={done ? 'check-circle' : icon as string} size={13} color={done ? colors.tint : colors.primary} />
            <Text style={[gs.body, { flex: 1, color: colors.foreground }]} numberOfLines={1}>{label as string}</Text>
          </View>
        ))}
      </View>
      {isOwner && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Reschedule or cancel from Upcoming sessions in your Profile; participants are notified.</Text>}
      {!isOwner && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>{t('social.sessionReminder')}</Text>}
    </View>
  ) : phase === 'ended' ? (
    <>
      <SectionCard testID="session-summary" colors={colors} icon="award" eyebrow="SESSION COMPLETE" title={isOwner ? 'Thanks for hosting' : 'Thanks for joining'}>
        <View style={[gs.row, { flexWrap: 'wrap', marginBottom: 12 }]}>
          {([
            [`${session.attendeeCount}`, 'joined'],
            [`${engagement?.polls.length ?? 0}`, 'polls'],
            [`${engagement?.questions.length ?? 0}`, 'questions'],
            ...(tutorial && !isOwner ? [[`${Math.min(session.tutorialProgress, stepCount)}/${stepCount}`, 'steps done']] : []),
          ] as [string, string][]).map(([v, l]) => (
            <View key={l} style={[s.stat, { backgroundColor: `${colors.primary}0B` }]}>
              <Text style={[s.statValue, { color: colors.foreground }]}>{v}</Text>
              <Text style={[gs.meta, { color: colors.mutedForeground }]}>{l}</Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }}>
          {!isOwner && !isFollowing && <PillButton testID="follow-guide" colors={colors} icon="user-plus" label="Follow this guide" onPress={() => followUser(session.guideId)} />}
          {!isOwner && isFollowing && <Notice colors={colors} icon="user-check" text="You follow this guide. Their next sessions show on their profile." />}
          <View style={[gs.row, { flexWrap: 'wrap' }]}>
            {tutorial && <PillButton colors={colors} flex variant="secondary" icon="book-open" label="Revisit tutorial" onPress={() => router.push(`/guide-tutorial/${tutorial.id}` as Href)} />}
            <PillButton colors={colors} flex variant="secondary" icon="compass" label="More tutorials" onPress={() => router.push('/guide-tutorials' as Href)} />
          </View>
          <View style={[gs.row, { flexWrap: 'wrap' }]}>
            <PillButton colors={colors} flex variant="secondary" icon="calendar" label={isOwner ? 'Guide profile' : 'Next sessions'} onPress={() => router.push(`/guide/${session.guideId}` as Href)} />
            {isOwner && <PillButton colors={colors} flex variant="secondary" icon="plus" label="Schedule another" onPress={() => router.push('/create-guide-session')} />}
          </View>
        </View>
      </SectionCard>
      <RecapPanel sessionId={session.id} engagement={engagement} isOwner={isOwner} colors={colors} refresh={refreshEngagement} />
    </>
  ) : !isOwner && tutorial ? (
    <View style={[s.liveStrip, { backgroundColor: `${colors.tint}12` }]}>
      <View style={[s.dot, { backgroundColor: colors.tint }]} />
      <Text style={[gs.meta, { flex: 1, color: colors.foreground }]}>Live · your progress {Math.min(session.tutorialProgress, stepCount)}/{stepCount} steps</Text>
    </View>
  ) : null;

  const engagementGate = (body: React.ReactNode) => engagementQuery.isLoading ? (
    <View style={{ gap: 10 }}>{[0, 1].map(i => <View key={i} style={[s.skeleton, { backgroundColor: `${colors.primary}0A`, borderColor: colors.border }]} />)}</View>
  ) : engagementQuery.isError && !engagement ? (
    <View style={[gs.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 8 }]}>
      <Icon name="cloud-off" size={20} color={colors.mutedForeground} />
      <Text style={[gs.body, { color: colors.mutedForeground }]}>Session activities could not be loaded.</Text>
      <PillButton testID="engagement-retry" colors={colors} variant="secondary" icon="refresh-cw" label="Retry" onPress={refreshEngagement} />
    </View>
  ) : body;

  const activityTab = (
    <>
      {phaseBlock}
      {tutorial ? (
        <SectionCard testID="session-tutorial" colors={colors} icon="book-open" eyebrow={isOwner ? 'YOUR TUTORIAL' : phase === 'ended' ? 'TUTORIAL' : 'FOLLOW ALONG AT YOUR PACE'} title={tutorial.title}
          right={progressComplete && !isOwner ? <Icon name="check-circle" size={18} color={colors.tint} /> : undefined}>
          <TutorialStepper steps={tutorial.steps} index={activeStep} colors={colors} active={tab === 'activity'}
            completed={isOwner ? 0 : session.tutorialProgress} onIndex={setActiveStep}
            questionHint="Share your answer in Chat, or ask the guide in Q&A."
            {...(!isOwner && session.isJoined && phase === 'live' ? {
              onNext: advanceTutorial,
              nextBusy: savingProgress,
              nextDisabled: progressComplete && activeStep >= stepCount - 1,
              nextLabel: progressComplete ? (activeStep >= stepCount - 1 ? 'All steps complete' : 'Next') : activeStep === stepCount - 1 ? 'Finish tutorial' : 'Mark done & continue',
            } : {})} />
          {!isOwner && phase === 'upcoming' && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Preview freely. Step progress saves once the session is live.</Text>}
          {isOwner && phase === 'live' && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Participants move through steps on their own. Track who is where in People.</Text>}
          <TouchableOpacity onPress={() => router.push(`/guide-tutorial/${tutorial.id}` as Href)} style={[gs.row, { marginTop: 12 }]}>
            <Icon name="maximize-2" size={13} color={colors.primary} />
            <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>Open in tutorial reader</Text>
          </TouchableOpacity>
        </SectionCard>
      ) : phase !== 'ended' && (
        <Notice colors={colors} icon="book-open" text={isOwner ? 'No tutorial attached. Activities, polls and chat carry the session.' : 'No tutorial for this session. Follow the guide in Chat and the activities below.'} />
      )}
      {engagementGate(<ActivitiesPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />)}
    </>
  );

  const peopleTab = (
    <SectionCard testID="session-participants" colors={colors} icon="users" eyebrow={isOwner ? 'ROSTER' : 'PEOPLE'} title={`${session.attendeeCount} of ${session.capacity} seats taken`}
      right={isOwner && rosterActive ? <Text style={[gs.meta, { color: colors.mutedForeground }]}>auto-refresh</Text> : undefined}>
      {!isOwner ? (
        <View style={{ gap: 10 }}>
          <View style={gs.row}>
            <Initials name="G" colors={colors} />
            <Text style={[gs.body, { flex: 1, color: colors.foreground }]}>Hosted by this guide</Text>
            <PillButton colors={colors} variant="secondary" label="Profile" onPress={() => router.push(`/guide/${session.guideId}` as Href)} />
          </View>
          <View style={[s.seatBar, { backgroundColor: `${colors.primary}14` }]}>
            <View style={{ width: `${Math.min(100, (session.attendeeCount / Math.max(1, session.capacity)) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: colors.primary }} />
          </View>
          <Text style={[gs.meta, { color: colors.mutedForeground }]}>The full list is visible to the host. Say hello to everyone in Chat.</Text>
          <View style={gs.row}>
            <PillButton colors={colors} flex variant="secondary" icon="message-circle" label="Open chat" onPress={() => switchTab('chat')} />
            <PillButton colors={colors} flex variant="secondary" icon="mail" label="Message guide" onPress={() => router.push(`/messages/${session.guideId}` as Href)} />
          </View>
        </View>
      ) : participantsLoading && participants === null ? (
        <View style={{ gap: 8 }}>{[0, 1, 2].map(i => <View key={i} style={[s.skeletonRow, { backgroundColor: `${colors.primary}0A` }]} />)}</View>
      ) : participantsError && participants === null ? (
        <View style={{ gap: 8 }}>
          <Text style={[gs.body, { color: colors.destructive }]}>{participantsError}</Text>
          <PillButton colors={colors} variant="secondary" icon="refresh-cw" label="Retry" onPress={() => void loadParticipants(session.id)} />
        </View>
      ) : (participants ?? []).length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 14, gap: 6 }}>
          <Icon name="user-plus" size={20} color={colors.mutedForeground} />
          <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>No one has joined yet. Share the session from your guide profile.</Text>
        </View>
      ) : (
        <View>
          {(participants ?? []).map(p => {
            const name = p.name ?? p.username ?? 'Player';
            const pct = stepCount ? Math.min(1, p.tutorialProgress / stepCount) : 0;
            return (
              <View key={p.userId} style={[gs.row, s.personRow, { borderBottomColor: colors.border }]}>
                {p.avatarUri ? <View style={s.avatar}><SecureImage source={{ uri: p.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" /></View> : <Initials name={name} colors={colors} />}
                <View style={{ flex: 1 }}>
                  <Text style={[gs.label, { color: colors.foreground, marginBottom: 3 }]} numberOfLines={1}>{name}</Text>
                  {tutorial ? (
                    <View style={[gs.row, { gap: 6 }]}>
                      <View style={[s.seatBar, { flex: 1, backgroundColor: `${colors.primary}14` }]}>
                        <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 3, backgroundColor: p.tutorialCompletedAt ? colors.tint : colors.primary }} />
                      </View>
                      <Text style={[gs.meta, { color: colors.mutedForeground }]}>{p.tutorialCompletedAt ? 'Done' : `${p.tutorialProgress}/${stepCount}`}</Text>
                    </View>
                  ) : <Text style={[gs.meta, { color: colors.mutedForeground }]}>Joined {new Date(p.joinedAt).toLocaleDateString()}</Text>}
                </View>
                {p.tutorialCompletedAt && <Icon name="check-circle" size={16} color={colors.tint} />}
              </View>
            );
          })}
          <TouchableOpacity onPress={() => void loadParticipants(session.id)} disabled={participantsLoading} style={[gs.row, { marginTop: 10, opacity: participantsLoading ? 0.5 : 1 }]}>
            <Icon name="refresh-cw" size={12} color={colors.primary} /><Text style={[gs.meta, { color: colors.primary }]}>{participantsLoading ? 'Refreshing…' : 'Refresh list'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SectionCard>
  );

  // Mount tabs lazily, then preserve their forms while switching between tools.
  // Tutorial video alone is unmounted off-tab so it cannot keep playing unseen.
  const roomPanels: { key: Tab; body: React.ReactNode }[] = [
    { key: 'activity', body: activityTab },
    { key: 'polls', body: engagementGate(<PollsPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />) },
    { key: 'qa', body: engagementGate(<QuestionsPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />) },
    { key: 'people', body: peopleTab },
  ];

  const inChat = showRoom && tab === 'chat';
  // Sticky bar: join for guests, chat jump + end for members. Never on chat (composer lives there) or for cancelled / non-member ended.
  const showBar = !inChat && phase !== 'cancelled' && (member || phase !== 'ended');

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={{ paddingTop: top, backgroundColor: colors.background }}>{header}</View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={inChat ? 'none' : 'on-drag'} style={{ flex: 1 }}
        scrollEnabled={!inChat}
        contentContainerStyle={[s.content, { paddingBottom: bottom + (showBar ? 96 : 24) }, inChat && { flex: 1, paddingBottom: bottom + 8 }]}>
        <Animated.View style={[{ opacity: fade }, inChat && { flex: 1, minHeight: 0 }]}>
          {showRoom ? (
            <>
              {refreshBanner}
              {tab === 'activity' && shortcutRow}
              {roomPanels.filter(panel => visitedTabs.has(panel.key)).map(panel => (
                <View key={`${userId}:${session.id}:${panel.key}`} pointerEvents={tab === panel.key ? 'auto' : 'none'} style={tab === panel.key ? undefined : s.hidden}>
                  {panel.body}
                </View>
              ))}
              {/* Kept mounted so unsent drafts survive tab switches; disabled (no requests) while hidden. */}
              <View testID="session-discussion-container" pointerEvents={inChat ? 'auto' : 'none'} style={inChat ? { flex: 1, minHeight: 0 } : s.hidden}>
                <SessionDiscussionPanel roomId={session.roomId} sessionId={session.id} guideId={session.guideId} phase={phase} colors={colors}
                  enabled={inChat && showRoom} />
              </View>
            </>
          ) : overview}
        </Animated.View>
      </ScrollView>

      {showBar && (
        <View style={[s.actionBar, { paddingBottom: bottom + 10, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {!member ? (
            <PillButton testID="session-join" colors={colors} flex icon="user-plus" busy={joining} disabled={isFull}
              label={isFull ? 'Session is full' : t('social.joinSession')} onPress={() => void join()} />
          ) : (
            <PillButton testID="session-chat" colors={colors} flex variant={isOwner && phase === 'live' ? 'secondary' : 'primary'} icon="message-circle"
              label={phase === 'live' ? 'Open chat' : phase === 'ended' ? 'Chat history' : 'Waiting room chat'}
              onPress={() => switchTab('chat')} />
          )}
          {isOwner && phase === 'live' && (
            <PillButton testID="session-end" colors={colors} flex variant="danger" icon="square" label="End session" busy={ending} onPress={confirmEnd} />
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  hidden: { display: 'none' },
  header: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, maxWidth: 760, width: '100%', alignSelf: 'center' },
  headerRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 0 },
  title: { fontFamily: 'Satoshi-Bold', fontSize: 17, lineHeight: 22, marginTop: 3 },
  phasePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  phaseText: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.8 },
  rolePill: { fontFamily: 'Satoshi-Bold', fontSize: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  attendance: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 11 },
  attendanceText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 3, marginTop: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: 'transparent' },
  tabText: { fontFamily: 'Satoshi-Bold', fontSize: 10.5 },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: 'Satoshi-Bold', fontSize: 9 },
  content: { paddingHorizontal: 16, paddingTop: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
  cover: { height: 132, borderRadius: 20, overflow: 'hidden', marginBottom: 12 },
  detailCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: 12 },
  detailTitle: { fontFamily: 'Satoshi-Black', fontSize: 21, lineHeight: 27 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 },
  countSmall: { fontFamily: 'Satoshi-Black', fontSize: 18, letterSpacing: 0.5 },
  lockCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12, marginBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, minHeight: 36 },
  chipText: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  waiting: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  countdown: { fontFamily: 'Satoshi-Black', fontSize: 28, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
  checklist: { gap: 7, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  liveStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12 },
  skeleton: { height: 120, borderRadius: 20, borderWidth: 1 },
  skeletonRow: { height: 44, borderRadius: 12 },
  seatBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  personRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  stat: { flexGrow: 1, minWidth: 70, borderRadius: 14, padding: 10, alignItems: 'center' },
  statValue: { fontFamily: 'Satoshi-Black', fontSize: 20 },
  actionBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: 'Satoshi-Bold', fontSize: 18 },
});
