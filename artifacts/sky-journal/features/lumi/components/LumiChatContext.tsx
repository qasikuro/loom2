import { createContext, useContext } from 'react';
import type { ActiveSession, LumiMood, SessionMinutes } from '../logic';

/** Chat-level actions shared with recommendation cards (optional outside the companion). */
export type LumiChatActions = {
  ask?: (text: string) => void;
  mood?: LumiMood;
  activeSession?: ActiveSession | null;
  startSession?: (minutes: SessionMinutes) => void;
};
export const LumiChatContext = createContext<LumiChatActions>({});
export const useLumiChat = () => useContext(LumiChatContext);
