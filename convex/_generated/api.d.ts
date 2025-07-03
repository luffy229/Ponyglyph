/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as bookmarks from "../bookmarks.js";
import type * as chat from "../chat.js";
import type * as comments from "../comments.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as storage from "../storage.js";
import type * as stories from "../stories.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  bookmarks: typeof bookmarks;
  chat: typeof chat;
  comments: typeof comments;
  http: typeof http;
  notifications: typeof notifications;
  posts: typeof posts;
  storage: typeof storage;
  stories: typeof stories;
  users: typeof users;
  utils: typeof utils;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
