import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../AppContext.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const pollDmUnread = useCallback(');
const end = source.indexOf('  // Records when the user last opened', start);
if (start < 0 || end < 0) throw new Error('Shared inbox callback not found');
const callbacks = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

class ApiError extends Error {
  constructor(public status: number) { super(String(status)); }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const thread = (partnerId: string, unread = true, lastAt = '2026-10-10T10:00:00Z') => ({
  partnerId, partnerName: partnerId, partnerHandle: null, partnerAvatar: null,
  lastMessage: 'hello', lastAt, unread,
});

function harness(fetcher: () => Promise<ReturnType<typeof thread>[]>) {
  const state = { threads: [] as ReturnType<typeof thread>[], unreadThreads: [] as { partnerId: string }[], unread: 0, loading: false, error: null as string | null };
  type Update<T> = T | ((previous: T) => T);
  const apply = <T>(previous: T, value: Update<T>): T => typeof value === 'function'
    ? (value as (previous: T) => T)(previous) : value;
  const deps = {
    useCallback: <T>(fn: T) => fn, apiFetch: vi.fn(fetcher), ApiError,
    dmRequestRef: { current: null as Promise<void> | null },
    dmEpochRef: { current: 0 }, dmReadDuringRefreshRef: { current: new Set<string>() },
    setDmThreads: (value: Update<typeof state.threads>) => { state.threads = apply(state.threads, value); },
    setUnreadDmThreads: (value: Update<typeof state.unreadThreads>) => { state.unreadThreads = apply(state.unreadThreads, value); },
    setDmUnread: (value: number) => { state.unread = value; },
    setDmThreadsLoading: (value: boolean) => { state.loading = value; },
    setDmThreadsError: (value: string | null) => { state.error = value; },
  };
  const create = new Function('deps',
    `const { ${Object.keys(deps).join(', ')} } = deps;\n${callbacks}\nreturn { pollDmUnread, markDmThreadRead };`);
  const api = create(deps) as { pollDmUnread: () => Promise<void>; markDmThreadRead: (id: string) => void };
  return { ...api, deps, state };
}

describe('one shared direct-message source', () => {
  it('deduplicates drawer, inbox and background refreshes without reading any conversation', async () => {
    const response = deferred<ReturnType<typeof thread>[]>();
    const h = harness(() => response.promise);
    const first = h.pollDmUnread();
    const second = h.pollDmUnread();
    expect(h.deps.apiFetch).toHaveBeenCalledTimes(1);
    expect(h.deps.apiFetch).toHaveBeenCalledWith('/messages');
    response.resolve([thread('older', false, '2026-10-09T10:00:00Z'), thread('newer')]);
    await Promise.all([first, second]);
    expect(h.state.threads.map(row => row.partnerId)).toEqual(['newer', 'older']);
    expect(h.state.unread).toBe(1);
    expect(h.state.unreadThreads.map(row => row.partnerId)).toEqual(['newer']);
    expect(h.state.loading).toBe(false);
  });

  it('does not restore an unread flag from a response that started before the conversation was read', async () => {
    const response = deferred<ReturnType<typeof thread>[]>();
    const h = harness(() => response.promise);
    const pending = h.pollDmUnread();
    h.markDmThreadRead('read');
    response.resolve([thread('read'), thread('other')]);
    await pending;
    expect(h.state.threads.find(row => row.partnerId === 'read')?.unread).toBe(false);
    expect(h.state.unreadThreads.map(row => row.partnerId)).toEqual(['other']);
  });

  it('keeps cached rows with an explicit error on a network failure', async () => {
    const h = harness(async () => { throw new Error('offline'); });
    h.state.threads = [thread('cached')];
    await h.pollDmUnread();
    expect(h.state.threads[0].partnerId).toBe('cached');
    expect(h.state.error).toBe('network');
    expect(h.state.loading).toBe(false);
  });

  it('removes stale private data if the account becomes restricted', async () => {
    const h = harness(async () => { throw new ApiError(403); });
    h.state.threads = [thread('cached')];
    h.state.unreadThreads = [{ partnerId: 'cached' }];
    h.state.unread = 1;
    await h.pollDmUnread();
    expect(h.state.threads).toEqual([]);
    expect(h.state.unreadThreads).toEqual([]);
    expect(h.state.unread).toBe(0);
    expect(h.state.error).toBe('403');
  });

  it('discards responses from the prior account after sign-out', async () => {
    const response = deferred<ReturnType<typeof thread>[]>();
    const h = harness(() => response.promise);
    const pending = h.pollDmUnread();
    h.deps.dmEpochRef.current++;
    h.deps.dmRequestRef.current = null;
    h.state.loading = false;
    response.resolve([thread('prior-account')]);
    await pending;
    expect(h.state.threads).toEqual([]);
    expect(h.state.unread).toBe(0);
  });
});
