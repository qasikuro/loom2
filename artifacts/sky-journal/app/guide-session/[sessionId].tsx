import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { SecureImage } from '@/components/SecureImage';
import { ActivitiesPanel, PollsPanel, QuestionsPanel, RecapPanel } from '@/components/guide-session/EngagementPanels';
import { TutorialStepper } from '@/components/guide-session/TutorialStepper';
import {
  Initials, Notice, PillButton, SectionCard, errorMessage, formatSessionCountdown, getSessionPhase, gs,
} from '@/components/guide-session/shared';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@clerk/expo';
import { getGetGuideSessionEngagementQueryKey, useGetGuideSessionEngagement } from '@workspace/api-client-react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
type Tab = 'activity' | 'polls' | 'qa' | 'people';
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'activity', label: 'Activity', icon: 'book-open' },
  { key: 'polls', label: 'Polls', icon: 'bar-chart-2' },
  { key: 'qa', label: 'Q&A', icon: 'help-circle' },
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
  const [activeStep, setActiveStep] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [joining, setJoining] = useState(false);
  const [ending, setEnding] = useState(false);
  const [participants, setParticipants] = useState<GuideSessionParticipant[] | null>(null);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState<string | null>(null);

  const isOwner = !!session && userId === session.guideId;
  const phase = session ? getSessionPhase(session.status, session.startsAt, session.endsAt, now) : 'upcoming';
  const member = !!session && (session.isJoined || isOwner);

  const engagementQuery = useGetGuideSessionEngagement(sessionId ?? '', {
    query: {
      queryKey: [...getGetGuideSessionEngagementQueryKey(sessionId ?? ''), userId],
      enabled: member && phase !== 'cancelled',
      retry: false,
      refetchInterval: phase === 'live' ? 5000 : false,
      refetchIntervalInBackground: false,
    },
  });
  const refreshEngagement = useCallback(() => { void engagementQuery.refetch(); }, [engagementQuery]);

  const load = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    setLoadError(null);
    apiFetch<GuideSession>(`/guide-sessions/${sessionId}`).then(value => {
      setSession(value);
      setActiveStep(Math.min(value.tutorialProgress ?? 0, Math.max((value.tutorial?.steps.length ?? 1) - 1, 0)));
    })
      .catch(error => setLoadError(errorMessage(error, t('social.sessionUnavailableBody'))))
      .finally(() => setLoading(false));
  }, [sessionId, t]);
  useEffect(load, [load]);

  // Engagement polling alone cannot announce cancellation, rescheduling or a
  // host ending early. Refresh the session without clearing the current step.
  useEffect(() => {
    if (!sessionId || !session || session.status !== 'scheduled') return;
    let disposed = false;
    let inFlight = false;
    const refreshStatus = async () => {
      if (inFlight || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      inFlight = true;
      try {
        const updated = await apiFetch<GuideSession>(`/guide-sessions/${sessionId}`);
        if (!disposed) {
          setSession(updated);
          setStatusRefreshError(false);
        }
      } catch {
        if (!disposed) setStatusRefreshError(true);
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => { void refreshStatus(); }, 10_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshStatus();
    });
    return () => { disposed = true; clearInterval(timer); subscription.remove(); };
  }, [sessionId, session?.status]);

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

  const loadParticipants = useCallback(async (id: string) => {
    setParticipantsLoading(true);
    setParticipantsError(null);
    try { setParticipants(await apiFetch<GuideSessionParticipant[]>(`/guide-sessions/${id}/participants`)); }
    catch (error) { setParticipantsError(errorMessage(error, 'Could not load participants.')); }
    finally { setParticipantsLoading(false); }
  }, []);
  useEffect(() => {
    if (tab === 'people' && isOwner && session && participants === null && !participantsLoading && !participantsError) void loadParticipants(session.id);
  }, [tab, isOwner, session, participants, participantsLoading, participantsError, loadParticipants]);

  async function join() {
    if (!session) return;
    setJoining(true);
    try {
      const updated = await apiFetch<GuideSession>(`/guide-sessions/${session.id}/join`, { method: 'POST' });
      setSession(updated);
      setActiveStep(Math.min(updated.tutorialProgress ?? 0, Math.max((updated.tutorial?.steps.length ?? 1) - 1, 0)));
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
    Alert.alert('End this session for everyone?', 'Polls and activities close and participants move to the summary. The Campfire chat stays open. This cannot be undone.', [
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
    return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}><View style={s.header}><BackButton /></View><SkyLoadingOverlay message={t('social.loadingSession')} /></View>;
  }
  if (!session) {
    return (
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: top, paddingHorizontal: 20 }]}>
        <View style={s.header}><BackButton /></View>
        <View style={s.centerState}>
          <Icon name="cloud-off" size={30} color={colors.mutedForeground} />
          <Text style={[s.stateTitle, { color: colors.foreground }]}>{t('social.sessionUnavailable')}</Text>
          <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>{loadError ?? t('social.sessionUnavailableBody')}</Text>
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
  const progressComplete = !!tutorial && session.tutorialProgress >= tutorial.steps.length;
  const showRoom = member && phase !== 'cancelled';
  const phaseMeta = {
    upcoming: { label: member ? 'WAITING ROOM' : 'UPCOMING', color: colors.primary, icon: 'calendar' },
    live: { label: 'LIVE NOW', color: colors.tint, icon: 'radio' },
    ended: { label: 'ENDED', color: colors.mutedForeground, icon: 'check-circle' },
    cancelled: { label: 'CANCELLED', color: colors.destructive, icon: 'x-circle' },
  }[phase];
  const tabBadge: Record<Tab, number | null> = {
    activity: engagement?.activities.filter(a => a.status === 'active').length || null,
    polls: engagement?.polls.filter(p => !p.closedAt).length || null,
    qa: engagement?.questions.filter(q => !q.answer).length || null,
    people: null,
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={s.header}>
        <BackButton />
        <Text style={[s.heading, { color: colors.foreground }]} numberOfLines={1}>{t('social.guideSession')}</Text>
        <View testID="session-phase" style={[s.phasePill, { backgroundColor: `${phaseMeta.color}18` }]}>
          {phase === 'live' ? <View style={[s.dot, { backgroundColor: phaseMeta.color }]} /> : <Icon name={phaseMeta.icon} size={11} color={phaseMeta.color} />}
          <Text style={[s.phaseText, { color: phaseMeta.color }]}>{phaseMeta.label}</Text>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: bottom + 120 }}>
        {statusRefreshError && (
          <Notice colors={colors} icon="cloud-off" text="Could not refresh the session status. Showing the last update and retrying automatically." />
        )}
        {/* Hero */}
        <View style={[s.hero, { backgroundColor: colors.muted }]}>
          {session.coverImageUri
            ? <Image source={{ uri: session.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <LinearGradient colors={[`${colors.primary}55`, `${colors.tint}30`, colors.card]} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['transparent', 'rgba(18,12,34,0.82)']} style={StyleSheet.absoluteFill} />
          <View style={s.heroBody}>
            {!!session.topic && <Text style={s.heroTopic}>{session.topic.toUpperCase()}</Text>}
            <Text style={s.heroTitle}>{session.title}</Text>
            <View style={[gs.row, { marginTop: 8, flexWrap: 'wrap' }]}>
              <Icon name="clock" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={s.heroMeta}>{start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} – {end.toLocaleTimeString([], { timeStyle: 'short' })}</Text>
              <Icon name="users" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={s.heroMeta}>{session.attendeeCount}/{session.capacity}</Text>
            </View>
          </View>
        </View>

        {/* Phase card */}
        {phase === 'cancelled' && (
          <SectionCard colors={colors} icon="x-circle" eyebrow="SESSION CANCELLED" title="This session will not take place">
            <Text style={[gs.body, { color: colors.mutedForeground }]}>The guide cancelled this session. Joined participants were notified. You can still message the guide or look for their other sessions.</Text>
          </SectionCard>
        )}
        {phase === 'upcoming' && member && (
          <View testID="waiting-room" style={[s.waiting, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[gs.eyebrow, { color: colors.primary }]}>{isOwner ? 'YOU ARE HOSTING' : 'YOU ARE IN'}</Text>
            <Text style={[s.countdownCaption, { color: colors.mutedForeground }]}>Starts in</Text>
            <Text style={[s.countdown, { color: colors.foreground }]}>{formatSessionCountdown(start.getTime() - now)}</Text>
            <View style={s.checklist}>
              {(isOwner ? [
                ['bar-chart-2', 'Prepare polls in the Polls tab', (engagement?.polls.length ?? 0) > 0],
                ['book-open', tutorial ? `Tutorial attached: ${tutorial.title}` : 'No tutorial attached', !!tutorial],
                ['users', `${Math.max(0, session.attendeeCount - 1)} participants joined so far`, session.attendeeCount > 1],
                ['message-circle', 'Say hello in the Campfire chat', false],
              ] as [string, string, boolean][] : [
                ['check', 'Your seat is saved', true],
                ['book-open', tutorial ? 'Preview the tutorial in Activity' : 'No tutorial for this one, just bring questions', !!tutorial],
                ['message-circle', 'Meet others in the Campfire chat', false],
                ['help-circle', 'Q&A and voting open at the start', false],
              ] as [string, string, boolean][]).map(([icon, label, done]) => (
                <View key={label} style={gs.row}>
                  <Icon name={done ? 'check-circle' : icon} size={14} color={done ? colors.tint : colors.primary} />
                  <Text style={[gs.body, { flex: 1, color: colors.foreground }]}>{label}</Text>
                </View>
              ))}
            </View>
            {isOwner && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Need a new time or to cancel? Use Upcoming sessions in your Profile; participants are notified automatically.</Text>}
          </View>
        )}
        {phase === 'live' && member && (
          <Notice colors={colors} icon="radio" tone="primary" text={isOwner
            ? 'You are live. Launch polls and activities, answer questions, and end the session when you are done.'
            : 'The session is live. Follow the tutorial, vote in polls and ask the guide questions below.'} />
        )}
        {phase === 'ended' && member && (
          <SectionCard testID="session-summary" colors={colors} icon="award" eyebrow="SESSION COMPLETE" title={isOwner ? 'Thanks for hosting' : 'Thanks for joining'}>
            <View style={[gs.row, { flexWrap: 'wrap', marginBottom: 12 }]}>
              {([
                [`${session.attendeeCount}`, 'joined'],
                [`${engagement?.polls.length ?? 0}`, 'polls'],
                [`${engagement?.questions.length ?? 0}`, 'questions'],
                ...(tutorial && !isOwner ? [[`${Math.min(session.tutorialProgress, tutorial.steps.length)}/${tutorial.steps.length}`, 'steps done']] : []),
              ] as [string, string][]).map(([v, l]) => (
                <View key={l} style={[s.stat, { backgroundColor: colors.background }]}>
                  <Text style={[s.statValue, { color: colors.foreground }]}>{v}</Text>
                  <Text style={[gs.meta, { color: colors.mutedForeground }]}>{l}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 8 }}>
              {!isOwner && !isFollowing && <PillButton testID="follow-guide" colors={colors} icon="user-plus" label="Follow this guide" onPress={() => followUser(session.guideId)} />}
              {!isOwner && isFollowing && <Notice colors={colors} icon="user-check" text="You follow this guide. Their next sessions show on their profile." />}
              {tutorial && <PillButton colors={colors} variant="secondary" icon="book-open" label="Revisit the tutorial" onPress={() => router.push(`/guide-tutorial/${tutorial.id}` as Href)} />}
              <PillButton colors={colors} variant="secondary" icon="compass" label="Browse more tutorials" onPress={() => router.push('/guide-tutorials' as Href)} />
              <PillButton colors={colors} variant="secondary" icon="calendar" label={isOwner ? 'Your guide profile' : 'Upcoming sessions from this guide'} onPress={() => router.push(`/guide/${session.guideId}` as Href)} />
              {isOwner && <PillButton colors={colors} variant="secondary" icon="plus" label="Schedule another session" onPress={() => router.push('/create-guide-session')} />}
            </View>
          </SectionCard>
        )}
        {phase === 'ended' && member && <RecapPanel sessionId={session.id} engagement={engagement} isOwner={isOwner} colors={colors} refresh={refreshEngagement} />}

        {/* About */}
        <Text style={[s.section, { color: colors.foreground }]}>{t('social.sessionAbout')}</Text>
        <Text style={[gs.body, { color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginBottom: 14 }]}>{session.description}</Text>
        {!member && tutorial && phase !== 'cancelled' && (
          <SectionCard colors={colors} icon="book-open" eyebrow="THIS SESSION USES" title={tutorial.title}>
            <Text style={[gs.meta, { color: colors.mutedForeground }]}>{tutorial.steps.length} steps · join to follow along live</Text>
          </SectionCard>
        )}

        {/* Room tabs */}
        {showRoom && (
          <>
            <View style={[s.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {TABS.map(item => {
                const on = tab === item.key;
                const badge = tabBadge[item.key];
                return (
                  <TouchableOpacity key={item.key} testID={`session-tab-${item.key}`} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    onPress={() => setTab(item.key)} style={[s.tab, on && { backgroundColor: colors.primary }]}>
                    <Icon name={item.icon} size={14} color={on ? colors.primaryForeground : colors.mutedForeground} />
                    <Text style={[s.tabText, { color: on ? colors.primaryForeground : colors.mutedForeground }]}>{item.label}</Text>
                    {!!badge && <View style={[s.badge, { backgroundColor: on ? colors.primaryForeground : colors.primary }]}><Text style={[s.badgeText, { color: on ? colors.primary : colors.primaryForeground }]}>{badge}</Text></View>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {engagementQuery.isLoading && tab !== 'people' ? (
              <View style={{ gap: 10 }}>{[0, 1].map(i => <View key={i} style={[s.skeleton, { backgroundColor: colors.card, borderColor: colors.border }]} />)}</View>
            ) : engagementQuery.isError && tab !== 'people' ? (
              <View style={[gs.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 8 }]}>
                <Text style={[gs.body, { color: colors.mutedForeground }]}>Session activities could not be loaded.</Text>
                <PillButton testID="engagement-retry" colors={colors} variant="secondary" icon="refresh-cw" label="Retry" onPress={refreshEngagement} />
              </View>
            ) : (
              <>
                {tab === 'activity' && (
                  <View>
                    {tutorial ? (
                      <SectionCard testID="session-tutorial" colors={colors} icon="book-open" eyebrow={isOwner ? 'YOUR TUTORIAL' : 'FOLLOW ALONG'} title={tutorial.title}
                        right={progressComplete && !isOwner ? <Icon name="check-circle" size={18} color={colors.tint} /> : undefined}>
                        <TutorialStepper steps={tutorial.steps} index={activeStep} colors={colors}
                          completed={isOwner ? 0 : session.tutorialProgress} onIndex={setActiveStep}
                          questionHint="Share your answer in the Campfire chat or the Q&A tab."
                          {...(!isOwner && session.isJoined && phase !== 'upcoming' ? {
                            onNext: advanceTutorial,
                            nextBusy: savingProgress,
                            nextDisabled: progressComplete && activeStep >= tutorial.steps.length - 1,
                            nextLabel: progressComplete ? (activeStep >= tutorial.steps.length - 1 ? 'All steps complete' : 'Next') : activeStep === tutorial.steps.length - 1 ? 'Finish tutorial' : 'Mark done and continue',
                          } : {})} />
                        {!isOwner && phase === 'upcoming' && <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 10 }]}>Preview freely. Step progress is saved once the session starts.</Text>}
                        <TouchableOpacity onPress={() => router.push(`/guide-tutorial/${tutorial.id}` as Href)} style={[gs.row, { marginTop: 12 }]}>
                          <Icon name="maximize-2" size={13} color={colors.primary} />
                          <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>Open in tutorial reader</Text>
                        </TouchableOpacity>
                      </SectionCard>
                    ) : (
                      <Notice colors={colors} icon="book-open" text={isOwner ? 'No tutorial is attached. Activities and the Campfire chat carry the session.' : 'This session has no tutorial. Follow the guide in the Campfire chat.'} />
                    )}
                    <ActivitiesPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />
                  </View>
                )}
                {tab === 'polls' && <PollsPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />}
                {tab === 'qa' && <QuestionsPanel sessionId={session.id} engagement={engagement} phase={phase} isOwner={isOwner} isJoined={session.isJoined} colors={colors} refresh={refreshEngagement} />}
                {tab === 'people' && (
                  <SectionCard testID="session-participants" colors={colors} icon="users" eyebrow="PARTICIPANTS" title={`${session.attendeeCount} of ${session.capacity} seats taken`}>
                    {!isOwner ? (
                      <View style={{ gap: 8 }}>
                        <View style={gs.row}>
                          <Initials name="G" colors={colors} />
                          <Text style={[gs.body, { flex: 1, color: colors.foreground }]}>Hosted by this guide</Text>
                          <PillButton colors={colors} variant="secondary" label="Profile" onPress={() => router.push(`/guide/${session.guideId}` as Href)} />
                        </View>
                        <Text style={[gs.meta, { color: colors.mutedForeground }]}>The full participant list is visible to the host. Say hello to everyone in the Campfire chat.</Text>
                      </View>
                    ) : participantsLoading ? (
                      <View style={{ gap: 8 }}>{[0, 1, 2].map(i => <View key={i} style={[s.skeletonRow, { backgroundColor: colors.background }]} />)}</View>
                    ) : participantsError ? (
                      <View style={{ gap: 8 }}>
                        <Text style={[gs.body, { color: colors.destructive }]}>{participantsError}</Text>
                        <PillButton colors={colors} variant="secondary" icon="refresh-cw" label="Retry" onPress={() => void loadParticipants(session.id)} />
                      </View>
                    ) : (participants ?? []).length === 0 ? (
                      <Text style={[gs.body, { color: colors.mutedForeground }]}>No one has joined yet. Share the session from your guide profile.</Text>
                    ) : (
                      <View>
                        {(participants ?? []).map(p => {
                          const name = p.name ?? p.username ?? 'Player';
                          return (
                            <View key={p.userId} style={[gs.row, s.personRow, { borderBottomColor: colors.border }]}>
                              {p.avatarUri ? <View style={s.avatar}><SecureImage source={{ uri: p.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" /></View> : <Initials name={name} colors={colors} />}
                              <View style={{ flex: 1 }}>
                                <Text style={[gs.label, { color: colors.foreground, marginBottom: 1 }]} numberOfLines={1}>{name}</Text>
                                <Text style={[gs.meta, { color: colors.mutedForeground }]}>
                                  {tutorial ? (p.tutorialCompletedAt ? 'Tutorial complete' : `${p.tutorialProgress}/${tutorial.steps.length} steps`) : `Joined ${new Date(p.joinedAt).toLocaleDateString()}`}
                                </Text>
                              </View>
                              {p.tutorialCompletedAt && <Icon name="check-circle" size={16} color={colors.tint} />}
                            </View>
                          );
                        })}
                        <TouchableOpacity onPress={() => void loadParticipants(session.id)} style={[gs.row, { marginTop: 10 }]}>
                          <Icon name="refresh-cw" size={12} color={colors.primary} /><Text style={[gs.meta, { color: colors.primary }]}>Refresh list</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </SectionCard>
                )}
              </>
            )}
          </>
        )}

        {!member && phase === 'ended' && <Notice colors={colors} icon="clock" text="This session has ended. Follow the guide to hear about the next one." />}
        {!member && phase === 'ended' && !isFollowing && userId !== session.guideId && (
          <PillButton testID="follow-guide" colors={colors} icon="user-plus" label="Follow this guide" onPress={() => followUser(session.guideId)} />
        )}

        {!isOwner && (
          <TouchableOpacity style={[gs.row, { justifyContent: 'center', marginTop: 16 }]} onPress={() => router.push(`/messages/${session.guideId}` as Href)}>
            <Icon name="mail" size={14} color={colors.primary} />
            <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>{t('social.messageGuide')}</Text>
          </TouchableOpacity>
        )}
        {session.isJoined && phase === 'upcoming' && <Text style={[gs.meta, { color: colors.mutedForeground, textAlign: 'center', marginTop: 10 }]}>{t('social.sessionReminder')}</Text>}
      </ScrollView>

      {/* Sticky action bar */}
      {phase !== 'cancelled' && (
        <View style={[s.actionBar, { paddingBottom: bottom + 10, backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {!member && phase !== 'ended' ? (
            <PillButton testID="session-join" colors={colors} flex icon="user-plus" busy={joining}
              disabled={session.attendeeCount >= session.capacity}
              label={session.attendeeCount >= session.capacity ? 'Session is full' : t('social.joinSession')} onPress={() => void join()} />
          ) : (
            <PillButton testID="session-chat" colors={colors} flex variant={isOwner && phase === 'live' ? 'secondary' : 'primary'} icon="message-circle"
              label={phase === 'live' ? 'Campfire chat' : phase === 'ended' ? 'Session chat' : 'Waiting room chat'}
              onPress={() => router.push(`/campfire/${session.roomId}` as Href)} />
          )}
          {isOwner && phase === 'live' && (
            <PillButton testID="session-end" colors={colors} flex variant="danger" icon="square" label="End session" busy={ending} onPress={confirmEnd} />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  heading: { flex: 1, fontFamily: 'Satoshi-Bold', fontSize: 17 },
  phasePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 },
  phaseText: { fontFamily: 'Satoshi-Bold', fontSize: 10, letterSpacing: 0.8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  hero: { height: 210, borderRadius: 24, overflow: 'hidden', marginBottom: 14, justifyContent: 'flex-end' },
  heroBody: { padding: 16 },
  heroTopic: { color: 'rgba(255,255,255,0.8)', fontFamily: 'Satoshi-Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 4 },
  heroTitle: { color: '#FBF8FF', fontFamily: 'Satoshi-Black', fontSize: 25, lineHeight: 30 },
  heroMeta: { color: 'rgba(255,255,255,0.88)', fontFamily: 'Satoshi-Medium', fontSize: 12, marginRight: 6 },
  waiting: { borderWidth: 1, borderRadius: 22, padding: 18, alignItems: 'center', marginBottom: 14 },
  countdownCaption: { fontFamily: 'Satoshi-Medium', fontSize: 12, marginTop: 8 },
  countdown: { fontFamily: 'Satoshi-Black', fontSize: 42, letterSpacing: 1, marginVertical: 2 },
  checklist: { alignSelf: 'stretch', gap: 9, marginTop: 12 },
  section: { fontFamily: 'Satoshi-Bold', fontSize: 16, marginTop: 6, marginBottom: 6 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 4, marginTop: 6, marginBottom: 12 },
  tab: { flex: 1, minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  badge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontFamily: 'Satoshi-Bold', fontSize: 9 },
  skeleton: { height: 120, borderRadius: 20, borderWidth: 1, opacity: 0.6 },
  skeletonRow: { height: 44, borderRadius: 12 },
  personRow: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
  stat: { flexGrow: 1, minWidth: 70, borderRadius: 14, padding: 10, alignItems: 'center' },
  statValue: { fontFamily: 'Satoshi-Black', fontSize: 20 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 80 },
  stateTitle: { fontFamily: 'Satoshi-Bold', fontSize: 18 },
});
