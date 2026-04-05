"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "@/../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "@/../convex/_generated/dataModel";

type Tab = "overview" | "users" | "feedback" | "waitlist";

const fmt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`;

const maskToken = (t: string) => t.slice(0, 12) + "…" + t.slice(-6);

const S: Record<string, React.CSSProperties> = {
  sidebar: { width: 220, minHeight: "100vh", backgroundColor: "#111315", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 20 },
  sidebarTop: { padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,.07)" },
  sidebarLogo: { fontSize: 14, fontWeight: 800, letterSpacing: "-.02em", color: "#f5f5f2" },
  sidebarSub: { fontSize: 11, color: "rgba(255,255,255,.28)", marginTop: 2, letterSpacing: ".08em", textTransform: "uppercase" as const },
  sidebarNav: { padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  sidebarBottom: { padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.07)" },
  main: { marginLeft: 220, minHeight: "100vh", backgroundColor: "#f5f5f3" },
  header: { padding: "28px 32px 0" },
  pageTitle: { fontSize: 22, fontWeight: 800, letterSpacing: "-.03em", color: "#111315", marginBottom: 4 },
  pageSub: { fontSize: 14, color: "rgba(17,19,21,.45)", marginBottom: 28 },
  content: { padding: "0 32px 40px" },
  card: { backgroundColor: "#ffffff", borderRadius: 14, border: "1px solid rgba(17,19,21,.08)", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  statVal: { fontSize: 32, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1 },
  statLabel: { fontSize: 12, color: "rgba(17,19,21,.45)", marginTop: 6, fontWeight: 500 },
  tableHead: { padding: "10px 18px", textAlign: "left" as const, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "rgba(17,19,21,.4)", backgroundColor: "#f8f8f6", borderBottom: "1px solid rgba(17,19,21,.07)" },
  tableCell: { padding: "11px 18px", borderBottom: "1px solid rgba(17,19,21,.05)", fontSize: 13 },
};

function NavItem({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, border: "none", background: active ? "rgba(255,255,255,.08)" : "transparent", color: active ? "#f5f5f2" : "rgba(255,255,255,.4)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left", transition: "background .15s, color .15s" }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
      {active && <span style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", backgroundColor: "#6fc46b" }} />}
    </button>
  );
}

// ─── Admin Gate ──────────────────────────────────────────────────────────────
function AdminGate({ onUnlock }: { onUnlock: () => void }) {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn, signOut } = useClerk();
  const stats = useQuery(api.admin.getStats);
  const whoami = useQuery(api.admin.whoami);

  // If already signed in, check admin status automatically
  useEffect(() => {
    if (stats) onUnlock();
  }, [stats]);

  function handleSignIn() {
    if (isSignedIn) {
      // Already signed in but not admin — sign out first so they can re-auth
      signOut();
    } else {
      openSignIn({ afterSignInUrl: "/admin" } as Parameters<typeof openSignIn>[0]);
    }
  }

  const showNotAdmin = isLoaded && isSignedIn && stats === null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#111315", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Satoshi', Arial, sans-serif" }}>
      <div style={{ width: "min(400px, calc(100vw - 40px))" }}>
        {/* Logo */}
        <div style={{ marginBottom: 40, textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-full.png" alt="Boardtivity" style={{ height: 120, marginBottom: 32, filter: "brightness(0) invert(1)" }} />
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", color: "#f5f5f2", marginBottom: 8 }}>
            Admin Access
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,.35)", lineHeight: 1.6 }}>
            {showNotAdmin
              ? "This account doesn't have admin access."
              : "Sign in with your admin account to continue."}
          </div>
        </div>

        {/* Card */}
        <div style={{ backgroundColor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: "28px 24px" }}>
          {showNotAdmin && whoami && (
            <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 10, backgroundColor: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.28)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>Signed in as</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", fontFamily: "monospace", wordBreak: "break-all" }}>{whoami.email ?? whoami.tokenIdentifier}</div>
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={!isLoaded || (isSignedIn && stats === undefined)}
            style={{ width: "100%", padding: "13px 0", borderRadius: 11, border: "none", backgroundColor: "#f5f5f2", color: "#111315", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em", opacity: (!isLoaded || (isSignedIn && stats === undefined)) ? .5 : 1, transition: "opacity .15s" }}
          >
            {!isLoaded ? "Loading…" : isSignedIn && stats === undefined ? "Verifying…" : showNotAdmin ? "Sign in with a different account" : "Sign in to admin"}
          </button>
        </div>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.18)" }}>
          Admin access is restricted. Unauthorized attempts are logged.
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminClient() {
  useEffect(() => { document.documentElement.style.visibility = ""; }, []);

  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { user } = useUser();

  const stats = useQuery(api.admin.getStats);
  const users = useQuery(api.admin.getUsers);
  const feedback = useQuery(api.admin.getFeedback);
  const waitlist = useQuery(api.admin.getWaitlist);
  const whoami = useQuery(api.admin.whoami);

  const deletePost = useMutation(api.admin.adminDeletePost);
  const deleteWaitlist = useMutation(api.admin.adminDeleteWaitlist);
  const deleteUser = useMutation(api.admin.adminDeleteUser);

  const { signOut } = useClerk();

  // Show gate if not unlocked or not admin
  if (!unlocked || !stats) {
    return <AdminGate onUnlock={() => setUnlocked(true)} />;
  }

  const TABS = [
    { id: "overview" as Tab, label: "Overview", icon: "◈" },
    { id: "users" as Tab, label: "Users", icon: "◉", count: stats.totalUsers },
    { id: "feedback" as Tab, label: "Feedback", icon: "◎", count: stats.totalPosts },
    { id: "waitlist" as Tab, label: "Waitlist", icon: "◌", count: stats.totalWaitlist },
  ];

  return (
    <div style={{ fontFamily: "'Satoshi', Arial, sans-serif", color: "#111315" }}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal.svg" alt="Boardtivity" style={{ height: 28, display: "block", filter: "brightness(0) invert(1)" }} />
          <div style={S.sidebarSub}>Admin</div>
        </div>

        <nav style={S.sidebarNav}>
          <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.2)", padding: "8px 12px 6px", fontWeight: 700 }}>Navigation</div>
          {TABS.map((t) => (
            <NavItem
              key={t.id}
              label={t.count !== undefined ? `${t.label} (${t.count})` : t.label}
              icon={t.icon}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            />
          ))}
        </nav>

        <div style={S.sidebarBottom}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {user?.emailAddresses[0]?.emailAddress}
          </div>
          <button
            onClick={() => { setUnlocked(false); signOut(); }}
            style={{ width: "100%", padding: "7px 0", borderRadius: 8, border: "1px solid rgba(255,255,255,.12)", background: "none", color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "color .15s, border-color .15s" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={S.main}>
        {/* ── Overview ── */}
        {tab === "overview" && (
          <>
            <div style={S.header}>
              <div style={S.pageTitle}>Overview</div>
              <div style={S.pageSub}>Your Boardtivity platform at a glance.</div>
            </div>
            <div style={S.content}>
              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
                {[
                  { label: "Registered users", value: stats.totalUsers, color: "#4a7ef5" },
                  { label: "Waitlist signups", value: stats.totalWaitlist, color: "#6fc46b" },
                  { label: "Feedback posts", value: stats.totalPosts, color: "#e07b54" },
                  { label: "Replies", value: stats.totalReplies, color: "#9b6fe8" },
                  { label: "Total votes", value: stats.totalUpvotes, color: "#f5a623" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ ...S.card, padding: "20px 22px" }}>
                    <div style={{ ...S.statVal, color }}>{value}</div>
                    <div style={S.statLabel}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Recent users */}
              <div style={{ ...S.card, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(17,19,21,.07)", fontSize: 13, fontWeight: 700, color: "#111315" }}>Recent users</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Token", "Last active", "Data size"].map(h => <th key={h} style={S.tableHead}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {users?.slice(0, 8).map((u) => (
                      <tr key={u.id}>
                        <td style={{ ...S.tableCell, fontFamily: "monospace", color: "rgba(17,19,21,.55)", fontSize: 12 }}>{maskToken(u.tokenIdentifier)}</td>
                        <td style={{ ...S.tableCell, color: "rgba(17,19,21,.5)" }}>{fmt(u.updatedAt)}</td>
                        <td style={{ ...S.tableCell, color: "rgba(17,19,21,.5)" }}>{fmtBytes(u.boardStateSize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Users ── */}
        {tab === "users" && (
          <>
            <div style={S.header}>
              <div style={S.pageTitle}>Users</div>
              <div style={S.pageSub}>{stats.totalUsers} registered accounts.</div>
            </div>
            <div style={S.content}>
              <div style={{ ...S.card, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Token identifier", "Last active", "Data size", ""].map(h => <th key={h} style={S.tableHead}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {users?.map((u) => (
                      <tr key={u.id} style={{ transition: "background .1s" }}>
                        <td style={{ ...S.tableCell, fontFamily: "monospace", color: "rgba(17,19,21,.55)", fontSize: 12 }}>{maskToken(u.tokenIdentifier)}</td>
                        <td style={{ ...S.tableCell, color: "rgba(17,19,21,.5)" }}>{fmt(u.updatedAt)}</td>
                        <td style={{ ...S.tableCell, color: "rgba(17,19,21,.5)" }}>{fmtBytes(u.boardStateSize)}</td>
                        <td style={S.tableCell}>
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
            <div style={S.header}>
              <div style={S.pageTitle}>Feedback</div>
              <div style={S.pageSub}>{stats.totalPosts} posts · {stats.totalReplies} replies · {stats.totalUpvotes} votes</div>
            </div>
            <div style={S.content}>
              {feedback?.length === 0 && (
                <div style={{ ...S.card, padding: "40px", textAlign: "center", color: "rgba(17,19,21,.35)", fontSize: 14 }}>No feedback posts yet.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {feedback?.map((p) => (
                  <div key={p._id} style={{ ...S.card, padding: "16px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{p.authorName}</span>
                          <span style={{ fontSize: 12, color: "rgba(17,19,21,.35)" }}>{fmt(p.createdAt)}</span>
                          <span style={{ fontSize: 11, backgroundColor: "#f3f1eb", borderRadius: 6, padding: "2px 8px", color: "rgba(17,19,21,.5)", fontWeight: 600 }}>↑{p.upvotes} · {p.replyCount} replies</span>
                        </div>
                        <div style={{ fontSize: 14, color: "#333", lineHeight: 1.6 }}>{p.content}</div>
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
            <div style={S.header}>
              <div style={S.pageTitle}>Waitlist</div>
              <div style={S.pageSub}>{stats.totalWaitlist} signups.</div>
            </div>
            <div style={S.content}>
              <div style={{ ...S.card, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Email", "Joined", ""].map(h => <th key={h} style={S.tableHead}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {waitlist?.length === 0 && (
                      <tr><td colSpan={3} style={{ ...S.tableCell, textAlign: "center", color: "rgba(17,19,21,.35)", padding: "32px 18px" }}>No signups yet.</td></tr>
                    )}
                    {waitlist?.map((w) => (
                      <tr key={w._id}>
                        <td style={{ ...S.tableCell, fontWeight: 500 }}>{w.email}</td>
                        <td style={{ ...S.tableCell, color: "rgba(17,19,21,.5)" }}>{fmt(w.joinedAt)}</td>
                        <td style={S.tableCell}>
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

const ghostBtn: React.CSSProperties = { fontSize: 12, color: "#c03030", background: "none", border: "1px solid rgba(192,48,48,.2)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 };
const dangerBtn: React.CSSProperties = { fontSize: 12, color: "#fff", background: "#c03030", border: "none", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const cancelBtn: React.CSSProperties = { fontSize: 12, color: "rgba(17,19,21,.5)", background: "none", border: "1px solid rgba(17,19,21,.15)", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontFamily: "inherit" };
