/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

const ACTIVE_CLIENT_WINDOW_MS = 90_000;
const CLIENT_ACTIVITY_WRITE_THROTTLE_MS = 15_000;
const ACTIVE_CLIENT_SYNC_THROTTLE_MS = 30_000;

function nowIso(): string {
  return new Date().toISOString();
}

function parseIsoDateMs(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasRecentActivity(lastActivityAt: string | null, windowMs: number): boolean {
  const lastActivityMs = parseIsoDateMs(lastActivityAt);
  if (lastActivityMs === null) return false;
  return Date.now() - lastActivityMs <= windowMs;
}

async function readSyncState(ctx: any, key: string): Promise<string | null> {
  const existing = await ctx.db.query("sync_state").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  return existing?.value ?? null;
}

async function writeSyncState(ctx: any, key: string, value: string) {
  const existing = await ctx.db.query("sync_state").withIndex("by_key", (q: any) => q.eq("key", key)).first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      value,
      updatedAt: nowIso(),
    });
    return;
  }

  await ctx.db.insert("sync_state", {
    key,
    value,
    updatedAt: nowIso(),
  });
}

export const getPublicSyncStatus = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("sync_state").collect();
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const lastClientActivityAt = byKey.get("lastClientActivityAt") ?? null;
    const hasActiveClients = hasRecentActivity(lastClientActivityAt, ACTIVE_CLIENT_WINDOW_MS);

    return {
      lastPollAt: byKey.get("lastPollAt") ?? null,
      lastWebhookAt: byKey.get("lastWebhookAt") ?? null,
      lastClientActivityAt,
      hasActiveClients,
    };
  },
});

export const reportClientActivity = mutation({
  args: {
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lastClientActivityAt = await readSyncState(ctx, "lastClientActivityAt");
    const lastActivityMs = parseIsoDateMs(lastClientActivityAt);
    const nowMs = Date.now();

    if (lastActivityMs !== null && nowMs - lastActivityMs < CLIENT_ACTIVITY_WRITE_THROTTLE_MS) {
      return { updated: false };
    }

    const now = nowIso();
    await writeSyncState(ctx, "lastClientActivityAt", now);
    if (args.source) {
      await writeSyncState(ctx, "lastClientActivitySource", args.source);
    }

    return { updated: true };
  },
});

export const requestActiveClientSync = mutation({
  args: {
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = nowIso();
    const nowMs = Date.now();

    const lastClientActivityAt = await readSyncState(ctx, "lastClientActivityAt");
    const lastActivityMs = parseIsoDateMs(lastClientActivityAt);
    if (lastActivityMs === null || nowMs - lastActivityMs >= CLIENT_ACTIVITY_WRITE_THROTTLE_MS) {
      await writeSyncState(ctx, "lastClientActivityAt", now);
    }

    if (args.source) {
      await writeSyncState(ctx, "lastClientActivitySource", args.source);
    }

    const lastRequestedAt = await readSyncState(ctx, "lastActiveClientSyncRequestAt");
    const lastRequestedMs = parseIsoDateMs(lastRequestedAt);
    if (lastRequestedMs !== null && nowMs - lastRequestedMs < ACTIVE_CLIENT_SYNC_THROTTLE_MS) {
      return { queued: false, reason: "throttled" as const };
    }

    await writeSyncState(ctx, "lastActiveClientSyncRequestAt", now);
    await ctx.scheduler.runAfter(0, internal.sync_node.pollSheetsAndMerge, {
      reason: `active-client:${args.source ?? "heartbeat"}`,
    });

    return { queued: true, reason: "scheduled" as const };
  },
});

export const requestImmediateSync = mutation({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await writeSyncState(ctx, "lastManualSyncRequest", `${nowIso()}${args.reason ? ` (${args.reason})` : ""}`);
    await ctx.scheduler.runAfter(0, internal.sync_node.pollSheetsAndMerge, {
      reason: args.reason ?? "manual",
    });
    return { queued: true };
  },
});

export const requestSheetSchemaInitialization = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.sync_node.ensureCanonicalSheetSchema, {});
    return { queued: true };
  },
});

export const setSyncState = internalMutation({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await writeSyncState(ctx, args.key, args.value);
  },
});

export const logSyncError = internalMutation({
  args: {
    type: v.string(),
    message: v.string(),
    context: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sync_errors", {
      type: args.type,
      message: args.message,
      context: args.context,
      createdAt: nowIso(),
    });
  },
});
