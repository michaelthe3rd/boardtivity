"use client";

import { createContext, useContext } from "react";
import type { HomeState } from "./useHomeState";

export const HomeContext = createContext<HomeState | null>(null);

export function useHome(): HomeState {
  const ctx = useContext(HomeContext);
  if (!ctx) throw new Error("useHome must be used inside HomeContext.Provider");
  return ctx;
}
