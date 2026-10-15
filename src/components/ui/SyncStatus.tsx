"use client";

import { CloudIcon } from "@/components/ui/Icons";

export type CloudSyncState = "loading" | "synced" | "saving" | "error";
// "signedOut" is display-only: the board lives in this browser and isn't backed up yet.
export type SyncDisplayState = CloudSyncState | "signedOut";

// One place for the sync colors and wording, so the toolbar and both Settings panels match.
export const SYNC_COLORS: Record<SyncDisplayState, string> = {
  synced: "#3db83d",
  saving: "#c8960a",
  loading: "#c8960a",
  error: "#c03030",
  signedOut: "#c03030",
};

export function syncLabel(state: SyncDisplayState, retryVerb: "click" | "tap" = "tap") {
  if (state === "signedOut") return `Not synced — ${retryVerb} to sign in`;
  return state === "synced" ? "Synced" : state === "saving" ? "Saving…" : state === "error" ? `Sync error — ${retryVerb} to retry` : "Connecting…";
}

// Cloud drawn in the status color: green synced, yellow saving/connecting, red error or signed out.
export function SyncCloud({ state, size = 16 }: { state: SyncDisplayState; size?: number }) {
  return (
    <span
      className={state === "saving" ? "sync-cloud-pulse" : undefined}
      style={{ display: "inline-flex", color: SYNC_COLORS[state], transition: "color .3s", flexShrink: 0 }}
    >
      <CloudIcon size={size} strokeWidth={2.2} />
    </span>
  );
}
