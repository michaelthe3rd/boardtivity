import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily digest — 13:00 UTC daily (9am Eastern / 6am Pacific)
crons.cron("daily digest", "0 13 * * *", internal.emails.sendDailyDigests, {});

// Weekly digest — 13:00 UTC every Monday
crons.cron("weekly digest", "0 13 * * 1", internal.emails.sendWeeklyDigests, {});

export default crons;
