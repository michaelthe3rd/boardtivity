import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Boardtivity",
  description: "How Boardtivity collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="April 5, 2026">
      {(t) => (
        <>
          <p>Boardtivity is built by a solo founder who genuinely cares about your privacy. This policy explains what data we collect, why we collect it, and what we do with it. No legalese. If you have questions, email <a href="mailto:contact@boardtivity.com" style={{ color: t.link, fontWeight: 600 }}>contact@boardtivity.com</a>.</p>

          <h2 style={h2(t.h2)}>Who We Are</h2>
          <p>Boardtivity ("we", "us", "our") is operated as a sole proprietorship under the name Boardtivity, available at boardtivity.com.</p>

          <h2 style={h2(t.h2)}>What We Collect</h2>

          <h3 style={h3(t.h3)}>Account information</h3>
          <p>When you sign up, we collect your email address and basic profile info. Authentication is handled by Clerk — we never see or store your password. If you sign in with Google, Clerk receives your Google profile on our behalf.</p>

          <h3 style={h3(t.h3)}>Board content</h3>
          <p>Everything you create in Boardtivity — boards, task cards, idea cards, thought cards — is stored in our database so we can show it back to you. We don't read your content, sell it, or use it to train AI models.</p>

          <h3 style={h3(t.h3)}>Session analytics</h3>
          <p>We track anonymous session data to understand how people use the app. This includes a randomly generated session ID stored in your browser's sessionStorage (not a cookie — it clears when you close the tab), and heartbeat events sent every 30 seconds to estimate time on site. This data is anonymous and used only in aggregate to improve the product.</p>

          <h3 style={h3(t.h3)}>Log data</h3>
          <p>Our hosting provider (Vercel) and backend (Convex) log standard server-side data like IP addresses and request timestamps. This is standard infrastructure logging, not used to profile individual users.</p>

          <h2 style={h2(t.h2)}>How We Use Your Data</h2>
          <ul style={ul}>
            <li>To create and maintain your account</li>
            <li>To store and display your boards and cards</li>
            <li>To send daily/weekly task digests (you can opt out in settings)</li>
            <li>To understand how the app is being used so we can improve it</li>
            <li>To process payments via Stripe</li>
          </ul>
          <p>We do <strong>not</strong> sell your data to third parties. We do not use your data for advertising.</p>

          <h2 style={h2(t.h2)}>Third-Party Services</h2>
          <ul style={ul}>
            <li><strong>Clerk</strong> — authentication. <a href="https://clerk.com/privacy" style={{ color: t.link, fontWeight: 600 }}>clerk.com/privacy</a></li>
            <li><strong>Convex</strong> — database and backend. <a href="https://www.convex.dev/privacy" style={{ color: t.link, fontWeight: 600 }}>convex.dev/privacy</a></li>
            <li><strong>Vercel</strong> — hosting. <a href="https://vercel.com/legal/privacy-policy" style={{ color: t.link, fontWeight: 600 }}>vercel.com/legal/privacy-policy</a></li>
            <li><strong>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" style={{ color: t.link, fontWeight: 600 }}>stripe.com/privacy</a></li>
            <li><strong>Resend</strong> — email delivery. <a href="https://resend.com/legal/privacy-policy" style={{ color: t.link, fontWeight: 600 }}>resend.com/legal/privacy-policy</a></li>
          </ul>

          <h2 style={h2(t.h2)}>Cookies and Local Storage</h2>
          <p>We use sessionStorage (not cookies) for anonymous session IDs — these clear automatically when you close the tab. We store theme preferences and board data in localStorage. Clerk may use minimal functional cookies to keep you signed in. We do not use advertising cookies or tracking pixels.</p>

          <h2 style={h2(t.h2)}>Your Rights</h2>
          <p>You can delete your account, request a copy of your data, or ask us to remove it by emailing <a href="mailto:contact@boardtivity.com" style={{ color: t.link, fontWeight: 600 }}>contact@boardtivity.com</a>.</p>
          <p><strong>GDPR (EU/UK):</strong> You have the right to access, correct, port, restrict, or erase your data, and to lodge a complaint with your local data protection authority. Our legal basis for processing is contract performance, legitimate interests, and consent for marketing.</p>
          <p><strong>CCPA (California):</strong> You have the right to know what we collect, request deletion, and opt out of sale. We do not sell personal information.</p>

          <h2 style={h2(t.h2)}>Data Retention</h2>
          <p>We keep your account data as long as your account is active. Anonymous session data is automatically cleaned up after 90 days. You can request deletion at any time.</p>

          <h2 style={h2(t.h2)}>Security</h2>
          <p>We use Convex for our backend, Clerk for auth, and Vercel for hosting — all reputable providers with strong security practices. No system is 100% secure. If you discover a security issue, please email <a href="mailto:contact@boardtivity.com" style={{ color: t.link, fontWeight: 600 }}>contact@boardtivity.com</a>.</p>

          <h2 style={h2(t.h2)}>Children</h2>
          <p>Boardtivity is not directed at children under 13. We don't knowingly collect data from anyone under 13.</p>

          <h2 style={h2(t.h2)}>Changes to This Policy</h2>
          <p>If we make meaningful changes, we'll update the date at the top and notify you by email for significant changes.</p>

          <h2 style={h2(t.h2)}>Contact</h2>
          <p>Email <a href="mailto:contact@boardtivity.com" style={{ color: t.link, fontWeight: 600 }}>contact@boardtivity.com</a> — we actually read and respond to these.</p>
        </>
      )}
    </LegalPage>
  );
}

const h2 = (color: string): React.CSSProperties => ({ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", marginTop: 44, marginBottom: 10, color });
const h3 = (color: string): React.CSSProperties => ({ fontSize: 15, fontWeight: 700, marginTop: 24, marginBottom: 6, color });
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 16 };
