/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as agences from "../agences.js";
import type * as auth from "../auth.js";
import type * as auth_mobile from "../auth_mobile.js";
import type * as beastdoor from "../beastdoor.js";
import type * as contacts from "../contacts.js";
import type * as employes from "../employes.js";
import type * as evenements from "../evenements.js";
import type * as example from "../example.js";
import type * as gms from "../gms.js";
import type * as http from "../http.js";
import type * as mobile from "../mobile.js";
import type * as objectifs from "../objectifs.js";
import type * as permissions from "../permissions.js";
import type * as progression from "../progression.js";
import type * as users from "../users.js";
import type * as ventes from "../ventes.js";
import type * as zones from "../zones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  agences: typeof agences;
  auth: typeof auth;
  auth_mobile: typeof auth_mobile;
  beastdoor: typeof beastdoor;
  contacts: typeof contacts;
  employes: typeof employes;
  evenements: typeof evenements;
  example: typeof example;
  gms: typeof gms;
  http: typeof http;
  mobile: typeof mobile;
  objectifs: typeof objectifs;
  permissions: typeof permissions;
  progression: typeof progression;
  users: typeof users;
  ventes: typeof ventes;
  zones: typeof zones;
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
