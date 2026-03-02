import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll sheets monthly-ish",
  { seconds: 2_629_746 },
  internal.sync_node.pollSheetsAndMerge,
  { reason: "cron:every-2629746-seconds" },
);

export default crons;
