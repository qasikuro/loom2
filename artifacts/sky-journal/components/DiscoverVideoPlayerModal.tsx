import { Icon } from '@/components/Icon';
import type { DiscoverPost } from '@/context/AppContext';
import { Video, ResizeMode } from 'expo-av';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  post:    DiscoverPost | null;
  onClose: () => void;
}

export function DiscoverVideoPlayerModal({ post, onClose }: Props) {
  const insets              = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [muted, setMuted]   = useState(false);

  // Reset mute state whenever the modal opens a new post
  React.useEffect(() => {
    setMuted(false);
  }, [post?.id]);

  if (!post || post.contentType !== 'video' || !post.videoUri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[vp.backdrop, { width: W, height: H }]}>
        {/* Video */}
        <Video
          source={{ uri: post.videoUri }}
          shouldPlay
          isLooping
          isMuted={muted}
          resizeMode={ResizeMode.CONTAIN}
          style={StyleSheet.absoluteFill}
          useNativeControls={false}
        />

        {/* Top bar */}
        <View style={[vp.topBar, { paddingTop: topInset + 8 }]}>
          <TouchableOpacity
            style={vp.iconBtn}
            onPress={onClose}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="x" size={18} color="#fff" />
          </TouchableOpacity>

          {/* Mute toggle */}
          <TouchableOpacity
            style={vp.iconBtn}
            onPress={() => setMuted(m => !m)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name={muted ? 'volume-x' : 'volume-2'} size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom info */}
        <View style={[vp.bottomBar, { paddingBottom: bottomInset + 16 }]}>
          {/* Author */}
          <Text style={vp.author} numberOfLines={1}>
            {post.authorHandle || post.authorName}
          </Text>

          {/* Caption / title */}
          <Text style={vp.title} numberOfLines={2}>{post.chapterTitle}</Text>

          {/* Description / pull quote */}
          {!!post.description && (
            <Text style={vp.desc} numberOfLines={3}>{post.description}</Text>
          )}

          {/* Mood pill */}
          <View style={vp.moodPill}>
            <Text style={vp.moodText}>{post.mood}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const vp = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, zIndex: 10,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, gap: 5,
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  author: {
    fontSize: 12, fontFamily: 'Satoshi-Regular',
    color: 'rgba(220,210,255,0.70)',
  },
  title: {
    fontSize: 18, fontFamily: 'Satoshi-Bold',
    color: '#fff', lineHeight: 24, flexShrink: 1,
  },
  desc: {
    fontSize: 13, fontFamily: 'Satoshi-Regular',
    color: 'rgba(240,234,255,0.75)', lineHeight: 18, flexShrink: 1,
  },
  moodPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(107,91,149,0.55)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
    marginTop: 2,
  },
  moodText: {
    fontSize: 11, fontFamily: 'Satoshi-Bold',
    color: 'rgba(220,210,255,0.95)',
  },
});
