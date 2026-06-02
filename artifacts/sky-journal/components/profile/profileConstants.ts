import { Images } from '@/assets/images';
import type { Story } from '@/context/AppContext';

export const BG_MAP: Record<string, any> = {
  bg1: Images.story_bg1, bg2: Images.story_bg2,
  bg3: Images.story_bg3, char: Images.character_default,
};

export function getCover(story: Story) {
  const p = story.panels[0];
  if (!p) return null;
  if (p.imageUri) return { uri: p.imageUri };
  if (p.bgPreset && BG_MAP[p.bgPreset]) return BG_MAP[p.bgPreset];
  return null;
}

export function fmtBal(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 1000)}k`;
  if (n >= 1000)  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export interface SocialPlatform {
  key:    string;
  label:  string;
  icon:   string;
  color:  string;
  prefix: string;
  placeholder: string;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram', label: 'Instagram',   icon: '📸', color: '#E1306C', prefix: 'https://instagram.com/',           placeholder: 'your_handle' },
  { key: 'tiktok',    label: 'TikTok',      icon: '🎵', color: '#010101', prefix: 'https://tiktok.com/@',            placeholder: 'yourhandle' },
  { key: 'twitter',   label: 'X / Twitter', icon: '✕',  color: '#1A8CD8', prefix: 'https://x.com/',                  placeholder: 'yourhandle' },
  { key: 'youtube',   label: 'YouTube',     icon: '▶',  color: '#FF0000', prefix: 'https://youtube.com/@',           placeholder: 'yourchannel' },
  { key: 'pinterest', label: 'Pinterest',   icon: '📌', color: '#E60023', prefix: 'https://pinterest.com/',          placeholder: 'yourprofile' },
  { key: 'twitch',    label: 'Twitch',      icon: '🎮', color: '#9146FF', prefix: 'https://twitch.tv/',              placeholder: 'yourchannel' },
  { key: 'spotify',   label: 'Spotify',     icon: '🎧', color: '#1DB954', prefix: 'https://open.spotify.com/user/', placeholder: 'userid' },
  { key: 'snapchat',  label: 'Snapchat',    icon: '👻', color: '#FFCC00', prefix: 'https://snapchat.com/add/',      placeholder: 'yourhandle' },
  { key: 'discord',   label: 'Discord',     icon: '💬', color: '#5865F2', prefix: 'https://discord.gg/',            placeholder: 'invite-code' },
  { key: 'bereal',    label: 'BeReal',      icon: '📷', color: '#3D3D3D', prefix: 'https://bere.al/',               placeholder: 'yourhandle' },
  { key: 'other',     label: 'Other',       icon: '🔗', color: '#6B5B95', prefix: '',                               placeholder: 'https://...' },
];

export function getPlatform(key: string | undefined) {
  return SOCIAL_PLATFORMS.find(p => p.key === key) ?? null;
}

export function extractHandle(url: string, prefix: string): string {
  if (!prefix || !url.startsWith(prefix)) return url;
  return url.slice(prefix.length).replace(/^@/, '').replace(/\/$/, '');
}

export const ATTRIBUTE_SUGGESTIONS = [
  'Dreamer', 'Curious', 'Kind', 'Loner', 'Brave', 'Gentle',
  'Wanderer', 'Silent', 'Joyful', 'Nostalgic', 'Hopeful', 'Mystic',
  'Observer', 'Poet', 'Seeker', 'Free Spirit',
];

export const ROLES = [
  { key: 'Collector', emoji: '🎁', color: '#C8A84B', hint: 'Gathers moments & items' },
  { key: 'Trader',    emoji: '🤝', color: '#78A8C8', hint: 'Connects & exchanges' },
  { key: 'Veteran',   emoji: '⭐', color: '#D4956A', hint: 'Long-time wanderer' },
  { key: 'Uber',      emoji: '👑', color: '#9B78E8', hint: 'Sky legend' },
  { key: 'Solo',      emoji: '🌙', color: '#6080C0', hint: 'Lone spirit' },
] as const;

export const GUIDE_TOPICS = [
  'Anxiety & Stress', 'Motivation', 'Self Growth', 'Relationships',
  'Loneliness', 'Creativity', 'Spirituality', 'Mental Health',
  'Dreams & Goals', 'Grief', 'Social Skills', 'Mindfulness',
];

export const GUIDE_TOPIC_COLORS: Record<string, string> = {
  'Anxiety & Stress': '#E87898', 'Motivation': '#E8A850', 'Self Growth': '#68C890',
  'Relationships': '#D878B0', 'Loneliness': '#7890C8', 'Creativity': '#B878E8',
  'Spirituality': '#C8A84B', 'Mental Health': '#78B8D8', 'Dreams & Goals': '#9878D8',
  'Grief': '#8890A8', 'Social Skills': '#78C8A8', 'Mindfulness': '#68B8B0',
};

export const DAY_LABELS_G = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MOOD_COLORS: Record<string, string> = {
  Peaceful: '#5B9BB5', Joyful: '#D4A849', Melancholy: '#5D7BA5',
  Nostalgic: '#A5785D', Hopeful: '#6BA57A', Dreamy: '#9B7AB5',
  Romantic: '#B86098', Chaotic: '#B85830', Soft: '#7B6BAA',
  Adventurous: '#3A9060',
};

export type AuraData = {
  gradient: [string, string, string];
  overlay:  [string, string, string];
  accent:   string;
  particle: string;
  speed:    number;
  count:    number;
};

export const MOOD_AURA: Record<string, AuraData> = {
  Hopeful:     { gradient: ['#131A0E','#1A2614','#20301A'], overlay: ['#1C2A16','#243020','#2A3826'], accent: '#C8A84B', particle: '✦', speed: 3800, count: 6  },
  Peaceful:    { gradient: ['#0C1A24','#10202E','#162838'], overlay: ['#122232','#18283A','#1E2E42'], accent: '#78A8C8', particle: '✧', speed: 5200, count: 5  },
  Lonely:      { gradient: ['#0C0C1E','#101226','#141830'], overlay: ['#14162C','#181C34','#1C2238'], accent: '#7090C0', particle: '·', speed: 7000, count: 4  },
  Dreamy:      { gradient: ['#120A2A','#1A1240','#221852'], overlay: ['#1C1640','#241E52','#2A2460'], accent: '#B89AE8', particle: '⋆', speed: 5500, count: 8  },
  Romantic:    { gradient: ['#1C0A12','#260E1E','#30142A'], overlay: ['#261430','#301A3A','#381E44'], accent: '#D878B0', particle: '◦', speed: 4200, count: 6  },
  Soft:        { gradient: ['#140A1E','#1C102E','#22163A'], overlay: ['#1E1438','#261A44','#2C204C'], accent: '#C8A0D8', particle: '○', speed: 6000, count: 5  },
  Chaotic:     { gradient: ['#1C0804','#280C06','#34100A'], overlay: ['#281008','#341408','#3E180C'], accent: '#E8784A', particle: '✸', speed: 1800, count: 10 },
  Joyful:      { gradient: ['#081408','#0E1E0E','#16281A'], overlay: ['#102014','#181E10','#1C2A1A'], accent: '#70C888', particle: '★', speed: 3000, count: 7  },
  Adventurous: { gradient: ['#0A160A','#101C0E','#162416'], overlay: ['#142018','#1A2818','#202E22'], accent: '#6AC888', particle: '↑', speed: 2500, count: 8  },
  Grateful:    { gradient: ['#1A0C18','#221020','#2A162C'], overlay: ['#221430','#2C1A38','#321E40'], accent: '#D878B0', particle: '✿', speed: 4500, count: 6  },
};

export const DEFAULT_AURA: AuraData = {
  gradient: ['#1D1A2E','#272450','#2E2A58'],
  overlay:  ['#22203A','#2C2A5A','#342E62'],
  accent: '#9B78E8', particle: '✦', speed: 4500, count: 6,
};

export const PARTICLE_XS    = [0.07, 0.20, 0.34, 0.50, 0.63, 0.76, 0.87, 0.94, 0.13, 0.57];
export const PARTICLE_SIZES = [16,   11,   20,   14,   12,   18,   10,   22,   15,   13];

export const FRAME_CONFIGS: Record<string, { color: string; glow: string; dashOpacity: number }> = {
  frame_starlight: { color: '#C8A84B', glow: 'rgba(200,168,75,0.40)',   dashOpacity: 0.90 },
  frame_moonveil:  { color: '#B8C8DC', glow: 'rgba(184,200,220,0.35)', dashOpacity: 0.82 },
  frame_blossom:   { color: '#F0A8C0', glow: 'rgba(240,168,192,0.38)', dashOpacity: 0.88 },
  frame_solstice:  { color: '#F0B840', glow: 'rgba(240,184,64,0.42)',  dashOpacity: 0.88 },
  frame_harvest:   { color: '#D47830', glow: 'rgba(212,120,48,0.40)',  dashOpacity: 0.86 },
  frame_frost:     { color: '#A8D0F0', glow: 'rgba(168,208,240,0.38)', dashOpacity: 0.84 },
};

export const ACCENT_CONFIGS: Record<string, { color: string; shadow: string }> = {
  accent_aura:     { color: '#6B5B95', shadow: 'rgba(107,91,149,0.55)' },
  accent_petal:    { color: '#D878A0', shadow: 'rgba(216,120,160,0.50)' },
  accent_twilight: { color: '#4888C8', shadow: 'rgba(72,136,200,0.50)' },
  accent_ember:    { color: '#D47830', shadow: 'rgba(212,120,48,0.50)'  },
};

export const MOOD_ORBS = [
  { key: 'Hopeful',  accent: '#C8A84B' }, { key: 'Peaceful', accent: '#78A8C8' },
  { key: 'Dreamy',   accent: '#B89AE8' }, { key: 'Lonely',   accent: '#7090C0' },
  { key: 'Soft',     accent: '#C8A0D8' }, { key: 'Romantic', accent: '#D878B0' },
  { key: 'Chaotic',  accent: '#E8784A' }, { key: 'Joyful',   accent: '#70C888' },
];
