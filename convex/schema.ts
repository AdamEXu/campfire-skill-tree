import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  skills: defineTable({
    skillId: v.string(),
    skillName: v.string(),
    category: v.string(),
    xp: v.number(),
    active: v.boolean(),
    updatedAt: v.string(),
    source: v.union(v.literal("sheet"), v.literal("dashboard")),
  })
    .index("by_skill_id", ["skillId"])
    .index("by_updated_at", ["updatedAt"]),

  attendees: defineTable({
    attendeeId: v.string(),
    fullName: v.string(),
    active: v.boolean(),
    updatedAt: v.string(),
    source: v.union(v.literal("sheet"), v.literal("dashboard")),
  })
    .index("by_attendee_id", ["attendeeId"])
    .index("by_full_name", ["fullName"]),

  completions: defineTable({
    completionId: v.string(),
    timestamp: v.string(),
    attendeeId: v.string(),
    skillId: v.string(),
    skillXp: v.number(),
    wildcardXp: v.number(),
    totalXp: v.number(),
    updatedAt: v.string(),
    source: v.union(v.literal("sheet"), v.literal("dashboard")),
  })
    .index("by_completion_id", ["completionId"])
    .index("by_attendee_id", ["attendeeId"])
    .index("by_timestamp", ["timestamp"]),

  pending_sheet_writes: defineTable({
    entityType: v.union(v.literal("skill"), v.literal("attendee"), v.literal("completion")),
    payload: v.any(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("done")),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_status_next_attempt", ["status", "nextAttemptAt"]),

  sync_state: defineTable({
    key: v.string(),
    value: v.string(),
    updatedAt: v.string(),
  }).index("by_key", ["key"]),

  sync_errors: defineTable({
    type: v.string(),
    message: v.string(),
    context: v.optional(v.any()),
    createdAt: v.string(),
  }).index("by_created_at", ["createdAt"]),
});
