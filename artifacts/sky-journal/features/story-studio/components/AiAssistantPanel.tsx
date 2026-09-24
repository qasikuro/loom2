/**
 * AiAssistantPanel
 *
 * Slide-up modal with 7 writing tools. Tapping a tool calls POST /ai/story-assist
 * with the current panel's text as context, then shows the result for the user
 * to insert or dismiss.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useApiFetch } from '../utils/apiClient';
import { SkyLoadingMark } from '@/components/SkyLoading';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiTool =
  | 'continue'
  | 'dialogue'
  | 'scene'
  | 'grammar'
  | 'emotion'
  | 'cliffhanger'
  | 'translate';

const TOOLS: Array<{
  key: AiTool;
  label: string;
  icon: string;
  color: string;
  hint: string;
}> = [
  { key: 'continue',    label: 'toolContinue',    icon: 'play',        color: '#78C8A0', hint: 'hintContinue' },
  { key: 'dialogue',    label: 'toolDialogue',    icon: 'message-square', color: '#78C8FF', hint: 'hintDialogue' },
  { key: 'scene',       label: 'toolScene',       icon: 'image',       color: '#C870A0', hint: 'hintScene' },
  { key: 'grammar',     label: 'toolGrammar',     icon: 'check-circle',color: '#F0C040', hint: 'hintGrammar' },
  { key: 'emotion',     label: 'toolEmotion',     icon: 'heart',       color: '#E05568', hint: 'hintEmotion' },
  { key: 'cliffhanger', label: 'toolCliffhanger',  icon: 'zap',         color: '#D0784A', hint: 'hintCliffhanger' },
  { key: 'translate',   label: 'toolTranslate',   icon: 'globe',       color: '#9B7FE8', hint: 'hintTranslate' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AiAssistantPanelProps {
  visible:  boolean;
  context:  string;           // current panel text passed as context
  onInsert: (text: string) => void;
  onClose:  () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiAssistantPanel({ visible, context, onInsert, onClose }: AiAssistantPanelProps) {
  const insets   = useSafeAreaInsets();
  const { t } = useTranslation();
  const apiFetch = useApiFetch();

  const slideAnim = useRef(new Animated.Value(0)).current;

  const [activeTool,  setActiveTool]  = useState<AiTool | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const abortRef = useRef(false);

  // Animate in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         visible ? 1 : 0,
      useNativeDriver: true,
      damping:         22,
      stiffness:       280,
    }).start();
    if (!visible) {
      // Reset state after dismiss
      setTimeout(() => {
        setActiveTool(null);
        setLoading(false);
        setResult(null);
        setErrorMsg(null);
      }, 300);
    }
  }, [visible]);

  const translateY = slideAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [500, 0],
  });

  async function runTool(tool: AiTool) {
    setActiveTool(tool);
    setLoading(true);
    setResult(null);
    setErrorMsg(null);
    abortRef.current = false;

    try {
      const resp = await apiFetch<{ text: string }>('/ai/story-assist', {
        method: 'POST',
        json:   { tool, context: context.slice(0, 4000) },
      });

      if (abortRef.current) return;

      if (resp && typeof resp.text === 'string' && resp.text.length > 0) {
        setResult(resp.text);
      } else {
        setErrorMsg(t('studioEditor.noResult'));
      }
    } catch {
      if (!abortRef.current) setErrorMsg(t('studioEditor.requestFailed'));
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }

  function handleCancel() {
    abortRef.current = true;
    setLoading(false);
    setActiveTool(null);
    setResult(null);
    setErrorMsg(null);
  }

  function handleInsert() {
    if (result) {
      onInsert(result);
      onClose();
    }
  }

  const sheetHeight = 460 + insets.bottom;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Scrim */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.scrim, { opacity: slideAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[s.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
        pointerEvents="box-none"
      >
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.sheetHeader}>
          <View style={s.aiIconWrap}>
            <Icon name="zap" size={14} color="#9B7FE8" />
          </View>
          <View style={s.sheetHeaderText}>
            <Text style={s.sheetTitle}>{t('studioEditor.aiTitle')}</Text>
            <Text style={s.sheetSub}>
              {context.trim() ? t('studioEditor.aiUsingContext') : t('studioEditor.aiNoContext')}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} accessibilityLabel={t('common.close')} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Icon name="x" size={16} color="rgba(200,185,255,0.50)" />
          </TouchableOpacity>
        </View>

        {/* Tool grid — hidden while loading/showing result */}
        {!loading && !result && !errorMsg && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.toolGrid, { paddingBottom: insets.bottom + 16 }]}
          >
            {TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.key}
                style={[s.toolBtn, { borderColor: `${tool.color}22`, backgroundColor: `${tool.color}0A` }]}
                accessibilityRole="button"
                accessibilityLabel={`${t(`studioEditor.${tool.label}`)}. ${t(`studioEditor.${tool.hint}`)}`}
                activeOpacity={0.75}
                onPress={() => runTool(tool.key)}
              >
                <View style={[s.toolIconWrap, { backgroundColor: `${tool.color}18` }]}>
                  <Icon name={tool.icon as never} size={17} color={tool.color} />
                </View>
                <View style={s.toolTextCol}>
                <Text style={s.toolLabel}>{t(`studioEditor.${tool.label}`)}</Text>
                <Text style={s.toolHint}>{t(`studioEditor.${tool.hint}`)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Loading state */}
        {loading && (
          <View style={s.loadingArea}>
            <View style={s.loadingCard}>
              <SkyLoadingMark color="#9B7FE8" size={42} />
              <Text style={s.loadingTitle}>
                {activeTool ? t(`studioEditor.${TOOLS.find(tool => tool.key === activeTool)?.label ?? 'writing'}`) : t('studioEditor.writing')} …
              </Text>
              <Text style={s.loadingHint}>{t('studioEditor.thinking')}</Text>
            </View>
            <TouchableOpacity style={s.cancelBtn} onPress={handleCancel}>
              <Text style={s.cancelBtnTxt}>{t('studioEditor.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result state */}
        {!loading && result && (
          <View style={[s.resultArea, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.resultHeader}>
              <View style={[s.resultToolTag, {
                backgroundColor: `${TOOLS.find(t => t.key === activeTool)?.color ?? '#9B7FE8'}18`,
                borderColor:     `${TOOLS.find(t => t.key === activeTool)?.color ?? '#9B7FE8'}28`,
              }]}>
                <Icon name={TOOLS.find(t => t.key === activeTool)?.icon as never ?? 'zap'} size={10} color={TOOLS.find(t => t.key === activeTool)?.color ?? '#9B7FE8'} />
                <Text style={[s.resultToolTxt, { color: TOOLS.find(t => t.key === activeTool)?.color ?? '#9B7FE8' }]}>
                  {activeTool && t(`studioEditor.${TOOLS.find(tool => tool.key === activeTool)?.label ?? 'writing'}`)}
                </Text>
              </View>
              <Text style={s.resultHeaderTxt}>{t('studioEditor.result')}</Text>
            </View>
            <ScrollView style={s.resultScroll} showsVerticalScrollIndicator={false}>
              <Text style={s.resultText}>{result}</Text>
            </ScrollView>
            <View style={s.resultActions}>
              <TouchableOpacity style={s.retryBtn} onPress={() => activeTool && runTool(activeTool)}>
                <Icon name="refresh-cw" size={13} color="rgba(200,185,255,0.55)" />
                <Text style={s.retryBtnTxt}>{t('studioEditor.regenerate')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.backToToolsBtn} onPress={handleCancel}>
                <Icon name="arrow-left" size={13} color="rgba(200,185,255,0.55)" />
                <Text style={s.retryBtnTxt}>{t('studioEditor.tools')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.insertBtn} onPress={handleInsert}>
                <Icon name="check" size={14} color="#fff" />
                <Text style={s.insertBtnTxt}>{t('studioEditor.insert')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error state */}
        {!loading && errorMsg && (
          <View style={s.errorArea}>
            <Icon name="alert-circle" size={22} color="#E05C5C" />
            <Text style={s.errorTitle}>{t('studioEditor.somethingWrong')}</Text>
            <Text style={s.errorBody}>{errorMsg}</Text>
            <TouchableOpacity style={s.retryErrBtn} onPress={() => activeTool && runTool(activeTool)}>
              <Text style={s.retryErrTxt}>{t('studioEditor.tryAgain')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={s.backToToolsTxt}>{t('studioEditor.backToTools')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0C0A1C',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderColor: 'rgba(200,185,255,0.10)',
    paddingHorizontal: 16, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4,
    borderRadius: 2, backgroundColor: 'rgba(200,185,255,0.18)', marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  aiIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(155,127,232,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetHeaderText: { flex: 1 },
  sheetTitle:      { fontSize: 15, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.95)' },
  sheetSub:        { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.38)', marginTop: 2 },
  closeBtn:        { padding: 4 },

  // Tool grid
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    width: '47%', flexGrow: 1,
    padding: 12, borderRadius: 16, borderWidth: 1,
  },
  toolIconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toolTextCol:  { flex: 1 },
  toolLabel:    { fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(240,235,255,0.90)' },
  toolHint:     { fontSize: 10.5, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.40)', marginTop: 2 },

  // Loading
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  loadingCard: {
    alignItems: 'center', gap: 14, padding: 32,
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(155,127,232,0.18)',
    backgroundColor: 'rgba(155,127,232,0.06)',
  },
  loadingTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.90)' },
  loadingHint:  { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.45)' },
  cancelBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelBtnTxt: { fontSize: 13, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.55)' },

  // Result
  resultArea:   { flex: 1, gap: 12 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultToolTag:{
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  resultToolTxt:  { fontSize: 10, fontFamily: 'Satoshi-Bold' },
  resultHeaderTxt:{ fontSize: 13, fontFamily: 'Satoshi-Bold', color: 'rgba(230,220,255,0.70)', flex: 1 },
  resultScroll: {
    flex: 1,
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  resultText:  { fontSize: 14, fontFamily: 'Satoshi-Regular', color: 'rgba(230,220,255,0.90)', lineHeight: 22 },
  resultActions:{ flexDirection: 'row', gap: 8, alignItems: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backToToolsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(200,185,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  retryBtnTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.55)' },
  insertBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 16,
    backgroundColor: '#9B7FE8',
  },
  insertBtnTxt: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#fff' },

  // Error
  errorArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  errorTitle: { fontSize: 16, fontFamily: 'Satoshi-Bold', color: 'rgba(248,244,255,0.90)' },
  errorBody:  { fontSize: 12, fontFamily: 'Satoshi-Regular', color: 'rgba(200,185,255,0.50)', textAlign: 'center' },
  retryErrBtn:{
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 16, backgroundColor: 'rgba(155,127,232,0.15)',
    borderWidth: 1, borderColor: 'rgba(155,127,232,0.30)',
    marginTop: 4,
  },
  retryErrTxt: { fontSize: 14, fontFamily: 'Satoshi-Bold', color: '#9B7FE8' },
  backToToolsTxt: { fontSize: 12, fontFamily: 'Satoshi-Medium', color: 'rgba(200,185,255,0.45)', marginTop: 4 },
});
