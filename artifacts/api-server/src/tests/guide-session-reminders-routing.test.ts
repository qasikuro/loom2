import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@workspace/db', () => ({
  db: { select: vi.fn(), update: vi.fn() },
  guideSessionsTable: {}, guideSessionAttendeesTable: {},
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(), eq: vi.fn(), gt: vi.fn(), isNull: vi.fn(), lte: vi.fn(),
}));
vi.mock('../services/pushService', () => ({ sendPushNotification: vi.fn().mockResolvedValue(undefined) }));

import { db } from '@workspace/db';
import { sendPushNotification } from '../services/pushService';
import { sendDueGuideSessionReminders } from '../services/guideSessionReminders';

describe('guide-session reminder destinations', () => {
  beforeEach(() => vi.clearAllMocks());
  it('opens the session workspace rather than its backing chat room', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: async () => [
        { id: 'session-id', roomId: 'backing-room', title: 'Learn together' },
      ] }) }) } as never)
      .mockReturnValueOnce({ from: () => ({ where: async () => [{ userId: 'participant-id' }] }) } as never);
    vi.mocked(db.update).mockReturnValueOnce({
      set: () => ({ where: () => ({ returning: async () => [{ id: 'session-id' }] }) }),
    } as never);

    await sendDueGuideSessionReminders();

    expect(sendPushNotification).toHaveBeenCalledWith('participant-id', expect.objectContaining({
      data: { type: 'guide_session', refId: 'session-id', url: '/guide-session/session-id' },
    }));
    expect(JSON.stringify(vi.mocked(sendPushNotification).mock.calls)).not.toContain('/campfire/');
  });
});
