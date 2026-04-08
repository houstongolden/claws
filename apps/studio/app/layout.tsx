import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claws Studio",
  description:
    "The visual control room for building dashboards on top of OpenClaw or the experimental Claws agent OS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        ["--font-sans" as string]: `${GeistSans.style.fontFamily}, system-ui, sans-serif`,
        ["--font-mono" as string]: `${GeistMono.style.fontFamily}, ui-monospace, monospace`,
      }}
    >
      <body>{children}</body>
    </html>
  );
}
