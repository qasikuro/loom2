import { Icon } from '@/components/Icon';
import { SecureImage } from '@/components/SecureImage';
import { ResizeMode, Video } from 'expo-av';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, PillButton, gs } from './shared';

export interface StepLike { id: string; type: 'text' | 'image' | 'video' | 'tip' | 'question'; title: string; body: string; mediaUri?: string | null }

const TYPE_LABEL: Record<StepLike['type'], { label: string; icon: string }> = {
  text: { label: 'STEP', icon: 'file-text' }, image: { label: 'IMAGE', icon: 'image' }, video: { label: 'VIDEO', icon: 'video' },
  tip: { label: 'TIP', icon: 'star' }, question: { label: 'QUESTION', icon: 'message-circle' },
};

/** Renders one tutorial step with media and a segmented progress track. */
export function TutorialStepper({ steps, index, completed, colors, onIndex, onNext, nextLabel, nextBusy, nextDisabled, questionHint }: {
  steps: StepLike[]; index: number; completed: number; colors: Colors; onIndex: (i: number) => void;
  onNext?: () => void; nextLabel?: string; nextBusy?: boolean; nextDisabled?: boolean; questionHint?: string;
}) {
  const step = steps[index];
  if (!step) return null;
  const info = TYPE_LABEL[step.type];
  return (
    <View>
      <View style={[gs.row, { gap: 4, marginBottom: 12 }]}>
        {steps.map((st, i) => (
          <TouchableOpacity key={st.id} accessibilityLabel={`Go to step ${i + 1}`} onPress={() => onIndex(i)} style={{ flex: 1, paddingVertical: 6 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: i < completed ? colors.primary : i === index ? `${colors.primary}70` : colors.border }} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={[gs.row, { marginBottom: 6 }]}>
        <Icon name={info.icon} size={12} color={step.type === 'tip' ? colors.gold ?? colors.primary : colors.primary} />
        <Text style={[gs.eyebrow, { color: colors.primary }]}>{info.label} {index + 1} OF {steps.length}</Text>
      </View>
      <Text style={{ fontFamily: 'Satoshi-Bold', fontSize: 19, lineHeight: 25, color: colors.foreground }}>{step.title}</Text>
      {!!step.body && (
        <View style={step.type === 'tip' ? { marginTop: 8, padding: 11, borderRadius: 12, backgroundColor: `${colors.primary}0D` } : { marginTop: 6 }}>
          <Text style={[gs.body, { color: step.type === 'tip' ? colors.foreground : colors.mutedForeground, fontSize: 14, lineHeight: 21 }]}>{step.body}</Text>
        </View>
      )}
      {step.mediaUri && step.type === 'image' && (
        <View style={ss.media}><SecureImage source={{ uri: step.mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" /></View>
      )}
      {step.mediaUri && step.type === 'video' && (
        <Video source={{ uri: step.mediaUri }} style={ss.media} useNativeControls resizeMode={ResizeMode.CONTAIN} shouldPlay={false} />
      )}
      {step.type === 'question' && !!questionHint && (
        <View style={[gs.row, { marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: `${colors.primary}0D` }]}>
          <Icon name="message-circle" size={13} color={colors.primary} />
          <Text style={[gs.meta, { color: colors.primary, flex: 1 }]}>{questionHint}</Text>
        </View>
      )}
      <View style={[gs.row, { marginTop: 14 }]}>
        <PillButton colors={colors} variant="secondary" icon="chevron-left" label="Previous" disabled={index === 0} onPress={() => onIndex(Math.max(0, index - 1))} />
        {onNext ? (
          <PillButton testID="tutorial-next" colors={colors} flex icon="arrow-right" label={nextLabel ?? 'Next'} busy={nextBusy} disabled={nextDisabled} onPress={onNext} />
        ) : (
          <PillButton testID="tutorial-next" colors={colors} flex icon="arrow-right" label="Next" disabled={index >= steps.length - 1} onPress={() => onIndex(Math.min(steps.length - 1, index + 1))} />
        )}
      </View>
    </View>
  );
}

const ss = StyleSheet.create({ media: { height: 190, borderRadius: 14, overflow: 'hidden', marginTop: 10, backgroundColor: '#00000010' } });
