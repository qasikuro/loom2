import type { RigValues } from '../home/useLumiRig';

export type ChatEmoteId =
  | 'heart' | 'facepalm' | 'gasp' | 'hug' | 'laugh' | 'eyeRoll'
  | 'teary' | 'hush' | 'peek' | 'salute' | 'angry' | 'flustered' | 'dizzy';
export type ChatEmote = { id: ChatEmoteId; emoji: string; label: string; description: string };
export const CHAT_EMOTES: readonly ChatEmote[] = [
  { id: 'heart', emoji: '❤️', label: 'Love', description: 'Lumi sends a little heart' },
  { id: 'facepalm', emoji: '🤦', label: 'Oh no', description: 'A very dramatic facepalm' },
  { id: 'gasp', emoji: '🫢', label: 'Gasp', description: 'Lumi cannot believe it' },
  { id: 'hug', emoji: '🤗', label: 'Hug', description: 'A big, soft Lumi hug' },
  { id: 'laugh', emoji: '🤣', label: 'Laugh', description: 'Lumi gets the giggles' },
  { id: 'eyeRoll', emoji: '🙄', label: 'Really?', description: 'The tiniest eye roll' },
  { id: 'teary', emoji: '🥲', label: 'A little cry', description: 'A tiny tear and a brave smile' },
  { id: 'hush', emoji: '🤫', label: 'Shh', description: 'Lumi keeps your secret' },
  { id: 'peek', emoji: '🫣', label: 'Peek', description: 'Lumi hides, then peeks out' },
  { id: 'salute', emoji: '🫡', label: 'Got it', description: 'Reporting for friendship duty' },
  { id: 'angry', emoji: '😤', label: 'Tiny tantrum', description: 'A cute little huff, not a scary one' },
  { id: 'flustered', emoji: '😳', label: 'Blush', description: 'Lumi gets wonderfully flustered' },
  { id: 'dizzy', emoji: '😵‍💫', label: 'Dizzy', description: 'Lumi needs a moment' },
];

export type ChatPose = {
  key: keyof RigValues;
  steps: readonly (readonly [target: number, duration: number])[];
  delay?: number;
};
export type ChatPerformance = { duration: number; poses: readonly ChatPose[] };
const pose = (key: keyof RigValues, ...steps: [number, number][]): ChatPose => ({ key, steps });
const hold = (key: keyof RigValues, target: number): ChatPose =>
  pose(key, [target, 220], [target, 1400], [0, 260]);

// Separate chat-only choreography. Home's reaction cycle stays unchanged.
export const CHAT_PERFORMANCES: Record<ChatEmoteId, ChatPerformance> = {
  heart: { duration: 2200, poses: [
    hold('blush', 1), hold('mLaugh', 0.85), hold('armsOpen', 1),
    pose('heart', [0.12, 280], [0.7, 1250], [1, 350]),
    hold('hearts', 1), hold('reach', 0.65),
  ] },
  facepalm: { duration: 2200, poses: [
    hold('armR', -135), hold('faceRot', -9), hold('faceY', 8),
    hold('shut', 1), hold('mSad', 1),
    pose('bodyRot', [-5, 300], [-5, 1000], [0, 400]),
  ] },
  gasp: { duration: 2100, poses: [
    hold('wide', 1), hold('mOpen', 1), hold('armR', -110), hold('brows', 1),
    pose('hop', [-13, 180], [0, 220]), hold('blush', 0.7),
  ] },
  hug: { duration: 2400, poses: [
    hold('armsOpen', 1), hold('reach', 1), hold('shut', 1),
    hold('mLaugh', 0.85), hold('blush', 1), hold('squash', 0.3),
    pose('faceRot', [-5, 400], [5, 500], [-3, 450], [0, 400]),
  ] },
  laugh: { duration: 2300, poses: [
    hold('shut', 1), hold('mLaugh', 1), hold('armL', 38), hold('armR', -38),
    pose('bodyRot', [-7, 180], [7, 200], [-7, 200], [7, 200], [-4, 200], [0, 250]),
    pose('hop', [-12, 160], [0, 160], [-9, 160], [0, 160], [-6, 160], [0, 200]),
    hold('squash', 0.35),
  ] },
  eyeRoll: { duration: 2200, poses: [
    hold('lids', 0.9), hold('mSad', 0.6), hold('brows', 0.4),
    pose('lookX', [-12, 250], [0, 300], [12, 350], [12, 650], [0, 250]),
    hold('lookY', -16), hold('faceRot', -8), hold('armL', 20),
  ] },
  teary: { duration: 2500, poses: [
    hold('mSad', 1), hold('lookY', 10), hold('faceY', 8),
    hold('armL', 22), hold('armR', -22), hold('blush', 0.75),
    pose('faceRot', [-4, 400], [4, 500], [-3, 450], [0, 400]),
    { ...hold('mLaugh', 0.7), delay: 420 },
  ] },
  hush: { duration: 2200, poses: [
    hold('armR', -125), hold('mOpen', 0.45), hold('lids', 0.4),
    hold('lookX', -8), hold('faceRot', 5),
    pose('faceY', [-5, 350], [-5, 1050], [0, 350]),
  ] },
  peek: { duration: 2400, poses: [
    pose('cover', [1, 200], [1, 700], [0.35, 350], [0.35, 400], [0, 350]),
    pose('shut', [1, 180], [1, 650], [0, 180]),
    hold('blush', 1), hold('mOpen', 0.5),
    pose('lookX', [0, 800], [12, 300], [-9, 300], [0, 350]),
    pose('faceY', [10, 300], [10, 600], [0, 600]),
  ] },
  salute: { duration: 2200, poses: [
    hold('armR', -150), hold('brows', 1), hold('wide', 0.5),
    hold('mLaugh', 0.65), hold('faceRot', -5), hold('reach', 0.4),
    pose('bodyRot', [-4, 250], [-4, 1400], [0, 250]),
  ] },
  angry: { duration: 2300, poses: [
    hold('brows', 1), hold('lids', 0.65), hold('mSad', 1),
    hold('armL', 48), hold('armR', -48), hold('blush', 1),
    pose('squash', [0.6, 260], [-0.2, 220], [0.5, 220], [0, 250]),
    pose('bodyRot', [-4, 250], [4, 250], [-4, 250], [0, 300]),
  ] },
  flustered: { duration: 2300, poses: [
    hold('blush', 1), hold('wide', 1), hold('mOpen', 0.7),
    hold('armL', 65), hold('armR', -65), hold('sweat', 1),
    pose('lookX', [-11, 250], [11, 250], [-6, 250], [6, 250], [0, 350]),
    pose('faceRot', [-6, 350], [6, 350], [0, 400]),
  ] },
  dizzy: { duration: 2600, poses: [
    hold('lids', 0.6), hold('mOpen', 0.55), hold('sweat', 0.7),
    pose('faceRot', [-16, 300], [14, 350], [-11, 350], [8, 350], [0, 350]),
    pose('bodyRot', [10, 350], [-9, 400], [7, 400], [0, 350]),
    pose('lookX', [12, 300], [-12, 350], [10, 350], [-8, 350], [0, 350]),
    hold('armL', 70), hold('armR', -70),
  ] },
};

export const CHAT_WALK_MS = 680;
export function getChatEmote(id: string): ChatEmote | null {
  return CHAT_EMOTES.find(emote => emote.id === id) ?? null;
}
export function chatPosition(width: number, size: number, dock: 'left' | 'center' | 'right'): number {
  const span = Math.max(0, (Number.isFinite(width) ? width : 0) - (Number.isFinite(size) ? Math.max(0, size) : 0));
  const inset = Math.min(12, span / 2);
  return dock === 'center' ? span / 2 : dock === 'left' ? inset : span - inset;
}
/** One pending performance at most; repeated taps replace, never accumulate. */
export function pendingChatEmote(current: ChatEmoteId, next: ChatEmoteId): ChatEmoteId | null {
  return current === next ? null : next;
}
