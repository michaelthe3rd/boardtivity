export default function LockIcon({ locked, size = 12 }: { locked: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "block" }}>
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      {locked ? <path d="M8 11V7.5a4 4 0 0 1 8 0V11" /> : <path d="M8 11V7.5a4 4 0 0 1 7.7-1.5" />}
    </svg>
  );
}
