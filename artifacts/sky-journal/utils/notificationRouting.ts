import type { Href } from "expo-router";

type Push = (href: Href) => void;

function internalUrl(value: unknown): value is string {
  return typeof value === "string"
    && value.startsWith("/")
    && !value.startsWith("//")
    && !value.includes("://")
    && !value.includes("\\");
}

export function resolveNotificationRoute(push: Push, data: Record<string, unknown>): void {
  if (internalUrl(data?.url)) {
    push(data.url as Href);
    return;
  }
  if (typeof data?.type !== "string") return;

  const refId = typeof data.refId === "string" && data.refId ? encodeURIComponent(data.refId) : null;
  const actorId = typeof data.actorId === "string" && data.actorId ? encodeURIComponent(data.actorId) : null;

  switch (data.type) {
    case "follow":
      if (refId) push(`/user/${refId}`);
      break;
    case "witness":
    case "save":
    case "new_story":
    case "resonate":
      if (refId) push(`/story/${refId}`);
      break;
    case "new_chapter":
      if (refId) push({ pathname: "/book-public", params: { bookId: decodeURIComponent(refId) } });
      break;
    case "message":
      if (refId) push(`/messages/${refId}`);
      break;
    case "new_outfit":
    case "badge_granted":
    case "badge_removed":
      if (actorId) push(`/user/${actorId}`);
      break;
    case "guide_session_rescheduled":
      if (refId) push({ pathname: "/guide-session/[sessionId]", params: { sessionId: decodeURIComponent(refId) } });
      break;
    case "guide_session_cancelled":
      if (actorId) push({ pathname: "/guide/[userId]", params: { userId: decodeURIComponent(actorId) } });
      break;
    default:
      break;
  }
}
