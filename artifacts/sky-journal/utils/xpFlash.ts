type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function fireXPFlash(message: string): void {
  listeners.forEach(fn => fn(message));
}

export function subscribeXPFlash(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
