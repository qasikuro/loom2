import { Icon } from '@/components/Icon';
import {
  useAnswerGuideSessionQuestion,
  useAskGuideSessionQuestion,
  useCloseGuideSessionActivity,
  useCloseGuideSessionPoll,
  useCreateGuideSessionActivity,
  useCreateGuideSessionPoll,
  useRespondToGuideSessionActivity,
  useSaveGuideSessionRecap,
  useVoteGuideSessionPoll,
  useVoteGuideSessionQuestion,
  type GuideSessionEngagement,
} from '@workspace/api-client-react';
import React, { useState } from 'react';
import { Alert, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, Notice, PillButton, SectionCard, SessionPhase, errorMessage, gs } from './shared';

interface PanelProps {
  sessionId: string; engagement: GuideSessionEngagement | undefined; phase: SessionPhase;
  isOwner: boolean; isJoined: boolean; colors: Colors; refresh: () => void;
}

/* ---------------- Polls ---------------- */
export function PollsPanel({ sessionId, engagement, phase, isOwner, isJoined, colors, refresh }: PanelProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const create = useCreateGuideSessionPoll({ mutation: { onSuccess: refresh } });
  const vote = useVoteGuideSessionPoll({ mutation: { onSuccess: refresh } });
  const close = useCloseGuideSessionPoll({ mutation: { onSuccess: refresh } });
  const live = phase === 'live';
  const canPrepare = isOwner && (phase === 'upcoming' || phase === 'live');
  const filled = options.map(o => o.trim());
  const dup = new Set(filled.filter(Boolean).map(o => o.toLocaleLowerCase())).size !== filled.filter(Boolean).length;
  const valid = question.trim().length >= 5 && filled.every(Boolean) && !dup;
  const polls = engagement?.polls ?? [];

  return (
    <View>
      {canPrepare && (
        <SectionCard colors={colors} icon="bar-chart-2" eyebrow={live ? 'LAUNCH NOW' : 'PREPARE AHEAD'} title={live ? 'Ask the room a quick poll' : 'Prepare a poll for this session'}>
          {!live && <Notice colors={colors} icon="info" tone="primary" text="Prepared polls are visible to joined participants. Voting opens automatically when the session starts." />}
          <TextInput testID="poll-question-input" value={question} onChangeText={setQuestion} maxLength={180}
            placeholder="Where do you usually find new outfits?" placeholderTextColor={colors.mutedForeground}
            style={[gs.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          {options.map((option, index) => (
            <View key={`opt-${index}`} style={gs.row}>
              <TextInput value={option} maxLength={80} placeholder={`Choice ${index + 1}`} placeholderTextColor={colors.mutedForeground}
                onChangeText={v => setOptions(cur => cur.map((o, i) => i === index ? v : o))}
                style={[gs.input, { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              {options.length > 2 && (
                <TouchableOpacity accessibilityLabel={`Remove choice ${index + 1}`} onPress={() => setOptions(cur => cur.filter((_, i) => i !== index))} style={{ padding: 8, marginBottom: 8 }}>
                  <Icon name="x" size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {dup && <Text style={[gs.meta, { color: colors.destructive, marginBottom: 8 }]}>Each choice needs to be different.</Text>}
          <View style={gs.row}>
            {options.length < 6 && <PillButton colors={colors} variant="secondary" icon="plus" label="Choice" onPress={() => setOptions(cur => [...cur, ''])} />}
            <PillButton testID="poll-create" colors={colors} flex icon="send" label={live ? 'Launch poll' : 'Save poll'} busy={create.isPending} disabled={!valid}
              onPress={() => create.mutate({ sessionId, data: { question: question.trim(), options: filled } }, {
                onSuccess: () => { setQuestion(''); setOptions(['', '']); },
                onError: e => Alert.alert('Could not create poll', errorMessage(e)),
              })} />
          </View>
        </SectionCard>
      )}
      {polls.length === 0 ? (
        <Notice colors={colors} icon="bar-chart-2" text={isOwner ? 'No polls yet. Prepare one above so the room has something to react to.' : phase === 'live' ? 'The guide has not opened a poll yet. It will appear here.' : 'Polls from the guide appear here. You can vote once the session is live.'} />
      ) : polls.map(poll => {
        const total = poll.voteCounts.reduce((a, b) => a + b, 0);
        const open = live && !poll.closedAt;
        const canVote = open && isJoined && !isOwner;
        return (
          <View key={poll.id} testID={`poll-${poll.id}`} style={[gs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[gs.row, { marginBottom: 8 }]}>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: open ? `${colors.tint}1C` : `${colors.mutedForeground}16` }}>
                <Text style={[gs.eyebrow, { color: open ? colors.tint : colors.mutedForeground }]}>{poll.closedAt ? 'CLOSED' : open ? 'LIVE POLL' : 'OPENS AT START'}</Text>
              </View>
              <View style={{ flex: 1 }} />
              {isOwner && !poll.closedAt && (
                <TouchableOpacity testID={`poll-close-${poll.id}`} disabled={close.isPending}
                  onPress={() => close.mutate({ sessionId, pollId: poll.id }, { onError: e => Alert.alert('Could not close poll', errorMessage(e)) })}>
                  <Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>Close poll</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[gs.cardTitle, { color: colors.foreground, marginBottom: 10 }]}>{poll.question}</Text>
            {poll.options.map((option, index) => {
              const count = poll.voteCounts[index] ?? 0;
              const pct = total ? Math.round(count / total * 100) : 0;
              const mine = poll.myVote === index;
              return (
                <TouchableOpacity key={`${poll.id}-${index}`} testID={`poll-vote-${poll.id}-${index}`} disabled={!canVote || vote.isPending}
                  onPress={() => vote.mutate({ sessionId, pollId: poll.id, data: { optionIndex: index } }, { onError: e => Alert.alert('Could not save vote', errorMessage(e)) })}
                  style={{ minHeight: 44, borderWidth: 1, borderRadius: 12, marginBottom: 7, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 12,
                    borderColor: mine ? colors.primary : colors.border, backgroundColor: colors.background }}>
                  <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: `${colors.primary}1C` }} />
                  <View style={gs.row}>
                    <Icon name={mine ? 'check-circle' : 'circle'} size={15} color={mine ? colors.primary : colors.mutedForeground} />
                    <Text style={[gs.body, { flex: 1, color: colors.foreground }]}>{option}</Text>
                    <Text style={[gs.meta, { color: colors.mutedForeground }]}>{count}{total ? ` · ${pct}%` : ''}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={[gs.meta, { color: colors.mutedForeground }]}>
              {total} {total === 1 ? 'vote' : 'votes'}{poll.myVote !== null ? ' · your vote is in' : canVote ? ' · tap a choice to vote' : !live && !poll.closedAt ? ' · voting opens when live' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ---------------- Q&A ---------------- */
export function QuestionsPanel({ sessionId, engagement, phase, isOwner, isJoined, colors, refresh }: PanelProps) {
  const [draft, setDraft] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ask = useAskGuideSessionQuestion({ mutation: { onSuccess: () => { setDraft(''); refresh(); } } });
  const answer = useAnswerGuideSessionQuestion({ mutation: { onSuccess: refresh } });
  const upvote = useVoteGuideSessionQuestion({ mutation: { onSuccess: refresh } });
  const live = phase === 'live';
  const questions = [...(engagement?.questions ?? [])].sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0));
  return (
    <View>
      {isJoined && !isOwner && (live ? (
        <SectionCard colors={colors} icon="help-circle" eyebrow="ASK THE GUIDE" title="What would you like to know?">
          <TextInput testID="qa-input" value={draft} onChangeText={setDraft} multiline maxLength={500}
            placeholder="How do you get the cape in this area?" placeholderTextColor={colors.mutedForeground}
            style={[gs.input, gs.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          <PillButton testID="qa-submit" colors={colors} icon="send" label="Send question" busy={ask.isPending} disabled={draft.trim().length < 4}
            onPress={() => ask.mutate({ sessionId, data: { question: draft.trim() } }, { onError: e => Alert.alert('Could not send question', errorMessage(e)) })} />
        </SectionCard>
      ) : phase === 'upcoming' ? <Notice colors={colors} icon="clock" text="Questions open when the session goes live. Note yours down and bring them along." /> : null)}
      {isOwner && phase === 'upcoming' && <Notice colors={colors} icon="info" tone="primary" text="Participants can send questions once the session is live. Answer them here, sorted by the most helpful." />}
      {questions.length === 0 ? (
        <Notice colors={colors} icon="message-square" text={live ? 'No questions yet.' : 'No questions were asked.'} />
      ) : questions.map(q => (
        <View key={q.id} testID={`question-${q.id}`} style={[gs.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[gs.row, { marginBottom: 4 }]}>
            <Text style={[gs.label, { color: colors.primary, marginBottom: 0, flex: 1 }]}>{q.isMine ? 'You' : q.askerName}</Text>
            {engagement?.questionVotingReady && (
              <TouchableOpacity testID={`question-upvote-${q.id}`} disabled={!live || !isJoined || isOwner || !!q.isMine || upvote.isPending}
                onPress={() => upvote.mutate({ sessionId, questionId: q.id, data: { voted: !q.myUpvoted } }, { onError: e => Alert.alert('Could not update vote', errorMessage(e)) })}
                style={[gs.row, { gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: q.myUpvoted ? colors.primary : colors.border }]}>
                <Icon name="arrow-up" size={12} color={colors.primary} />
                <Text style={[gs.meta, { color: colors.primary }]}>{q.upvoteCount ?? 0}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[gs.body, { color: colors.foreground }]}>{q.question}</Text>
          {q.answer ? (
            <View style={{ marginTop: 9, padding: 10, borderRadius: 12, backgroundColor: `${colors.tint}12` }}>
              <Text style={[gs.eyebrow, { color: colors.tint, marginBottom: 3 }]}>GUIDE ANSWER</Text>
              <Text style={[gs.body, { color: colors.foreground }]}>{q.answer}</Text>
            </View>
          ) : isOwner ? (
            <View style={{ marginTop: 9 }}>
              <TextInput testID={`qa-answer-input-${q.id}`} value={answers[q.id] ?? ''} multiline maxLength={1000}
                onChangeText={v => setAnswers(cur => ({ ...cur, [q.id]: v }))} placeholder="Write a helpful answer" placeholderTextColor={colors.mutedForeground}
                style={[gs.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
              <PillButton testID={`qa-answer-${q.id}`} colors={colors} label="Answer" icon="corner-down-right" busy={answer.isPending} disabled={(answers[q.id] ?? '').trim().length < 2}
                onPress={() => answer.mutate({ sessionId, questionId: q.id, data: { answer: (answers[q.id] ?? '').trim() } }, {
                  onSuccess: () => setAnswers(cur => { const n = { ...cur }; delete n[q.id]; return n; }),
                  onError: e => Alert.alert('Could not save answer', errorMessage(e)),
                })} />
            </View>
          ) : <Text style={[gs.meta, { color: colors.mutedForeground, marginTop: 7 }]}>Waiting for the guide's answer</Text>}
        </View>
      ))}
    </View>
  );
}

/* ---------------- Activities ---------------- */
export function ActivitiesPanel({ sessionId, engagement, phase, isOwner, isJoined, colors, refresh }: PanelProps) {
  const [kind, setKind] = useState<'challenge' | 'reflection' | 'resource'>('challenge');
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [url, setUrl] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const create = useCreateGuideSessionActivity({ mutation: { onSuccess: refresh } });
  const respond = useRespondToGuideSessionActivity({ mutation: { onSuccess: refresh } });
  const close = useCloseGuideSessionActivity({ mutation: { onSuccess: refresh } });
  const live = phase === 'live';
  if (!engagement?.activitiesReady) {
    return <Notice colors={colors} icon="clock" text="Live activities are not available on this server yet. Polls, Q&A and chat still work." />;
  }
  const activities = engagement.activities;
  return (
    <View>
      {isOwner && live && (
        <SectionCard colors={colors} icon="zap" eyebrow="HOST" title="Launch the next activity">
          <View style={[gs.row, { marginBottom: 9 }]}>
            {([['challenge', 'Challenge', 'zap'], ['reflection', 'Reflection', 'feather'], ['resource', 'Resource', 'link']] as const).map(([k, label, icon]) => (
              <TouchableOpacity key={k} onPress={() => setKind(k)} style={[gs.row, { flex: 1, gap: 5, justifyContent: 'center', minHeight: 36, borderRadius: 11, borderWidth: 1,
                borderColor: kind === k ? colors.primary : colors.border, backgroundColor: kind === k ? `${colors.primary}12` : colors.background }]}>
                <Icon name={icon} size={12} color={kind === k ? colors.primary : colors.mutedForeground} />
                <Text style={[gs.meta, { color: kind === k ? colors.primary : colors.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={title} onChangeText={setTitle} maxLength={100} placeholder="Title" placeholderTextColor={colors.mutedForeground}
            style={[gs.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          <TextInput value={prompt} onChangeText={setPrompt} maxLength={1000} multiline placeholder="What should participants do or think about?" placeholderTextColor={colors.mutedForeground}
            style={[gs.input, gs.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          {kind === 'resource' && <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" maxLength={2048} placeholder="https://"
            placeholderTextColor={colors.mutedForeground} style={[gs.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />}
          <PillButton colors={colors} icon="play" label="Launch for everyone" busy={create.isPending}
            disabled={title.trim().length < 3 || prompt.trim().length < 5 || (kind === 'resource' && !/^https?:\/\/\S+/i.test(url.trim()))}
            onPress={() => create.mutate({ sessionId, data: { title: title.trim(), prompt: prompt.trim(), kind, ...(kind === 'resource' ? { resourceUrl: url.trim() } : {}) } }, {
              onSuccess: () => { setTitle(''); setPrompt(''); setUrl(''); },
              onError: e => Alert.alert('Could not launch activity', errorMessage(e)),
            })} />
        </SectionCard>
      )}
      {isOwner && phase === 'upcoming' && <Notice colors={colors} icon="info" tone="primary" text="Challenges, reflections and resources are launched live, one at a time, once the session starts." />}
      {activities.length === 0 ? (
        <Notice colors={colors} icon="layers" text={isOwner ? 'No activities launched yet.' : 'The guide has not launched an activity yet.'} />
      ) : activities.map(a => {
        const active = a.status === 'active' && live;
        const draft = drafts[a.id] ?? a.myResponse ?? '';
        return (
          <View key={a.id} style={[gs.card, { backgroundColor: colors.card, borderColor: active ? colors.primary : colors.border }]}>
            <View style={[gs.row, { marginBottom: 6 }]}>
              <Icon name={a.kind === 'resource' ? 'link' : a.kind === 'reflection' ? 'feather' : 'zap'} size={13} color={colors.primary} />
              <Text style={[gs.eyebrow, { color: colors.primary, flex: 1 }]}>{a.kind.toUpperCase()}</Text>
              <Text style={[gs.eyebrow, { color: active ? colors.tint : colors.mutedForeground }]}>{active ? 'LIVE' : 'DONE'}</Text>
            </View>
            <Text style={[gs.cardTitle, { color: colors.foreground }]}>{a.title}</Text>
            <Text style={[gs.body, { color: colors.mutedForeground, marginTop: 4 }]}>{a.prompt}</Text>
            {!!a.resourceUrl && (
              <TouchableOpacity onPress={() => void Linking.openURL(a.resourceUrl!).catch(() => Alert.alert('Could not open link', 'Check the link and try again.'))} style={[gs.row, { marginTop: 9 }]}>
                <Icon name="external-link" size={13} color={colors.primary} /><Text style={[gs.label, { color: colors.primary, marginBottom: 0 }]}>Open resource</Text>
              </TouchableOpacity>
            )}
            {isOwner ? (
              <View style={{ marginTop: 10 }}>
                <View style={gs.row}>
                  <Text style={[gs.meta, { flex: 1, color: colors.mutedForeground }]}>{a.responseCount} {a.responseCount === 1 ? 'response' : 'responses'}</Text>
                  {active && <PillButton colors={colors} variant="secondary" label="Finish" busy={close.isPending}
                    onPress={() => close.mutate({ sessionId, activityId: a.id }, { onError: e => Alert.alert('Could not finish activity', errorMessage(e)) })} />}
                </View>
                {a.responses.map(r => (
                  <View key={`${a.id}-${r.userId}`} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Text style={[gs.label, { color: colors.foreground, marginBottom: 2 }]}>{r.displayName ?? 'Participant'}</Text>
                    <Text style={[gs.body, { color: colors.mutedForeground }]}>{r.response}</Text>
                  </View>
                ))}
              </View>
            ) : active && isJoined ? (
              <View style={{ marginTop: 10 }}>
                <TextInput value={draft} multiline maxLength={1000} onChangeText={v => setDrafts(cur => ({ ...cur, [a.id]: v }))}
                  placeholder="Write your response" placeholderTextColor={colors.mutedForeground}
                  style={[gs.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
                <PillButton colors={colors} icon="send" label={a.myResponse ? 'Update response' : 'Send response'} busy={respond.isPending} disabled={draft.trim().length < 2}
                  onPress={() => respond.mutate({ sessionId, activityId: a.id, data: { response: draft.trim() } }, {
                    onSuccess: () => setDrafts(cur => { const n = { ...cur }; delete n[a.id]; return n; }),
                    onError: e => Alert.alert('Could not send response', errorMessage(e)),
                  })} />
              </View>
            ) : a.myResponse ? <Text style={[gs.meta, { color: colors.tint, marginTop: 8 }]}>Your response: {a.myResponse}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/* ---------------- Recap ---------------- */
export function RecapPanel({ sessionId, engagement, isOwner, colors, refresh }: Omit<PanelProps, 'phase' | 'isJoined'>) {
  const [summary, setSummary] = useState('');
  const [highlights, setHighlights] = useState('');
  const save = useSaveGuideSessionRecap({ mutation: { onSuccess: refresh } });
  const recap = engagement?.recap;
  return (
    <SectionCard testID="session-recap" colors={colors} icon="award" eyebrow="SESSION RECAP" title={recap ? 'What we covered' : isOwner ? 'Share what everyone learned' : 'Recap coming soon'}>
      {recap ? (
        <View style={{ marginBottom: isOwner ? 12 : 0 }}>
          <Text style={[gs.body, { color: colors.foreground }]}>{recap.summary}</Text>
          {recap.highlights.map((h, i) => (
            <View key={`${i}-${h}`} style={[gs.row, { marginTop: 7, alignItems: 'flex-start' }]}>
              <Icon name="check" size={13} color={colors.tint} /><Text style={[gs.body, { flex: 1, color: colors.mutedForeground }]}>{h}</Text>
            </View>
          ))}
        </View>
      ) : !isOwner ? <Text style={[gs.body, { color: colors.mutedForeground }]}>The guide has not shared a recap yet.</Text> : null}
      {isOwner && (
        <>
          <TextInput testID="recap-summary" value={summary} onChangeText={setSummary} multiline maxLength={1200}
            placeholder={recap ? 'Rewrite the summary (at least 20 characters)' : 'A short summary of the session (at least 20 characters)'} placeholderTextColor={colors.mutedForeground}
            style={[gs.input, gs.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          <TextInput value={highlights} onChangeText={setHighlights} multiline maxLength={850} placeholder="Highlights, one per line (up to 6)" placeholderTextColor={colors.mutedForeground}
            style={[gs.input, gs.multiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]} />
          <PillButton testID="recap-save" colors={colors} icon="send" label={recap ? 'Update recap' : 'Publish recap'} busy={save.isPending} disabled={summary.trim().length < 20}
            onPress={() => save.mutate({ sessionId, data: { summary: summary.trim(), highlights: highlights.split('\n').map(v => v.trim()).filter(Boolean).slice(0, 6) } }, {
              onSuccess: () => { setSummary(''); setHighlights(''); },
              onError: e => Alert.alert('Could not publish recap', errorMessage(e)),
            })} />
        </>
      )}
    </SectionCard>
  );
}
