import type { ReactNode } from "react";
import type { Metadata } from "next";
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
