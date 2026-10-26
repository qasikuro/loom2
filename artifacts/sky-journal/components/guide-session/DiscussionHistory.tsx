import { Icon } from '@/components/Icon';
import type { SessionDiscussionMessage } from '@/utils/sessionDiscussion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type Colors, gs } from './shared';

// useColors returns a new object on parent refreshes; compare the actual tokens
// used here rather than invalidating every bubble on the session clock tick.
function sameColors(a: Colors, b: Colors) {
  return a.primary === b.primary && a.primaryForeground === b.primaryForeground
    && a.muted === b.muted && a.mutedForeground === b.mutedForeground && a.foreground === b.foreground;
}

const MessageBubble = React.memo(function MessageBubble({ message, own, guide, colors, onReport }: {
  message: SessionDiscussionMessage; own: boolean; guide: boolean; colors: Colors;
  onReport: (id: string) => void;
}) {
  return (
    <View style={{ alignItems: own ? 'flex-end' : 'flex-start' }}>
      <View style={[s.bubble, { backgroundColor: own ? colors.primary : colors.muted }]}>
        <View style={[gs.row, { justifyContent: 'space-between', marginBottom: 4 }]}>
          <Text numberOfLines={1} style={[s.author, { flex: 1, color: own ? colors.primaryForeground : colors.primary }]}>
            {own ? 'You' : message.authorName}{guide ? ' · Guide' : ''}
          </Text>
          {!own && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Report message by ${message.authorName}`}
            hitSlop={10} onPress={() => onReport(message.id)}>
            <Icon name="flag" size={13} color={colors.mutedForeground} />
          </TouchableOpacity>}
        </View>
        <Text selectable style={[s.body, { color: own ? colors.primaryForeground : colors.foreground }]}>
          {message.content || `Reaction: ${message.expression ?? 'expression'}`}
        </Text>
        <Text style={[s.time, { color: own ? colors.primaryForeground : colors.mutedForeground }]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}, (previous, next) => previous.message === next.message && previous.own === next.own
  && previous.guide === next.guide && previous.onReport === next.onReport && sameColors(previous.colors, next.colors));

/** Isolate the bounded history from every composer keystroke and parent status refresh. */
export const DiscussionHistory = React.memo(function DiscussionHistory({ messages, userId, guideId, colors, loaded, failed, ended, scope, onReport }: {
  messages: SessionDiscussionMessage[]; userId: string | null | undefined; guideId: string;
  colors: Colors; loaded: boolean; failed: boolean; ended: boolean; scope: string;
  onReport: (id: string) => void;
}) {
  const list = useRef<FlatList<SessionDiscussionMessage>>(null);
  const atBottom = useRef(true);
  const lastId = useRef<string | undefined>(undefined);
  const [unread, setUnread] = useState(false);
  const jump = useCallback((animated = true) => {
    atBottom.current = true;
    setUnread(false);
    list.current?.scrollToOffset({ offset: 0, animated });
  }, []);
  const handleScroll = useCallback((event: {
    nativeEvent: { contentOffset: { y: number } };
  }) => {
    const nextAtBottom = event.nativeEvent.contentOffset.y < 70;
    const wasAtBottom = atBottom.current;
    atBottom.current = nextAtBottom;
    if (nextAtBottom && !wasAtBottom) setUnread(false);
  }, []);
  const newestFirst = React.useMemo(() => [...messages].reverse(), [messages]);
  const renderMessage = useCallback(({ item }: { item: SessionDiscussionMessage }) => (
    <MessageBubble
      message={item}
      own={item.userId === userId}
      guide={item.userId === guideId}
      colors={colors}
      onReport={onReport}
    />
  ), [userId, guideId, colors, onReport]);

  useEffect(() => {
    atBottom.current = true;
    lastId.current = undefined;
    setUnread(false);
  }, [scope]);
  useEffect(() => {
    const latest = messages.at(-1);
    if (latest && latest.id !== lastId.current && !atBottom.current) setUnread(true);
    lastId.current = latest?.id;
  }, [messages]);

  return (
    <View style={s.root}>
      <FlatList<SessionDiscussionMessage>
        ref={list}
        data={newestFirst}
        inverted
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 70 }}
        keyExtractor={message => message.id}
        renderItem={renderMessage}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        style={s.messages} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        ListEmptyComponent={
          !loaded && !failed
            ? <View style={s.empty}>
                {[0, 1, 2].map(i => <View key={i}
                  style={[s.placeholder, { width: i === 1 ? '64%' : '82%', alignSelf: i === 1 ? 'flex-end' : 'flex-start', backgroundColor: colors.muted }]} />)}
              </View>
            : loaded && !messages.length
              ? <View style={s.empty}>
                  <Icon name="message-circle" size={28} color={colors.primary} />
                  <Text style={[gs.cardTitle, { color: colors.foreground, textAlign: 'center' }]}>A place to learn together</Text>
                  <Text style={[gs.body, { color: colors.mutedForeground, textAlign: 'center' }]}>
                    {ended ? 'There are no recent messages to show.' : 'Say hello, share a thought, or discuss the current activity. Use Q&A for questions you want the guide to answer.'}
                  </Text>
                </View>
              : null
        }
      />
      {unread && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Jump to latest messages"
        onPress={() => jump()} style={[s.latest, { backgroundColor: colors.primary }]}>
        <Icon name="arrow-down" size={14} color={colors.primaryForeground} />
        <Text style={[s.author, { color: colors.primaryForeground }]}>New messages</Text>
      </TouchableOpacity>}
    </View>
  );
}, (previous, next) => previous.messages === next.messages && previous.userId === next.userId
  && previous.guideId === next.guideId && previous.loaded === next.loaded && previous.failed === next.failed
  && previous.ended === next.ended && previous.scope === next.scope && previous.onReport === next.onReport
  && sameColors(previous.colors, next.colors));

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  messages: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1, gap: 12, paddingVertical: 8 },
  placeholder: { height: 48, borderRadius: 16, marginBottom: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 44 },
  bubble: { maxWidth: '90%', borderRadius: 17, padding: 12, minWidth: 90 },
  author: { fontSize: 11, fontFamily: 'Satoshi-Bold' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: 'Satoshi-Medium' },
  time: { fontSize: 10, marginTop: 5, textAlign: 'right', opacity: 0.75, fontFamily: 'Satoshi-Medium' },
  latest: { position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
});
