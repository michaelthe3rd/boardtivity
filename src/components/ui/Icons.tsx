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
export const CloudIcon = (p: IconProps) => <Svg {...p}><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.6 4.5 4.5 0 0 0 7 18.5z" /></Svg>;
// iOS Safari's Share button: a box with an arrow pointing up out of it.
export const ShareIcon = (p: IconProps) => <Svg {...p}><path d="M8 9H6.5A1.5 1.5 0 0 0 5 10.5v8A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 9H16" /><line x1="12" y1="3.5" x2="12" y2="14" /><polyline points="8.5,7 12,3.5 15.5,7" /></Svg>;
// Three stacked dots, like the Chrome / Android browser menu.
export const MoreVerticalIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></Svg>;
export const PlusSquareIcon = (p: IconProps) => <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><line x1="12" y1="8.5" x2="12" y2="15.5" /><line x1="8.5" y1="12" x2="15.5" y2="12" /></Svg>;
// Viewfinder corners around a dot (same corner brackets as the logo): "bring the board back to the middle".
export const CenterIcon = (p: IconProps) => <Svg {...p}><path d="M4 9V6a2 2 0 0 1 2-2h3" /><path d="M15 4h3a2 2 0 0 1 2 2v3" /><path d="M20 15v3a2 2 0 0 1-2 2h-3" /><path d="M9 20H6a2 2 0 0 1-2-2v-3" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></Svg>;
