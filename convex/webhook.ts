import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

export const sheetWebhook = httpAction(async (ctx, request) => {
  const secret = process.env.SHEET_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Missing SHEET_WEBHOOK_SECRET", { status: 500 });
  }

  const header = request.headers.get("x-sheet-webhook-secret");
  if (header !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return new Response("Invalid payload", { status: 400 });
  }

  const body = payload as {
    spreadsheetId?: string;
    sheetName?: "Skills" | "Attendees" | "Completions";
    rowId?: string;
    editedAt?: string;
    editor?: string;
  };

  if (!body.spreadsheetId || !body.sheetName || !body.rowId) {
    return new Response("Invalid payload", { status: 400 });
  }

  await ctx.runAction(internal.sync_node.processSheetWebhook, {
    spreadsheetId: String(body.spreadsheetId),
    sheetName: body.sheetName,
    rowId: String(body.rowId),
    editedAt: body.editedAt ? String(body.editedAt) : new Date().toISOString(),
    editor: body.editor ? String(body.editor) : undefined,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
