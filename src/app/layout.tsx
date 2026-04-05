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
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
