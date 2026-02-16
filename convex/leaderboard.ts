import { v } from "convex/values";
import { query } from "./_generated/server";

export const getLeaderboard = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const search = (args.search ?? "").trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    const [attendees, completions] = await Promise.all([
      ctx.db.query("attendees").collect(),
      ctx.db.query("completions").collect(),
    ]);

    const attendeeTotals = new Map<string, { totalXp: number; recentActivityAt: string | null }>();

    for (const completion of completions) {
      const current = attendeeTotals.get(completion.attendeeId) ?? {
        totalXp: 0,
        recentActivityAt: null,
      };

      current.totalXp += completion.totalXp;

      if (!current.recentActivityAt || Date.parse(completion.timestamp) > Date.parse(current.recentActivityAt)) {
        current.recentActivityAt = completion.timestamp;
      }

      attendeeTotals.set(completion.attendeeId, current);
    }

    const rows = attendees
      .filter((attendee) => attendee.active)
      .map((attendee) => {
        const totals = attendeeTotals.get(attendee.attendeeId) ?? { totalXp: 0, recentActivityAt: null };
        return {
          attendeeId: attendee.attendeeId,
          fullName: attendee.fullName,
          totalXp: totals.totalXp,
          recentActivityAt: totals.recentActivityAt,
        };
      })
      .filter((row) => (search ? row.fullName.toLowerCase().includes(search) : true))
      .sort((a, b) => {
        if (a.totalXp !== b.totalXp) return b.totalXp - a.totalXp;
        return a.fullName.localeCompare(b.fullName);
      })
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        ...row,
      }));

    return rows;
  },
});
