export default function BoardtivityLogo({ size = 32, dark = false }: { size?: number; dark?: boolean }) {
  const color = dark ? "#f5f5f2" : "#171613";
  return (
    <svg width={size} height={Math.round(size * 180 / 220)} viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <rect x="15" y="15" width="190" height="150" rx="28" ry="28" stroke={color} strokeWidth="9"/>
      <path d="M38 38 H58 M38 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 38 H162 M182 38 V58" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M38 142 H58 M38 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <path d="M182 142 H162 M182 142 V122" stroke={color} strokeWidth="6" strokeLinecap="round"/>
      <text x="110" y="118" fontFamily="Satoshi, Arial Black, sans-serif" fontWeight="900" fontSize="85" textAnchor="middle" fill={color}>B</text>
    </svg>
  );
}
