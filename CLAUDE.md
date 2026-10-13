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
- `src/components/home/useHomeState.ts`: all app state, effects and handlers (board data, sync, focus timer, billing). Its return object is shared through `HomeContext` (`src/components/home/HomeContext.tsx`); components read it with `const { ... } = useHome()`. To expose something new to a view, add it to the hook's `return { ... }`.
- `src/components/HomeShell.tsx`: page layout only (header, hero, desktop board canvas and toolbar), composing the pieces below.
- `src/components/board/`: MobileBoard (phone layout), SettingsPanel, TaskComposer, NoteDetailModal, StepModal, DraftPromptModal, RenameBoardModal.
- `src/components/focus/`: DurationPicker, FocusOverlay, SessionReviewModal, ProfilePanel.
- `src/components/landing/`: MarketingSections (focus showcase, features, pricing), FeedbackBoard.
- `src/components/tutorial/Tutorial.tsx`: the interactive onboarding tour. Each step spotlights a real control by its `data-tour="…"` attribute (same ids on desktop and phone, e.g. `add-task`, `composer-title`, `composer-create`, `newest-card`, `focus-button`, `bob`, `boards`, `settings`) and either waits for Next or for the user to do the action. Steps whose control isn't visible are skipped automatically. Auto-opens once for brand-new accounts (no saved board in Convex yet; key `boardtivity_tutorial_v2_seen`); Settings → Help → "Replay the tutorial" calls `openTutorial()`. Keep `data-tour` attributes when refactoring those controls, and add a step when shipping a major feature.
- `src/components/modals/AccountModals.tsx`: Upgrade, LimitReached, Subscribed, WhatsNew, NamePrompt. All use `src/components/ui/Modal.tsx`.
- `src/lib/`: `board.ts` (types), `ui.ts` (theme tokens + style builders like `buttonStyle`, `pageText`), `colors.ts` (note/task palettes), `dates.ts`, `boardLayout.ts` (canvas sizes, ids, subtask layout), `breakdown.ts` (offline subtask heuristics), `hooks.ts` (`useIsMobile`, `useRevealOnScroll`).
- For new UI, reuse `src/lib/ui.ts` tokens and `Modal` instead of hand-writing colors and overlays.
- Every pop-up (dialogs, focus screens, panels) must render inside `<OverlayLayer>` at the end of `HomeShell`. It portals into the fullscreen board when fullscreen is on (the browser only paints that element) and into `<body>` otherwise. Anything rendered elsewhere disappears in fullscreen. Clerk modals can't be portaled, so `openSignIn`/`openSignUp` from `useHome()` exit fullscreen first.
- BOB access is enforced server-side in `api/bob/route.ts` (Plus status + remaining tokens via Convex). Usage is still recorded from the client (`recordUsage` in BobAgent).
- Convex tables: `convex/schema.ts` (userBoards, focusStats, reminders, subscriptions, feedback*, bobUsage, sessions, waitlist, emailPrefs).

## Sync logic (careful)
Board state is saved to localStorage and debounced to Convex (`userBoards`). `useHomeState` uses refs (`justAppliedCloudRef`, last-pushed snapshot, in-flight guard, deletion tombstones) to avoid echo loops and to stop stale devices from restoring deleted items. Any change that adds or removes notes/boards must keep tombstones updated, or deletions will come back. Test with two tabs signed in as the same user.

## Commands
- `npm run dev` for local dev (port 3000). `npm run type-check` before committing.
- `npm run build` also runs `convex deploy`, so don't run it locally unless you mean to deploy Convex.
