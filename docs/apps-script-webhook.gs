/**
 * Install trigger: onEdit
 * Spreadsheet URL: https://docs.google.com/spreadsheets/d/18DMgukvpV4GIT1Wa2IsoIaFnioMIoKHlOTtWv3wmcEA/edit
 */
const CONVEX_WEBHOOK_URL = "https://YOUR_CONVEX_DEPLOYMENT.convex.site/sheet-webhook";
const SHEET_WEBHOOK_SECRET = "replace-with-SHEET_WEBHOOK_SECRET";

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (!["Skills", "Attendees", "Completions"].includes(sheetName)) return;

  const row = e.range.getRow();
  if (row <= 1) return; // skip headers

  const rowId = sheet.getRange(row, 1).getDisplayValue();
  if (!rowId) return;

  const payload = {
    spreadsheetId: e.source.getId(),
    sheetName,
    rowId,
    editedAt: new Date().toISOString(),
    editor: Session.getActiveUser().getEmail() || undefined,
  };

  UrlFetchApp.fetch(CONVEX_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
    headers: {
      "x-sheet-webhook-secret": SHEET_WEBHOOK_SECRET,
    },
  });
}
