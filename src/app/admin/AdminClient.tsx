"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "@/../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/../convex/_generated/dataModel";

type Tab = "overview" | "analytics" | "users" | "feedback" | "waitlist";

// ─── Theme ───────────────────────────────────────────────────────────────────
type Theme = {
  sidebarBg: string; sidebarBorder: string; sidebarText: string; sidebarSub: string;
  navActiveBg: string; navActiveText: string; navText: string; navSectionText: string;
  mainBg: string; cardBg: string; cardBorder: string; cardShadow: string;
  titleText: string; subText: string; mutedText: string;
  tableHeadBg: string; tableHeadText: string; tableHeadBorder: string;
  tableRowBorder: string; tableBodyText: string;
  logoFilter: string; signOutBorder: string; signOutText: string;
  toggleBg: string; toggleBorder: string; toggleText: string;
  emailText: string; sectionDivider: string; tagBg: string; tagText: string;
};

const dark: Theme = {
  sidebarBg: "#0f1012", sidebarBorder: "rgba(255,255,255,.07)", sidebarText: "#f0f0ee", sidebarSub: "rgba(255,255,255,.28)",
  navActiveBg: "rgba(255,255,255,.09)", navActiveText: "#f0f0ee", navText: "rgba(255,255,255,.38)", navSectionText: "rgba(255,255,255,.18)",
  mainBg: "#16181a", cardBg: "#1d2023", cardBorder: "rgba(255,255,255,.07)", cardShadow: "0 1px 6px rgba(0,0,0,.35)",
  titleText: "#f0f0ee", subText: "rgba(240,240,238,.38)", mutedText: "rgba(240,240,238,.28)",
  tableHeadBg: "#181b1e", tableHeadText: "rgba(240,240,238,.28)", tableHeadBorder: "rgba(255,255,255,.06)",
  tableRowBorder: "rgba(255,255,255,.04)", tableBodyText: "rgba(240,240,238,.55)",
  logoFilter: "brightness(0) invert(1)", signOutBorder: "rgba(255,255,255,.12)", signOutText: "rgba(255,255,255,.38)",
  toggleBg: "rgba(255,255,255,.07)", toggleBorder: "rgba(255,255,255,.1)", toggleText: "rgba(255,255,255,.55)",
  emailText: "rgba(255,255,255,.35)", sectionDivider: "rgba(255,255,255,.06)", tagBg: "rgba(255,255,255,.07)", tagText: "rgba(240,240,238,.45)",
};

const light: Theme = {
  sidebarBg: "#ffffff", sidebarBorder: "rgba(17,19,21,.08)", sidebarText: "#111315", sidebarSub: "rgba(17,19,21,.38)",
  navActiveBg: "rgba(17,19,21,.06)", navActiveText: "#111315", navText: "rgba(17,19,21,.45)", navSectionText: "rgba(17,19,21,.25)",
  mainBg: "#f5f5f3", cardBg: "#ffffff", cardBorder: "rgba(17,19,21,.08)", cardShadow: "0 1px 4px rgba(0,0,0,.04)",
  titleText: "#111315", subText: "rgba(17,19,21,.45)", mutedText: "rgba(17,19,21,.35)",
  tableHeadBg: "#f8f8f6", tableHeadText: "rgba(17,19,21,.4)", tableHeadBorder: "rgba(17,19,21,.07)",
  tableRowBorder: "rgba(17,19,21,.05)", tableBodyText: "rgba(17,19,21,.5)",
  logoFilter: "brightness(0)", signOutBorder: "rgba(17,19,21,.15)", signOutText: "rgba(17,19,21,.5)",
  toggleBg: "rgba(17,19,21,.05)", toggleBorder: "rgba(17,19,21,.1)", toggleText: "rgba(17,19,21,.55)",
  emailText: "rgba(17,19,21,.38)", sectionDivider: "rgba(17,19,21,.06)", tagBg: "#f0ede6", tagText: "rgba(17,19,21,.5)",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

const maskToken = (t: string) => t.slice(0, 14) + "…" + t.slice(-6);

const fmtDay = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
};

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ values, color, height = 72 }: { values: number[]; color: string; height?: number }) {
  const max = Math.max(...values, 1);
  const n = values.length;
  return (
    <svg viewBox={`0 0 ${n * 12} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      {values.map((v, i) => {
        const bh = Math.max((v / max) * (height - 6), v > 0 ? 3 : 0);
        return (
          <rect key={i} x={i * 12 + 1.5} y={height - bh} width={9} height={bh || 2}
            rx={2.5} fill={color} fillOpacity={v === 0 ? 0.15 : 0.82} />
        );
      })}
    </svg>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({ label, icon, active, onClick, t }: { label: string; icon: string; active: boolean; onClick: () => void; t: Theme }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9,
      border: "none", background: active ? t.navActiveBg : "transparent",
      color: active ? t.navActiveText : t.navText,
      fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      width: "100%", textAlign: "left", transition: "background .15s, color .15s",
    }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
      {active && <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: "50%", backgroundColor: "#6fc46b" }} />}
    </button>
  );
}

// ─── Admin Gate ───────────────────────────────────────────────────────────────
function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();
  const stats = useQuery(api.admin.getStats);
  const whoami = useQuery(api.admin.whoami);

  useEffect(() => { if (stats) onUnlock(); }, [stats]);

  function handleSignIn() {
    if (isSignedIn) {
      signOut();
    } else {
      openSignIn({ afterSignInUrl: "/admin" } as Parameters<typeof openSignIn>[0]);
    }
  }

  const showNotAdmin = isLoaded && isSignedIn && stats === null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f1012", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Satoshi', Arial, sans-serif" }}>
      <div style={{ width: "min(400px, calc(100vw - 40px))" }}>
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Boardtivity" style={{ height: 130, marginBottom: 32, filter: "brightness(0) invert(1)" }} />
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", color: "#f0f0ee", marginBottom: 8 }}>Admin Access</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.32)", lineHeight: 1.6 }}>
            {showNotAdmin ? "This account doesn't have admin access." : "Sign in with your admin account to continue."}
          </div>
        </div>
        <div style={{ backgroundColor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "28px 24px" }}>
          {showNotAdmin && whoami && (
            <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, backgroundColor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.28)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Signed in as</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", fontFamily: "monospace", wordBreak: "break-all" }}>{whoami.email ?? whoami.tokenIdentifier}</div>
            </div>
          )}
          <button onClick={handleSignIn} disabled={!isLoaded || (isSignedIn && stats === undefined)}
            style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", backgroundColor: "#f0f0ee", color: "#111315", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em", opacity: (!isLoaded || (isSignedIn && stats === undefined)) ? .5 : 1, transition: "opacity .15s" }}>
            {!isLoaded ? "Loading…" : isSignedIn && stats === undefined ? "Verifying…" : showNotAdmin ? "Sign in with a different account" : "Sign in to admin"}
          </button>
        </div>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.16)" }}>
          Admin access is restricted. Unauthorized attempts are logged.
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminClient() {
  useEffect(() => { document.documentElement.style.visibility = ""; }, []);

  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [bulbFlicker, setBulbFlicker] = useState(false);

  const t = isDark ? dark : light;

  const { user } = useUser();
  const stats = useQuery(api.admin.getStats);
  const users = useQuery(api.admin.getUsers);
  const feedback = useQuery(api.admin.getFeedback);
  const waitlist = useQuery(api.admin.getWaitlist);
  const analytics = useQuery(api.admin.getAnalytics);

  const deletePost = useMutation(api.admin.adminDeletePost);
  const deleteWaitlist = useMutation(api.admin.adminDeleteWaitlist);
  const deleteUser = useMutation(api.admin.adminDeleteUser);
  const { signOut } = useClerk();

  if (!unlocked || !stats) return <AdminGate onUnlock={() => setUnlocked(true)} />;

  const TABS: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: "overview", label: "Overview", icon: "◈" },
    { id: "analytics", label: "Analytics", icon: "◧" },
    { id: "users", label: "Users", icon: "◉", count: stats.totalUsers },
    { id: "feedback", label: "Feedback", icon: "◎", count: stats.totalPosts },
    { id: "waitlist", label: "Waitlist", icon: "◌", count: stats.totalWaitlist },
  ];

  // Shared style builders that use theme
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    backgroundColor: t.cardBg, borderRadius: 14, border: `1px solid ${t.cardBorder}`,
    boxShadow: t.cardShadow, ...extra,
  });
  const tableHead: React.CSSProperties = {
    padding: "10px 18px", textAlign: "left", fontSize: 11, fontWeight: 700,
    letterSpacing: ".08em", textTransform: "uppercase", color: t.tableHeadText,
    backgroundColor: t.tableHeadBg, borderBottom: `1px solid ${t.tableHeadBorder}`,
  };
  const tableCell: React.CSSProperties = {
    padding: "11px 18px", borderBottom: `1px solid ${t.tableRowBorder}`, fontSize: 13,
  };
  const ghostBtn: React.CSSProperties = { fontSize: 12, color: "#c03030", background: "none", border: "1px solid rgba(192,48,48,.2)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 };
  const dangerBtn: React.CSSProperties = { fontSize: 12, color: "#fff", background: "#c03030", border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
  const cancelBtn: React.CSSProperties = { fontSize: 12, color: t.tableBodyText, background: "none", border: `1px solid ${t.signOutBorder}`, borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ fontFamily: "'Satoshi', Arial, sans-serif", color: t.titleText, backgroundColor: t.mainBg, minHeight: "100vh" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 220, minHeight: "100vh", backgroundColor: t.sidebarBg, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 20, borderRight: `1px solid ${t.sidebarBorder}` }}>
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${t.sidebarBorder}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.svg" alt="Boardtivity" style={{ height: 28, display: "block", filter: t.logoFilter }} />
          <div style={{ fontSize: 11, color: t.sidebarSub, marginTop: 4, letterSpacing: ".08em", textTransform: "uppercase" as const }}>Admin</div>
        </div>

        <nav style={{ padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: t.navSectionText, padding: "8px 12px 6px", fontWeight: 700 }}>Navigation</div>
          {TABS.map((tb) => (
            <NavItem key={tb.id} label={tb.count !== undefined ? `${tb.label} (${tb.count})` : tb.label}
              icon={tb.icon} active={tab === tb.id} onClick={() => setTab(tb.id)} t={t} />
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: `1px solid ${t.sidebarBorder}`, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Dark/light toggle — lightbulb */}
          <button
            onClick={() => { setBulbFlicker(true); setIsDark(!isDark); }}
            onAnimationEnd={() => setBulbFlicker(false)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px",
              borderRadius: 9, border: `1px solid ${t.toggleBorder}`, background: t.toggleBg,
              color: t.toggleText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              boxShadow: !isDark ? "0 0 8px rgba(255,200,40,.25)" : undefined,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              className={bulbFlicker ? "bulb-flicker" : undefined}>
              {/* bulb globe */}
              <path d="M12 2C8.686 2 6 4.686 6 8c0 2.21 1.13 4.16 2.85 5.28V15a1 1 0 0 0 1 1h4.3a1 1 0 0 0 1-1v-1.72C16.87 12.16 18 10.21 18 8c0-3.314-2.686-6-6-6Z"
                fill={!isDark ? "rgba(255,210,60,.95)" : "currentColor"}
                stroke={!isDark ? "rgba(200,155,20,.7)" : "currentColor"}
                strokeWidth={!isDark ? "0" : "0.5"}
                opacity={!isDark ? 1 : 0.55}
              />
              {/* base bands */}
              <line x1="9.5" y1="17" x2="14.5" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={!isDark ? 0.8 : 0.5}/>
              <line x1="10" y1="19" x2="14" y2="19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={!isDark ? 0.8 : 0.5}/>
              <line x1="10.5" y1="21" x2="13.5" y2="21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity={!isDark ? 0.6 : 0.35}/>
              {/* glow rays — only when light mode (on) */}
              {!isDark && [[-5,-5],[5,-5],[0,-7],[-7,0],[7,0]].map(([dx,dy],i) => (
                <line key={i}
                  x1={12+dx*0.55} y1={8+dy*0.55}
                  x2={12+dx} y2={8+dy}
                  stroke="rgba(255,220,60,.7)" strokeWidth="1.3" strokeLinecap="round"
                />
              ))}
            </svg>
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <div style={{ fontSize: 12, color: t.emailText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {user?.emailAddresses[0]?.emailAddress}
          </div>
          <button onClick={() => { setUnlocked(false); signOut(); }}
            style={{ width: "100%", padding: "7px 0", borderRadius: 8, border: `1px solid ${t.signOutBorder}`, background: "none", color: t.signOutText, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: 220, minHeight: "100vh", backgroundColor: t.mainBg }}>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <>
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: t.titleText, marginBottom: 4 }}>Overview</div>
              <div style={{ fontSize: 14, color: t.subText, marginBottom: 28 }}>Your Boardtivity platform at a glance.</div>
            </div>
            <div style={{ padding: "0 32px 40px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "Registered users", value: stats.totalUsers, color: "#4a7ef5" },
                  { label: "Waitlist signups", value: stats.totalWaitlist, color: "#6fc46b" },
                  { label: "Feedback posts", value: stats.totalPosts, color: "#e07b54" },
                  { label: "Replies", value: stats.totalReplies, color: "#9b6fe8" },
                  { label: "Total votes", value: stats.totalUpvotes, color: "#f5a623" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={card({ padding: "20px 22px" })}>
                    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, color }}>{value}</div>
                    <div style={{ fontSize: 12, color: t.subText, marginTop: 6, fontWeight: 500 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={card({ overflow: "hidden" })}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.sectionDivider}`, fontSize: 13, fontWeight: 700, color: t.titleText }}>Recent users</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Token", "Last active", "Data size"].map(h => <th key={h} style={tableHead}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users?.slice(0, 8).map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...tableCell, fontFamily: "monospace", color: t.tableBodyText, fontSize: 12 }}>{maskToken(u.tokenIdentifier)}</td>
                        <td style={{ ...tableCell, color: t.tableBodyText }}>{fmt(u.updatedAt)}</td>
                        <td style={{ ...tableCell, color: t.tableBodyText }}>{fmtBytes(u.boardStateSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Analytics ── */}
        {tab === "analytics" && (
          <>
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: t.titleText, marginBottom: 4 }}>Analytics</div>
              <div style={{ fontSize: 14, color: t.subText, marginBottom: 28 }}>Growth, activity, and usage metrics — last 30 days.</div>
            </div>
            <div style={{ padding: "0 32px 40px" }}>
              {!analytics ? (
                <div style={{ color: t.subText, fontSize: 14 }}>Loading…</div>
              ) : (
                <>
                  {/* Stat row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
                    {[
                      { label: "Active last 7d", value: analytics.active7d, color: "#6fc46b" },
                      { label: "Active last 30d", value: analytics.active30d, color: "#4a7ef5" },
                      { label: "Total users", value: stats.totalUsers, color: "#9b6fe8" },
                      { label: "Total waitlist", value: stats.totalWaitlist, color: "#f5a623" },
                      { label: "Avg board size", value: fmtBytes(analytics.avgStorage), color: "#e07b54" },
                      { label: "Total storage", value: fmtBytes(analytics.totalStorage), color: "#4dc9d3" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={card({ padding: "18px 20px" })}>
                        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, color }}>{value}</div>
                        <div style={{ fontSize: 11, color: t.subText, marginTop: 6, fontWeight: 500 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Charts row 1: full-width user signups */}
                  <div style={card({ padding: "20px 24px", marginBottom: 16 })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: t.titleText }}>New user signups</div>
                        <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>Daily registrations over the last 30 days</div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "#4a7ef5", letterSpacing: "-.04em" }}>
                        {analytics.userSignups.reduce((a, b) => a + b, 0)}
                      </div>
                    </div>
                    <BarChart values={analytics.userSignups} color="#4a7ef5" height={80} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      {analytics.days.filter((_, i) => i % 5 === 0 || i === analytics.days.length - 1).map((d) => (
                        <span key={d} style={{ fontSize: 10, color: t.mutedText }}>{fmtDay(d)}</span>
                      ))}
                    </div>
                  </div>

                  {/* Charts row 2: activity + waitlist side by side */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={card({ padding: "20px 24px" })}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: t.titleText }}>Daily active users</div>
                          <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>Sessions recorded per day</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#6fc46b", letterSpacing: "-.04em" }}>
                          {analytics.userActivity.reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                      <BarChart values={analytics.userActivity} color="#6fc46b" height={72} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        {analytics.days.filter((_, i) => i % 7 === 0 || i === analytics.days.length - 1).map((d) => (
                          <span key={d} style={{ fontSize: 10, color: t.mutedText }}>{fmtDay(d)}</span>
                        ))}
                      </div>
                    </div>
                    <div style={card({ padding: "20px 24px" })}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: t.titleText }}>Waitlist growth</div>
                          <div style={{ fontSize: 12, color: t.subText, marginTop: 2 }}>New signups per day</div>
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#f5a623", letterSpacing: "-.04em" }}>
                          {analytics.waitlistSignups.reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                      <BarChart values={analytics.waitlistSignups} color="#f5a623" height={72} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        {analytics.days.filter((_, i) => i % 7 === 0 || i === analytics.days.length - 1).map((d) => (
                          <span key={d} style={{ fontSize: 10, color: t.mutedText }}>{fmtDay(d)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Top users by storage */}
                  <div style={card({ overflow: "hidden" })}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.sectionDivider}`, fontSize: 13, fontWeight: 700, color: t.titleText }}>Top users by data usage</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr>{["Token", "Storage", "Last active", "Member since"].map(h => <th key={h} style={tableHead}>{h}</th>)}</tr></thead>
                      <tbody>
                        {analytics.topUsers.map((u, i) => (
                          <tr key={u.tokenIdentifier}>
                            <td style={{ ...tableCell, fontFamily: "monospace", color: t.tableBodyText, fontSize: 11 }}>
                              <span style={{ marginRight: 8, color: t.mutedText, fontSize: 11 }}>#{i + 1}</span>
                              {maskToken(u.tokenIdentifier)}
                            </td>
                            <td style={{ ...tableCell }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 80, height: 5, borderRadius: 3, backgroundColor: t.sectionDivider, overflow: "hidden" }}>
                                  <div style={{ height: "100%", borderRadius: 3, backgroundColor: "#4a7ef5", width: `${(u.size / (analytics.topUsers[0]?.size || 1)) * 100}%` }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: t.titleText }}>{fmtBytes(u.size)}</span>
                              </div>
                            </td>
                            <td style={{ ...tableCell, color: t.tableBodyText, fontSize: 12 }}>{fmt(u.updatedAt)}</td>
                            <td style={{ ...tableCell, color: t.tableBodyText, fontSize: 12 }}>{fmt(u.createdAt)}</td>
                          </tr>
                        ))}
                        {analytics.topUsers.length === 0 && (
                          <tr><td colSpan={4} style={{ ...tableCell, textAlign: "center", color: t.mutedText, padding: "32px 18px" }}>No users yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <>
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: t.titleText, marginBottom: 4 }}>Users</div>
              <div style={{ fontSize: 14, color: t.subText, marginBottom: 28 }}>{stats.totalUsers} registered accounts.</div>
            </div>
            <div style={{ padding: "0 32px 40px" }}>
              <div style={card({ overflow: "hidden" })}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Token identifier", "Last active", "Data size", ""].map(h => <th key={h} style={tableHead}>{h}</th>)}</tr></thead>
                  <tbody>
                    {users?.map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...tableCell, fontFamily: "monospace", color: t.tableBodyText, fontSize: 11 }}>{maskToken(u.tokenIdentifier)}</td>
                        <td style={{ ...tableCell, color: t.tableBodyText }}>{fmt(u.updatedAt)}</td>
                        <td style={{ ...tableCell, color: t.tableBodyText }}>{fmtBytes(u.boardStateSize)}</td>
                        <td style={tableCell}>
                          {confirmDelete === u.id ? (
                            <span style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { deleteUser({ id: u.id as Id<"userBoards"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(u.id)} style={ghostBtn}>Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Feedback ── */}
        {tab === "feedback" && (
          <>
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: t.titleText, marginBottom: 4 }}>Feedback</div>
              <div style={{ fontSize: 14, color: t.subText, marginBottom: 28 }}>{stats.totalPosts} posts · {stats.totalReplies} replies · {stats.totalUpvotes} votes</div>
            </div>
            <div style={{ padding: "0 32px 40px" }}>
              {feedback?.length === 0 && (
                <div style={card({ padding: "40px", textAlign: "center", color: t.mutedText, fontSize: 14 })}>No feedback posts yet.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {feedback?.map((p) => (
                  <div key={p._id} style={card({ padding: "16px 20px" })}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: t.titleText }}>{p.authorName}</span>
                          <span style={{ fontSize: 12, color: t.mutedText }}>{fmt(p.createdAt)}</span>
                          <span style={{ fontSize: 11, backgroundColor: t.tagBg, borderRadius: 6, padding: "2px 8px", color: t.tagText, fontWeight: 600 }}>↑{p.upvotes} · {p.replyCount} replies</span>
                        </div>
                        <div style={{ fontSize: 14, color: t.tableBodyText, lineHeight: 1.6 }}>{p.content}</div>
                      </div>
                      {confirmDelete === p._id ? (
                        <span style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          <button onClick={() => { deletePost({ postId: p._id as Id<"feedbackPosts"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(p._id)} style={{ ...ghostBtn, flexShrink: 0 }}>Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Waitlist ── */}
        {tab === "waitlist" && (
          <>
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: t.titleText, marginBottom: 4 }}>Waitlist</div>
              <div style={{ fontSize: 14, color: t.subText, marginBottom: 28 }}>{stats.totalWaitlist} signups.</div>
            </div>
            <div style={{ padding: "0 32px 40px" }}>
              <div style={card({ overflow: "hidden" })}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Email", "Joined", ""].map(h => <th key={h} style={tableHead}>{h}</th>)}</tr></thead>
                  <tbody>
                    {waitlist?.length === 0 && (
                      <tr><td colSpan={3} style={{ ...tableCell, textAlign: "center", color: t.mutedText, padding: "32px 18px" }}>No signups yet.</td></tr>
                    )}
                    {waitlist?.map((w) => (
                      <tr key={w._id}>
                        <td style={{ ...tableCell, fontWeight: 500, color: t.titleText }}>{w.email}</td>
                        <td style={{ ...tableCell, color: t.tableBodyText }}>{fmt(w.joinedAt)}</td>
                        <td style={tableCell}>
                          {confirmDelete === w._id ? (
                            <span style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { deleteWaitlist({ id: w._id as Id<"waitlist"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm</button>
                              <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmDelete(w._id)} style={ghostBtn}>Delete</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
