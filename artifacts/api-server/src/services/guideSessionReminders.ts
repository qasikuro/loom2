import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { db, guideSessionAttendeesTable, guideSessionsTable } from "@workspace/db";
import { sendPushNotification } from "./pushService";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function sendDueGuideSessionReminders(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const due = await db.select().from(guideSessionsTable).where(and(
      eq(guideSessionsTable.status, "scheduled"),
      isNull(guideSessionsTable.reminderSentAt),
      lte(guideSessionsTable.startsAt, now),
      gt(guideSessionsTable.endsAt, now),
    )).limit(50);
    for (const session of due) {
      const claimed = await db.update(guideSessionsTable).set({ reminderSentAt: now })
        .where(and(eq(guideSessionsTable.id, session.id), isNull(guideSessionsTable.reminderSentAt)))
        .returning({ id: guideSessionsTable.id });
      if (!claimed.length) continue;
      const attendees = await db.select({ userId: guideSessionAttendeesTable.userId })
        .from(guideSessionAttendeesTable)
        .where(eq(guideSessionAttendeesTable.sessionId, session.id));
      await Promise.all(attendees.map(({ userId }) => sendPushNotification(userId, {
        title: `${session.title} is starting`,
        body: "Your guide session is ready. Join everyone in the shared chat.",
        data: { type: "guide_session", refId: session.roomId, url: `/campfire/${session.roomId}` },
      })));
    }
  } finally {
    running = false;
  }
}

export function startGuideSessionReminders(): void {
  if (timer) return;
  void sendDueGuideSessionReminders();
  timer = setInterval(() => void sendDueGuideSessionReminders(), 30_000);
  timer.unref?.();
}