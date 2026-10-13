import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { LUMI_MOODS, readChatContext, sessionIdeas } from '../../features/lumi/logic';

describe('short mood-guided sessions', () => {
  it('keeps every checklist short, unique and optional across moods and needs', () => {
    for (const mood of LUMI_MOODS) {
      for (const intent of ['company', 'quiet', 'creative', 'focus', 'unspecified'] as const) {
        const ideas = sessionIdeas(mood, readChatContext([], intent));
        expect(ideas).toHaveLength(3);
        expect(new Set(ideas).size).toBe(ideas.length);
      }
    }
  });

  it('prioritizes requested company even for a tired player', () => {
    expect(sessionIdeas('tired', readChatContext([], 'company'))[0]).toBe('hello');
  });

  it('never treats sadness or loneliness as permission for a social task', () => {
    for (const mood of ['sad', 'lonely'] as const) {
      expect(sessionIdeas(mood, readChatContext([], 'quiet'))[0]).toBe('quietSpot');
      expect(sessionIdeas(mood, readChatContext([], 'quiet'))).not.toContain('hello');
      expect(sessionIdeas(mood, readChatContext([], 'unspecified'))).not.toContain('hello');
    }
  });

  it('starts with a simple creative or focus task when asked', () => {
    expect(sessionIdeas('stressed', readChatContext([], 'creative'))[0]).toBe('create');
    expect(sessionIdeas('sad', readChatContext([], 'focus'))[0]).toBe('goal');
  });
});

// Source-contract guards complement the pure policy tests. They do not claim
// to simulate native navigation, layout, accessibility or button interaction.
describe('in-chat check-in wiring', () => {
  const companion = readFileSync(new URL('../../features/lumi/components/LumiCompanion.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../../app/(tabs)/drift.tsx', import.meta.url), 'utf8');
  const session = readFileSync(new URL('../../features/lumi/components/LumiMoodSession.tsx', import.meta.url), 'utf8');

  it('keeps the check-in in the latest-message slot of the existing chat', () => {
    expect(companion).toContain('ListHeaderComponent={<View style={{ gap: 12 }}>{sessionPrompt}');
    expect(companion).toContain('onCheckIn={openCheckIn}');
    expect(route).not.toContain("onCheckIn={() => go('welcome'");
  });

  it('does not require a timed session and guards duplicate completion', () => {
    expect(session).toContain("{ id: null, icon: 'message-circle' }");
    expect(companion).toContain('if (result.minutes !== null) startSession(result.minutes)');
    expect(companion).toContain('completingCheckIn.current');
    expect(session).toContain('disabled={!canNext}');
  });

  it('isolates the chat and restored session across account changes', () => {
    expect(route).toContain("key={userId ?? 'signed-out'}");
    expect(route).toContain('activeSession={sessionOwner === userId && sessionStart && mode');
  });

  it('discloses AI processing before completion and permits cancellation', () => {
    expect(session).toContain("t('lumi.checkin.dataNotice'");
    expect(session).toContain('onPress={onCancel}');
    expect(companion).toContain('onSkip={stayInChat}');
  });
});
