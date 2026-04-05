import "./globals.css";
import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Boardtivity",
  description: "Boardtivity — the visual board for tasks, thoughts, and focus.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem("boardtivity");if(s){var d=JSON.parse(s);var t=d.theme||"light";var bt=d.boardTheme||t;document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-board-theme",bt);var bg=t==="dark"?"#0d0f12":"#f3f1eb";document.documentElement.style.backgroundColor=bg;}}catch(e){}})();`}} />
      </head>
      <body suppressHydrationWarning>
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
