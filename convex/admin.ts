/* eslint-disable @typescript-eslint/no-explicit-any */
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { shouldApplyIncomingUpdate } from "./lib/conflict";

type Source = "sheet" | "dashboard";
const internalAny = internal as any;
const ACTIVE_CLIENT_WINDOW_MS = 90_000;

function nowIso(): string {
  return new Date().toISOString();
}

function hasRecentActivity(timestamp: string | null, windowMs = ACTIVE_CLIENT_WINDOW_MS): boolean {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= windowMs;
}

function parseBoolean(value: boolean | string): boolean {
  if (typeof value === "boolean") return value;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseNumber(value: number | string): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function upsertSkillRecord(
  ctx: any,
  row: {
    skillId: string;
    skillName: string;
    category: string;
    xp: number;
    active: boolean;
    updatedAt: string;
  },
  source: Source,
) {
  const existing = await ctx.db.query("skills").withIndex("by_skill_id", (q: any) => q.eq("skillId", row.skillId)).first();

  if (
    existing &&
    !shouldApplyIncomingUpdate({
      existingUpdatedAt: existing.updatedAt,
      incomingUpdatedAt: row.updatedAt,
      existingSource: existing.source,
      incomingSource: source,
    })
  ) {
    return existing;
  }

  const payload = {
    skillId: row.skillId,
    skillName: row.skillName,
    category: row.category,
    xp: row.xp,
    active: row.active,
    updatedAt: row.updatedAt,
    source,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const _id = await ctx.db.insert("skills", payload);
  return { _id, ...payload };
}

async function upsertAttendeeRecord(
  ctx: any,
  row: {
    attendeeId: string;
    fullName: string;
    active: boolean;
    updatedAt: string;
  },
  source: Source,
) {
  const existing = await ctx.db
    .query("attendees")
    .withIndex("by_attendee_id", (q: any) => q.eq("attendeeId", row.attendeeId))
    .first();

  if (
    existing &&
    !shouldApplyIncomingUpdate({
      existingUpdatedAt: existing.updatedAt,
      incomingUpdatedAt: row.updatedAt,
      existingSource: existing.source,
      incomingSource: source,
    })
  ) {
    return existing;
  }

  const payload = {
    attendeeId: row.attendeeId,
    fullName: row.fullName,
    active: row.active,
    updatedAt: row.updatedAt,
    source,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const _id = await ctx.db.insert("attendees", payload);
  return { _id, ...payload };
}

async function upsertCompletionRecord(
  ctx: any,
  row: {
    completionId: string;
    timestamp: string;
    attendeeId: string;
    skillId: string;
    skillXp: number;
    wildcardXp: number;
    totalXp: number;
    updatedAt: string;
  },
  source: Source,
) {
  const existing = await ctx.db
    .query("completions")
    .withIndex("by_completion_id", (q: any) => q.eq("completionId", row.completionId))
    .first();

  if (
    existing &&
    !shouldApplyIncomingUpdate({
      existingUpdatedAt: existing.updatedAt,
      incomingUpdatedAt: row.updatedAt,
      existingSource: existing.source,
      incomingSource: source,
    })
  ) {
    return existing;
  }

  const payload = {
    completionId: row.completionId,
    timestamp: row.timestamp,
    attendeeId: row.attendeeId,
    skillId: row.skillId,
    skillXp: row.skillXp,
    wildcardXp: row.wildcardXp,
    totalXp: row.totalXp,
    updatedAt: row.updatedAt,
    source,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
    return { ...existing, ...payload };
  }

  const _id = await ctx.db.insert("completions", payload);
  return { _id, ...payload };
}

async function queueWrite(
  ctx: any,
  args: {
    entityType: "skill" | "attendee" | "completion";
    payload: unknown;
  },
) {
  await ctx.db.insert("pending_sheet_writes", {
    entityType: args.entityType,
    payload: args.payload,
    status: "pending",
    attempts: 0,
    nextAttemptAt: Date.now(),
    lastError: undefined,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export const listSkills = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("skills").collect();
  },
});

export const listAttendees = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("attendees").withIndex("by_full_name").collect();
  },
});

export const listCompletions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 2000);
    return await ctx.db.query("completions").order("desc").take(limit);
  },
});

export const getSyncDiagnostics = query({
  args: {},
  handler: async (ctx) => {
    const stateRows = await ctx.db.query("sync_state").collect();
    const stateByKey = new Map(stateRows.map((row) => [row.key, row.value]));

    const pendingWrites = await ctx.db
      .query("pending_sheet_writes")
      .withIndex("by_status_next_attempt", (q) => q.eq("status", "pending"))
      .collect();

    const failedWrites = pendingWrites.filter((row) => row.attempts >= 3).length;

    const errors = await ctx.db.query("sync_errors").order("desc").take(10);
    const lastClientActivityAt = stateByKey.get("lastClientActivityAt") ?? null;

    return {
      pendingWrites: pendingWrites.length,
      failedWrites,
      lastPollAt: stateByKey.get("lastPollAt") ?? null,
      lastWebhookAt: stateByKey.get("lastWebhookAt") ?? null,
      lastSuccessfulWriteAt: stateByKey.get("lastSuccessfulWriteAt") ?? null,
      lastClientActivityAt,
      hasActiveClients: hasRecentActivity(lastClientActivityAt),
      queueDepth: pendingWrites.length,
      recentErrors: errors,
    };
  },
});

export const upsertSkill = mutation({
  args: {
    skillId: v.string(),
    skillName: v.string(),
    category: v.string(),
    xp: v.union(v.number(), v.string()),
    active: v.union(v.boolean(), v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updatedAt = args.updatedAt ?? nowIso();
    const row = {
      skillId: args.skillId,
      skillName: args.skillName,
      category: args.category,
      xp: parseNumber(args.xp),
      active: parseBoolean(args.active),
      updatedAt,
    };

    const result = await upsertSkillRecord(ctx, row, "dashboard");

    await queueWrite(ctx, {
      entityType: "skill",
      payload: {
        ...row,
        source: "dashboard",
      },
    });

    await ctx.scheduler.runAfter(0, internalAny.admin_node.processSheetWriteQueue, {});
    return result;
  },
});

export const upsertAttendee = mutation({
  args: {
    attendeeId: v.string(),
    fullName: v.string(),
    active: v.union(v.boolean(), v.string()),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updatedAt = args.updatedAt ?? nowIso();
    const row = {
      attendeeId: args.attendeeId,
      fullName: args.fullName,
      active: parseBoolean(args.active),
      updatedAt,
    };

    const result = await upsertAttendeeRecord(ctx, row, "dashboard");

    await queueWrite(ctx, {
      entityType: "attendee",
      payload: {
        ...row,
        source: "dashboard",
      },
    });

    await ctx.scheduler.runAfter(0, internalAny.admin_node.processSheetWriteQueue, {});
    return result;
  },
});

export const upsertCompletion = mutation({
  args: {
    completionId: v.string(),
    timestamp: v.string(),
    attendeeId: v.string(),
    skillId: v.string(),
    skillXp: v.union(v.number(), v.string()),
    wildcardXp: v.union(v.number(), v.string()),
    totalXp: v.optional(v.union(v.number(), v.string())),
    source: v.optional(v.union(v.literal("sheet"), v.literal("dashboard"))),
    updatedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updatedAt = args.updatedAt ?? nowIso();
    const skillXp = parseNumber(args.skillXp);
    const wildcardXp = parseNumber(args.wildcardXp);
    const totalXp = args.totalXp === undefined ? skillXp + wildcardXp : parseNumber(args.totalXp);

    const row = {
      completionId: args.completionId,
      timestamp: args.timestamp,
      attendeeId: args.attendeeId,
      skillId: args.skillId,
      skillXp,
      wildcardXp,
      totalXp,
      updatedAt,
    };

    const result = await upsertCompletionRecord(ctx, row, "dashboard");

    await queueWrite(ctx, {
      entityType: "completion",
      payload: {
        ...row,
        source: "dashboard",
      },
    });

    await ctx.scheduler.runAfter(0, internalAny.admin_node.processSheetWriteQueue, {});
    return result;
  },
});

export const requestQueueFlush = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internalAny.admin_node.processSheetWriteQueue, {});
    return { queued: true };
  },
});

export const upsertSkillsFromSheet = internalMutation({
  args: {
    rows: v.array(
      v.object({
        skillId: v.string(),
        skillName: v.string(),
        category: v.string(),
        xp: v.number(),
        active: v.boolean(),
        updatedAt: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await upsertSkillRecord(ctx, row, "sheet");
    }
  },
});

export const upsertAttendeesFromSheet = internalMutation({
  args: {
    rows: v.array(
      v.object({
        attendeeId: v.string(),
        fullName: v.string(),
        active: v.boolean(),
        updatedAt: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await upsertAttendeeRecord(ctx, row, "sheet");
    }
  },
});

export const upsertCompletionsFromSheet = internalMutation({
  args: {
    rows: v.array(
      v.object({
        completionId: v.string(),
        timestamp: v.string(),
        attendeeId: v.string(),
        skillId: v.string(),
        skillXp: v.number(),
        wildcardXp: v.number(),
        totalXp: v.number(),
        updatedAt: v.string(),
        source: v.union(v.literal("sheet"), v.literal("dashboard")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await upsertCompletionRecord(ctx, row, row.source === "dashboard" ? "dashboard" : "sheet");
    }
  },
});

export const claimPendingSheetWrites = internalMutation({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("pending_sheet_writes")
      .withIndex("by_status_next_attempt", (q) => q.eq("status", "pending"))
      .take(args.limit * 4);

    const rows = candidates.filter((row) => row.nextAttemptAt <= now).slice(0, args.limit);

    for (const row of rows) {
      await ctx.db.patch(row._id, {
        status: "processing",
        updatedAt: nowIso(),
      });
    }

    return rows;
  },
});

export const markSheetWriteSuccess = internalMutation({
  args: {
    id: v.id("pending_sheet_writes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "done",
      updatedAt: nowIso(),
      lastError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.sync.setSyncState, {
      key: "lastSuccessfulWriteAt",
      value: nowIso(),
    });
  },
});

export const markSheetWriteFailure = internalMutation({
  args: {
    id: v.id("pending_sheet_writes"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return;

    const attempts = (existing.attempts ?? 0) + 1;
    const delayMs = Math.min(60000, Math.pow(2, attempts) * 1000);

    await ctx.db.patch(args.id, {
      status: "pending",
      attempts,
      nextAttemptAt: Date.now() + delayMs,
      updatedAt: nowIso(),
      lastError: args.error,
    });

    await ctx.db.insert("sync_errors", {
      type: "sheet_write",
      message: args.error,
      context: { queueId: String(args.id) },
      createdAt: nowIso(),
    });

    await ctx.scheduler.runAfter(delayMs, internalAny.admin_node.processSheetWriteQueue, {});
  },
});
