import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily and weekly outlines. Runs every hour on the hour; each user is picked up in the
// hour that matches their chosen time in their own time zone (see emails.ts).
crons.cron("email outlines", "0 * * * *", internal.emails.sendScheduledDigests, {});

export default crons;
