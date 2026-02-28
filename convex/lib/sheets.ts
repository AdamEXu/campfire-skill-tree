"use node";

import fs from "node:fs";
import { google, sheets_v4 } from "googleapis";

const SHEETS_SCOPE = ["https://www.googleapis.com/auth/spreadsheets"];
const PACIFIC_TZ = "America/Los_Angeles";

const PACIFIC_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: PACIFIC_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const PACIFIC_OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: PACIFIC_TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
});

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type SkillSheetRow = {
  skillId: string;
  skillName: string;
  category: string;
  xp: number;
  active: boolean;
  updatedAt: string;
};

export type AttendeeSheetRow = {
  attendeeId: string;
  fullName: string;
  active: boolean;
  updatedAt: string;
};

export type CompletionSheetRow = {
  completionId: string;
  timestamp: string;
  attendeeId: string;
  skillId: string;
  skillXp: number;
  wildcardXp: number;
  totalXp: number;
  updatedAt: string;
  source: "sheet" | "dashboard";
};

function parseBool(value: unknown, defaultValue = true): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
    if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  }
  return defaultValue;
}

function parseNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

function parseOffsetMinutes(offsetLabel: string): number | null {
  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}

function getPacificOffsetMinutes(utcMillis: number): number {
  const parts = PACIFIC_OFFSET_FORMATTER.formatToParts(new Date(utcMillis));
  const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  return parseOffsetMinutes(offsetLabel) ?? -480;
}

function readPacificDateParts(utcMillis: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = PACIFIC_PARTS_FORMATTER.formatToParts(new Date(utcMillis));
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(valueByType.get("year") ?? "0"),
    month: Number(valueByType.get("month") ?? "1"),
    day: Number(valueByType.get("day") ?? "1"),
    hour: Number(valueByType.get("hour") ?? "0"),
    minute: Number(valueByType.get("minute") ?? "0"),
    second: Number(valueByType.get("second") ?? "0"),
  };
}

function parsePacificWallClockString(raw: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const isoLike = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2})(?::(\d{2}))?(?::(\d{2}))?)?(?:\.\d+)?$/,
  );
  if (isoLike) {
    return {
      year: Number(isoLike[1]),
      month: Number(isoLike[2]),
      day: Number(isoLike[3]),
      hour: Number(isoLike[4] ?? "0"),
      minute: Number(isoLike[5] ?? "0"),
      second: Number(isoLike[6] ?? "0"),
    };
  }

  const usLike = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (!usLike) return null;

  const hourRaw = Number(usLike[4] ?? "0");
  const amPm = (usLike[7] ?? "").toUpperCase();
  let hour = hourRaw;
  if (amPm === "PM" && hour < 12) hour += 12;
  if (amPm === "AM" && hour === 12) hour = 0;

  return {
    year: Number(usLike[3]),
    month: Number(usLike[1]),
    day: Number(usLike[2]),
    hour,
    minute: Number(usLike[5] ?? "0"),
    second: Number(usLike[6] ?? "0"),
  };
}

function formatOffset(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function pacificLocalToIso(params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): string {
  const baseUtc = Date.UTC(
    params.year,
    params.month - 1,
    params.day,
    params.hour,
    params.minute,
    params.second,
  );

  let utcMillis = baseUtc;
  for (let i = 0; i < 3; i += 1) {
    const offsetMinutes = getPacificOffsetMinutes(utcMillis);
    const candidateUtc = baseUtc - offsetMinutes * 60_000;
    if (candidateUtc === utcMillis) break;
    utcMillis = candidateUtc;
  }

  const pacificParts = readPacificDateParts(utcMillis);
  const offset = formatOffset(getPacificOffsetMinutes(utcMillis));

  const year = String(pacificParts.year).padStart(4, "0");
  const month = String(pacificParts.month).padStart(2, "0");
  const day = String(pacificParts.day).padStart(2, "0");
  const hour = String(pacificParts.hour).padStart(2, "0");
  const minute = String(pacificParts.minute).padStart(2, "0");
  const second = String(pacificParts.second).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

function parseSheetSerialAsPacificIso(serial: number): string {
  // Google Sheets/Excel serial origin (1899-12-30).
  const utcMillis = Math.round((serial - 25569) * 86_400_000);
  const pseudoUtc = new Date(utcMillis);
  return pacificLocalToIso({
    year: pseudoUtc.getUTCFullYear(),
    month: pseudoUtc.getUTCMonth() + 1,
    day: pseudoUtc.getUTCDate(),
    hour: pseudoUtc.getUTCHours(),
    minute: pseudoUtc.getUTCMinutes(),
    second: pseudoUtc.getUTCSeconds(),
  });
}

function nowPacificIso(): string {
  const parts = readPacificDateParts(Date.now());
  return pacificLocalToIso(parts);
}

function parseTimestamp(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value) && value > 20000) {
    return parseSheetSerialAsPacificIso(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const raw = value.trim();
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 20000) {
      return parseSheetSerialAsPacificIso(asNumber);
    }

    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
      const local = parsePacificWallClockString(raw);
      if (local) return pacificLocalToIso(local);
    }

    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      const pacific = readPacificDateParts(parsed);
      return pacificLocalToIso(pacific);
    }
    return raw;
  }
  return nowPacificIso();
}

function normalizeName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function makeAttendeeId(inputName: string): string {
  const slug = normalizeName(inputName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `A-${slug || "unknown"}`;
}

function looksLikeSkillId(value: string): boolean {
  return /^S\d{1,3}$/i.test(value.trim());
}

function looksLikeCompletionId(value: string): boolean {
  return /^C[A-Z0-9-]{2,}$/i.test(value.trim());
}

function parseServiceAccountCredentials(): ServiceAccountCredentials {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    const parsed = JSON.parse(json) as ServiceAccountCredentials;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing required fields");
    }
    return parsed;
  }

  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (!file) {
    throw new Error("Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_FILE");
  }

  const filePayload = JSON.parse(fs.readFileSync(file, "utf8")) as ServiceAccountCredentials;
  if (!filePayload.client_email || !filePayload.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_FILE is missing required fields");
  }
  return filePayload;
}

async function createSheetsClient(): Promise<sheets_v4.Sheets> {
  const creds = parseServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: SHEETS_SCOPE,
  });
  return google.sheets({ version: "v4", auth });
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error("GOOGLE_SPREADSHEET_ID is required");
  return id;
}

async function readRows(range: string, opts?: { optional?: boolean }): Promise<string[][]> {
  const sheets = await createSheetsClient();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const values = response.data.values ?? [];
    return values.map((row) => row.map((cell) => String(cell ?? "")));
  } catch (error) {
    if (opts?.optional) return [];
    throw error;
  }
}

export async function pullSheetSnapshot(): Promise<{
  skills: SkillSheetRow[];
  attendees: AttendeeSheetRow[];
  completions: CompletionSheetRow[];
}> {
  const [skillsRaw, attendeesRaw, completionsRaw] = await Promise.all([
    readRows("Skills!A2:F"),
    readRows("Attendees!A2:D", { optional: true }),
    readRows("Completions!A2:I"),
  ]);

  const skills = skillsRaw
    .filter((row) => row[0] && row[0].toLowerCase() !== "skillid")
    .map((row): SkillSheetRow => ({
      skillId: row[0],
      skillName: row[1] ?? "",
      category: row[2] ?? "",
      xp: parseNumber(row[3], 0),
      active: parseBool(row[4], true),
      updatedAt: parseTimestamp(row[5]),
    }));

  const attendees = attendeesRaw
    .filter((row) => row[0] && row[0].toLowerCase() !== "attendeeid")
    .map((row): AttendeeSheetRow => ({
      attendeeId: row[0],
      fullName: row[1] ?? "",
      active: parseBool(row[2], true),
      updatedAt: parseTimestamp(row[3]),
    }));

  const skillsByName = new Map<string, string>();
  for (const skill of skills) {
    skillsByName.set(skill.skillName.trim().toLowerCase(), skill.skillId);
  }

  const attendeeNameToId = new Map<string, string>();
  const generatedAttendeeNames = new Map<string, string>();
  for (const attendee of attendees) {
    attendeeNameToId.set(attendee.fullName.trim().toLowerCase(), attendee.attendeeId);
  }

  const completions: CompletionSheetRow[] = [];
  for (let index = 0; index < completionsRaw.length; index += 1) {
    const row = completionsRaw[index];
    if (!row.some((cell) => cell && cell.trim().length > 0)) continue;

    const first = (row[0] ?? "").trim();
    const second = (row[1] ?? "").trim();
    const third = (row[2] ?? "").trim();

    if (
      first.toLowerCase() === "completionid" ||
      first.toLowerCase() === "timestamp" ||
      second.toLowerCase() === "column 2"
    ) {
      continue;
    }

    // Canonical format: CompletionID, Timestamp, AttendeeID, SkillID, ...
    if (looksLikeCompletionId(first)) {
      const skillXp = parseNumber(row[4], 0);
      const wildcardXp = parseNumber(row[5], 0);
      completions.push({
        completionId: first,
        timestamp: parseTimestamp(row[1]),
        attendeeId: row[2] ?? "",
        skillId: row[3] ?? "",
        skillXp,
        wildcardXp,
        totalXp: parseNumber(row[6], skillXp + wildcardXp),
        updatedAt: parseTimestamp(row[7]),
        source: row[8] === "dashboard" ? "dashboard" : "sheet",
      });
      continue;
    }

    // Legacy format: Timestamp, ParticipantName, SkillName, XP, WildcardXP, TotalXP
    if (second && third) {
      const normalizedName = normalizeName(second);
      const attendeeKey = normalizedName.toLowerCase();
      const attendeeId = attendeeNameToId.get(attendeeKey) ?? makeAttendeeId(normalizedName);
      attendeeNameToId.set(attendeeKey, attendeeId);
      generatedAttendeeNames.set(attendeeId, normalizedName);

      const skillRef = third;
      const skillId = looksLikeSkillId(skillRef)
        ? skillRef.toUpperCase()
        : (skillsByName.get(skillRef.toLowerCase()) ?? skillRef);

      const skillXp = parseNumber(row[3], 0);
      const wildcardXp = parseNumber(row[4], 0);
      const totalXp = parseNumber(row[5], skillXp + wildcardXp);

      completions.push({
        completionId: `CLEG-${String(index + 1).padStart(6, "0")}`,
        timestamp: parseTimestamp(row[0]),
        attendeeId,
        skillId,
        skillXp,
        wildcardXp,
        totalXp,
        updatedAt: new Date().toISOString(),
        source: "sheet",
      });
    }
  }

  const attendeeMap = new Map(attendees.map((row) => [row.attendeeId, row]));
  for (const completion of completions) {
    if (!attendeeMap.has(completion.attendeeId)) {
      attendeeMap.set(completion.attendeeId, {
        attendeeId: completion.attendeeId,
        fullName: generatedAttendeeNames.get(completion.attendeeId) ??
          (completion.attendeeId.startsWith("A-")
            ? completion.attendeeId.replace(/^A-/, "").replace(/-/g, " ")
            : completion.attendeeId),
        active: true,
        updatedAt: completion.updatedAt,
      });
    }
  }

  return { skills, attendees: [...attendeeMap.values()], completions };
}

async function findRowNumberById(sheetName: string, id: string): Promise<number | null> {
  const rows = await readRows(`${sheetName}!A2:A`);
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? null : index + 2;
}

async function updateRow(sheetName: string, rowNumber: number, values: (string | number | boolean)[]) {
  const sheets = await createSheetsClient();
  const endColumn = String.fromCharCode("A".charCodeAt(0) + values.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${sheetName}!A${rowNumber}:${endColumn}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

async function appendRow(sheetName: string, values: (string | number | boolean)[]) {
  const sheets = await createSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
}

async function upsertRow(sheetName: string, id: string, values: (string | number | boolean)[]) {
  const rowNumber = await findRowNumberById(sheetName, id);
  if (rowNumber === null) {
    await appendRow(sheetName, values);
    return;
  }
  await updateRow(sheetName, rowNumber, values);
}

export async function upsertSkillRow(row: SkillSheetRow): Promise<void> {
  await upsertRow("Skills", row.skillId, [
    row.skillId,
    row.skillName,
    row.category,
    row.xp,
    row.active,
    row.updatedAt,
  ]);
}

export async function upsertAttendeeRow(row: AttendeeSheetRow): Promise<void> {
  await upsertRow("Attendees", row.attendeeId, [
    row.attendeeId,
    row.fullName,
    row.active,
    row.updatedAt,
  ]);
}

export async function upsertCompletionRow(row: CompletionSheetRow): Promise<void> {
  await upsertRow("Completions", row.completionId, [
    row.completionId,
    row.timestamp,
    row.attendeeId,
    row.skillId,
    row.skillXp,
    row.wildcardXp,
    row.totalXp,
    row.updatedAt,
    row.source,
  ]);
}

export async function ensureSheetSchema(): Promise<void> {
  const sheets = await createSheetsClient();
  const id = spreadsheetId();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
  const tabs = new Map<string, number>();
  for (const sheet of meta.data.sheets ?? []) {
    if (!sheet.properties?.title || sheet.properties.sheetId == null) continue;
    tabs.set(sheet.properties.title, sheet.properties.sheetId);
  }

  const requests: sheets_v4.Schema$Request[] = [];

  if (!tabs.has("Attendees")) {
    requests.push({
      addSheet: {
        properties: {
          title: "Attendees",
          gridProperties: { rowCount: 2000, columnCount: 8 },
        },
      },
    });
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "Skills!A1:F1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["SkillID", "SkillName", "Category", "XP", "Active", "UpdatedAt"]],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "Attendees!A1:D1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["AttendeeID", "FullName", "Active", "UpdatedAt"]],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: "Completions!A1:I1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["CompletionID", "Timestamp", "AttendeeID", "SkillID", "SkillXP", "WildcardXP", "TotalXP", "UpdatedAt", "Source"]],
    },
  });

  const refreshed = await sheets.spreadsheets.get({ spreadsheetId: id });
  const sheetIds = new Map<string, number>();
  for (const sheet of refreshed.data.sheets ?? []) {
    if (!sheet.properties?.title || sheet.properties.sheetId == null) continue;
    sheetIds.set(sheet.properties.title, sheet.properties.sheetId);
  }

  const hideRequests: sheets_v4.Schema$Request[] = [];

  const skillsId = sheetIds.get("Skills");
  if (skillsId !== undefined) {
    hideRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: skillsId,
          dimension: "COLUMNS",
          startIndex: 5,
          endIndex: 6,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }

  const attendeesId = sheetIds.get("Attendees");
  if (attendeesId !== undefined) {
    hideRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: attendeesId,
          dimension: "COLUMNS",
          startIndex: 3,
          endIndex: 4,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }

  const completionsId = sheetIds.get("Completions");
  if (completionsId !== undefined) {
    hideRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: completionsId,
          dimension: "COLUMNS",
          startIndex: 7,
          endIndex: 9,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }

  if (hideRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: id,
      requestBody: { requests: hideRequests },
    });
  }
}
