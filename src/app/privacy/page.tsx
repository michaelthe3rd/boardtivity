import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Boardtivity",
  description: "How Boardtivity collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 100px", fontFamily: "'Satoshi', Arial, sans-serif", color: "#1a1a18", lineHeight: 1.8 }}>
      <div style={{ marginBottom: 48 }}>
        <a href="/" style={{ fontSize: 13, color: "rgba(17,19,21,.45)", textDecoration: "none", fontWeight: 600 }}>← Back to Boardtivity</a>
      </div>

      <h1 style={h1}>Privacy Policy</h1>
      <p style={meta}>Last updated: April 5, 2026</p>

      <p>Boardtivity is built by a solo founder who genuinely cares about your privacy. This policy explains what data we collect, why we collect it, and what we do with it. No legalese. If you have questions, email <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>.</p>

      <h2 style={h2}>Who We Are</h2>
      <p>Boardtivity ("we", "us", "our") is operated as a sole proprietorship under the name Boardtivity, available at boardtivity.com.</p>

      <h2 style={h2}>What We Collect</h2>

      <h3 style={h3}>Account information</h3>
      <p>When you sign up, we collect your email address and basic profile info. Authentication is handled by Clerk — we never see or store your password. If you sign in with Google, Clerk receives your Google profile on our behalf.</p>

      <h3 style={h3}>Board content</h3>
      <p>Everything you create in Boardtivity — boards, task cards, idea cards, thought cards — is stored in our database so we can show it back to you. We don't read your content, sell it, or use it to train AI models.</p>

      <h3 style={h3}>Waitlist emails</h3>
      <p>If you sign up for the waitlist, we store your email to notify you about updates and to link your spot to an account if you sign up later.</p>

      <h3 style={h3}>Session analytics</h3>
      <p>We track anonymous session data to understand how people use the app. This includes a randomly generated session ID stored in your browser's sessionStorage (not a cookie — it clears when you close the tab), and heartbeat events sent every 30 seconds to estimate time on site. This data is anonymous and used only in aggregate to improve the product.</p>

      <h3 style={h3}>Log data</h3>
      <p>Our hosting provider (Vercel) and backend (Convex) log standard server-side data like IP addresses and request timestamps. This is standard infrastructure logging, not used to profile individual users.</p>

      <h2 style={h2}>How We Use Your Data</h2>
      <ul style={ul}>
        <li>To create and maintain your account</li>
        <li>To store and display your boards and cards</li>
        <li>To notify you about your waitlist status or product updates (you can opt out anytime)</li>
        <li>To understand how the app is being used so we can improve it</li>
        <li>To process payments in the future via Stripe (not yet active)</li>
      </ul>
      <p>We do <strong>not</strong> sell your data to third parties. We do not use your data for advertising.</p>

      <h2 style={h2}>Third-Party Services</h2>
      <ul style={ul}>
        <li><strong>Clerk</strong> — authentication. <a href="https://clerk.com/privacy" style={a}>clerk.com/privacy</a></li>
        <li><strong>Convex</strong> — database and backend. <a href="https://www.convex.dev/privacy" style={a}>convex.dev/privacy</a></li>
        <li><strong>Vercel</strong> — hosting. <a href="https://vercel.com/legal/privacy-policy" style={a}>vercel.com/legal/privacy-policy</a></li>
        <li><strong>Stripe</strong> (coming soon) — payment processing. <a href="https://stripe.com/privacy" style={a}>stripe.com/privacy</a></li>
      </ul>

      <h2 style={h2}>Cookies and Local Storage</h2>
      <p>We use sessionStorage (not cookies) for anonymous session IDs — these clear automatically when you close the tab. We store theme preferences in localStorage. Clerk may use minimal functional cookies to keep you signed in. We do not use advertising cookies or tracking pixels.</p>

      <h2 style={h2}>Your Rights</h2>
      <p>You can delete your account, request a copy of your data, or ask us to remove it by emailing <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>.</p>
      <p><strong>GDPR (EU/UK):</strong> You have the right to access, correct, port, restrict, or erase your data, and to lodge a complaint with your local data protection authority. Our legal basis for processing is contract performance, legitimate interests, and consent for marketing.</p>
      <p><strong>CCPA (California):</strong> You have the right to know what we collect, request deletion, and opt out of sale. We do not sell personal information.</p>

      <h2 style={h2}>Data Retention</h2>
      <p>We keep your account data as long as your account is active. Anonymous session data is automatically cleaned up after 90 days. Waitlist emails are kept until you ask us to remove them.</p>

      <h2 style={h2}>Security</h2>
      <p>We use Convex for our backend, Clerk for auth, and Vercel for hosting — all reputable providers with strong security practices. No system is 100% secure. If you discover a security issue, please email <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>.</p>

      <h2 style={h2}>Children</h2>
      <p>Boardtivity is not directed at children under 13. We don't knowingly collect data from anyone under 13.</p>

      <h2 style={h2}>Changes to This Policy</h2>
      <p>If we make meaningful changes, we'll update the date at the top and notify you by email for significant changes. We won't quietly change what we do with your data.</p>

      <h2 style={h2}>Contact</h2>
      <p>Email <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a> — we actually read and respond to these.</p>

      <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid rgba(17,19,21,.08)", fontSize: 13, color: "rgba(17,19,21,.35)" }}>
        <a href="/terms" style={{ color: "rgba(17,19,21,.45)", marginRight: 20, textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
        <a href="/" style={{ color: "rgba(17,19,21,.45)", textDecoration: "none", fontWeight: 600 }}>Back to Boardtivity</a>
      </div>
    </div>
  );
}

const h1: React.CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, marginTop: 0 };
const h2: React.CSSProperties = { fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", marginTop: 44, marginBottom: 10 };
const h3: React.CSSProperties = { fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 6 };
const meta: React.CSSProperties = { fontSize: 14, color: "rgba(17,19,21,.4)", marginBottom: 40, marginTop: 0 };
const a: React.CSSProperties = { color: "#111315", fontWeight: 600 };
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 16 };
