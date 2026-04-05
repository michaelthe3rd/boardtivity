"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "@/../convex/_generated/api";
import { useState } from "react";
import { Id } from "@/../convex/_generated/dataModel";

type Tab = "overview" | "users" | "feedback" | "waitlist";

const fmt = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`;

const maskToken = (t: string) => t.slice(0, 12) + "…" + t.slice(-6);

export default function AdminClient() {
  const { user, isLoaded } = useUser();
  const { signOut, openSignIn } = useClerk();
  const [tab, setTab] = useState<Tab>("overview");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const whoami = useQuery(api.admin.whoami);
  const stats = useQuery(api.admin.getStats);
  const users = useQuery(api.admin.getUsers);
  const feedback = useQuery(api.admin.getFeedback);
  const waitlist = useQuery(api.admin.getWaitlist);

  const deletePost = useMutation(api.admin.adminDeletePost);
  const deleteWaitlist = useMutation(api.admin.adminDeleteWaitlist);
  const deleteUser = useMutation(api.admin.adminDeleteUser);

  if (!isLoaded) return <Loading />;
  if (!user) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Satoshi', Arial, sans-serif", backgroundColor: "#f5f5f3" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em", marginBottom: 28, color: "#111315" }}>Boardtivity / admin</div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 10, color: "#111315" }}>Admin access</div>
        <div style={{ fontSize: 15, color: "rgba(0,0,0,.45)", marginBottom: 28 }}>Sign in with your admin account to continue.</div>
        <button
          onClick={() => openSignIn({ afterSignInUrl: "/admin" } as Parameters<typeof openSignIn>[0])}
          style={{ padding: "12px 28px", borderRadius: 12, border: "none", backgroundColor: "#111315", color: "#f5f5f3", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "-.01em" }}
        >Sign in</button>
      </div>
    </div>
  );
  if (stats === undefined) return <Loading />;
  if (stats === null) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Satoshi', Arial, sans-serif", backgroundColor: "#f5f5f3" }}>
      <div style={{ maxWidth: 520, width: "100%", padding: "0 24px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, color: "#111315" }}>Access denied</div>
        <div style={{ fontSize: 15, color: "rgba(0,0,0,.45)", marginBottom: 28 }}>Your account isn't recognized as admin. Run this in your terminal to fix it:</div>
        {whoami && (
          <div style={{ backgroundColor: "#111315", borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.3)", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>What Convex sees for your account</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>Email: <span style={{ color: "#f5f5f2" }}>{whoami.email ?? "(not in JWT)"}</span></div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 16 }}>Token: <span style={{ color: "#f5f5f2", wordBreak: "break-all" }}>{whoami.tokenIdentifier}</span></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Run this command:</div>
            <div style={{ fontSize: 12, color: "#6fc46b", fontFamily: "monospace", wordBreak: "break-all" }}>
              npx convex env set ADMIN_TOKENS &quot;{whoami.tokenIdentifier}&quot;
            </div>
          </div>
        )}
        <button onClick={() => signOut()} style={{ fontSize: 13, color: "rgba(0,0,0,.4)", background: "none", border: "1px solid rgba(0,0,0,.15)", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
          Sign out
        </button>
      </div>
    </div>
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: `Users (${stats.totalUsers})` },
    { id: "feedback", label: `Feedback (${stats.totalPosts})` },
    { id: "waitlist", label: `Waitlist (${stats.totalWaitlist})` },
  ];

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f3", fontFamily: "'Satoshi', Arial, sans-serif", color: "#111315" }}>
      {/* Top bar */}
      <div style={{ backgroundColor: "#111315", color: "#f5f5f3", padding: "0 28px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-.02em" }}>Boardtivity</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.35)", fontWeight: 500 }}>/ admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.55)" }}>{user.emailAddresses[0]?.emailAddress}</span>
          <button
            onClick={() => signOut()}
            style={{ fontSize: 12, color: "rgba(255,255,255,.45)", background: "none", border: "1px solid rgba(255,255,255,.15)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}
          >Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, borderBottom: "1px solid rgba(0,0,0,.08)", paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ padding: "10px 18px", fontSize: 14, fontWeight: 600, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", color: tab === t.id ? "#111315" : "rgba(0,0,0,.4)", borderBottom: tab === t.id ? "2px solid #111315" : "2px solid transparent", marginBottom: -1, letterSpacing: "-.01em" }}
            >{t.label}</button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Registered users", value: stats.totalUsers, color: "#5a8df5" },
                { label: "Feedback posts", value: stats.totalPosts, color: "#e07b54" },
                { label: "Replies", value: stats.totalReplies, color: "#b57fe8" },
                { label: "Waitlist signups", value: stats.totalWaitlist, color: "#6fc46b" },
                { label: "Total votes", value: stats.totalUpvotes, color: "#f5a623" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ backgroundColor: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(0,0,0,.07)", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.03em", color }}>{value}</div>
                  <div style={{ fontSize: 13, color: "rgba(0,0,0,.45)", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: "#fff", borderRadius: 14, padding: "20px 22px", border: "1px solid rgba(0,0,0,.07)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(0,0,0,.35)", marginBottom: 14 }}>Recent users</div>
              {users?.slice(0, 8).map((u) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: "rgba(0,0,0,.6)" }}>{maskToken(u.tokenIdentifier)}</span>
                  <span style={{ fontSize: 12, color: "rgba(0,0,0,.35)" }}>{fmt(u.updatedAt)} · {fmtBytes(u.boardStateSize)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {tab === "users" && (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,.07)" }}>
                  {["Token identifier", "Last active", "Data size", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(0,0,0,.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                    <td style={{ padding: "12px 18px", fontFamily: "monospace", color: "rgba(0,0,0,.65)", fontSize: 12 }}>{maskToken(u.tokenIdentifier)}</td>
                    <td style={{ padding: "12px 18px", color: "rgba(0,0,0,.5)" }}>{fmt(u.updatedAt)}</td>
                    <td style={{ padding: "12px 18px", color: "rgba(0,0,0,.5)" }}>{fmtBytes(u.boardStateSize)}</td>
                    <td style={{ padding: "12px 18px" }}>
                      {confirmDelete === u.id ? (
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => { deleteUser({ id: u.id as Id<"userBoards"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm delete</button>
                          <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(u.id)} style={ghostDangerBtn}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Feedback */}
        {tab === "feedback" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feedback?.map((p) => (
              <div key={p._id} style={{ backgroundColor: "#fff", borderRadius: 14, padding: "18px 20px", border: "1px solid rgba(0,0,0,.07)", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{p.authorName}</span>
                      <span style={{ fontSize: 12, color: "rgba(0,0,0,.35)" }}>{fmt(p.createdAt)}</span>
                      <span style={{ fontSize: 11, backgroundColor: "#f0f0ee", borderRadius: 6, padding: "2px 7px", color: "rgba(0,0,0,.45)" }}>↑{p.upvotes} ↓{p.downvotes} · {p.replyCount} replies</span>
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "#333" }}>{p.content}</div>
                  </div>
                  <div>
                    {confirmDelete === p._id ? (
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button onClick={() => { deletePost({ postId: p._id as Id<"feedbackPosts"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm</button>
                        <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(p._id)} style={ghostDangerBtn}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {feedback?.length === 0 && <Empty label="No feedback posts yet." />}
          </div>
        )}

        {/* Waitlist */}
        {tab === "waitlist" && (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f8f6", borderBottom: "1px solid rgba(0,0,0,.07)" }}>
                  {["Email", "Joined", ""].map((h) => (
                    <th key={h} style={{ padding: "12px 18px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(0,0,0,.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waitlist?.map((w) => (
                  <tr key={w._id} style={{ borderBottom: "1px solid rgba(0,0,0,.05)" }}>
                    <td style={{ padding: "12px 18px", fontWeight: 500 }}>{w.email}</td>
                    <td style={{ padding: "12px 18px", color: "rgba(0,0,0,.45)" }}>{fmt(w.joinedAt)}</td>
                    <td style={{ padding: "12px 18px" }}>
                      {confirmDelete === w._id ? (
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => { deleteWaitlist({ id: w._id as Id<"waitlist"> }); setConfirmDelete(null); }} style={dangerBtn}>Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} style={cancelBtn}>Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDelete(w._id)} style={ghostDangerBtn}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
                {waitlist?.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: "28px 18px", textAlign: "center", color: "rgba(0,0,0,.35)", fontSize: 13 }}>No waitlist signups yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Satoshi', Arial, sans-serif", color: "rgba(0,0,0,.35)", fontSize: 14 }}>
      Loading…
    </div>
  );
}

function Gate({ message }: { message: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "'Satoshi', Arial, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 10 }}>Access denied</div>
        <div style={{ fontSize: 15, color: "rgba(0,0,0,.45)" }}>{message}</div>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(0,0,0,.35)", fontSize: 14 }}>{label}</div>;
}

const ghostDangerBtn: React.CSSProperties = { fontSize: 12, color: "#c03030", background: "none", border: "1px solid rgba(192,48,48,.2)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 };
const dangerBtn: React.CSSProperties = { fontSize: 12, color: "#fff", background: "#c03030", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 };
const cancelBtn: React.CSSProperties = { fontSize: 12, color: "rgba(0,0,0,.5)", background: "none", border: "1px solid rgba(0,0,0,.15)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" };
