"use client";

import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";

export function SessionTracker() {
  const startSession = useMutation(api.sessions.startSession);
  const heartbeat = useMutation(api.sessions.heartbeat);
  const sessionIdRef = useRef<string | null>(null);
  const { isSignedIn } = useUser();
  const isSignedInRef = useRef(isSignedIn ?? false);

  // Keep ref in sync with latest auth state
  useEffect(() => {
    isSignedInRef.current = isSignedIn ?? false;
  }, [isSignedIn]);

  useEffect(() => {
    let sid = sessionStorage.getItem("brd_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("brd_sid", sid);
    }
    sessionIdRef.current = sid;

    startSession({ sessionId: sid, isSignedIn: isSignedInRef.current });

    // Skip heartbeats while the tab is hidden; send one as soon as it becomes visible again.
    const beat = () => {
      if (sessionIdRef.current && document.visibilityState === "visible") {
        heartbeat({ sessionId: sessionIdRef.current, isSignedIn: isSignedInRef.current });
      }
    };
    const interval = setInterval(beat, 30000);
    document.addEventListener("visibilitychange", beat);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [startSession, heartbeat]);

  return null;
}
