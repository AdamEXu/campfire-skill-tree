"use client";

import { useEffect, useMemo, useState } from "react";
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

const PACIFIC_TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

const POLL_INTERVAL_SECONDS = 2_629_746;

function formatWhen(timestamp: string | null): string {
  if (!timestamp) return "-";
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return timestamp;
  return PACIFIC_FORMATTER.format(new Date(parsed));
}

function formatLastPollTime(timestamp: string | null): string {
  if (!timestamp) return "-";
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return timestamp;
  return PACIFIC_TIME_WITH_SECONDS_FORMATTER.format(new Date(parsed));
}

function getNextPollCountdown(lastPollAt: string | null, nowMs: number): number | null {
  if (!lastPollAt) return null;
  const lastPollMs = Date.parse(lastPollAt);
  if (Number.isNaN(lastPollMs)) return null;

  const nextPollMs = lastPollMs + POLL_INTERVAL_SECONDS * 1000;
  const remainingMs = nextPollMs - nowMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

export function LeaderboardView() {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const entries = useQuery(api.leaderboard.getLeaderboard, {
    search,
    limit,
  });

  const status = useQuery(api.sync.getPublicSyncStatus, {});

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const sortedEntries = useMemo<LeaderboardRow[]>(() => (entries ?? []) as LeaderboardRow[], [entries]);
  const nextPollCountdown = useMemo(
    () => getNextPollCountdown(status?.lastPollAt ?? null, nowMs),
    [status?.lastPollAt, nowMs],
  );

  const nextPollText =
    nextPollCountdown === null
      ? "Next poll in -"
      : nextPollCountdown === 0
      ? "Polling..."
      : `Next poll in ${nextPollCountdown} ${nextPollCountdown === 1 ? "second" : "seconds"}`;

  return (
    <div className="leaderboard-shell">
      <div className="leaderboard-controls">
        <div>
          <strong>Live leaderboard</strong>
          <div className="small-muted">
            Last poll: {formatLastPollTime(status?.lastPollAt ?? null)} | {nextPollText}
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
