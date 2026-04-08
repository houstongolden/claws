import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "../components/providers";
import "./globals.css";

const THEME_SCRIPT = `
(function(){
  var t = localStorage.getItem('claws-theme');
  var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();
`;

export const metadata = {
  title: "Claws",
  description: "Local-first agent OS for builders",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-[family-name:var(--font-geist-sans)] antialiased [font-feature-settings:'rlig'_1,'calt'_1]">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Visible if React never mounts (bundle error / wrong port serving empty app) */}
        <div
          id="claws-boot-fallback"
          suppressHydrationWarning
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            background: "#f0f0f2",
            color: "#333",
            fontFamily: "system-ui,sans-serif",
            fontSize: 14,
          }}
        >
          <p style={{ fontWeight: 600, margin: 0 }}>Loading Claws…</p>
          <p style={{ maxWidth: 420, margin: 0, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
            If this stays forever: run <code style={{ background: "#ddd", padding: "2px 6px", borderRadius: 4 }}>pnpm dev</code> and open the URL printed for the dashboard. Blank pages usually mean the Next server did not start (port 4318 already in use) — dev now stops the old process on that port automatically.
          </p>
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
