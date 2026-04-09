import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Boardtivity",
  description: "The terms governing your use of Boardtivity.",
};

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", color: "#1a1a18" }}>
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 100px", fontFamily: "'Satoshi', Arial, sans-serif", color: "#1a1a18", lineHeight: 1.8 }}>
      <div style={{ marginBottom: 48 }}>
        <a href="/" style={{ fontSize: 13, color: "rgba(17,19,21,.45)", textDecoration: "none", fontWeight: 600 }}>← Back to Boardtivity</a>
      </div>

      <h1 style={h1}>Terms of Service</h1>
      <p style={meta}>Last updated: April 5, 2026</p>

      <p>These Terms of Service govern your use of Boardtivity, available at boardtivity.com. By using Boardtivity, you agree to these terms. If you don't agree, please don't use the service. Questions? Email <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>.</p>

      <h2 style={h2}>1. Who We Are</h2>
      <p>Boardtivity is operated as a sole proprietorship under the name Boardtivity, run by a single founder. "We", "us", and "our" mean Boardtivity.</p>

      <h2 style={h2}>2. Acceptance</h2>
      <p>By creating an account, joining the waitlist, or using Boardtivity, you confirm that you're at least 13 years old, have the legal capacity to enter this agreement, and agree to these Terms and our Privacy Policy.</p>

      <h2 style={h2}>3. What the Service Is</h2>
      <p>Boardtivity is a productivity tool for organizing tasks, ideas, and thoughts on visual boards. We offer a free tier with core functionality and a Plus tier with additional features (billing not yet active, coming soon). We may change, add, or remove features at any time — we'll communicate significant changes.</p>

      <h2 style={h2}>4. Your Account</h2>
      <p>You're responsible for keeping your credentials secure and for all activity that happens under your account. Don't share your password. If you think your account has been compromised, contact us immediately.</p>

      <h2 style={h2}>5. What You Can't Do</h2>
      <p>You agree not to use Boardtivity to:</p>
      <ul style={ul}>
        <li>Store or share illegal content of any kind</li>
        <li>Harass, threaten, or harm other users</li>
        <li>Attempt to access other users' accounts or data</li>
        <li>Reverse engineer, scrape, or abuse the service</li>
        <li>Use automated scripts that degrade performance for others</li>
        <li>Violate any applicable law or regulation</li>
      </ul>
      <p>We trust users to act in good faith. Violations may result in account termination.</p>

      <h2 style={h2}>6. Your Content</h2>
      <p><strong>You own your content.</strong> Everything you create on Boardtivity — boards, cards, notes — belongs to you. By using the service, you give us a limited license to store and display your content for the sole purpose of running the service. We don't claim ownership of anything you create, and we won't use your content for any other purpose.</p>

      <h2 style={h2}>7. Our Intellectual Property</h2>
      <p>Boardtivity's design, code, branding, and all non-user content are owned by Boardtivity. These Terms don't give you any rights to our intellectual property beyond normal use of the service.</p>

      <h2 style={h2}>8. Service Availability</h2>
      <p>We do our best to keep Boardtivity running, but we make no uptime guarantees at this stage. The service may be unavailable due to maintenance, outages, or issues with our infrastructure providers. We're not liable for losses resulting from downtime.</p>

      <h2 style={h2}>9. Payments and Billing</h2>
      <p>Boardtivity offers a free tier and a paid Plus tier at $6/month, billed via Stripe. By subscribing, you authorize us to charge your payment method on a recurring monthly basis. You can cancel anytime — your Plus access continues until the end of the current billing period, after which your account reverts to the free tier. We do not offer refunds for partial months. Pricing may change with 30 days' notice.</p>

      <h2 style={h2}>10. Termination</h2>
      <p><strong>You</strong> can close your account at any time by emailing <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>. We'll delete your account and content promptly.</p>
      <p><strong>We</strong> may suspend or terminate your account if we believe you've violated these Terms or are harming the platform or other users. We'll give fair warning when possible.</p>

      <h2 style={h2}>11. Limitation of Liability</h2>
      <p>Boardtivity is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we're not liable for any indirect, incidental, or consequential damages from your use of the service. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim — or $0 if you're on the free tier. This exists because Boardtivity is an indie project run by one person.</p>

      <h2 style={h2}>12. Indemnification</h2>
      <p>You agree to hold Boardtivity harmless from any claims, losses, or damages arising from your use of the service, your content, or your violation of these Terms.</p>

      <h2 style={h2}>13. Changes to Terms</h2>
      <p>We may update these Terms over time. We'll update the date at the top and notify you by email for material changes. Continued use after a change means you accept the updated Terms.</p>

      <h2 style={h2}>14. Governing Law</h2>
      <p>These Terms are governed by the laws of the State of California. Any disputes will be resolved in courts located in California.</p>

      <h2 style={h2}>15. Entire Agreement</h2>
      <p>These Terms and our Privacy Policy constitute the entire agreement between you and Boardtivity regarding your use of the service.</p>

      <h2 style={h2}>16. Contact</h2>
      <p>Questions about these Terms? Email <a href="mailto:contact@boardtivity.com" style={a}>contact@boardtivity.com</a>.</p>

      <div style={{ marginTop: 64, paddingTop: 24, borderTop: "1px solid rgba(17,19,21,.08)", fontSize: 13, color: "rgba(17,19,21,.35)" }}>
        <a href="/privacy" style={{ color: "rgba(17,19,21,.45)", marginRight: 20, textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
        <a href="/" style={{ color: "rgba(17,19,21,.45)", textDecoration: "none", fontWeight: 600 }}>Back to Boardtivity</a>
      </div>
    </div>
    </div>
  );
}

const h1: React.CSSProperties = { fontSize: 32, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 8, marginTop: 0 };
const h2: React.CSSProperties = { fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", marginTop: 44, marginBottom: 10 };
const meta: React.CSSProperties = { fontSize: 14, color: "rgba(17,19,21,.4)", marginBottom: 40, marginTop: 0 };
const a: React.CSSProperties = { color: "#111315", fontWeight: 600 };
const ul: React.CSSProperties = { paddingLeft: 20, marginBottom: 16 };
