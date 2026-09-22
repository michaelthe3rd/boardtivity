"use client";

import { useState } from "react";
import type { Ref } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ThemeMode } from "@/lib/board";
import { border, buttonStyle, muted, pageText } from "@/lib/ui";

// Community feature requests: post, vote, reply. Owns its own Convex queries and form state.
export default function FeedbackBoard({ theme, isMobile, isSignedIn, onSignIn, sectionRef }: {
  theme: ThemeMode;
  isMobile: boolean;
  isSignedIn: boolean | undefined;
  onSignIn: () => void;
  sectionRef?: Ref<HTMLElement>;
}) {
  const feedbackPosts = useQuery(api.feedback.list);
  const postFeedback = useMutation(api.feedback.post);
  const voteFeedback = useMutation(api.feedback.vote);
  const deleteFeedback = useMutation(api.feedback.remove);
  const replyFeedback = useMutation(api.feedback.reply);
  const deleteReplyFeedback = useMutation(api.feedback.removeReply);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackPosting, setFeedbackPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyPosting, setReplyPosting] = useState(false);

  return (
      <section ref={sectionRef} id="feedback" style={{ maxWidth: 720, margin: "0 auto", padding: isMobile ? "60px 20px 80px" : "100px 32px 120px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: muted(theme), fontWeight: 700, marginBottom: 10, opacity: .5 }}>Community</div>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,3vw,38px)", fontWeight: 900, letterSpacing: "-.04em", color: pageText(theme), lineHeight: 1.1 }}>Feature Requests & Feedback</h2>
          <p style={{ margin: 0, fontSize: 15, color: muted(theme), opacity: .6, lineHeight: 1.7 }}>Share what you'd like to see. Upvote ideas you care about.</p>
        </div>

        {/* Post form */}
        {isSignedIn ? (
          <div style={{ marginBottom: 28, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, padding: "18px 20px" }}>
            <textarea
              placeholder="Share feedback, request a feature, or report a bug…"
              value={feedbackContent}
              onChange={e => { setFeedbackContent(e.target.value); setFeedbackError(null); }}
              maxLength={500}
              rows={3}
              style={{ width: "100%", background: "none", border: "none", outline: "none", resize: "none", fontSize: 14, color: pageText(theme), fontFamily: "inherit", lineHeight: 1.65, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 12, borderTop: `1px solid ${border(theme)}`, paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: feedbackError ? "#c03030" : muted(theme), opacity: feedbackError ? 1 : .4 }}>
                {feedbackError ?? `${feedbackContent.length}/500`}
              </div>
              <button
                disabled={feedbackPosting || !feedbackContent.trim()}
                onClick={async () => {
                  setFeedbackPosting(true);
                  setFeedbackError(null);
                  try {
                    await postFeedback({ content: feedbackContent });
                    setFeedbackContent("");
                  } catch (e: any) {
                    const msg = e?.message ?? "";
                    const rlMatch = msg.match(/rate_limit:(\d+)/);
                    if (rlMatch) {
                      setFeedbackError(`You already posted today. Try again in ${rlMatch[1]}h.`);
                    } else {
                      setFeedbackError("Something went wrong, try again.");
                    }
                  }
                  setFeedbackPosting(false);
                }}
                style={{ height: 34, padding: "0 16px", borderRadius: 8, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 13, fontWeight: 700, cursor: feedbackPosting || !feedbackContent.trim() ? "not-allowed" : "pointer", opacity: feedbackPosting || !feedbackContent.trim() ? .4 : 1, fontFamily: "inherit" }}
              >
                {feedbackPosting ? "Posting…" : "Post"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 28, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 14, color: muted(theme), opacity: .65 }}>Sign in to post or vote.</span>
            <button onClick={() => onSignIn()} style={{ ...buttonStyle(theme, true), fontSize: 13, height: 34 }}>Sign in</button>
          </div>
        )}

        {/* Posts list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {feedbackPosts === undefined ? (
            <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: muted(theme), opacity: .4 }}>Loading…</div>
          ) : feedbackPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: muted(theme), opacity: .4 }}>No posts yet — be the first!</div>
          ) : feedbackPosts.map((p) => {
            const score = p.upvotes - p.downvotes;
            const isReplying = replyingTo === p._id;
            return (
              <div key={p._id} style={{ borderRadius: 12, overflow: "hidden" }}>
                {/* Post row */}
                <div style={{ display: "flex", gap: 0, backgroundColor: theme === "dark" ? "#17191d" : "#ffffff", border: `1px solid ${border(theme)}`, borderRadius: isReplying || (p.replies && p.replies.length > 0) ? "12px 12px 0 0" : 12, padding: "14px 16px", alignItems: "flex-start" }}>
                  {/* Vote column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0, marginRight: 12, paddingTop: 1 }}>
                    <button
                      onClick={async () => { if (isSignedIn) await voteFeedback({ postId: p._id, direction: "up" }); else onSignIn(); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "none", backgroundColor: p.userVote === "up" ? (theme === "dark" ? "rgba(111,196,107,.18)" : "rgba(60,180,90,.12)") : "transparent", cursor: "pointer", transition: "all .1s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1.5L10.5 8H1.5L6 1.5Z" fill={p.userVote === "up" ? "#6fc46b" : muted(theme)} opacity={p.userVote === "up" ? 1 : 0.45}/></svg>
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 700, color: score > 0 ? "#6fc46b" : score < 0 ? "#c03030" : muted(theme), lineHeight: 1, minWidth: 16, textAlign: "center" }}>{score}</span>
                    <button
                      onClick={async () => { if (isSignedIn) await voteFeedback({ postId: p._id, direction: "down" }); else onSignIn(); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 6, border: "none", backgroundColor: p.userVote === "down" ? (theme === "dark" ? "rgba(200,60,60,.18)" : "rgba(180,40,40,.1)") : "transparent", cursor: "pointer", transition: "all .1s" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10.5L1.5 4H10.5L6 10.5Z" fill={p.userVote === "down" ? "#c03030" : muted(theme)} opacity={p.userVote === "down" ? 1 : 0.45}/></svg>
                    </button>
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: muted(theme), opacity: .5, marginBottom: 6 }}>
                      {p.authorName} · {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: 15, color: pageText(theme), lineHeight: 1.7, marginBottom: 10, wordBreak: "break-word" }}>{p.content}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        onClick={() => { setReplyingTo(isReplying ? null : p._id); setReplyContent(""); setReplyError(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: muted(theme), opacity: .55, padding: 0, fontFamily: "inherit" }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={e => (e.currentTarget.style.opacity = "0.55")}
                      >
                        {isReplying ? "Cancel" : `Reply${p.replies && p.replies.length > 0 ? ` (${p.replies.length})` : ""}`}
                      </button>
                      {p.isOwner && (
                        <button
                          onClick={async () => { await deleteFeedback({ postId: p._id }); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#c03030", opacity: .5, padding: 0, fontFamily: "inherit" }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {(p.replies && p.replies.length > 0) && (
                  <div style={{ backgroundColor: theme === "dark" ? "#13151a" : "#f8f8f9", border: `1px solid ${border(theme)}`, borderTop: "none", borderRadius: isReplying ? "0" : "0 0 12px 12px" }}>
                    {p.replies.map((r, i) => (
                      <div key={r._id} style={{ display: "flex", gap: 10, padding: "12px 16px 12px 52px", borderTop: i > 0 ? `1px solid ${border(theme)}` : "none" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: muted(theme), opacity: .45, marginBottom: 4 }}>
                            {r.authorName} · {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </div>
                          <div style={{ fontSize: 14, color: pageText(theme), lineHeight: 1.65, wordBreak: "break-word", opacity: .85 }}>{r.content}</div>
                        </div>
                        {r.isOwner && (
                          <button
                            onClick={async () => { await deleteReplyFeedback({ replyId: r._id }); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#c03030", opacity: .4, padding: 0, fontFamily: "inherit", flexShrink: 0, alignSelf: "flex-start", marginTop: 2 }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0.4")}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply form */}
                {isReplying && (
                  <div style={{ backgroundColor: theme === "dark" ? "#13151a" : "#f8f8f9", border: `1px solid ${border(theme)}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: "12px 16px 12px 52px" }}>
                    <textarea
                      autoFocus
                      placeholder="Write a reply…"
                      value={replyContent}
                      onChange={e => { setReplyContent(e.target.value); setReplyError(null); }}
                      maxLength={300}
                      rows={2}
                      style={{ width: "100%", background: theme === "dark" ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${border(theme)}`, borderRadius: 8, outline: "none", resize: "none", fontSize: 13, color: pageText(theme), fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", padding: "8px 12px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 8 }}>
                      <div style={{ fontSize: 11, color: replyError ? "#c03030" : muted(theme), opacity: replyError ? 1 : .4 }}>
                        {replyError ?? `${replyContent.length}/300`}
                      </div>
                      <button
                        disabled={replyPosting || !replyContent.trim()}
                        onClick={async () => {
                          setReplyPosting(true);
                          setReplyError(null);
                          try {
                            await replyFeedback({ postId: p._id, content: replyContent });
                            setReplyContent("");
                            setReplyingTo(null);
                          } catch (e: any) {
                            const msg = e?.message ?? "";
                            if (msg.includes("reply_rate_limit")) {
                              setReplyError("You've replied 5 times today. Try again tomorrow.");
                            } else {
                              setReplyError("Something went wrong, try again.");
                            }
                          }
                          setReplyPosting(false);
                        }}
                        style={{ height: 30, padding: "0 14px", borderRadius: 7, border: "none", backgroundColor: theme === "dark" ? "#f7f8fb" : "#111315", color: theme === "dark" ? "#111315" : "#f7f8fb", fontSize: 12, fontWeight: 700, cursor: replyPosting || !replyContent.trim() ? "not-allowed" : "pointer", opacity: replyPosting || !replyContent.trim() ? .4 : 1, fontFamily: "inherit" }}
                      >
                        {replyPosting ? "…" : "Reply"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
  );
}
