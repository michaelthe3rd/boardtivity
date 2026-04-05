"use client";
import dynamic from "next/dynamic";

const HomeShell = dynamic(
  () => import("@/components/HomeShell").then((m) => m.HomeShell),
  { ssr: false }
);

export default function HomeShellClient() {
  return <HomeShell />;
}
