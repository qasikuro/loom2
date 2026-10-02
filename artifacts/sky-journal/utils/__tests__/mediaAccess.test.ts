import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../context/AppContext', () => ({ apiFetch: vi.fn() }));
vi.mock('../apiBase', () => ({ getApiBase: () => 'https://media.test/api' }));

import { apiFetch } from '../../context/AppContext';
import {
  canonicalMediaUri,
  resolveMediaReadUrl,
  setMediaAuthScope,
} from '../mediaAccess';

const path = '/api/images/private-photo.jpg';
const readUrl = (ticket: string) => `https://media.test${path}?media_owner=user&media_exp=123&media_sig=${ticket}`;

describe('media access ticket cache', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
    setMediaAuthScope(null);
  });

  it('does not reuse a prior account ticket for the same canonical asset', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ urls: { [path]: readUrl('owner-a') } } as never)
      .mockResolvedValueOnce({ urls: { [path]: readUrl('owner-b') } } as never);

    setMediaAuthScope('media-owner-a');
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('owner-a'));
    setMediaAuthScope('media-owner-b');
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('owner-b'));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('canonicalizes managed aliases for resolution while stripping old tickets from stale sources', async () => {
    const alias = 'https://media.test/API/IMAGES/./private%2Dphoto.jpg/?media_owner=other&media_exp=123&media_sig=foreign-ticket';
    vi.mocked(apiFetch).mockResolvedValueOnce({
      urls: { [path]: readUrl('current-owner') },
    } as never);
    setMediaAuthScope('canonical-owner');

    expect(canonicalMediaUri(alias)).toBe(`https://media.test${path}`);
    expect(await resolveMediaReadUrl(alias)).toBe(readUrl('current-owner'));
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('current-owner'));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toEqual({ paths: [path] });

    const foreignUrl = 'https://other.test/API/IMAGES/private%2Dphoto.jpg/?media_sig=foreign-ticket';
    expect(canonicalMediaUri(foreignUrl)).toBe(foreignUrl);
    expect(canonicalMediaUri('/unmanaged/private%2Dphoto.jpg?media_sig=keep')).toBe('/unmanaged/private%2Dphoto.jpg?media_sig=keep');
  });

  it('routes legacy Replit development media URLs through the current API', async () => {
    const legacyUrl = 'https://old-workspace.pike.replit.dev/api/images/private-photo.jpg?old_ticket=stale';
    vi.mocked(apiFetch).mockResolvedValueOnce({
      urls: { [path]: readUrl('current-owner') },
    } as never);
    setMediaAuthScope('legacy-media-owner');

    expect(canonicalMediaUri(legacyUrl)).toBe(`https://media.test${path}`);
    expect(await resolveMediaReadUrl(legacyUrl)).toBe(readUrl('current-owner'));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(apiFetch).mock.calls[0][1]?.body))).toEqual({ paths: [path] });

    const insecureLegacyUrl = 'http://old-workspace.pike.replit.dev/api/images/private-photo.jpg';
    expect(canonicalMediaUri(insecureLegacyUrl)).toBe(insecureLegacyUrl);
  });

  it('ignores a late response after account change and rejects the old request', async () => {
    let finishOldRequest!: (response: { urls: Record<string, string> }) => void;
    vi.mocked(apiFetch)
      .mockImplementationOnce(() => new Promise(resolve => { finishOldRequest = resolve; }) as never)
      .mockResolvedValueOnce({ urls: { [path]: readUrl('new-owner') } } as never);

    setMediaAuthScope('race-owner-old');
    const oldRequest = resolveMediaReadUrl(path);
    await vi.waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    setMediaAuthScope('race-owner-new');
    await expect(oldRequest).rejects.toThrow('account changed');
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('new-owner'));
    finishOldRequest({ urls: { [path]: readUrl('old-owner') } });
    await Promise.resolve();

    expect(await resolveMediaReadUrl(path)).toBe(readUrl('new-owner'));
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it('renews the ticket after the local short-lived cache expires', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ urls: { [path]: readUrl('first') } } as never)
      .mockResolvedValueOnce({ urls: { [path]: readUrl('renewed') } } as never);

    setMediaAuthScope('expiry-owner');
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('first'));
    now += 14 * 60_000 + 1;
    expect(await resolveMediaReadUrl(path)).toBe(readUrl('renewed'));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('rejects only a path omitted from an otherwise successful batch response', async () => {
    const otherPath = '/api/images/authorized.jpg';
    vi.mocked(apiFetch).mockResolvedValueOnce({
      urls: { [otherPath]: readUrl('authorized') },
    } as never);

    setMediaAuthScope('partial-owner');
    const unauthorized = resolveMediaReadUrl(path);
    const authorized = resolveMediaReadUrl(otherPath);

    await expect(unauthorized).rejects.toThrow(`URL for ${path}`);
    expect(await authorized).toBe(readUrl('authorized'));
  });
});