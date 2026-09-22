<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Boardtivity — project map

Visual task + idea board with focus sessions and an AI assistant (BOB). Live at boardtivity.com.

## Stack
- Next.js 16 (App Router) + React 19, deployed on Vercel. Inline styles, no CSS framework (`src/app/globals.css` holds theme vars and a few classes).
- Convex backend (`convex/`), Clerk auth (`convex/auth.config.ts`, `src/proxy.ts`), Stripe billing (`src/app/api/checkout`, `api/portal`, `convex/subscriptions.ts`).
- BOB: `src/app/api/bob/route.ts` (Gemini) + `src/components/BobAgent.tsx` UI.
- Mobile: `mobile/` is an Expo app that wraps boardtivity.com in a WebView (`mobile/app/index.tsx`). UI changes to the web app ship to mobile automatically; native changes need an EAS build.

## Where things live
- `src/components/HomeShell.tsx` (~6.7k lines) holds almost the whole product: landing page, board canvas, notes/tasks, focus timer, settings, profile, modals. Sections are marked with `{/* ── NAME ── */}` comments. The render starts around the single `return (` near line 2300; state, effects, and handlers come before it.
- Shared types: `src/lib/board.ts`.
- Convex tables: `convex/schema.ts` (userBoards, focusStats, reminders, subscriptions, feedback*, bobUsage, sessions, waitlist, emailPrefs).

## Sync logic (careful)
Board state is saved to localStorage and debounced to Convex (`userBoards`). HomeShell uses refs (`justAppliedCloudRef`, last-pushed snapshot, in-flight guard, deletion tombstones) to avoid echo loops and to stop stale devices from restoring deleted items. Any change that adds or removes notes/boards must keep tombstones updated, or deletions will come back. Test with two tabs signed in as the same user.

## Commands
- `npm run dev` for local dev (port 3000). `npm run type-check` before committing.
- `npm run build` also runs `convex deploy`, so don't run it locally unless you mean to deploy Convex.
