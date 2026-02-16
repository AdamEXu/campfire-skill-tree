export type Source = "sheet" | "dashboard";

export interface SkillRow {
  skillId: string;
  skillName: string;
  category: string;
  xp: number;
  active: boolean;
  updatedAt: string;
}

export interface AttendeeRow {
  attendeeId: string;
  fullName: string;
  active: boolean;
  updatedAt: string;
}

export interface CompletionRow {
  completionId: string;
  timestamp: string;
  attendeeId: string;
  skillId: string;
  skillXp: number;
  wildcardXp: number;
  totalXp: number;
  updatedAt: string;
  source: Source;
}

export interface SheetWebhookEvent {
  spreadsheetId: string;
  sheetName: "Skills" | "Attendees" | "Completions";
  rowId: string;
  editedAt: string;
  editor?: string;
}

export interface LeaderboardEntry {
  rank: number;
  attendeeId: string;
  fullName: string;
  totalXp: number;
  recentActivityAt: string | null;
}
