export const STICKERS = [
  { type: 'Hopeful',     emoji: '☀️', color: '#C8A84B', bg: '#2A1E00' },
  { type: 'Peaceful',    emoji: '🌊', color: '#58A0B8', bg: '#0A1E28' },
  { type: 'Lonely',      emoji: '🌙', color: '#6B8EC8', bg: '#0E1A30' },
  { type: 'Romantic',    emoji: '💕', color: '#C87AA8', bg: '#2A0E1E' },
  { type: 'Chaotic',     emoji: '🌪️', color: '#C87850', bg: '#2A1000' },
  { type: 'Adventurous', emoji: '⚡', color: '#58A878', bg: '#0A2018' },
  { type: 'Dreamy',      emoji: '✨', color: '#9878C8', bg: '#1A0E2E' },
  { type: 'Soft',        emoji: '🌸', color: '#C887A8', bg: '#2A0E20' },
] as const;

export type StickerType = (typeof STICKERS)[number]['type'];
