/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { ensureSheetSchema, pullSheetSnapshot } from "./lib/sheets";

async function setState(ctx: any, key: string, value: string) {
  await ctx.runMutation(internal.sync.setSyncState, { key, value });
}

export const pollSheetsAndMerge = internalAction({
  args: {
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startedAt = new Date().toISOString();

    try {
      await setState(ctx, "lastPollStartedAt", startedAt);

      const snapshot = await pullSheetSnapshot();

      await ctx.runMutation(internal.admin.upsertSkillsFromSheet, {
        rows: snapshot.skills,
      });

      await ctx.runMutation(internal.admin.upsertAttendeesFromSheet, {
        rows: snapshot.attendees,
      });

      await ctx.runMutation(internal.admin.upsertCompletionsFromSheet, {
        rows: snapshot.completions,
      });

      const completedAt = new Date().toISOString();
      await setState(ctx, "lastPollAt", completedAt);
      await setState(ctx, "lastPollReason", args.reason ?? "unknown");

      return {
        ok: true,
        skills: snapshot.skills.length,
        attendees: snapshot.attendees.length,
        completions: snapshot.completions.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown polling failure";
      await ctx.runMutation(internal.sync.logSyncError, {
        type: "sheet_poll",
        message,
        context: { reason: args.reason ?? null },
      });
      return { ok: false, error: message };
    }
  },
});

export const processSheetWebhook = internalAction({
  args: {
    spreadsheetId: v.string(),
    sheetName: v.union(v.literal("Skills"), v.literal("Attendees"), v.literal("Completions")),
    rowId: v.string(),
    editedAt: v.string(),
    editor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await setState(ctx, "lastWebhookAt", args.editedAt || new Date().toISOString());
    await setState(ctx, "lastWebhookSheet", args.sheetName);
    await ctx.runAction(internal.sync_node.pollSheetsAndMerge, {
      reason: `webhook:${args.sheetName}:${args.rowId}`,
    });
  },
});

export const ensureCanonicalSheetSchema = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      await ensureSheetSchema();
      await setState(ctx, "lastSchemaInitAt", new Date().toISOString());
      await ctx.runAction(internal.sync_node.pollSheetsAndMerge, {
        reason: "schema-init",
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown schema init failure";
      await ctx.runMutation(internal.sync.logSyncError, {
        type: "sheet_schema",
        message,
      });
      return { ok: false, error: message };
    }
  },
});
