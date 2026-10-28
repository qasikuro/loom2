/** Coordinates native animation callbacks with React's later unmount commit. */
export function createTeyvatViewerSession() {
  let revision = 0;
  let phase: 'idle' | 'open' | 'closing' | 'awaiting-commit' = 'idle';
  return {
    open() {
      if (phase !== 'idle') return null;
      phase = 'open';
      return ++revision;
    },
    isOpen() {
      return phase === 'open';
    },
    beginClose(session: number) {
      if (session !== revision || phase !== 'open') return false;
      phase = 'closing';
      return true;
    },
    finishClose(session: number) {
      if (session !== revision || phase !== 'closing') return false;
      phase = 'awaiting-commit';
      return true;
    },
    commitClosed() {
      if (phase === 'awaiting-commit') phase = 'idle';
    },
    reset() {
      revision += 1;
      phase = 'idle';
    },
  };
}
