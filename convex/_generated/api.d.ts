/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as admin_node from "../admin_node.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_conflict from "../lib/conflict.js";
import type * as lib_sheets from "../lib/sheets.js";
import type * as sync from "../sync.js";
import type * as sync_node from "../sync_node.js";
import type * as webhook from "../webhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  admin_node: typeof admin_node;
  crons: typeof crons;
  http: typeof http;
  leaderboard: typeof leaderboard;
  "lib/conflict": typeof lib_conflict;
  "lib/sheets": typeof lib_sheets;
  sync: typeof sync;
  sync_node: typeof sync_node;
  webhook: typeof webhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
