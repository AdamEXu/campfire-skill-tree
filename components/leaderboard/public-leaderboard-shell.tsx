import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";

export function PublicLeaderboardShell() {
  return (
    <main className="page-shell">
      <header className="leaderboard-top">
        <div className="leaderboard-top-card">
          <div>
            <p className="top-kicker">Campfire San Jose</p>
            <h1 className="top-title">Skill Tree Leaderboard</h1>
            <p className="top-subtitle">
              Live updating XP leaderboard for Campfire San Jose.
            </p>
          </div>
        </div>
      </header>
      <LeaderboardView />
    </main>
  );
}
