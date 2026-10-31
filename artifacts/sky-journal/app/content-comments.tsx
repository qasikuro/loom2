import { Icon } from "@/components/Icon";
import { SecureImage } from "@/components/SecureImage";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@clerk/expo";
import {
  getGetContentCommentsQueryKey,
  useCreateContentComment,
  useDeleteContentComment,
  useGetContentComments,
  useSetContentCommentCreatorReaction,
  useToggleContentCommentLike,
} from "@workspace/api-client-react";
import { Button } from "@workspace/storigam-kindness/components/native/button";
import { useColors as useKindnessColors } from "@workspace/storigam-kindness/hooks/use-colors";
import type { NativeThemeMode } from "@workspace/storigam-kindness/lib/native-theme";
import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ContentType = "story" | "video" | "outfit" | "book" | "tutorial" | "session";
type KindnessTag = "creativity" | "smile" | "outfit" | "colors" | "relaxing" | "keepCreating";
type CreatorReaction = "heart" | "sparkle" | "flower" | "clap";

interface CommentItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUri: string | null;
  parentId: string | null;
  content: string;
  kindnessTag: KindnessTag | null;
  creatorReaction: CreatorReaction | null;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  isMine: boolean;
  isContentOwner: boolean;
  createdAt: string;
}

const KINDNESS_OPTIONS: { tag: KindnessTag; label: string; phrase: string; icon: string }[] = [
  { tag: "creativity", label: "Love the creativity", phrase: "I loved the creativity.", icon: "sparkles" },
  { tag: "smile", label: "Made me smile", phrase: "This made me smile.", icon: "heart" },
  { tag: "outfit", label: "Amazing outfit", phrase: "Such a lovely outfit.", icon: "star" },
  { tag: "colors", label: "Beautiful colors", phrase: "The colors are beautiful.", icon: "droplet" },
  { tag: "relaxing", label: "So relaxing", phrase: "This feels so relaxing.", icon: "wind" },
  { tag: "keepCreating", label: "Keep creating", phrase: "Keep creating. I’d love to see more.", icon: "feather" },
];

const CONTENT_LABELS: Record<ContentType, string> = {
  story: "Story",
  video: "Video",
  outfit: "Outfit",
  book: "Book",
  tutorial: "Tutorial",
  session: "Session",
};

function isContentType(value: string | undefined): value is ContentType {
  return value === "story" || value === "video" || value === "outfit" ||
    value === "book" || value === "tutorial" || value === "session";
}

function ago(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ContentCommentsScreen() {
  const params = useLocalSearchParams<{ contentType?: string; contentId?: string; title?: string }>();
  const contentType = isContentType(params.contentType) ? params.contentType : null;
  const contentId = typeof params.contentId === "string" ? params.contentId : "";
  const contentTitle = typeof params.title === "string" ? params.title : "";
  const { isDark } = useTheme();
  const mode: NativeThemeMode = isDark ? "dark" : "light";
  const colors = useKindnessColors(mode);
  const insets = useSafeAreaInsets();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [selectedTag, setSelectedTag] = useState<KindnessTag | null>(null);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [sent, setSent] = useState(false);

  const queryParams = replyTo ? { parentId: replyTo.id } : undefined;
  const query = useGetContentComments(contentType ?? "story", contentId, queryParams, {
    query: {
      queryKey: [
        ...getGetContentCommentsQueryKey(contentType ?? "story", contentId, queryParams),
        userId,
      ],
      enabled: !!contentType && !!contentId,
      retry: false,
      staleTime: 12_000,
    },
  });
  const comments = (query.data?.comments ?? []) as CommentItem[];

  const invalidateComments = () => {
    if (!contentType || !contentId) return;
    void queryClient.invalidateQueries({
      queryKey: getGetContentCommentsQueryKey(contentType, contentId),
    });
  };

  const createComment = useCreateContentComment({
    mutation: {
      onSuccess: () => {
        setDraft("");
        setSelectedTag(null);
        setSent(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        invalidateComments();
        setTimeout(() => setSent(false), 2200);
      },
      onError: () => Alert.alert("Could not post", "Please check your connection and try again."),
    },
  });
  const toggleLike = useToggleContentCommentLike({ mutation: { onSuccess: invalidateComments } });
  const setCreatorReaction = useSetContentCommentCreatorReaction({ mutation: { onSuccess: invalidateComments } });
  const deleteComment = useDeleteContentComment({
    mutation: {
      onSuccess: invalidateComments,
      onError: () => Alert.alert("Could not remove comment", "Please try again."),
    },
  });

  const submit = () => {
    if (!contentType || !contentId || createComment.isPending) return;
    const selected = KINDNESS_OPTIONS.find(option => option.tag === selectedTag);
    const content = draft.trim() || selected?.phrase || "";
    if (!content) {
      Alert.alert("Add a kind note", "Choose a prompt or write a short comment first.");
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    createComment.mutate({
      contentType,
      contentId,
      data: {
        content,
        parentId: replyTo?.id ?? null,
        kindnessTag: selectedTag,
      },
    });
  };

  const confirmDelete = (comment: CommentItem) => {
    Alert.alert("Remove comment?", "The conversation will stay in place, but this comment will be hidden.", [
      { text: "Keep comment", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteComment.mutate({ commentId: comment.id }),
      },
    ]);
  };

  if (!contentType || !contentId) {
    return (
      <View style={[styles.invalid, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: colors.fontFamily.bold }}>Comments are unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Icon name="arrow-left" size={17} color={colors.primary} />
          <Text style={{ color: colors.primary, fontFamily: colors.fontFamily.medium }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderComment = ({ item, index }: { item: CommentItem; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 25, 125)).duration(230)}
      style={[styles.commentCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
    >
      <View style={styles.commentHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          {item.authorAvatarUri
            ? <SecureImage source={{ uri: item.authorAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            : <Text style={[styles.avatarLetter, { color: colors.primary }]}>{item.authorName.slice(0, 1).toUpperCase()}</Text>}
        </View>
        <View style={styles.authorInfo}>
          <View style={styles.authorNameRow}>
            <Text style={[styles.authorName, { color: colors.foreground }]} numberOfLines={1}>{item.authorName}</Text>
            {item.isMine && <Text style={[styles.youLabel, { color: colors.mutedForeground }]}>You</Text>}
            {item.isContentOwner && <Text style={[styles.creatorLabel, { color: colors.accentForeground, backgroundColor: colors.accent }]}>Creator</Text>}
          </View>
          <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>{ago(item.createdAt)}</Text>
        </View>
        {(item.isMine || item.isContentOwner) && item.content !== "This comment was removed." && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Remove comment"
            hitSlop={10}
            onPress={() => confirmDelete(item)}
            style={styles.moreButton}
          >
            <Icon name="more-horizontal" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.commentBody, { color: colors.foreground }]}>{item.content}</Text>
      {item.kindnessTag && (
        <View style={[styles.kindnessPill, { backgroundColor: `${colors.accent}28` }]}>
          <Icon name="sparkles" size={12} color={colors.accentForeground} />
          <Text style={[styles.kindnessText, { color: colors.accentForeground }]}>
            {KINDNESS_OPTIONS.find(option => option.tag === item.kindnessTag)?.label ?? "A little kindness"}
          </Text>
        </View>
      )}
      {item.creatorReaction && (
        <View style={[styles.creatorNote, { backgroundColor: colors.secondary }]}>
          <Icon name={item.creatorReaction === "heart" ? "heart" : "sparkles"} size={13} color={colors.primary} />
          <Text style={[styles.creatorNoteText, { color: colors.secondaryForeground }]}>The creator appreciated this</Text>
        </View>
      )}

      <View style={styles.commentActions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={item.likedByMe ? "Unlike comment" : "Like comment"}
          onPress={() => toggleLike.mutate({ commentId: item.id })}
          disabled={toggleLike.isPending || item.content === "This comment was removed."}
          style={styles.actionButton}
        >
          <Icon name="heart" size={15} color={item.likedByMe ? colors.accent : colors.mutedForeground} />
          <Text style={[styles.actionText, { color: item.likedByMe ? colors.accent : colors.mutedForeground }]}>{item.likeCount}</Text>
        </TouchableOpacity>
        {!replyTo && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${item.authorName}`}
            onPress={() => {
              setReplyTo(item);
              setDraft("");
              setSelectedTag(null);
            }}
            style={styles.actionButton}
          >
            <Icon name="corner-down-right" size={15} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>
              {item.replyCount > 0 ? `Reply · ${item.replyCount}` : "Reply"}
            </Text>
          </TouchableOpacity>
        )}
        {item.isContentOwner && item.content !== "This comment was removed." && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={item.creatorReaction ? "Remove creator appreciation" : "Appreciate comment"}
            onPress={() => setCreatorReaction.mutate({
              commentId: item.id,
              data: { reaction: item.creatorReaction ? null : "heart" },
            })}
            disabled={setCreatorReaction.isPending}
            style={[styles.actionButton, styles.creatorAction]}
          >
            <Icon name="heart" size={14} color={item.creatorReaction ? colors.accent : colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {item.creatorReaction ? "Appreciated" : "Appreciate"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Icon name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {replyTo ? "Replies" : "Comments"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {replyTo ? `Replying to ${replyTo.authorName}` : `${CONTENT_LABELS[contentType]}${contentTitle ? ` · ${contentTitle}` : ""}`}
          </Text>
        </View>
        <View style={[styles.headerIcon, { backgroundColor: colors.secondary }]}>
          <Icon name="heart" size={18} color={colors.accent} />
        </View>
      </View>

      <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <View style={[styles.introIcon, { backgroundColor: colors.secondary }]}>
          <Icon name="sparkles" size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>Leave a little kindness</Text>
          <Text style={[styles.introCopy, { color: colors.mutedForeground }]}>A thoughtful note can make someone’s day.</Text>
        </View>
        {replyTo && (
          <TouchableOpacity onPress={() => setReplyTo(null)} accessibilityRole="button" accessibilityLabel="Back to comments" style={styles.threadBack}>
            <Icon name="x" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {sent && (
        <Animated.View entering={FadeInDown.duration(220)} style={[styles.sentBanner, { backgroundColor: colors.secondary }]}>
          <Icon name="check-circle" size={16} color={colors.primary} />
          <Text style={[styles.sentText, { color: colors.secondaryForeground }]}>A little kindness sent.</Text>
        </Animated.View>
      )}

      {query.isError ? (
        <View style={styles.emptyState}>
          <Icon name="cloud-off" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Comments couldn’t load</Text>
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Check your connection and try again.</Text>
          <TouchableOpacity onPress={() => void query.refetch()} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : query.isLoading ? (
        <View style={styles.emptyState}>
          <Icon name="clock" size={24} color={colors.primary} />
          <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>Gathering kind words…</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          renderItem={renderComment}
          contentContainerStyle={comments.length ? styles.list : styles.emptyList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
                <Icon name="message-circle" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {replyTo ? "No replies yet" : "Start with something kind"}
              </Text>
              <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
                {replyTo ? "Your reply can keep the conversation going." : "Be the first to leave a thoughtful note."}
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.composer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsRow}>
          {KINDNESS_OPTIONS.map(option => {
            const selected = selectedTag === option.tag;
            return (
              <Pressable
                key={option.tag}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setSelectedTag(current => current === option.tag ? null : option.tag);
                  setDraft(current => current.trim() ? current : option.phrase);
                }}
                style={[
                  styles.tagOption,
                  { backgroundColor: selected ? colors.accent : colors.secondary, borderColor: selected ? colors.accent : colors.border },
                ]}
              >
                <Icon name={option.icon} size={13} color={selected ? colors.accentForeground : colors.primary} />
                <Text style={[styles.tagLabel, { color: selected ? colors.accentForeground : colors.secondaryForeground }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            value={draft}
            onChangeText={value => { setDraft(value); setSent(false); }}
            placeholder={replyTo ? "Write a kind reply…" : "Add a kind comment…"}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
            accessibilityLabel={replyTo ? "Write a reply" : "Write a comment"}
            style={[styles.input, { color: colors.foreground, fontFamily: colors.fontFamily.regular }]}
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{draft.length}/500</Text>
        </View>
        <View style={styles.composerBottom}>
          <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
            {replyTo ? `Replying to ${replyTo.authorName}` : "Keep it thoughtful and encouraging."}
          </Text>
          <Button
            label={createComment.isPending ? "Sending…" : "Send"}
            onPress={submit}
            mode={mode}
            disabled={createComment.isPending || (!draft.trim() && !selectedTag)}
            size="small"
            style={styles.sendButton}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  invalid: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14, padding: 24 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  headerBack: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: "Satoshi-Bold", fontSize: 19 },
  headerSubtitle: { fontFamily: "Satoshi-Regular", fontSize: 12, marginTop: 2 },
  headerIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  intro: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 14, marginBottom: 9, padding: 13, borderWidth: 1 },
  introIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  introTitle: { fontFamily: "Satoshi-Bold", fontSize: 14 },
  introCopy: { fontFamily: "Satoshi-Regular", fontSize: 12, marginTop: 2 },
  threadBack: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sentBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  sentText: { fontFamily: "Satoshi-Medium", fontSize: 12 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 },
  emptyList: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 18 },
  commentCard: { borderWidth: 1, padding: 13, gap: 9 },
  commentHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 37, height: 37, borderRadius: 19, overflow: "hidden", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontFamily: "Satoshi-Bold", fontSize: 14 },
  authorInfo: { flex: 1, minWidth: 0 },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { fontFamily: "Satoshi-Bold", fontSize: 13, flexShrink: 1 },
  youLabel: { fontFamily: "Satoshi-Medium", fontSize: 10 },
  creatorLabel: { overflow: "hidden", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, fontFamily: "Satoshi-Bold", fontSize: 9 },
  timeLabel: { fontFamily: "Satoshi-Regular", fontSize: 10, marginTop: 1 },
  moreButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  commentBody: { fontFamily: "Satoshi-Regular", fontSize: 14, lineHeight: 20, marginLeft: 47 },
  kindnessPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginLeft: 47, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  kindnessText: { fontFamily: "Satoshi-Medium", fontSize: 10 },
  creatorNote: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginLeft: 47, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12 },
  creatorNoteText: { fontFamily: "Satoshi-Medium", fontSize: 10 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 16, marginLeft: 45, marginTop: 1 },
  actionButton: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 5 },
  creatorAction: { marginLeft: "auto" },
  actionText: { fontFamily: "Satoshi-Medium", fontSize: 11 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 30, gap: 8 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "Satoshi-Bold", fontSize: 16, textAlign: "center" },
  emptyCopy: { fontFamily: "Satoshi-Regular", fontSize: 13, textAlign: "center", lineHeight: 19 },
  retryButton: { padding: 10 },
  retryText: { fontFamily: "Satoshi-Bold", fontSize: 13 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 14 },
  tagsRow: { gap: 7, paddingBottom: 10 },
  tagOption: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1 },
  tagLabel: { fontFamily: "Satoshi-Medium", fontSize: 11 },
  inputWrap: { minHeight: 52, maxHeight: 110, flexDirection: "row", alignItems: "flex-end", borderWidth: 1, paddingLeft: 12, paddingRight: 10, paddingVertical: 9 },
  input: { flex: 1, maxHeight: 90, minHeight: 32, fontSize: 14, lineHeight: 19, padding: 0 },
  charCount: { fontFamily: "Satoshi-Regular", fontSize: 9, marginLeft: 8, marginBottom: 1 },
  composerBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 9 },
  privacyNote: { flex: 1, fontFamily: "Satoshi-Regular", fontSize: 10 },
  sendButton: { minWidth: 78 },
});
