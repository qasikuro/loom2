import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'storigam:global-chat-button-enabled:v1';

interface GlobalChatButtonSettings {
  enabled: boolean;
  isLoaded: boolean;
  setEnabled: (enabled: boolean) => void;
}

const GlobalChatButtonSettingsContext = createContext<GlobalChatButtonSettings | null>(null);

export function GlobalChatButtonSettingsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const userChangedValue = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        if (!active || userChangedValue.current) return;
        if (value === 'true' || value === 'false') setEnabledState(value === 'true');
      })
      .catch(() => null)
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => { active = false; };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    userChangedValue.current = true;
    setEnabledState(value);
    AsyncStorage.setItem(STORAGE_KEY, String(value)).catch(() => null);
  }, []);

  const contextValue = useMemo(() => ({ enabled, isLoaded, setEnabled }), [enabled, isLoaded, setEnabled]);

  return (
    <GlobalChatButtonSettingsContext.Provider value={contextValue}>
      {children}
    </GlobalChatButtonSettingsContext.Provider>
  );
}

export function useGlobalChatButtonSettings() {
  const context = useContext(GlobalChatButtonSettingsContext);
  if (!context) throw new Error('useGlobalChatButtonSettings must be used within GlobalChatButtonSettingsProvider');
  return context;
}
