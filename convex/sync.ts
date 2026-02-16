/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";

function nowIso(): string {
  return new Date().toISOString();
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

    return {
      lastPollAt: byKey.get("lastPollAt") ?? null,
      lastWebhookAt: byKey.get("lastWebhookAt") ?? null,
    };
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
