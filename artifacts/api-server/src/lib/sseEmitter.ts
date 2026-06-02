/**
 * Lightweight in-process SSE broadcaster with campfire presence tracking.
 *
 * Campfire channels get automatic presence events when users join/leave.
 *
 * Usage:
 *   emitSSEEvent('messages:userId123', { type: 'new_message', ... });
 *   emitSSEEvent('campfire:roomId456', { type: 'new_message', ... });
 *
 *   const id = addSSEClient(res, ['campfire:roomId456'], 'userId123');
 *   req.on('close', () => removeSSEClient(id));
 */

import type { Response } from "express";

interface SSEClient {
  res:      Response;
  channels: Set<string>;
  userId:   string;
}

const clients = new Map<string, SSEClient>();

// roomId → Set of userIds currently watching via SSE
const campfirePresence = new Map<string, Set<string>>();

let _seq = 0;

function writeLine(res: Response, line: string): boolean {
  try {
    res.write(line);
    return true;
  } catch {
    return false;
  }
}

function broadcastPresence(roomId: string): void {
  const userSet = campfirePresence.get(roomId) ?? new Set();
  const count   = userSet.size;
  const line    = `data: ${JSON.stringify({
    channel: `campfire:${roomId}`,
    data:    { type: "presence_update", soulCount: count },
  })}\n\n`;

  for (const [clientId, client] of clients) {
    if (!client.channels.has(`campfire:${roomId}`)) continue;
    if (!writeLine(client.res, line)) clients.delete(clientId);
  }
}

export function addSSEClient(
  res:      Response,
  channels: string[],
  userId:   string,
): string {
  const id = String(++_seq);
  clients.set(id, { res, channels: new Set(channels), userId });

  // Register campfire presence
  for (const ch of channels) {
    if (!ch.startsWith("campfire:")) continue;
    const roomId = ch.slice("campfire:".length);
    if (!campfirePresence.has(roomId)) campfirePresence.set(roomId, new Set());
    campfirePresence.get(roomId)!.add(userId);
    // Small delay so client receives the connected comment before the presence push
    setTimeout(() => broadcastPresence(roomId), 100);
  }

  return id;
}

export function removeSSEClient(id: string): void {
  const client = clients.get(id);
  if (!client) return;
  clients.delete(id);

  for (const ch of client.channels) {
    if (!ch.startsWith("campfire:")) continue;
    const roomId = ch.slice("campfire:".length);
    const users  = campfirePresence.get(roomId);
    if (!users) continue;
    users.delete(client.userId);
    if (users.size === 0) campfirePresence.delete(roomId);
    broadcastPresence(roomId);
  }
}

export function emitSSEEvent(channel: string, data: unknown): void {
  const line = `data: ${JSON.stringify({ channel, data })}\n\n`;
  for (const [clientId, client] of clients) {
    if (!client.channels.has(channel)) continue;
    if (!writeLine(client.res, line)) clients.delete(clientId);
  }
}

export function connectedClientCount(): number {
  return clients.size;
}
