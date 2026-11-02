/** Keep chat history rendering bounded on slower Android devices. */
export const CHAT_HISTORY_LIST_CONFIG = {
  initialNumToRender: 12,
  maxToRenderPerBatch: 8,
  updateCellsBatchingPeriod: 40,
  windowSize: 7,
} as const;
