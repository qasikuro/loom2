/** A separate JSON cosmetic slot lets the card border coexist with avatar frames and effects. */
export const FOUNDER_REGALIA_ID = "card_frame_founder_regalia";

export function founderCardFrame(isFounder: boolean, saved: unknown): string | null {
  if (!isFounder) return null;
  // Existing Founders retain their frame until they explicitly turn it off in the Store.
  return saved === undefined || saved === FOUNDER_REGALIA_ID ? FOUNDER_REGALIA_ID : null;
}
