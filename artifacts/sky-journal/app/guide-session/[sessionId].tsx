import { BackButton } from '@/components/BackButton';
import { Icon } from '@/components/Icon';
import { SkyLoadingOverlay } from '@/components/SkyLoading';
import { apiFetch, useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SecureImage } from '@/components/SecureImage';
import { useAuth } from '@clerk/expo';
import { ResizeMode, Video } from 'expo-av';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  useAnswerGuideSessionQuestion,
  useAskGuideSessionQuestion,
  useCloseGuideSessionPoll,
  useCreateGuideSessionPoll,
  getGetGuideSessionEngagementQueryKey,
  useGetGuideSessionEngagement,
  useSaveGuideSessionRecap,
  useVoteGuideSessionPoll,
} from '@workspace/api-client-react';
import { TextInput } from 'react-native';

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

export default function GuideSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const { followingIds, followUser } = useApp();
  const [session, setSession] = useState<GuideSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [activeStep, setActiveStep] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);
  const [participants, setParticipants] = useState<GuideSessionParticipant[]>([]);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [questionDraft, setQuestionDraft] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [recapDraft, setRecapDraft] = useState('');
  const [recapHighlight, setRecapHighlight] = useState('');
  const engagementQuery = useGetGuideSessionEngagement(sessionId ?? '', {
    query: {
      queryKey: getGetGuideSessionEngagementQueryKey(sessionId ?? ''),
      enabled: !!session && (session.isJoined || userId === session.guideId),
      retry: false,
      refetchInterval: session?.status === 'scheduled'
        && new Date(session.startsAt).getTime() <= Date.now()
        && new Date(session.endsAt).getTime() > Date.now() ? 5000 : false,
      refetchIntervalInBackground: false,
    },
  });
  const refreshEngagement = () => void engagementQuery.refetch();
  const createPollMutation = useCreateGuideSessionPoll({ mutation: { onSuccess: refreshEngagement } });
  const votePollMutation = useVoteGuideSessionPoll({ mutation: { onSuccess: refreshEngagement } });
  const closePollMutation = useCloseGuideSessionPoll({ mutation: { onSuccess: refreshEngagement } });
  const askQuestionMutation = useAskGuideSessionQuestion({ mutation: { onSuccess: () => {
    setQuestionDraft('');
    refreshEngagement();
  } } });
  const answerQuestionMutation = useAnswerGuideSessionQuestion({ mutation: { onSuccess: refreshEngagement } });
  const saveRecapMutation = useSaveGuideSessionRecap({ mutation: { onSuccess: refreshEngagement } });
  const load = useCallback(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetch<GuideSession>(`/guide-sessions/${sessionId}`).then(value => {
      setSession(value);
      setActiveStep(Math.min(value.tutorialProgress ?? 0, Math.max((value.tutorial?.steps.length ?? 1) - 1, 0)));
    })
      .catch(() => Alert.alert(t('social.sessionUnavailable'), t('social.sessionUnavailableBody')))
      .finally(() => setLoading(false));
  }, [sessionId, t]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!session) return;
    const startsAt = new Date(session.startsAt).getTime();
    const endsAt = new Date(session.endsAt).getTime();
    const currentTime = Date.now();
    setNow(currentTime);
    if (session.status === 'completed' || !Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt <= currentTime) return;

    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= endsAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  async function join() {
    if (!session) return;
    try {
      const updated = await apiFetch<GuideSession>(`/guide-sessions/${session.id}/join`, { method: 'POST' });
      setSession(updated);
      setActiveStep(Math.min(updated.tutorialProgress ?? 0, Math.max((updated.tutorial?.steps.length ?? 1) - 1, 0)));
    } catch (error) {
      Alert.alert(t('social.joinError'), error instanceof Error ? error.message : t('social.tryAgain'));
    }
  }
  async function advanceTutorial() {
    if (!session?.tutorial || savingProgress) return;
    const stepCount = session.tutorial.steps.length;
    if (activeStep < stepCount) {
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
        Alert.alert('Progress not saved', error instanceof Error ? error.message : t('social.tryAgain'));
      } finally {
        setSavingProgress(false);
      }
    }
  }

  async function endSession() {
    if (!session) return;
    Alert.alert('End this session?', 'Participants will still be able to see the summary, but the live session will close.', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: 'End session', style: 'destructive', onPress: async () => {
        try {
          await apiFetch(`/guide-sessions/${session.id}/end`, { method: 'POST' });
          setSession(current => current ? { ...current, status: 'completed' } : current);
        } catch (error) {
          Alert.alert('Could not end session', error instanceof Error ? error.message : t('social.tryAgain'));
        }
      } },
    ]);
  }
  async function toggleParticipants() {
    if (participantsOpen) { setParticipantsOpen(false); return; }
    if (!session) return;
    setParticipantsOpen(true);
    setParticipantsLoading(true);
    try {
      setParticipants(await apiFetch<GuideSessionParticipant[]>(`/guide-sessions/${session.id}/participants`));
    } catch (error) {
      setParticipantsOpen(false);
      Alert.alert('Could not load participants', error instanceof Error ? error.message : t('social.tryAgain'));
    } finally {
      setParticipantsLoading(false);
    }
  }
  const top = Platform.OS === 'web' ? 67 : insets.top;
  if (loading || !session) return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}><BackButton /><SkyLoadingOverlay message={t('social.loadingSession')} /></View>;
  const start = new Date(session.startsAt);
  const started = now >= start.getTime();
  const ended = session.status === 'completed' || now >= new Date(session.endsAt).getTime();
  const isOwner = userId === session.guideId;
  const live = started && !ended && session.status === 'scheduled';
  const waitingRoomVisible = (session.isJoined || isOwner) && !started && !ended;
  const countdown = formatSessionCountdown(start.getTime() - now);
  const isFollowing = followingIds.includes(session.guideId);
  const activeTutorialStep = session.tutorial?.steps[activeStep];
  const progressComplete = !!session.tutorial && session.tutorialProgress >= session.tutorial.steps.length;
  const pollOptionsHaveDuplicates = new Set(pollOptions.map(option => option.trim().toLocaleLowerCase()).filter(Boolean)).size !== pollOptions.filter(option => option.trim()).length;
  const engagement = engagementQuery.data;
  return <View style={[s.root, { backgroundColor: colors.background, paddingTop: top }]}>
    <View style={s.header}><BackButton /><Text style={[s.heading, { color: colors.foreground }]}>{t('social.guideSession')}</Text></View>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
      {session.coverImageUri && (
        <View style={[s.cover, { backgroundColor: colors.muted }]}>
          <Image source={{ uri: session.coverImageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={s.coverShade} />
          <View style={s.coverPill}><Icon name={live ? 'radio' : 'calendar'} size={12} color="#fff" /><Text style={s.coverPillText}>{live ? 'LIVE SESSION' : 'UPCOMING SESSION'}</Text></View>
        </View>
      )}
      {session.topic && <Text style={[s.topic, { color: colors.primary }]}>{session.topic}</Text>}
      <Text style={[s.title, { color: colors.foreground }]}>{session.title}</Text>
      <View style={[s.timeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="clock" size={18} color={colors.primary} />
        <View><Text style={[s.time, { color: colors.foreground }]}>{start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          <Text style={[s.meta, { color: colors.mutedForeground }]}>{session.attendeeCount} of {session.capacity} joined</Text></View>
      </View>
      {waitingRoomVisible && (
        <View style={[s.waitingRoom, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.waitingRoomHeading}>
            <View style={[s.waitingRoomIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Icon name="clock" size={17} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.waitingRoomEyebrow, { color: colors.primary }]}>WAITING ROOM</Text>
              <Text style={[s.waitingRoomTitle, { color: colors.foreground }]}>
                {isOwner ? 'Your session is getting ready' : 'You’re all set'}
              </Text>
            </View>
            <View style={[s.waitingRoomReady, { backgroundColor: `${colors.tint}18` }]}>
              <View style={[s.waitingRoomDot, { backgroundColor: colors.tint }]} />
              <Text style={[s.waitingRoomReadyText, { color: colors.tint }]}>READY</Text>
            </View>
          </View>
          <View style={[s.countdownPanel, { backgroundColor: colors.background }]}>
            <Text style={[s.countdownCaption, { color: colors.mutedForeground }]}>SESSION STARTS IN</Text>
            <Text style={[s.countdownValue, { color: colors.foreground }]}>{countdown}</Text>
          </View>
          <View style={s.waitingRoomMeta}>
            <Icon name="users" size={14} color={colors.primary} />
            <Text style={[s.waitingRoomMetaText, { color: colors.mutedForeground }]}>
              {session.attendeeCount} {session.attendeeCount === 1 ? 'participant' : 'participants'} joined
            </Text>
            {session.tutorial && (
              <>
                <View style={[s.waitingRoomSeparator, { backgroundColor: colors.border }]} />
                <Icon name="book-open" size={14} color={colors.primary} />
                <Text style={[s.waitingRoomMetaText, { color: colors.mutedForeground }]}>Tutorial ready</Text>
              </>
            )}
          </View>
          <Text style={[s.waitingRoomCopy, { color: colors.mutedForeground }]}>
            The shared room is open while you wait. Live polls and questions appear when the session starts.
          </Text>
        </View>
      )}
      <Text style={[s.section, { color: colors.foreground }]}>{t('social.sessionAbout')}</Text>
      <Text style={[s.body, { color: colors.mutedForeground }]}>{session.description}</Text>
      {session.tutorial && (
        <View style={[s.tutorialCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.tutorialHeader}>
            <View style={[s.tutorialIcon, { backgroundColor: `${colors.primary}14` }]}><Icon name="book-open" size={17} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[s.tutorialEyebrow, { color: colors.primary }]}>{session.isJoined ? 'YOUR SESSION GUIDE' : 'SESSION TUTORIAL'}</Text>
              <Text style={[s.tutorialTitle, { color: colors.foreground }]}>{session.tutorial.title}</Text>
            </View>
            <Text style={[s.tutorialCount, { color: colors.mutedForeground }]}>{session.tutorial.steps.length} steps</Text>
          </View>
          <Text style={[s.tutorialDescription, { color: colors.mutedForeground }]}>{session.tutorial.description}</Text>
          {session.isJoined && activeTutorialStep ? (
            <View style={[s.activeStep, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={s.activeStepTop}>
                <Text style={[s.stepNumber, { color: colors.primary }]}>STEP {String(activeStep + 1).padStart(2, '0')}</Text>
                {progressComplete && <View style={[s.completePill, { backgroundColor: `${colors.tint}18` }]}><Icon name="check" size={11} color={colors.tint} /><Text style={[s.completeText, { color: colors.tint }]}>COMPLETE</Text></View>}
              </View>
              <Text style={[s.activeStepTitle, { color: colors.foreground }]}>{activeTutorialStep.title}</Text>
              {!!activeTutorialStep.body && <Text style={[s.activeStepBody, { color: colors.mutedForeground }]}>{activeTutorialStep.body}</Text>}
              {activeTutorialStep.mediaUri && activeTutorialStep.type === 'image' && (
                <View style={s.stepMedia}>
                  <SecureImage source={{ uri: activeTutorialStep.mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
              )}
              {activeTutorialStep.mediaUri && activeTutorialStep.type === 'video' && (
                <Video source={{ uri: activeTutorialStep.mediaUri }} style={s.stepMedia}
                  useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false} isLooping />
              )}
              {activeTutorialStep.type === 'question' && (
                <View style={[s.questionPrompt, { backgroundColor: `${colors.primary}0D` }]}>
                  <Icon name="message-circle" size={13} color={colors.primary} />
                  <Text style={[s.questionText, { color: colors.primary }]}>Share your answer in the live group chat.</Text>
                </View>
              )}
              <View style={s.stepFooter}>
                <View style={s.progressTrack}>
                  {session.tutorial.steps.map((step, index) => (
                    <View key={step.id} style={[s.progressSegment, { backgroundColor: index < session.tutorialProgress ? colors.primary : index === activeStep ? `${colors.primary}66` : colors.border }]} />
                  ))}
                </View>
                {activeStep > 0 && (
                  <TouchableOpacity onPress={() => setActiveStep(step => Math.max(0, step - 1))} style={[s.stepNav, { borderColor: colors.border }]}>
                    <Icon name="chevron-left" size={15} color={colors.foreground} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity disabled={progressComplete || savingProgress} onPress={advanceTutorial}
                  style={[s.stepContinue, { backgroundColor: progressComplete ? `${colors.tint}20` : colors.primary, opacity: savingProgress ? 0.65 : 1 }]}>
                  <Text style={[s.stepContinueText, { color: progressComplete ? colors.tint : colors.primaryForeground }]}>
                    {progressComplete ? 'All steps complete' : savingProgress ? 'Saving…' : activeStep === session.tutorial.steps.length - 1 ? 'Finish tutorial' : 'Next step'}
                  </Text>
                  <Icon name={progressComplete ? 'check' : 'arrow-right'} size={14} color={progressComplete ? colors.tint : colors.primaryForeground} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[s.tutorialPreview, { backgroundColor: colors.background }]}>
              <Icon name="list" size={14} color={colors.primary} />
              <Text style={[s.tutorialPreviewText, { color: colors.mutedForeground }]}>
                {session.tutorial.steps.map((step, index) => `${index + 1}. ${step.title}`).slice(0, 3).join('   ·   ')}
              </Text>
            </View>
          )}
        </View>
      )}
      {(session.isJoined || isOwner) && (
        <View style={[s.engagementCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.engagementHeading}>
            <View style={{ flex: 1 }}>
              <Text style={[s.engagementTitle, { color: colors.foreground }]}>Live session</Text>
              <Text style={[s.engagementSubTitle, { color: colors.mutedForeground }]}>Polls and questions for everyone here</Text>
            </View>
            {live && <View style={[s.liveBadge, { backgroundColor: `${colors.tint}20` }]}><View style={[s.liveDot, { backgroundColor: colors.tint }]} /><Text style={[s.liveBadgeText, { color: colors.tint }]}>LIVE</Text></View>}
          </View>
          {engagementQuery.isLoading ? (
            <Text style={[s.engagementEmpty, { color: colors.mutedForeground }]}>Loading session activities…</Text>
          ) : engagementQuery.isError ? (
            <TouchableOpacity onPress={refreshEngagement} style={[s.engagementEmptyCard, { backgroundColor: colors.background }]}>
              <Text style={[s.engagementEmpty, { color: colors.mutedForeground }]}>Couldn’t load activities. Tap to try again.</Text>
            </TouchableOpacity>
          ) : (
            <>
              {live && isOwner && (
                <View style={[s.engagementForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.formLabel, { color: colors.foreground }]}>Ask a quick poll</Text>
                  <TextInput
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    placeholder="What should we talk about?"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.engagementInput, { color: colors.foreground, borderColor: colors.border }]}
                    maxLength={180}
                  />
                  {pollOptions.map((option, index) => (
                    <TextInput
                      key={`poll-option-${index}`}
                      value={option}
                      onChangeText={value => setPollOptions(current => current.map((item, itemIndex) => itemIndex === index ? value : item))}
                      placeholder={`Choice ${index + 1}`}
                      placeholderTextColor={colors.mutedForeground}
                      style={[s.engagementInput, { color: colors.foreground, borderColor: colors.border }]}
                      maxLength={80}
                    />
                  ))}
                  <View style={s.formActions}>
                    {pollOptions.length < 6 && (
                      <TouchableOpacity onPress={() => setPollOptions(current => [...current, ''])} style={[s.smallSecondary, { borderColor: colors.border }]}>
                        <Text style={[s.smallSecondaryText, { color: colors.primary }]}>+ Add choice</Text>
                      </TouchableOpacity>
                    )}
                    {pollOptions.length > 2 && (
                      <TouchableOpacity onPress={() => setPollOptions(current => current.slice(0, -1))} style={[s.smallSecondary, { borderColor: colors.border }]}>
                        <Text style={[s.smallSecondaryText, { color: colors.mutedForeground }]}>Remove last</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      disabled={createPollMutation.isPending || pollQuestion.trim().length < 5 || pollOptions.some(option => !option.trim()) || pollOptionsHaveDuplicates}
                      onPress={() => createPollMutation.mutate({
                        sessionId: session.id,
                        data: { question: pollQuestion.trim(), options: pollOptions.map(option => option.trim()) },
                      }, { onSuccess: () => { setPollQuestion(''); setPollOptions(['', '']); }, onError: error => Alert.alert('Could not create poll', error.message) })}
                      style={[s.formSubmit, { backgroundColor: colors.primary, opacity: createPollMutation.isPending ? 0.6 : 1 }]}
                    >
                      <Text style={[s.formSubmitText, { color: colors.primaryForeground }]}>{createPollMutation.isPending ? 'Creating…' : 'Create poll'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {(engagement?.polls.length ?? 0) > 0 && (
                <View style={s.engagementSection}>
                  <Text style={[s.formLabel, { color: colors.foreground }]}>Session polls</Text>
                  {engagement?.polls.map(poll => {
                    const totalVotes = poll.voteCounts.reduce((sum, value) => sum + value, 0);
                    const isPollOpen = live && !poll.closedAt;
                    return (
                      <View key={poll.id} style={[s.pollCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <View style={s.pollTitleRow}>
                          <Text style={[s.pollQuestion, { color: colors.foreground }]}>{poll.question}</Text>
                          {isOwner && !poll.closedAt && (
                            <TouchableOpacity onPress={() => closePollMutation.mutate({ sessionId: session.id, pollId: poll.id }, { onError: error => Alert.alert('Could not close poll', error.message) })}>
                              <Text style={[s.smallSecondaryText, { color: colors.primary }]}>Close</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {poll.options.map((option, index) => {
                          const count = poll.voteCounts[index] ?? 0;
                          const percent = totalVotes ? Math.round(count / totalVotes * 100) : 0;
                          return (
                            <TouchableOpacity
                              key={`${poll.id}-${index}`}
                              disabled={!isPollOpen || votePollMutation.isPending}
                              onPress={() => votePollMutation.mutate({ sessionId: session.id, pollId: poll.id, data: { optionIndex: index } }, { onError: error => Alert.alert('Could not save vote', error.message) })}
                              style={[s.pollOption, { backgroundColor: poll.myVote === index ? `${colors.primary}18` : colors.card, borderColor: poll.myVote === index ? colors.primary : colors.border }]}
                            >
                              <View style={[s.pollBar, { width: `${percent}%`, backgroundColor: `${colors.primary}20` }]} />
                              <Text style={[s.pollOptionText, { color: colors.foreground }]}>{option}</Text>
                              <Text style={[s.pollCount, { color: colors.mutedForeground }]}>{count}{totalVotes ? ` · ${percent}%` : ''}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        <Text style={[s.pollFootnote, { color: colors.mutedForeground }]}>
                          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}{poll.closedAt ? ' · Closed' : poll.myVote !== null ? ' · Your vote is in' : isPollOpen ? ' · Tap an option to vote' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              {live && session.isJoined && !isOwner && (
                <View style={[s.engagementForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[s.formLabel, { color: colors.foreground }]}>Ask the guide</Text>
                  <TextInput
                    value={questionDraft}
                    onChangeText={setQuestionDraft}
                    placeholder="What would you like to ask?"
                    placeholderTextColor={colors.mutedForeground}
                    style={[s.engagementInput, s.multilineInput, { color: colors.foreground, borderColor: colors.border }]}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    disabled={askQuestionMutation.isPending || questionDraft.trim().length < 4}
                    onPress={() => askQuestionMutation.mutate({ sessionId: session.id, data: { question: questionDraft.trim() } }, { onError: error => Alert.alert('Could not send question', error.message) })}
                    style={[s.formSubmit, { backgroundColor: colors.primary, opacity: askQuestionMutation.isPending ? 0.6 : 1 }]}
                  >
                    <Text style={[s.formSubmitText, { color: colors.primaryForeground }]}>{askQuestionMutation.isPending ? 'Sending…' : 'Send question'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {(engagement?.questions.length ?? 0) > 0 && (
                <View style={s.engagementSection}>
                  <Text style={[s.formLabel, { color: colors.foreground }]}>Questions · {engagement?.questions.length}</Text>
                  {engagement?.questions.map(question => (
                    <View key={question.id} style={[s.questionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[s.questionByline, { color: colors.primary }]}>{question.askerName}</Text>
                      <Text style={[s.questionContent, { color: colors.foreground }]}>{question.question}</Text>
                      {question.answer ? (
                        <View style={[s.answerCard, { backgroundColor: `${colors.tint}12` }]}>
                          <Text style={[s.questionByline, { color: colors.tint }]}>Guide answer</Text>
                          <Text style={[s.questionContent, { color: colors.foreground }]}>{question.answer}</Text>
                        </View>
                          ) : isOwner ? (
                        <View style={s.answerComposer}>
                          <TextInput
                            value={answerDrafts[question.id] ?? ''}
                            onChangeText={value => setAnswerDrafts(current => ({ ...current, [question.id]: value }))}
                            placeholder="Write a helpful answer…"
                            placeholderTextColor={colors.mutedForeground}
                            style={[s.engagementInput, s.multilineInput, { color: colors.foreground, borderColor: colors.border }]}
                            multiline
                            maxLength={1000}
                          />
                          <TouchableOpacity
                            disabled={answerQuestionMutation.isPending || (answerDrafts[question.id] ?? '').trim().length < 2}
                            onPress={() => answerQuestionMutation.mutate({ sessionId: session.id, questionId: question.id, data: { answer: (answerDrafts[question.id] ?? '').trim() } }, { onError: error => Alert.alert('Could not save answer', error.message) })}
                            style={[s.smallSubmit, { backgroundColor: colors.primary }]}
                          >
                            <Text style={[s.smallSubmitText, { color: colors.primaryForeground }]}>Answer</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[s.pollFootnote, { color: colors.mutedForeground }]}>Waiting for the guide’s answer</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
              {ended && (
                <View style={s.engagementSection}>
                  <Text style={[s.formLabel, { color: colors.foreground }]}>Session recap</Text>
                  {engagement?.recap ? (
                    <View style={[s.recapCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[s.questionContent, { color: colors.foreground }]}>{engagement.recap.summary}</Text>
                      {engagement.recap.highlights.map((highlight, index) => (
                        <View key={`${index}-${highlight}`} style={s.recapHighlight}>
                          <Icon name="sparkles" size={13} color={colors.primary} />
                          <Text style={[s.recapHighlightText, { color: colors.mutedForeground }]}>{highlight}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[s.engagementEmpty, { color: colors.mutedForeground }]}>The guide hasn’t shared a recap yet.</Text>
                  )}
                  {isOwner && (
                    <View style={[s.engagementForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <Text style={[s.formLabel, { color: colors.foreground }]}>{engagement?.recap ? 'Update the recap' : 'Share what everyone learned'}</Text>
                      <TextInput
                        value={recapDraft}
                        onChangeText={setRecapDraft}
                        placeholder={engagement?.recap?.summary ?? 'Write a short session summary…'}
                        placeholderTextColor={colors.mutedForeground}
                        style={[s.engagementInput, s.multilineInput, { color: colors.foreground, borderColor: colors.border }]}
                        multiline
                        maxLength={1200}
                      />
                      <TextInput
                        value={recapHighlight}
                        onChangeText={setRecapHighlight}
                        placeholder={engagement?.recap?.highlights.join('\n') ?? 'Highlights (one per line, up to 6)'}
                        placeholderTextColor={colors.mutedForeground}
                        style={[s.engagementInput, s.multilineInput, { color: colors.foreground, borderColor: colors.border }]}
                        multiline
                        maxLength={850}
                      />
                      <TouchableOpacity
                        disabled={saveRecapMutation.isPending || recapDraft.trim().length < 20}
                        onPress={() => saveRecapMutation.mutate({
                          sessionId: session.id,
                          data: { summary: recapDraft.trim(), highlights: recapHighlight.split('\n').map(value => value.trim()).filter(Boolean).slice(0, 6) },
                        }, { onSuccess: () => { setRecapDraft(''); setRecapHighlight(''); }, onError: error => Alert.alert('Could not publish recap', error.message) })}
                        style={[s.formSubmit, { backgroundColor: colors.primary, opacity: saveRecapMutation.isPending ? 0.6 : 1 }]}
                      >
                        <Text style={[s.formSubmitText, { color: colors.primaryForeground }]}>{saveRecapMutation.isPending ? 'Saving…' : engagement?.recap ? 'Update recap' : 'Publish recap'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              {live && isOwner && (engagement?.polls.length ?? 0) === 0 && (engagement?.questions.length ?? 0) === 0 && (
                <Text style={[s.engagementEmpty, { color: colors.mutedForeground }]}>Create a poll or invite questions to get everyone involved.</Text>
              )}
            </>
          )}
        </View>
      )}
      {!session.isJoined && !isOwner && !ended ? (
        <TouchableOpacity style={[s.primary, { backgroundColor: colors.primary }]} onPress={join}>
          <Icon name="user-plus" size={17} color={colors.primaryForeground} />
          <Text style={[s.primaryText, { color: colors.primaryForeground }]}>{t('social.joinSession')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[s.primary, { backgroundColor: colors.primary }]} onPress={() => router.push(`/campfire/${session.roomId}`)}>
          <Icon name="message-circle" size={17} color={colors.primaryForeground} />
          <Text style={[s.primaryText, { color: colors.primaryForeground }]}>{live ? 'Enter live group chat' : ended ? 'Open session chat' : 'Open waiting room'}</Text>
        </TouchableOpacity>
      )}
      {!session.isJoined && ended && (
        <View style={[s.endedNotice, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="clock" size={15} color={colors.mutedForeground} />
          <Text style={[s.endedText, { color: colors.mutedForeground }]}>This session has ended.</Text>
        </View>
      )}
      {ended && userId !== session.guideId && !isFollowing && (
        <TouchableOpacity style={[s.secondary, { borderColor: colors.border }]} onPress={() => followUser(session.guideId)}>
          <Icon name="user-plus" size={16} color={colors.primary} />
          <Text style={[s.secondaryText, { color: colors.primary }]}>Follow this guide</Text>
        </TouchableOpacity>
      )}
      {isOwner && (
        <View style={{ marginTop: 10 }}>
          <TouchableOpacity style={[s.secondary, { borderColor: colors.border, marginTop: 0 }]} onPress={() => void toggleParticipants()}>
            <Icon name="users" size={16} color={colors.primary} />
            <Text style={[s.secondaryText, { color: colors.primary }]}>Participants · {session.attendeeCount}</Text>
            <Icon name={participantsOpen ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
          </TouchableOpacity>
          {participantsOpen && (
            <View style={[s.participantsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {participantsLoading ? <Text style={[s.participantHint, { color: colors.mutedForeground }]}>Loading participants…</Text>
                : participants.length === 0 ? <Text style={[s.participantHint, { color: colors.mutedForeground }]}>No participants yet.</Text>
                  : participants.map(participant => (
                    <View key={participant.userId} style={[s.participantRow, { borderBottomColor: colors.border }]}>
                      <View style={[s.participantAvatar, { backgroundColor: `${colors.primary}15` }]}>
                        {participant.avatarUri
                          ? <Image source={{ uri: participant.avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                          : <Icon name="user" size={13} color={colors.primary} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.participantName, { color: colors.foreground }]} numberOfLines={1}>{participant.name ?? participant.username ?? 'Player'}</Text>
                        <Text style={[s.participantHint, { color: colors.mutedForeground }]}>{participant.tutorialCompletedAt ? 'Tutorial complete' : `${participant.tutorialProgress} steps complete`}</Text>
                      </View>
                      {participant.tutorialCompletedAt && <Icon name="check-circle" size={16} color={colors.tint} />}
                    </View>
                  ))}
            </View>
          )}
        </View>
      )}
      {isOwner && live && (
        <TouchableOpacity style={[s.secondary, { borderColor: colors.border }]} onPress={endSession}>
          <Icon name="square" size={16} color={colors.destructive ?? colors.primary} /><Text style={[s.secondaryText, { color: colors.destructive ?? colors.primary }]}>End session</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.secondary, { borderColor: colors.border }]} onPress={() => router.push(`/messages/${session.guideId}`)}>
        <Icon name="message-circle" size={17} color={colors.primary} /><Text style={[s.secondaryText, { color: colors.primary }]}>{t('social.messageGuide')}</Text>
      </TouchableOpacity>
      {session.isJoined && !live && session.status === 'scheduled' && <Text style={[s.note, { color: colors.mutedForeground }]}>{t('social.sessionReminder')}</Text>}
    </ScrollView>
  </View>;
}
function formatSessionCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', gap: 14, alignItems: 'center', padding: 18 },
  heading: { fontFamily: 'Satoshi-Bold', fontSize: 18 }, topic: { fontFamily: 'Satoshi-Bold', fontSize: 13, marginBottom: 8 },
  title: { fontFamily: 'Satoshi-Black', fontSize: 30, lineHeight: 36, marginBottom: 20 },
  timeCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
  time: { fontFamily: 'Satoshi-Bold', fontSize: 15 }, meta: { fontFamily: 'Satoshi-Regular', fontSize: 12, marginTop: 3 },
  waitingRoom: { borderWidth: 1, borderRadius: 17, padding: 13, marginTop: 12 },
  waitingRoomHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  waitingRoomIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  waitingRoomEyebrow: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 1 },
  waitingRoomTitle: { fontFamily: 'Satoshi-Bold', fontSize: 14, marginTop: 2 },
  waitingRoomReady: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  waitingRoomDot: { width: 6, height: 6, borderRadius: 3 },
  waitingRoomReadyText: { fontFamily: 'Satoshi-Bold', fontSize: 8, letterSpacing: 0.5 },
  countdownPanel: { alignItems: 'center', borderRadius: 13, paddingVertical: 11, marginTop: 12 },
  countdownCaption: { fontFamily: 'Satoshi-Bold', fontSize: 8, letterSpacing: 1 },
  countdownValue: { fontFamily: 'Satoshi-Black', fontSize: 28, fontVariant: ['tabular-nums'], marginTop: 2 },
  waitingRoomMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  waitingRoomMetaText: { fontFamily: 'Satoshi-Medium', fontSize: 10 },
  waitingRoomSeparator: { width: 1, height: 13, marginHorizontal: 3 },
  waitingRoomCopy: { fontFamily: 'Satoshi-Regular', fontSize: 11, lineHeight: 16, marginTop: 8 },
  cover: { height: 180, borderRadius: 19, overflow: 'hidden', marginBottom: 19 },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,16,35,0.22)' },
  coverPill: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(22,17,36,0.76)' },
  coverPillText: { fontFamily: 'Satoshi-Bold', fontSize: 9, color: '#fff', letterSpacing: 0.8 },
  section: { fontFamily: 'Satoshi-Bold', fontSize: 16, marginTop: 24, marginBottom: 8 },
  body: { fontFamily: 'Satoshi-Regular', fontSize: 15, lineHeight: 23 },
  primary: { marginTop: 28, padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontFamily: 'Satoshi-Bold', fontSize: 15 },
  secondary: { marginTop: 10, padding: 15, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  secondaryText: { fontFamily: 'Satoshi-Bold', fontSize: 15 }, note: { fontFamily: 'Satoshi-Regular', fontSize: 12, textAlign: 'center', marginTop: 12 },
  tutorialCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 20 },
  tutorialHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tutorialIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tutorialEyebrow: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.8, marginBottom: 3 },
  tutorialTitle: { fontFamily: 'Satoshi-Bold', fontSize: 15 },
  tutorialCount: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  tutorialDescription: { fontFamily: 'Satoshi-Regular', fontSize: 12, lineHeight: 18, marginTop: 10 },
  tutorialPreview: { minHeight: 42, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginTop: 11 },
  tutorialPreviewText: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 10, lineHeight: 15 },
  activeStep: { borderWidth: 1, borderRadius: 14, marginTop: 12, padding: 12 },
  activeStepTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepNumber: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.8 },
  completePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 4 },
  completeText: { fontFamily: 'Satoshi-Bold', fontSize: 8, letterSpacing: 0.5 },
  activeStepTitle: { fontFamily: 'Satoshi-Bold', fontSize: 16, marginTop: 7 },
  activeStepBody: { fontFamily: 'Satoshi-Regular', fontSize: 13, lineHeight: 19, marginTop: 5 },
  stepMedia: { height: 158, borderRadius: 11, overflow: 'hidden', marginTop: 10 },
  questionPrompt: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, padding: 9, marginTop: 10 },
  questionText: { fontFamily: 'Satoshi-Medium', fontSize: 11 },
  stepFooter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 4 },
  progressSegment: { height: 4, flex: 1, borderRadius: 3 },
  stepNav: { width: 32, height: 32, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepContinue: { minHeight: 36, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11 },
  stepContinueText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  endedNotice: { minHeight: 43, marginTop: 10, borderRadius: 13, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  endedText: { fontFamily: 'Satoshi-Medium', fontSize: 12 },
  participantsCard: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 11, marginTop: 8 },
  participantRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  participantAvatar: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  participantName: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  participantHint: { fontFamily: 'Satoshi-Regular', fontSize: 10, paddingVertical: 9 },
  engagementCard: { marginTop: 20, borderWidth: 1, borderRadius: 18, padding: 14 },
  engagementHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  engagementTitle: { fontFamily: 'Satoshi-Bold', fontSize: 17 },
  engagementSubTitle: { fontFamily: 'Satoshi-Regular', fontSize: 11, marginTop: 2 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontFamily: 'Satoshi-Bold', fontSize: 9, letterSpacing: 0.6 },
  engagementSection: { marginTop: 15 },
  engagementForm: { marginTop: 11, borderWidth: 1, borderRadius: 13, padding: 11, gap: 8 },
  formLabel: { fontFamily: 'Satoshi-Bold', fontSize: 12 },
  engagementInput: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, fontFamily: 'Satoshi-Regular', fontSize: 12 },
  multilineInput: { minHeight: 72, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
  smallSecondary: { minHeight: 32, borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  smallSecondaryText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  formSubmit: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11, marginLeft: 'auto' },
  formSubmitText: { fontFamily: 'Satoshi-Bold', fontSize: 11 },
  pollCard: { borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 8, overflow: 'hidden' },
  pollTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  pollQuestion: { flex: 1, fontFamily: 'Satoshi-Bold', fontSize: 13 },
  pollOption: { minHeight: 37, borderWidth: 1, borderRadius: 10, marginTop: 6, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
  pollBar: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  pollOptionText: { flex: 1, fontFamily: 'Satoshi-Medium', fontSize: 11 },
  pollCount: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  pollFootnote: { fontFamily: 'Satoshi-Regular', fontSize: 10, marginTop: 7 },
  engagementEmptyCard: { borderRadius: 12, padding: 10 },
  engagementEmpty: { fontFamily: 'Satoshi-Regular', fontSize: 11, lineHeight: 16, paddingVertical: 6 },
  questionCard: { borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 8 },
  questionByline: { fontFamily: 'Satoshi-Bold', fontSize: 10, marginBottom: 4 },
  questionContent: { fontFamily: 'Satoshi-Medium', fontSize: 12, lineHeight: 18 },
  answerCard: { borderRadius: 10, padding: 9, marginTop: 9 },
  answerComposer: { marginTop: 8, gap: 7 },
  smallSubmit: { alignSelf: 'flex-end', minHeight: 32, borderRadius: 9, justifyContent: 'center', paddingHorizontal: 12 },
  smallSubmitText: { fontFamily: 'Satoshi-Bold', fontSize: 10 },
  recapCard: { borderWidth: 1, borderRadius: 13, padding: 11, marginTop: 8 },
  recapHighlight: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
  recapHighlightText: { flex: 1, fontFamily: 'Satoshi-Regular', fontSize: 11, lineHeight: 16 },
});