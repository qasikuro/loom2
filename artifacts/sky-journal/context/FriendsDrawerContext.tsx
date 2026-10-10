import { useAuth } from '@clerk/expo';
import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FriendsMessagesDrawer, type DrawerTab } from '@/components/FriendsMessagesDrawer';

interface DrawerCtx { isOpen: boolean; open: (tab?: DrawerTab) => void; close: () => void }
const Ctx = createContext<DrawerCtx | null>(null);

export function FriendsDrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const { isSignedIn, userId } = useAuth();
  const pathname = usePathname();
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const visible = isOpen && !!isSignedIn && !!userId && openedFor === userId;
  const [tab, setTab] = useState<DrawerTab>('all');
  useEffect(() => { setOpen(false); setTab('all'); }, [userId, isSignedIn, pathname]);
  const open = useCallback((t: DrawerTab = 'all') => {
    if (!isSignedIn || !userId) return;
    setOpenedFor(userId); setTab(t); setOpen(true);
  }, [isSignedIn, userId]);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ isOpen: visible, open, close }), [visible, open, close]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <FriendsMessagesDrawer key={userId ?? 'signed-out'} visible={visible} scopeKey={userId ?? null} initialTab={tab} onClose={close} />
    </Ctx.Provider>
  );
}

export function useFriendsDrawer(): DrawerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFriendsDrawer must be used inside FriendsDrawerProvider');
  return c;
}
