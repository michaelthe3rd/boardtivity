import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logSession = mutation({
  args: {
    date: v.string(),
    minutes: v.number(),
    taskCompleted: v.boolean(),
  },
  handler: async (ctx, { date, minutes, taskCompleted }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const existing = await ctx.db
      .query("focusStats")
      .withIndex("by_token_and_date", (q) =>
        q
          .eq("tokenIdentifier", identity.tokenIdentifier)
          .eq("date", date)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        totalMinutes: existing.totalMinutes + minutes,
        tasksCompleted: existing.tasksCompleted + (taskCompleted ? 1 : 0),
      });
    } else {
      await ctx.db.insert("focusStats", {
        tokenIdentifier: identity.tokenIdentifier,
        date,
        totalMinutes: minutes,
        tasksCompleted: taskCompleted ? 1 : 0,
      });
    }
    return null;
  },
});

export const getStats = query({
  args: {
    days: v.number(),
  },
  handler: async (ctx, { days }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clampedDays = Math.min(days, 90);

    // Build the set of date strings for the requested window (oldest → newest)
    const today = new Date();
    const dateStrings: string[] = [];
    for (let i = clampedDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateStrings.push(d.toISOString().slice(0, 10));
    }

    const oldestDate = dateStrings[0];

    // Fetch all rows for this user on or after oldestDate.
    // The index is on [tokenIdentifier, date]; string comparison works for
    // ISO date strings, so we can use gte to bound the scan.
    const rows = await ctx.db
      .query("focusStats")
      .withIndex("by_token_and_date", (q) =>
        q
          .eq("tokenIdentifier", identity.tokenIdentifier)
          .gte("date", oldestDate)
      )
      .order("asc")
      .take(90);

    // Build a map for quick lookup
    const byDate = new Map<string, { totalMinutes: number; tasksCompleted: number }>();
    for (const row of rows) {
      byDate.set(row.date, {
        totalMinutes: row.totalMinutes,
        tasksCompleted: row.tasksCompleted,
      });
    }

    // Produce the days array (one entry per requested date, filling zeros for missing days)
    const daysArray = dateStrings.map((date) => {
      const found = byDate.get(date);
      return {
        date,
        totalMinutes: found?.totalMinutes ?? 0,
        tasksCompleted: found?.tasksCompleted ?? 0,
      };
    });

    // All-time totals: fetch all rows for the user (bounded at 10000 to stay safe)
    const allRows = await ctx.db
      .query("focusStats")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .take(10000);

    let totalMinutesAllTime = 0;
    let totalTasksCompletedAllTime = 0;
    for (const row of allRows) {
      totalMinutesAllTime += row.totalMinutes;
      totalTasksCompletedAllTime += row.tasksCompleted;
    }

    // Current streak: count consecutive days (ending today) with totalMinutes > 0
    const todayStr = today.toISOString().slice(0, 10);
    let currentStreak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      // Look up in the allRows map
      const matchingRow = allRows.find((r) => r.date === dateStr);
      if (matchingRow && matchingRow.totalMinutes > 0) {
        currentStreak++;
      } else {
        // If today has no entry yet, don't break the streak — skip today and
        // continue checking yesterday. Otherwise break.
        if (i === 0 && dateStr === todayStr) {
          continue;
        }
        break;
      }
    }

    return {
      days: daysArray,
      currentStreak,
      totalMinutes: totalMinutesAllTime,
      totalTasksCompleted: totalTasksCompletedAllTime,
    };
  },
});
