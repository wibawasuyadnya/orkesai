import type { Metadata } from "next";
import "./globals.css";
// bundled Apple Color Emoji web font (samuelngs/apple-emoji-ttf web build) so
// emoji render identically on Windows/Linux/web, not only on macOS
import "./fonts.css";

export const metadata: Metadata = {
  title: "OrkesAI",
  description: "Multi-agent workspace for the OrkesAI terminal agent",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
