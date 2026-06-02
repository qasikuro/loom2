export * from "./generated/api";
export * from "./generated/types";

import * as zod from "zod";
import {
  GetCharacterResponse,
  ListJournalEntriesResponse,
  ListJournalEntriesResponseItem,
  ListStoriesResponse,
  ListStoriesResponseItem,
  ListOutfitsResponse,
  ListOutfitsResponseItem,
  ListGalleryResponse,
  GetGalleryUsageResponse,
  ListNotificationsResponse,
  ListDiscoverFeedResponse,
  GetRewardBalanceResponse,
  GetRewardsShopResponse,
  GetConstellationResponse,
  ListFriendsResponse,
  ListFollowingResponse,
} from "./generated/api";

// Passthrough schemas for fetch boundaries.
// ApiCharacterSchema uses .passthrough() to preserve server-side extras not yet
// described in the OpenAPI spec (username, avatarUri, isGuide, etc.).
// Array schemas use the base schemas — strip mode is fine at item level; extras
// logged as mismatch and never reach mapper functions.
export const ApiCharacterSchema = GetCharacterResponse.passthrough();
export const ApiJournalEntriesSchema = ListJournalEntriesResponse;
export const ApiStoriesSchema = ListStoriesResponse;
export const ApiOutfitsSchema = ListOutfitsResponse;

// Schemas for previously unvalidated endpoints
export const ApiGallerySchema = ListGalleryResponse;
export const ApiGalleryUsageSchema = GetGalleryUsageResponse;
export const ApiNotificationsSchema = ListNotificationsResponse;
// DiscoverPost items carry extra server-side fields (pageLayoutKey, pages, overlays, etc.)
// so we passthrough on each item to preserve them without failing validation.
export const ApiDiscoverSchema = zod.array(
  ListDiscoverFeedResponse.element.passthrough(),
);
export const ApiRewardBalanceSchema = GetRewardBalanceResponse;
// ShopResponse includes a server-side _ts field not in the spec; passthrough preserves it.
export const ApiShopSchema = GetRewardsShopResponse.passthrough();
export const ApiConstellationSchema = GetConstellationResponse;
export const ApiFriendsSchema = ListFriendsResponse;
export const ApiFollowingSchema = ListFollowingResponse;

// Inferred TypeScript types derived from generated Zod schemas
export type ApiCharacter = zod.infer<typeof ApiCharacterSchema>;
export type ApiJournalEntry = zod.infer<typeof ListJournalEntriesResponseItem>;
export type ApiStoryItem = zod.infer<typeof ListStoriesResponseItem>;
export type ApiOutfitItem = zod.infer<typeof ListOutfitsResponseItem>;
