"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Login failed");
      setLoading(false);
      return;
    }

    const redirect = new URLSearchParams(window.location.search).get("redirect") ?? "/admin";
    router.replace(redirect);
    router.refresh();
  }

  return (
    <main className="login-shell">
      <form onSubmit={onSubmit} className="login-card">
        <h1 style={{ margin: 0, fontFamily: "\"Ember & Fire\", sans-serif", color: "#854d16" }}>Admin Login</h1>
        <p className="small-muted" style={{ margin: 0 }}>Enter shared passcode to open the keyboard-first dashboard.</p>
        <label htmlFor="passcode" className="small-muted">Passcode</label>
        <input
          id="passcode"
          type="password"
          className="text-input"
          autoFocus
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          placeholder="••••••••"
        />
        {error ? <p className="status-bad" style={{ margin: 0 }}>{error}</p> : null}
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button disabled={loading} className="primary-btn" type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <Link href="/" className="secondary-btn">View Leaderboard</Link>
        </div>
      </form>
    </main>
  );
}
