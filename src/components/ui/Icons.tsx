// Small line icons as SVG so they look the same on every platform (no emoji or text glyphs).
// Shapes reuse the app's existing inline SVGs where one exists (check, plus, clock), and new ones
// follow the same style: round caps and joins, ~2px strokes, drawn in the current text color.

type IconProps = { size?: number; strokeWidth?: number };

function Svg({ size = 14, strokeWidth = 2, viewBox = "0 0 24 24", children }: IconProps & { viewBox?: string; children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}>
      {children}
    </svg>
  );
}

// Same checkmark as the "Signed in" pill and focus summary.
export const CheckIcon = ({ strokeWidth = 2, ...p }: IconProps) => <Svg {...p} strokeWidth={strokeWidth} viewBox="0 0 14 14"><polyline points="2,7 5.5,10.5 12,3.5" /></Svg>;
// Same plus as the phone "+" board button.
export const PlusIcon = ({ strokeWidth = 2.5, ...p }: IconProps) => <Svg {...p} strokeWidth={strokeWidth}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Svg>;
// Same clock as the focus-stats button.
export const TimerIcon = ({ strokeWidth = 1.4, ...p }: IconProps) => <Svg {...p} strokeWidth={strokeWidth} viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" /><path d="M7 4v3l2 1.5" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></Svg>;
export const PencilIcon = (p: IconProps) => <Svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></Svg>;
export const LinkIcon = (p: IconProps) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>;
export const UnlinkIcon = (p: IconProps) => <Svg {...p}><path d="M15.5 13.5l3.2-3.2a4 4 0 0 0-5.7-5.7l-1.5 1.5" /><path d="M8.5 10.5l-3.2 3.2a4 4 0 0 0 5.7 5.7l1.5-1.5" /><line x1="4" y1="4" x2="20" y2="20" /></Svg>;
export const ListIcon = (p: IconProps) => <Svg {...p}><line x1="9" y1="7" x2="20" y2="7" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="17" x2="20" y2="17" /><circle cx="5" cy="7" r=".6" fill="currentColor" /><circle cx="5" cy="12" r=".6" fill="currentColor" /><circle cx="5" cy="17" r=".6" fill="currentColor" /></Svg>;
