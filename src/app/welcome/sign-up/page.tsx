import { SignUp } from "@clerk/nextjs";

const appearance = {
  variables: {
    fontFamily: "'Satoshi', Arial, sans-serif",
    fontFamilyButtons: "'Satoshi', Arial, sans-serif",
    fontSize: "15px",
    borderRadius: "10px",
    colorBackground: "#ffffff",
    colorInputBackground: "#f7f8f9",
    colorInputText: "#111315",
    colorText: "#111315",
    colorTextSecondary: "#888",
    colorPrimary: "#111315",
    colorDanger: "#c03030",
    spacingUnit: "18px",
  },
  elements: {
    card: {
      boxShadow: "none",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: "18px",
      padding: "32px",
    },
    headerTitle: { fontSize: "22px", fontWeight: "800", letterSpacing: "-0.03em" },
    headerSubtitle: { fontSize: "14px", opacity: "0.5" },
    socialButtonsBlockButton: {
      border: "1px solid rgba(0,0,0,0.1)",
      borderRadius: "10px",
      fontWeight: "600",
      fontSize: "14px",
      height: "44px",
    },
    formButtonPrimary: {
      backgroundColor: "#111315",
      borderRadius: "10px",
      fontWeight: "700",
      fontSize: "14px",
      height: "44px",
    },
    formFieldInput: {
      borderRadius: "10px",
      border: "1px solid rgba(0,0,0,0.12)",
      fontSize: "14px",
      height: "44px",
      backgroundColor: "#f7f8f9",
    },
    formFieldLabel: { fontSize: "13px", fontWeight: "600" },
    footerActionLink: { color: "#111315", fontWeight: "700" },
    dividerLine: { backgroundColor: "rgba(0,0,0,0.07)" },
    dividerText: { color: "#bbb", fontSize: "12px" },
    logoBox: { display: "none" },
  },
};

export default function WelcomeSignUpPage() {
  return (
    <>
      <style>{`html,body{height:100%;margin:0;background:#f8f8f6;}`}</style>
    <main style={{
      background: "#f8f8f6",
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 20px",
      gap: "24px",
      boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
        <svg width={66} height={54} viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
          <rect x="15" y="15" width="190" height="150" rx="28" ry="28" stroke="#171613" strokeWidth="9"/>
          <path d="M38 38 H58 M38 38 V58" stroke="#171613" strokeWidth="6" strokeLinecap="round"/>
          <path d="M182 38 H162 M182 38 V58" stroke="#171613" strokeWidth="6" strokeLinecap="round"/>
          <path d="M38 142 H58 M38 142 V122" stroke="#171613" strokeWidth="6" strokeLinecap="round"/>
          <path d="M182 142 H162 M182 142 V122" stroke="#171613" strokeWidth="6" strokeLinecap="round"/>
          <text x="110" y="118" fontFamily="Satoshi, Arial Black, sans-serif" fontWeight="900" fontSize="85" textAnchor="middle" fill="#171613">B</text>
        </svg>
        <span style={{
          fontSize: "22px",
          fontWeight: "700",
          color: "#111315",
          letterSpacing: "-0.03em",
          fontFamily: "'Satoshi', Arial, sans-serif",
        }}>
          Boardtivity
        </span>
      </div>

      <div style={{ width: "100%", maxWidth: "420px" }}>
        <SignUp
          forceRedirectUrl="/"
          signInUrl="/welcome"
          appearance={appearance}
        />
      </div>
    </main>
    </>
  );
}
