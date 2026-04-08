import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claws — The front-end framework for OpenClaw UIs",
  description:
    "React hooks, visual Studio, and AIOS template marketplace for building custom dashboards on top of OpenClaw. Plus an experimental agent OS for Vercelians.",
  openGraph: {
    title: "Claws — The front-end framework for OpenClaw UIs",
    description:
      "React hooks, visual Studio, and AIOS template marketplace for OpenClaw. Plus an experimental agent OS for Vercelians 👽🦞",
    url: "https://claws.so",
    siteName: "Claws",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claws — The front-end framework for OpenClaw UIs",
    description:
      "React hooks + visual Studio + template marketplace for OpenClaw. Plus an experimental agent OS for Vercelians 👽🦞",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{
        // Override the tokens to use Geist via next/font
        ["--font-sans" as string]: `${GeistSans.style.fontFamily}, system-ui, sans-serif`,
        ["--font-mono" as string]: `${GeistMono.style.fontFamily}, ui-monospace, monospace`,
      }}
    >
      <body>{children}</body>
    </html>
  );
}
