/* eslint-disable @typescript-eslint/no-explicit-any */
"use node";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  upsertAttendeeRow,
  upsertCompletionRow,
  upsertSkillRow,
  type AttendeeSheetRow,
  type CompletionSheetRow,
  type SkillSheetRow,
} from "./lib/sheets";

async function flushSheetWriteQueue(ctx: any, limit = 25): Promise<number> {
  const queueItems: Array<{
    _id: string;
    entityType: "skill" | "attendee" | "completion";
    payload: unknown;
  }> = await ctx.runMutation(internal.admin.claimPendingSheetWrites, {
    limit,
  });

  for (const item of queueItems) {
    try {
      if (item.entityType === "skill") {
        await upsertSkillRow(item.payload as SkillSheetRow);
      } else if (item.entityType === "attendee") {
        await upsertAttendeeRow(item.payload as AttendeeSheetRow);
      } else {
        await upsertCompletionRow(item.payload as CompletionSheetRow);
      }

      await ctx.runMutation(internal.admin.markSheetWriteSuccess, {
        id: item._id,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sheet write error";
      await ctx.runMutation(internal.admin.markSheetWriteFailure, {
        id: item._id,
        error: message,
      });
    }
  }

  await ctx.runMutation(internal.sync.setSyncState, {
    key: "lastQueueFlushAt",
    value: new Date().toISOString(),
  });

  return queueItems.length;
}

export const processSheetWriteQueue: any = internalAction({
  args: {},
  handler: async (ctx: any): Promise<{ processed: number }> => {
    const processed = await flushSheetWriteQueue(ctx);
    return { processed };
  },
});

export const queueFlushCron: any = internalAction({
  args: {},
  handler: async (ctx: any): Promise<void> => {
    await flushSheetWriteQueue(ctx);
  },
});
