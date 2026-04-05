"use client";

const BG_SWATCHES = [
  { label: "Page light", bg: "#f3f1eb", text: "#171613" },
  { label: "White", bg: "#ffffff", text: "#171613" },
  { label: "Page dark", bg: "#0d0f12", text: "#f5f5f2" },
  { label: "Pure black", bg: "#000000", text: "#f5f5f2" },
  { label: "Indigo", bg: "#4f46e5", text: "#ffffff" },
  { label: "Mid grey", bg: "#6b7280", text: "#ffffff" },
];

export default function LogoPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f1eb", fontFamily: "'Satoshi', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "32px 48px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo-icon.png" width={22} height={22} alt="Boardtivity" style={{ display: "block" }} />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".04em", color: "#111315" }}>Logo Preview</span>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 48px 120px" }}>

        {/* Hero — full logo */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "#aaa", marginBottom: 28 }}>Full</div>
          <img src="/logo-vertical.svg" alt="Boardtivity full logo" style={{ maxWidth: 400, display: "block" }} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,.08)", margin: "0 0 64px" }} />

        {/* Horizontal lockup */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "#aaa", marginBottom: 28 }}>Horizontal</div>
          <img src="/logo-horizontal.svg" alt="Boardtivity horizontal logo" style={{ maxWidth: 360, display: "block" }} />
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,.08)", margin: "0 0 64px" }} />

        {/* Icon size scale */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "#aaa", marginBottom: 28 }}>Icon size scale</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
            {[16, 24, 32, 48, 64, 96, 128].map(s => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <img src="/logo-icon.svg" width={s} height={s} alt="Boardtivity" style={{ display: "block" }} />
                <span style={{ fontSize: 11, color: "#aaa", fontWeight: 500 }}>{s}px</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,.08)", margin: "0 0 64px" }} />

        {/* On different backgrounds */}
        <div style={{ marginBottom: 72 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "#aaa", marginBottom: 28 }}>Icon on backgrounds</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {BG_SWATCHES.map(({ label, bg, text }) => (
              <div key={label} style={{ backgroundColor: bg, borderRadius: 16, padding: "32px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, minWidth: 140, border: bg === "#ffffff" ? "1px solid rgba(0,0,0,.08)" : "none" }}>
                <img src="/logo-icon.svg" width={56} height={56} alt="Boardtivity" style={{ display: "block" }} />
                <span style={{ fontSize: 11, color: text, opacity: .55, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: "rgba(0,0,0,.08)", margin: "0 0 64px" }} />

        {/* Dark background */}
        <div style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: "#aaa", marginBottom: 28 }}>On dark</div>
          <div style={{ backgroundColor: "#0d0f12", borderRadius: 20, padding: "48px 40px", display: "flex", flexDirection: "column", gap: 40 }}>
            <img src="/logo-vertical.svg" alt="Boardtivity vertical logo" style={{ maxWidth: 280, display: "block" }} />
            <img src="/logo-horizontal.svg" alt="Boardtivity horizontal logo" style={{ maxWidth: 360, display: "block" }} />
          </div>
        </div>

      </div>
    </div>
  );
}
