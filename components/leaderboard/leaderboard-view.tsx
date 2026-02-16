"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type LeaderboardRow = {
  rank: number;
  attendeeId: string;
  fullName: string;
  totalXp: number;
  recentActivityAt: string | null;
};

const PACIFIC_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
});

function formatWhen(timestamp: string | null): string {
  if (!timestamp) return "-";
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return timestamp;
  return PACIFIC_FORMATTER.format(new Date(parsed));
}

export function LeaderboardView() {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const entries = useQuery(api.leaderboard.getLeaderboard, {
    search,
    limit,
  });

  const status = useQuery(api.sync.getPublicSyncStatus, {});

  const sortedEntries = useMemo<LeaderboardRow[]>(() => (entries ?? []) as LeaderboardRow[], [entries]);

  return (
    <div className="leaderboard-shell">
      <div className="leaderboard-controls">
        <div>
          <strong>Live leaderboard</strong>
          <div className="small-muted">
            Last poll: {formatWhen(status?.lastPollAt ?? null)} | Last webhook: {formatWhen(status?.lastWebhookAt ?? null)}
          </div>
        </div>
        <input
          className="text-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search attendee"
          aria-label="Search attendee"
        />
        <select
          className="text-input"
          value={String(limit)}
          onChange={(event) => setLimit(Number(event.target.value))}
          style={{ width: 110 }}
          aria-label="Rows to show"
        >
          <option value="25">Top 25</option>
          <option value="50">Top 50</option>
          <option value="100">Top 100</option>
        </select>
      </div>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Attendee</th>
            <th>Total XP</th>
            <th>Recent Activity</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((entry) => (
            <tr key={entry.attendeeId}>
              <td><span className="rank-pill">#{entry.rank}</span></td>
              <td>{entry.fullName}</td>
              <td>{entry.totalXp}</td>
              <td>{formatWhen(entry.recentActivityAt)}</td>
            </tr>
          ))}
          {entries?.length === 0 ? (
            <tr>
              <td colSpan={4} className="small-muted">No attendees found.</td>
            </tr>
          ) : null}
          {entries === undefined ? (
            <tr>
              <td colSpan={4} className="small-muted">Loading...</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
