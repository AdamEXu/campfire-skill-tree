/* eslint-disable @typescript-eslint/no-explicit-any */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
const internalAny = internal as any;

crons.interval("poll-google-sheet-every-30s", { seconds: 30 }, internal.sync_node.pollCron, {});
crons.interval("flush-sheet-write-queue", { seconds: 5 }, internalAny.admin_node.queueFlushCron, {});

export default crons;
