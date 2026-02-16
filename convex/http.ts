import { httpRouter } from "convex/server";
import { sheetWebhook } from "./webhook";

const http = httpRouter();

http.route({
  path: "/sheet-webhook",
  method: "POST",
  handler: sheetWebhook,
});

export default http;
