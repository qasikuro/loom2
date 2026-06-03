import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSound } from '@/context/SoundContext';
import { apiFetch, useApp } from '@/context/AppContext';
import type { JournalEntry } from '@/context/AppContext';

const DONE_KEY  = 'onboarding_v1';
const DRAFT_KEY = 'onboarding_draft_v1';   // persists step + all selections
const { width: W, height: H } = Dimensions.get('window');

// ── Moods ──────────────────────────────────────────────────────────────────────

const MOODS = [
  { id: 'Dreamy',      emoji: '🌙', color: '#9B78E8' },
  { id: 'Hopeful',     emoji: '☀️', color: '#C8A84B' },
  { id: 'Soft',        emoji: '🌸', color: '#E8A8C8' },
  { id: 'Peaceful',    emoji: '🍃', color: '#78B8A8' },
  { id: 'Romantic',    emoji: '💕', color: '#E878A8' },
  { id: 'Lonely',      emoji: '🌧️', color: '#7890C8' },
  { id: 'Adventurous', emoji: '⚡', color: '#C8784B' },
  { id: 'Chaotic',     emoji: '🌪️', color: '#A87848' },
] as const;

type MoodId = typeof MOODS[number]['id'];

// ── Constellation types ────────────────────────────────────────────────────────

const CONSTELLATION_TYPES = [
  {
    id:       'wanderer' as const,
    emoji:    '🌊',
    name:     'The Wanderer',
    desc:     'Always exploring, always curious. You drift through many skies, collecting moments.',
    accent:   '#80C4FF',
    gradient: ['#0A1530', '#142A5E', '#0E1A40'] as const,
  },
  {
    id:       'keeper' as const,
    emoji:    '🌸',
    name:     'The Keeper',
    desc:     'Steady and nurturing. You hold memories close and light the way for others.',
    accent:   '#E8A8C8',
    gradient: ['#2A1030', '#4A1850', '#300C40'] as const,
  },
  {
    id:       'dreamer' as const,
    emoji:    '🌙',
    name:     'The Dreamer',
    desc:     'Fluid and imaginative. You float between worlds, weaving stories from starlight.',
    accent:   '#9B78E8',
    gradient: ['#120C30', '#2E1B6A', '#1A0E40'] as const,
  },
] as const;

type ConstellationType = typeof CONSTELLATION_TYPES[number]['id'];

interface DraftState {
  step:    number;
  mood:    MoodId | null;
  type:    ConstellationType | null;
  journal: string;
}

// ── Step indices ───────────────────────────────────────────────────────────────
const STEP_WELCOME       = 0;
const STEP_MOOD          = 1;
const STEP_CONSTELLATION = 2;
const STEP_JOURNAL       = 3;
const STEP_REVEAL        = 4;
const TOTAL_STEPS        = 5;

// ── Draft helpers ──────────────────────────────────────────────────────────────

async function loadDraft(): Promise<DraftState | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DraftState;
  } catch { return null; }
}

async function saveDraft(d: DraftState): Promise<void> {
  try { await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
}

async function clearDraft(): Promise<void> {
  try { await AsyncStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/** Earliest step that still needs a selection (used for invalid resume). */
function earliestIncomplete(d: DraftState): number {
  if (!d.mood) return STEP_MOOD;
  if (!d.type) return STEP_CONSTELLATION;
  return STEP_REVEAL;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface OnboardingOverlayProps {
  visible:    boolean;
  onComplete: () => void;  // called after successful seeding — marks onboarding done
  onDismiss:  () => void;  // called on skip — just hides overlay, draft preserved
}

export function OnboardingOverlay({ visible, onComplete, onDismiss }: OnboardingOverlayProps) {
  const { playSound }               = useSound();
  const { reloadData, addJournalEntry } = useApp();

  const [step, setStep]             = useState(STEP_WELCOME);
  const [selectedMood, setSelectedMood]   = useState<MoodId | null>(null);
  const [selectedType, setSelectedType]   = useState<ConstellationType | null>(null);
  const [journalText, setJournalText]     = useState('');
  const [saving, setSaving]               = useState(false);
  const [seedError, setSeedError]         = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(0)).current;
  const emojiScale = useRef(new Animated.Value(0)).current;
  const sparkAnims = useRef(
    Array.from({ length: 12 }, () => ({
      x:  new Animated.Value(0),
      y:  new Animated.Value(0),
      op: new Animated.Value(0),
      sc: new Animated.Value(1),
    }))
  ).current;

  // ── Load saved draft on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    setSeedError(false);

    loadDraft().then(draft => {
      let startStep = STEP_WELCOME;
      if (draft) {
        // Restore all saved selections
        if (draft.mood) setSelectedMood(draft.mood);
        if (draft.type) setSelectedType(draft.type);
        if (draft.journal) setJournalText(draft.journal);

        // Validate resume position: if at reveal but selections are missing,
        // route back to earliest incomplete step so user re-picks intentionally.
        if (draft.step === STEP_REVEAL && (!draft.mood || !draft.type)) {
          startStep = earliestIncomplete(draft);
        } else {
          startStep = Math.min(draft.step, STEP_REVEAL);
        }
      }

      setStep(startStep);
      slideAnim.setValue(0);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
      entranceEmoji();
      if (startStep === STEP_REVEAL) fireSparks();
    });
  }, [visible]);

  // ── Emoji entrance spring ──────────────────────────────────────────────────
  function entranceEmoji() {
    emojiScale.setValue(0);
    Animated.spring(emojiScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }).start(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(emojiScale, { toValue: 1.08, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(emojiScale, { toValue: 1.00, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    });
  }

  // ── Spark burst ────────────────────────────────────────────────────────────
  function fireSparks() {
    sparkAnims.forEach((p, i) => {
      p.x.setValue(0); p.y.setValue(0); p.op.setValue(0); p.sc.setValue(1);
      const angle = (i / sparkAnims.length) * Math.PI * 2;
      const dist  = 60 + Math.random() * 50;
      Animated.sequence([
        Animated.timing(p.op, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(p.x,  { toValue: Math.cos(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.y,  { toValue: Math.sin(angle) * dist, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.op, { toValue: 0, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(p.sc, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }

  // ── Navigate to step (also persists full draft) ────────────────────────────
  const goToStep = useCallback((next: number, overrides?: Partial<DraftState>) => {
    playSound('navigate');
    Animated.timing(slideAnim, {
      toValue: -W, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => {
      setStep(next);
      // Persist draft with latest state + new step
      const draft: DraftState = {
        step:    next,
        mood:    overrides?.mood    ?? selectedMood,
        type:    overrides?.type    ?? selectedType,
        journal: overrides?.journal ?? journalText,
      };
      saveDraft(draft);
      slideAnim.setValue(W);
      entranceEmoji();
      if (next === STEP_REVEAL) fireSparks();
      Animated.timing(slideAnim, {
        toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true,
      }).start();
    });
  }, [playSound, selectedMood, selectedType, journalText]);

  // ── Selection handlers (persist draft immediately) ─────────────────────────
  const pickMood = useCallback((id: MoodId) => {
    playSound('tap');
    setSelectedMood(id);
    saveDraft({ step, mood: id, type: selectedType, journal: journalText });
  }, [playSound, step, selectedType, journalText]);

  const pickType = useCallback((id: ConstellationType) => {
    playSound('tap');
    setSelectedType(id);
    saveDraft({ step, mood: selectedMood, type: id, journal: journalText });
  }, [playSound, step, selectedMood, journalText]);

  const changeJournal = useCallback((text: string) => {
    setJournalText(text);
    saveDraft({ step, mood: selectedMood, type: selectedType, journal: text });
  }, [step, selectedMood, selectedType]);

  // ── Completion: seed profile + create journal entry (transactional) ────────
  const handleFinish = useCallback(async () => {
    setSaving(true);
    setSeedError(false);
    Keyboard.dismiss();

    const mood = selectedMood  ?? 'Dreamy';
    const type = selectedType  ?? 'dreamer';

    // Character PUT is required — retry once on failure
    let characterOk = false;
    for (let attempt = 0; attempt < 2 && !characterOk; attempt++) {
      try {
        await apiFetch('/character', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ mood, constellationType: type }),
        });
        characterOk = true;
      } catch {
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!characterOk) {
      // Surface inline error so user can retry — do NOT mark onboarding done
      setSaving(false);
      setSeedError(true);
      return;
    }

    // Journal POST: required when user typed something (retry once); empty → skipped intentionally.
    const trimmedText = journalText.trim();
    if (trimmedText) {
      const entryId = crypto.randomUUID();
      const entry: JournalEntry = {
        id:         entryId,
        date:       new Date().toISOString().slice(0, 10),
        type:       'diary',
        text:       trimmedText,
        mood,
        imageUri:   undefined,
        friendName: undefined,
      };
      // Optimistic local insert so profile shows the entry immediately after completion.
      addJournalEntry(entry);

      let journalOk = false;
      for (let attempt = 0; attempt < 2 && !journalOk; attempt++) {
        try {
          await apiFetch('/journal-entries', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ id: entryId, date: entry.date, type: 'diary', text: entry.text, mood: entry.mood }),
          });
          journalOk = true;
        } catch {
          if (attempt === 0) await new Promise(r => setTimeout(r, 800));
        }
      }

      if (!journalOk) {
        setSaving(false);
        setSeedError(true);
        return;
      }
    }

    // All required writes done — clear draft and complete
    await clearDraft();
    reloadData().catch(() => null);
    setSaving(false);
    playSound('chime');
    Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(onComplete);
  }, [selectedMood, selectedType, journalText, addJournalEntry, reloadData, onComplete, playSound]);

  // ── Skip — hides overlay for this session; does NOT mark onboarding done.
  //          Draft is preserved so the user resumes from this step on next sign-in.
  //          onDismiss (not onComplete) is called so _layout does NOT call markOnboardingDone.
  const handleSkip = useCallback(() => {
    playSound('tap');
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      onDismiss();
    });
  }, [playSound, onDismiss]);

  // ── Per-step "next" logic ──────────────────────────────────────────────────
  function handleNext() {
    if (step === STEP_JOURNAL) {
      goToStep(STEP_REVEAL);
      setTimeout(() => { fireSparks(); playSound('chime'); }, 350);
      return;
    }
    if (step === STEP_REVEAL) {
      handleFinish();
      return;
    }
    goToStep(step + 1);
  }

  const moodDef   = MOODS.find(m => m.id === selectedMood);
  const typeDef   = CONSTELLATION_TYPES.find(t => t.id === selectedType);
  const accentNow = step === STEP_MOOD          ? (moodDef?.color  ?? '#C8A84B')
                  : step === STEP_CONSTELLATION  ? (typeDef?.accent ?? '#9B78E8')
                  : step === STEP_REVEAL         ? (typeDef?.accent ?? '#C8A84B')
                  : '#C8A84B';

  const canAdvance = step === STEP_MOOD         ? !!selectedMood
                   : step === STEP_CONSTELLATION ? !!selectedType
                   : true;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[s.root, { opacity: fadeAnim }]}>

        {/* Static starfield */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient colors={['rgba(6,4,18,0.96)', 'rgba(12,8,32,0.98)']} style={StyleSheet.absoluteFill} />
          {STAR_POSITIONS.map((st, i) => (
            <View key={i} style={[s.star, { left: st.x, top: st.y, opacity: st.op, width: st.sz, height: st.sz, borderRadius: st.sz / 2 }]} />
          ))}
        </View>

        {/* Skip (top-right, all steps except reveal) */}
        {step !== STEP_REVEAL && (
          <Pressable style={s.earlySkip} onPress={handleSkip} hitSlop={16}>
            <Text style={s.earlySkipText}>Skip</Text>
          </Pressable>
        )}

        {/* Main card */}
        <Animated.View style={[s.card, { transform: [{ translateX: slideAnim }] }]}>
          <LinearGradient
            colors={
              step === STEP_CONSTELLATION && typeDef ? typeDef.gradient
              : step === STEP_MOOD && moodDef        ? ['#1A0E38', '#2A1560', '#1A0E38'] as const
              : ['#0E0B20', '#2A1560', '#1A0E38'] as const
            }
            style={StyleSheet.absoluteFill}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          />

          {step === STEP_WELCOME       && <WelcomeStep emojiScale={emojiScale} />}
          {step === STEP_MOOD          && (
            <MoodStep emojiScale={emojiScale} selectedMood={selectedMood} onSelect={pickMood} />
          )}
          {step === STEP_CONSTELLATION && (
            <ConstellationStep emojiScale={emojiScale} selectedType={selectedType} onSelect={pickType} />
          )}
          {step === STEP_JOURNAL       && (
            <JournalStep emojiScale={emojiScale} value={journalText} onChange={changeJournal} mood={selectedMood} />
          )}
          {step === STEP_REVEAL        && (
            <RevealStep
              emojiScale={emojiScale} sparkAnims={sparkAnims}
              selectedMood={selectedMood} selectedType={selectedType} accent={accentNow}
            />
          )}

          {/* Seed error banner */}
          {seedError && (
            <View style={s.errorBanner}>
              <Text style={s.errorText}>Couldn't reach the sky. Check your connection and try again.</Text>
            </View>
          )}

          {/* Progress dots */}
          <View style={s.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  i === step   ? [s.dotActive, { backgroundColor: accentNow }]
                  : i < step   ? { backgroundColor: `${accentNow}55`, width: 10 }
                  : { backgroundColor: 'rgba(255,255,255,0.15)' },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            {step > STEP_WELCOME && step !== STEP_REVEAL && (
              <TouchableOpacity style={s.backBtn} onPress={() => goToStep(step - 1)} activeOpacity={0.7}>
                <Text style={s.backBtnText}>← Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                s.nextBtn,
                {
                  backgroundColor: (canAdvance && !saving) ? accentNow : 'rgba(255,255,255,0.10)',
                  flex: (step <= STEP_WELCOME || step === STEP_REVEAL) ? 1 : 0,
                },
              ]}
              onPress={handleNext}
              activeOpacity={0.85}
              disabled={!canAdvance || saving}
            >
              <Text style={[s.nextBtnText, { color: (canAdvance && !saving) ? '#0E0B20' : 'rgba(220,210,240,0.40)' }]}>
                {step === STEP_WELCOME      ? 'Begin your sky →'
                : step === STEP_MOOD        ? 'Choose your mood →'
                : step === STEP_CONSTELLATION ? 'This is me →'
                : step === STEP_JOURNAL     ? (journalText.trim() ? 'Save my first line →' : 'Skip for now →')
                : saving && !seedError      ? 'Setting your sky…'
                : seedError                 ? 'Retry →'
                : 'Enter your sky ✦'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Step sub-components ────────────────────────────────────────────────────────

function WelcomeStep({ emojiScale }: { emojiScale: Animated.Value }) {
  return (
    <>
      <View style={s.orbWrap}>
        <Animated.View style={[s.orbGlow, { backgroundColor: '#C8A84B30', transform: [{ scale: emojiScale }] }]} />
        <Animated.View style={[s.orb, { borderColor: '#C8A84B55', transform: [{ scale: emojiScale }] }]}>
          <Text style={s.emoji}>✦</Text>
        </Animated.View>
      </View>
      <Text style={[s.stepLabel, { color: '#C8A84B' }]}>WELCOME</Text>
      <Text style={s.title}>Your sky is waiting</Text>
      <Text style={s.desc}>
        Sky Journal is a dreamy space for your memories, stories, and soul. In just a moment, we'll shape your sky to feel like home.
      </Text>
      <View style={[s.hintPill, { borderColor: '#C8A84B40', backgroundColor: '#C8A84B12' }]}>
        <Text style={[s.hintText, { color: '#C8A84B' }]}>Takes about 60 seconds ✦</Text>
      </View>
    </>
  );
}

function MoodStep({
  emojiScale, selectedMood, onSelect,
}: {
  emojiScale: Animated.Value;
  selectedMood: MoodId | null;
  onSelect: (id: MoodId) => void;
}) {
  const moodDef = MOODS.find(m => m.id === selectedMood);
  const accent  = moodDef?.color ?? '#9B78E8';
  return (
    <>
      <View style={s.orbWrap}>
        <Animated.View style={[s.orbGlow, { backgroundColor: `${accent}28`, transform: [{ scale: emojiScale }] }]} />
        <Animated.View style={[s.orb, { borderColor: `${accent}55`, transform: [{ scale: emojiScale }] }]}>
          <Text style={s.emoji}>{moodDef?.emoji ?? '🌙'}</Text>
        </Animated.View>
      </View>
      <Text style={[s.stepLabel, { color: accent }]}>YOUR VIBE</Text>
      <Text style={s.title}>How does your sky feel today?</Text>
      <Text style={[s.desc, { marginBottom: 16 }]}>Pick the mood that fits right now. You can change this any time.</Text>
      <View style={s.moodGrid}>
        {MOODS.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[s.moodChip, selectedMood === m.id && { backgroundColor: `${m.color}30`, borderColor: `${m.color}80` }]}
            onPress={() => onSelect(m.id)}
            activeOpacity={0.75}
          >
            <Text style={s.moodEmoji}>{m.emoji}</Text>
            <Text style={[s.moodLabel, { color: selectedMood === m.id ? m.color : 'rgba(220,210,240,0.65)' }]}>{m.id}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function ConstellationStep({
  emojiScale, selectedType, onSelect,
}: {
  emojiScale: Animated.Value;
  selectedType: ConstellationType | null;
  onSelect: (id: ConstellationType) => void;
}) {
  const typeDef = CONSTELLATION_TYPES.find(t => t.id === selectedType);
  const accent  = typeDef?.accent ?? '#9B78E8';
  return (
    <>
      <View style={s.orbWrap}>
        <Animated.View style={[s.orbGlow, { backgroundColor: `${accent}28`, transform: [{ scale: emojiScale }] }]} />
        <Animated.View style={[s.orb, { borderColor: `${accent}55`, transform: [{ scale: emojiScale }] }]}>
          <Text style={s.emoji}>{typeDef?.emoji ?? '✨'}</Text>
        </Animated.View>
      </View>
      <Text style={[s.stepLabel, { color: accent }]}>YOUR CONSTELLATION</Text>
      <Text style={s.title}>What kind of sky child are you?</Text>
      <View style={{ width: '100%', gap: 10, marginTop: 8, marginBottom: 12 }}>
        {CONSTELLATION_TYPES.map(ct => (
          <TouchableOpacity
            key={ct.id}
            style={[s.typeCard, selectedType === ct.id && { borderColor: `${ct.accent}80`, backgroundColor: `${ct.accent}18` }]}
            onPress={() => onSelect(ct.id)}
            activeOpacity={0.78}
          >
            <Text style={s.typeEmoji}>{ct.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.typeName, { color: selectedType === ct.id ? ct.accent : '#EDE8FF' }]}>{ct.name}</Text>
              <Text style={s.typeDesc} numberOfLines={2}>{ct.desc}</Text>
            </View>
            {selectedType === ct.id && (
              <View style={[s.typeCheck, { backgroundColor: ct.accent }]}>
                <Text style={{ fontSize: 10, color: '#0E0B20' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function JournalStep({
  emojiScale, value, onChange, mood,
}: {
  emojiScale: Animated.Value;
  value: string;
  onChange: (t: string) => void;
  mood: MoodId | null;
}) {
  const moodDef = MOODS.find(m => m.id === mood);
  const accent  = moodDef?.color ?? '#9B78E8';
  return (
    <>
      <View style={s.orbWrap}>
        <Animated.View style={[s.orbGlow, { backgroundColor: `${accent}28`, transform: [{ scale: emojiScale }] }]} />
        <Animated.View style={[s.orb, { borderColor: `${accent}55`, transform: [{ scale: emojiScale }] }]}>
          <Text style={s.emoji}>📖</Text>
        </Animated.View>
      </View>
      <Text style={[s.stepLabel, { color: accent }]}>YOUR FIRST LINE</Text>
      <Text style={s.title}>Write one line about today</Text>
      <Text style={[s.desc, { marginBottom: 18 }]}>Just one honest sentence. It'll be your first journal entry — completely private.</Text>
      <TextInput
        style={[s.journalInput, { borderColor: `${accent}50` }]}
        placeholder="Today I feel…"
        placeholderTextColor="rgba(200,184,232,0.35)"
        value={value}
        onChangeText={onChange}
        maxLength={200}
        multiline={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        autoFocus={Platform.OS !== 'web'}
      />
      <Text style={s.charCount}>{value.length}/200</Text>
    </>
  );
}

function RevealStep({
  emojiScale, sparkAnims, selectedMood, selectedType, accent,
}: {
  emojiScale: Animated.Value;
  sparkAnims: { x: Animated.Value; y: Animated.Value; op: Animated.Value; sc: Animated.Value }[];
  selectedMood: MoodId | null;
  selectedType: ConstellationType | null;
  accent: string;
}) {
  const moodDef = MOODS.find(m => m.id === selectedMood);
  const typeDef = CONSTELLATION_TYPES.find(t => t.id === selectedType);
  return (
    <>
      <View style={[s.orbWrap, { marginBottom: 20 }]}>
        <Animated.View style={[s.orbGlow, { width: 160, height: 160, borderRadius: 80, backgroundColor: `${accent}30`, transform: [{ scale: emojiScale }] }]} />
        <Animated.View style={[s.orb, { width: 110, height: 110, borderRadius: 55, borderColor: `${accent}60`, transform: [{ scale: emojiScale }] }]}>
          <Text style={{ fontSize: 48 }}>{typeDef?.emoji ?? '✦'}</Text>
        </Animated.View>
        {sparkAnims.map((p, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[s.spark, { backgroundColor: accent, transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.sc }], opacity: p.op }]}
          />
        ))}
      </View>
      <Text style={[s.stepLabel, { color: accent }]}>YOUR SKY IS READY</Text>
      <Text style={s.title}>Welcome, {typeDef?.name ?? 'Sky Child'}</Text>
      <Text style={s.desc}>
        Your sky is{moodDef ? ` ${moodDef.id.toLowerCase()} ` : ' '}and waiting. Your constellation lights the way. Let the journey begin.
      </Text>
      {selectedMood && (
        <View style={[s.hintPill, { borderColor: `${accent}40`, backgroundColor: `${accent}12` }]}>
          <Text style={[s.hintText, { color: accent }]}>{moodDef?.emoji} {selectedMood} sky • {typeDef?.name}</Text>
        </View>
      )}
    </>
  );
}

// ── Async helpers (public API for _layout.tsx) ─────────────────────────────────

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(DONE_KEY);
    return v === 'done';
  } catch { return false; }
}

export async function markOnboardingDone(): Promise<void> {
  try { await AsyncStorage.setItem(DONE_KEY, 'done'); } catch { /* ignore */ }
}

// ── Static star field ──────────────────────────────────────────────────────────

const STAR_POSITIONS = Array.from({ length: 48 }, (_, i) => ({
  x:  (i * 137.508) % W,
  y:  (i * 97.301)  % H,
  op: 0.06 + (i % 5) * 0.05,
  sz: 1 + (i % 3),
}));

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         9999,
  },

  star: {
    position:        'absolute',
    backgroundColor: '#FFFFFF',
  },

  earlySkip: {
    position: 'absolute',
    top:      56,
    right:    24,
    zIndex:   10,
  },
  earlySkipText: {
    fontSize:    13,
    fontFamily:  'Satoshi-Medium',
    color:       'rgba(200,184,232,0.45)',
  },

  card: {
    width:             Math.min(W - 32, 400),
    maxHeight:         H * 0.90,
    borderRadius:      28,
    paddingTop:        36,
    paddingBottom:     32,
    paddingHorizontal: 24,
    alignItems:        'center',
    overflow:          'hidden',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.06)',
    elevation:         30,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 16 },
    shadowOpacity:     0.75,
    shadowRadius:      36,
  },

  // Orb
  orbWrap: {
    width:          120,
    height:         120,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   24,
  },
  orbGlow: {
    position:     'absolute',
    width:        140,
    height:       140,
    borderRadius: 70,
  },
  orb: {
    width:           96,
    height:          96,
    borderRadius:    48,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  emoji: { fontSize: 38 },

  // Sparks
  spark: {
    position:     'absolute',
    width:        6,
    height:       6,
    borderRadius: 3,
  },

  // Error banner
  errorBanner: {
    width:             '100%',
    marginBottom:      12,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       'rgba(200,80,80,0.40)',
    backgroundColor:   'rgba(200,60,60,0.12)',
  },
  errorText: {
    fontSize:    12,
    fontFamily:  'Satoshi-Medium',
    color:       '#F08080',
    textAlign:   'center',
  },

  // Text
  stepLabel: {
    fontSize:      10,
    fontFamily:    'Satoshi-Bold',
    letterSpacing: 2.8,
    marginBottom:  10,
    opacity:       0.90,
  },
  title: {
    fontSize:      24,
    fontFamily:    'Satoshi-Black',
    color:         '#F0EAF8',
    textAlign:     'center',
    marginBottom:  12,
    lineHeight:    30,
  },
  desc: {
    fontSize:     14,
    fontFamily:   'Satoshi-Regular',
    color:        'rgba(220,210,240,0.75)',
    textAlign:    'center',
    lineHeight:   21,
    marginBottom: 16,
  },

  hintPill: {
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderRadius:      20,
    borderWidth:       1,
    marginBottom:      16,
  },
  hintText: {
    fontSize:      12,
    fontFamily:    'Satoshi-Medium',
    letterSpacing: 0.3,
  },

  // Mood grid
  moodGrid: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            8,
    width:          '100%',
    marginBottom:   16,
    justifyContent: 'center',
  },
  moodChip: {
    width:           '22%',
    alignItems:      'center',
    paddingVertical: 10,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     'rgba(200,184,232,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap:             4,
  },
  moodEmoji: { fontSize: 22 },
  moodLabel: {
    fontSize:      9,
    fontFamily:    'Satoshi-Bold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  // Constellation type cards
  typeCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   12,
    paddingHorizontal: 14,
    borderRadius:      16,
    borderWidth:       1,
    borderColor:       'rgba(200,184,232,0.12)',
    backgroundColor:   'rgba(255,255,255,0.02)',
  },
  typeEmoji: { fontSize: 26 },
  typeName:  { fontSize: 14, fontFamily: 'Satoshi-Bold', marginBottom: 2 },
  typeDesc:  { fontSize: 11, fontFamily: 'Satoshi-Regular', color: 'rgba(200,184,232,0.55)', lineHeight: 16 },
  typeCheck: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Journal input
  journalInput: {
    width:             '100%',
    paddingHorizontal: 16,
    paddingVertical:   14,
    borderRadius:      14,
    borderWidth:       1.5,
    backgroundColor:   'rgba(255,255,255,0.04)',
    fontSize:          15,
    fontFamily:        'Satoshi-Regular',
    color:             '#F0EAF8',
    marginBottom:      6,
  },
  charCount: {
    alignSelf:    'flex-end',
    fontSize:     11,
    fontFamily:   'Satoshi-Medium',
    color:        'rgba(200,184,232,0.35)',
    marginBottom: 16,
  },

  // Progress dots
  dots: {
    flexDirection: 'row',
    gap:           8,
    marginBottom:  24,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: 4,
  },
  dotActive: { width: 22 },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap:           10,
    width:         '100%',
  },
  backBtn: {
    height:            50,
    paddingHorizontal: 16,
    borderRadius:      14,
    alignItems:        'center',
    justifyContent:    'center',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.10)',
  },
  backBtnText: {
    fontSize:   14,
    fontFamily: 'Satoshi-Medium',
    color:      'rgba(220,210,240,0.55)',
  },
  nextBtn: {
    height:            50,
    borderRadius:      14,
    paddingHorizontal: 20,
    alignItems:        'center',
    justifyContent:    'center',
  },
  nextBtnText: {
    fontSize:   15,
    fontFamily: 'Satoshi-Bold',
  },
});
