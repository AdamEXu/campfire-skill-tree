"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DataGrid,
  renderTextEditor,
  type CellSelectArgs,
  type Column,
  type RowsChangeData,
} from "react-data-grid";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ADMIN_KEYMAP } from "@/lib/keyboard";
import { normalizeFullName } from "@/lib/normalize";

type SkillGridRow = {
  skillId: string;
  skillName: string;
  category: string;
  xp: number;
  active: boolean | string;
  updatedAt: string;
};

type AttendeeGridRow = {
  attendeeId: string;
  fullName: string;
  active: boolean | string;
  updatedAt: string;
};

type CompletionGridRow = {
  completionId: string;
  timestamp: string;
  attendeeId: string;
  skillId: string;
  skillXp: number;
  wildcardXp: number;
  totalXp: number;
  source: "sheet" | "dashboard";
  updatedAt: string;
};

type TabName = "completions" | "attendees" | "skills";

type SelectedCell = {
  rowIdx: number;
  columnKey: string;
};

function parseNumericSuffix(id: string): number {
  const digits = id.replace(/\D/g, "");
  return Number(digits || 0);
}

function buildId(prefix: string, width: number, value: number): string {
  return `${prefix}${String(value).padStart(width, "0")}`;
}

function nextId(prefix: string, width: number, ids: string[]): string {
  const max = ids.reduce((acc, id) => Math.max(acc, parseNumericSuffix(id)), 0);
  return buildId(prefix, width, max + 1);
}

function parseBool(value: boolean | string): boolean {
  if (typeof value === "boolean") return value;
  return value.trim().toLowerCase() === "true";
}

function parseNumber(input: number | string): number {
  if (typeof input === "number") return input;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function formatPacificTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "-";
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return timestamp;
  return PACIFIC_FORMATTER.format(new Date(parsed));
}

export function AdminDashboard() {
  const [tab, setTab] = useState<TabName>("completions");
  const [showHelp, setShowHelp] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

  const skills = useQuery(api.admin.listSkills, {});
  const attendees = useQuery(api.admin.listAttendees, {});
  const completions = useQuery(api.admin.listCompletions, { limit: 500 });
  const diagnostics = useQuery(api.admin.getSyncDiagnostics, {});

  const upsertSkill = useMutation(api.admin.upsertSkill);
  const upsertAttendee = useMutation(api.admin.upsertAttendee);
  const upsertCompletion = useMutation(api.admin.upsertCompletion);
  const requestQueueFlush = useMutation(api.admin.requestQueueFlush);
  const requestImmediateSync = useMutation(api.sync.requestImmediateSync);
  const requestSheetSchemaInitialization = useMutation(api.sync.requestSheetSchemaInitialization);

  const [skillRows, setSkillRows] = useState<SkillGridRow[]>([]);
  const [attendeeRows, setAttendeeRows] = useState<AttendeeGridRow[]>([]);
  const [completionRows, setCompletionRows] = useState<CompletionGridRow[]>([]);

  useEffect(() => {
    setSkillRows((skills ?? []) as SkillGridRow[]);
  }, [skills]);

  useEffect(() => {
    setAttendeeRows((attendees ?? []) as AttendeeGridRow[]);
  }, [attendees]);

  useEffect(() => {
    setCompletionRows((completions ?? []) as CompletionGridRow[]);
  }, [completions]);

  const fillDown = useCallback(() => {
    if (!selectedCell) return;

    if (tab === "skills") {
      if (selectedCell.rowIdx >= skillRows.length - 1) return;
      const source = skillRows[selectedCell.rowIdx];
      const target = skillRows[selectedCell.rowIdx + 1];
      const key = selectedCell.columnKey as keyof SkillGridRow;
      const nextRows = [...skillRows];
      nextRows[selectedCell.rowIdx + 1] = { ...target, [key]: source[key] };
      setSkillRows(nextRows);
      void upsertSkill(nextRows[selectedCell.rowIdx + 1]);
      return;
    }

    if (tab === "attendees") {
      if (selectedCell.rowIdx >= attendeeRows.length - 1) return;
      const source = attendeeRows[selectedCell.rowIdx];
      const target = attendeeRows[selectedCell.rowIdx + 1];
      const key = selectedCell.columnKey as keyof AttendeeGridRow;
      const nextRows = [...attendeeRows];
      nextRows[selectedCell.rowIdx + 1] = { ...target, [key]: source[key] };
      setAttendeeRows(nextRows);
      void upsertAttendee(nextRows[selectedCell.rowIdx + 1]);
      return;
    }

    if (selectedCell.rowIdx >= completionRows.length - 1) return;
    const source = completionRows[selectedCell.rowIdx];
    const target = completionRows[selectedCell.rowIdx + 1];
    const key = selectedCell.columnKey as keyof CompletionGridRow;
    const nextRows = [...completionRows];
    const next = { ...target, [key]: source[key] };
    next.totalXp = Number(next.skillXp || 0) + Number(next.wildcardXp || 0);
    nextRows[selectedCell.rowIdx + 1] = next;
    setCompletionRows(nextRows);
    void upsertCompletion(nextRows[selectedCell.rowIdx + 1]);
  }, [
    attendeeRows,
    completionRows,
    selectedCell,
    skillRows,
    tab,
    upsertAttendee,
    upsertCompletion,
    upsertSkill,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMeta = event.metaKey || event.ctrlKey;

      if (key === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowHelp((value) => !value);
        return;
      }

      if (isMeta && key === "s") {
        event.preventDefault();
        void requestQueueFlush({});
        void requestImmediateSync({ reason: "manual-shortcut" });
        return;
      }

      if (isMeta && key === "d") {
        event.preventDefault();
        fillDown();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fillDown, requestImmediateSync, requestQueueFlush]);

  function onCellKeyDown() {
    // Keep defaults for tab/enter navigation so behavior stays spreadsheet-like.
  }

  function onSelection<TRow>(args: CellSelectArgs<TRow>) {
    setSelectedCell({ rowIdx: args.rowIdx, columnKey: args.column.key });
  }

  const skillColumns = useMemo<readonly Column<SkillGridRow>[]>(
    () => [
      { key: "skillId", name: "Skill ID", width: 110, editable: true, renderEditCell: renderTextEditor },
      { key: "skillName", name: "Skill Name", width: 260, editable: true, renderEditCell: renderTextEditor },
      { key: "category", name: "Category", width: 170, editable: true, renderEditCell: renderTextEditor },
      { key: "xp", name: "XP", width: 100, editable: true, renderEditCell: renderTextEditor },
      { key: "active", name: "Active", width: 100, editable: true, renderEditCell: renderTextEditor },
      { key: "updatedAt", name: "Updated At", width: 220 },
    ],
    [],
  );

  const attendeeColumns = useMemo<readonly Column<AttendeeGridRow>[]>(
    () => [
      { key: "attendeeId", name: "Attendee ID", width: 130, editable: true, renderEditCell: renderTextEditor },
      { key: "fullName", name: "Full Name", width: 260, editable: true, renderEditCell: renderTextEditor },
      { key: "active", name: "Active", width: 110, editable: true, renderEditCell: renderTextEditor },
      { key: "updatedAt", name: "Updated At", width: 220 },
    ],
    [],
  );

  const completionColumns = useMemo<readonly Column<CompletionGridRow>[]>(
    () => [
      { key: "completionId", name: "Completion ID", width: 160, editable: true, renderEditCell: renderTextEditor },
      { key: "timestamp", name: "Timestamp", width: 200, editable: true, renderEditCell: renderTextEditor },
      { key: "attendeeId", name: "Attendee ID", width: 130, editable: true, renderEditCell: renderTextEditor },
      { key: "skillId", name: "Skill ID", width: 100, editable: true, renderEditCell: renderTextEditor },
      { key: "skillXp", name: "Skill XP", width: 100, editable: true, renderEditCell: renderTextEditor },
      { key: "wildcardXp", name: "Wildcard XP", width: 120, editable: true, renderEditCell: renderTextEditor },
      { key: "totalXp", name: "Total XP", width: 100 },
      { key: "source", name: "Source", width: 100 },
      { key: "updatedAt", name: "Updated At", width: 220 },
    ],
    [],
  );

  function onSkillRowsChange(rows: SkillGridRow[], data: RowsChangeData<SkillGridRow>) {
    const nextRows = rows.map((row) => ({ ...row, active: parseBool(row.active) }));
    setSkillRows(nextRows);
    for (const idx of data.indexes) {
      void upsertSkill(nextRows[idx]);
    }
  }

  function onAttendeeRowsChange(rows: AttendeeGridRow[], data: RowsChangeData<AttendeeGridRow>) {
    const nextRows = rows.map((row) => ({
      ...row,
      fullName: normalizeFullName(row.fullName),
      active: parseBool(row.active),
    }));
    setAttendeeRows(nextRows);
    for (const idx of data.indexes) {
      void upsertAttendee(nextRows[idx]);
    }
  }

  function onCompletionRowsChange(rows: CompletionGridRow[], data: RowsChangeData<CompletionGridRow>) {
    const nextRows = rows.map((row) => ({
      ...row,
      skillXp: parseNumber(row.skillXp),
      wildcardXp: parseNumber(row.wildcardXp),
      totalXp: parseNumber(row.skillXp) + parseNumber(row.wildcardXp),
    }));
    setCompletionRows(nextRows);
    for (const idx of data.indexes) {
      void upsertCompletion(nextRows[idx]);
    }
  }

  function addSkillRow() {
    const row: SkillGridRow = {
      skillId: nextId("S", 2, skillRows.map((value) => value.skillId)),
      skillName: "",
      category: "Foundation",
      xp: 10,
      active: true,
      updatedAt: new Date().toISOString(),
    };
    const nextRows = [...skillRows, row];
    setSkillRows(nextRows);
    void upsertSkill(row);
  }

  function addAttendeeRow() {
    const row: AttendeeGridRow = {
      attendeeId: nextId("A", 4, attendeeRows.map((value) => value.attendeeId)),
      fullName: "",
      active: true,
      updatedAt: new Date().toISOString(),
    };
    const nextRows = [...attendeeRows, row];
    setAttendeeRows(nextRows);
    void upsertAttendee(row);
  }

  function addCompletionRow() {
    const row: CompletionGridRow = {
      completionId: nextId("C", 6, completionRows.map((value) => value.completionId)),
      timestamp: new Date().toISOString(),
      attendeeId: attendeeRows[0]?.attendeeId ?? "",
      skillId: skillRows[0]?.skillId ?? "",
      skillXp: 0,
      wildcardXp: 0,
      totalXp: 0,
      source: "dashboard",
      updatedAt: new Date().toISOString(),
    };
    const nextRows = [row, ...completionRows];
    setCompletionRows(nextRows);
    void upsertCompletion(row);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const content =
    tab === "skills" ? (
      <DataGrid
        columns={skillColumns}
        rows={skillRows}
        rowKeyGetter={(row) => row.skillId}
        onRowsChange={onSkillRowsChange}
        onCellKeyDown={onCellKeyDown}
        onSelectedCellChange={onSelection}
      />
    ) : tab === "attendees" ? (
      <DataGrid
        columns={attendeeColumns}
        rows={attendeeRows}
        rowKeyGetter={(row) => row.attendeeId}
        onRowsChange={onAttendeeRowsChange}
        onCellKeyDown={onCellKeyDown}
        onSelectedCellChange={onSelection}
      />
    ) : (
      <DataGrid
        columns={completionColumns}
        rows={completionRows}
        rowKeyGetter={(row) => row.completionId}
        onRowsChange={onCompletionRowsChange}
        onCellKeyDown={onCellKeyDown}
        onSelectedCellChange={onSelection}
      />
    );

  return (
    <section className="admin-shell">
      <div className="status-banner">
        <span className={diagnostics?.pendingWrites ? "status-bad" : "status-good"}>
          Pending writes: {diagnostics?.pendingWrites ?? 0}
        </span>
        <span>Failed writes: {diagnostics?.failedWrites ?? 0}</span>
        <span>Last poll: {formatPacificTimestamp(diagnostics?.lastPollAt)}</span>
        <span>Last webhook: {formatPacificTimestamp(diagnostics?.lastWebhookAt)}</span>
        <span>Last queue flush: {formatPacificTimestamp(diagnostics?.lastSuccessfulWriteAt)}</span>
      </div>

      <div className="admin-card" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <button className="primary-btn" onClick={() => requestImmediateSync({ reason: "manual-click" })}>Sync from Sheet</button>
        <button className="secondary-btn" onClick={() => requestQueueFlush({})}>Flush Write Queue</button>
        <button className="secondary-btn" onClick={() => requestSheetSchemaInitialization({})}>Init/Repair Sheet Schema</button>
        <button className="ghost-btn" onClick={logout}>Logout</button>
      </div>

      <div className="admin-card">
        <div className="tab-row">
          <button className={`tab-btn ${tab === "completions" ? "active" : ""}`} onClick={() => setTab("completions")}>Completions</button>
          <button className={`tab-btn ${tab === "attendees" ? "active" : ""}`} onClick={() => setTab("attendees")}>Attendees</button>
          <button className={`tab-btn ${tab === "skills" ? "active" : ""}`} onClick={() => setTab("skills")}>Skills</button>
          {tab === "completions" ? <button className="secondary-btn" onClick={addCompletionRow}>+ Completion</button> : null}
          {tab === "attendees" ? <button className="secondary-btn" onClick={addAttendeeRow}>+ Attendee</button> : null}
          {tab === "skills" ? <button className="secondary-btn" onClick={addSkillRow}>+ Skill</button> : null}
        </div>
        <div className="grid-wrap">{content}</div>
      </div>

      <div className="small-muted">
        Mac shortcuts: <span className="kbd">⌘S</span> sync, <span className="kbd">⌘D</span> fill down, <span className="kbd">⌘C</span>/<span className="kbd">⌘V</span> copy/paste, <span className="kbd">?</span> help.
      </div>

      {showHelp ? (
        <div className="overlay" role="dialog" aria-modal="true" onClick={() => setShowHelp(false)}>
          <div className="overlay-card" onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Keyboard shortcuts</h3>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.45rem" }}>
              {ADMIN_KEYMAP.map((entry) => (
                <li key={entry.key}><strong>{entry.key}</strong>: {entry.action}</li>
              ))}
            </ul>
            <div style={{ marginTop: "0.8rem" }}>
              <button className="secondary-btn" onClick={() => setShowHelp(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
