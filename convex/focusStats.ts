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
    // Client-supplied local date (YYYY-MM-DD) so streak/window uses
    // the user's timezone rather than the server's UTC clock.
    clientToday: v.optional(v.string()),
  },
  handler: async (ctx, { days, clientToday }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clampedDays = Math.min(days, 90);

    // Use client-supplied date if provided, otherwise fall back to UTC
    const todayStr = clientToday ?? new Date().toISOString().slice(0, 10);
    const todayDate = new Date(todayStr + "T12:00:00Z"); // noon UTC avoids off-by-one

    // Build the set of date strings for the requested window (oldest → newest)
    const dateStrings: string[] = [];
    for (let i = clampedDays - 1; i >= 0; i--) {
      const d = new Date(todayDate);
      d.setUTCDate(todayDate.getUTCDate() - i);
      dateStrings.push(d.toISOString().slice(0, 10));
    }

    const oldestDate = dateStrings[0];

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

    const daysArray = dateStrings.map((date) => {
      const found = byDate.get(date);
      return {
        date,
        totalMinutes: found?.totalMinutes ?? 0,
        tasksCompleted: found?.tasksCompleted ?? 0,
      };
    });

    // All-time totals
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

    // Current streak: count consecutive days ending today (client local date)
    let currentStreak = 0;
    for (let i = 0; ; i++) {
      const d = new Date(todayDate);
      d.setUTCDate(todayDate.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const matchingRow = allRows.find((r) => r.date === dateStr);
      if (matchingRow && matchingRow.totalMinutes > 0) {
        currentStreak++;
      } else {
        // Skip today if no entry yet (don't break streak)
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
