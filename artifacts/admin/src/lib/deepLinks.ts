/**
 * Deep-link destinations for the push-notification compose form.
 *
 * KEEP IN SYNC WITH THE EXPO ROUTER ROUTE TREE
 * ─────────────────────────────────────────────
 * The source of truth for available screens is:
 *
 *   artifacts/sky-journal/app/
 *
 * When you add a new screen to the mobile app, add a corresponding entry
 * here so admins can target it from the notification composer without
 * having to type a raw path every time.
 *
 * Rules of thumb:
 *  • Static routes (no [param] in the path) → add directly to the list.
 *  • Parameterised routes (e.g. /story/[id]) → omit from this list; admins
 *    can still reach them via the "Custom path…" option.
 *  • Auth-only screens ((auth)/*) → not useful as push destinations; omit.
 */

export interface DeepLinkOption {
  value: string; // Expo Router path, or a sentinel constant
  label: string;
}

export interface DeepLinkGroup {
  label: string;
  options: DeepLinkOption[];
}

/**
 * Grouped deep-link destinations shown in the notification composer.
 *
 * Sections mirror the Expo Router directory layout:
 *   (tabs)/   → main bottom-tab screens
 *   top-level → feature screens reachable from menus / links
 *   create/   → creation flows (useful for campaign prompts)
 */
export const DEEP_LINK_GROUPS: DeepLinkGroup[] = [
  {
    label: "Main Tabs",
    options: [
      { value: "/(tabs)/index",    label: "Home (Journal)" },
      { value: "/(tabs)/discover", label: "Discover" },
      { value: "/(tabs)/create",   label: "Create" },
      { value: "/(tabs)/log",      label: "Log" },
      { value: "/(tabs)/drift",    label: "Drift" },
      { value: "/(tabs)/profile",  label: "Profile" },
    ],
  },
  {
    label: "Features",
    options: [
      { value: "/season",           label: "Season" },
      { value: "/shop",             label: "Shop" },
      { value: "/campfire",         label: "Campfire (room list)" },
      { value: "/messages",         label: "Messages" },
      { value: "/constellation",    label: "Constellation" },
      { value: "/my-stories",       label: "My Stories" },
      { value: "/saved-stories",    label: "Saved Stories" },
      { value: "/wardrobe",         label: "Wardrobe" },
      { value: "/purchase-history", label: "Purchase History" },
    ],
  },
  {
    label: "Creation Flows",
    options: [
      { value: "/create-journal-entry", label: "New Journal Entry" },
      { value: "/create-moment-log",    label: "New Moment Log" },
      { value: "/create-friend-log",    label: "New Friend Log" },
      { value: "/create-outfit",        label: "New Outfit" },
      { value: "/quick-moment",         label: "Quick Moment" },
      { value: "/vibe-post",            label: "Vibe Post" },
    ],
  },
];
