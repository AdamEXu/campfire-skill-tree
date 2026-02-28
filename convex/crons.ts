import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll sheets every minute",
  { minutes: 1 },
  internal.sync_node.pollSheetsAndMerge,
  { reason: "cron:every-minute" },
);

export default crons;
