import "./globals.css";
import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { SessionTracker } from "@/components/SessionTracker";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Boardtivity",
  description: "Boardtivity — the visual board for tasks, thoughts, and focus.",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem("boardtivity");if(s){var d=JSON.parse(s);if(d&&typeof d==="object"){var VALID=["light","dark"];var t=VALID.includes(d.theme)?d.theme:"light";var bt=VALID.includes(d.boardTheme)?d.boardTheme:t;document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-board-theme",bt);}}if(location.pathname==="/"){document.documentElement.style.visibility="hidden";}}catch(e){}})();`}} />
      </head>
      <body suppressHydrationWarning>
        <ConvexClientProvider>
          {children}
          <SessionTracker />
        </ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
