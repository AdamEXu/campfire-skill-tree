export type SyncSource = "sheet" | "dashboard";

function toMillis(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

export function shouldApplyIncomingUpdate(params: {
  existingUpdatedAt?: string;
  incomingUpdatedAt?: string;
  existingSource?: SyncSource;
  incomingSource?: SyncSource;
}): boolean {
  const existingTs = toMillis(params.existingUpdatedAt);
  const incomingTs = toMillis(params.incomingUpdatedAt);

  if (incomingTs > existingTs) return true;
  if (incomingTs < existingTs) return false;

  if (params.incomingSource === "sheet" && params.existingSource !== "sheet") {
    return true;
  }

  return params.existingUpdatedAt === undefined;
}
