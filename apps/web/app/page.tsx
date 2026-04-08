import { CopyButton } from "./copy-button";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <PillarOne />
      <PillarTwo />
      <QuickStart />
      <Footer />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Nav
   ───────────────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        borderColor: "var(--color-surface-3)",
        background: "color-mix(in srgb, var(--color-bg) 75%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        height: 56,
      }}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <a href="#" className="link-muted flex items-center gap-2 no-underline">
          <span className="text-lg">🦞</span>
          <span
            className="mono text-[13px] font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            claws
          </span>
          <span
            className="mono text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            v0.1
          </span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {[
            { href: "#framework", label: "framework" },
            { href: "#os", label: "agent-os" },
            { href: "#start", label: "install" },
            {
              href: "https://github.com/houstongolden/claws",
              label: "github",
              external: true,
            },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              className="link-muted mono text-[12px] no-underline"
            >
              {item.label}
            </a>
          ))}
        </div>

        <a
          href="#start"
          className="btn-brand mono rounded-md px-3 py-1.5 text-[12px] font-medium no-underline"
        >
          npm i @claws/sdk
        </a>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   Hero
   ───────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      className="relative overflow-hidden px-6 pt-32 pb-20"
      style={{ minHeight: "80vh" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: 900,
          height: 500,
          background:
            "radial-gradient(ellipse at center, rgba(255,51,68,0.15) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <div
          className="mono mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider"
          style={{
            borderColor: "var(--color-surface-3)",
            background: "var(--color-surface-1)",
            color: "var(--color-text-muted)",
          }}
        >
          <span
            className="h-1 w-1 rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          open source · local-first · vercel-native
        </div>

        <h1
          className="mb-6 text-5xl font-extrabold md:text-7xl"
          style={{
            color: "var(--color-text-primary)",
            letterSpacing: "-0.035em",
            lineHeight: 1.02,
          }}
        >
          The front-end framework
          <br />
          for{" "}
          <span style={{ color: "var(--color-brand)" }}>OpenClaw UIs.</span>
        </h1>

        <p
          className="mx-auto mb-3 max-w-2xl text-base md:text-lg"
          style={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}
        >
          React hooks, a visual Studio, and a template marketplace for building
          custom dashboards on top of OpenClaw.
        </p>
        <p
          className="mono mx-auto mb-12 text-[13px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          // plus an experimental agent OS for vercelians 👽🦞
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="#start"
            className="btn-brand mono rounded-md px-5 py-2.5 text-[13px] font-medium no-underline"
          >
            install @claws/sdk
          </a>
          <a
            href="https://github.com/houstongolden/claws"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary mono rounded-md px-5 py-2.5 text-[13px] font-medium no-underline"
          >
            view on github
          </a>
        </div>

        <Terminal />
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   Terminal block
   ───────────────────────────────────────────────────────────── */

function Terminal() {
  return (
    <div className="mx-auto mt-16 w-full max-w-2xl text-left">
      <div
        className="overflow-hidden rounded-lg"
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-surface-3)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center gap-1.5 border-b px-4 py-3"
          style={{
            borderColor: "var(--color-surface-3)",
            background: "var(--color-bg)",
          }}
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "var(--color-brand)" }}
          />
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "var(--color-warning)" }}
          />
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "var(--color-success)" }}
          />
          <span
            className="mono ml-3 text-[11px]"
            style={{ color: "var(--color-text-ghost)" }}
          >
            ~/projects/my-dashboard
          </span>
        </div>
        <div
          className="mono p-5 text-[12.5px] leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <Line prompt cmd="npm install @claws/sdk" />
          <Line output="added 1 package in 1.8s" />
          <Spacer />
          <Line prompt cmd='echo "import { useGateway } from \"@claws/sdk/react\"" >> app.tsx' />
          <Spacer />
          <Line prompt cmd="claws dev" />
          <div className="mt-3 flex items-center gap-2">
            <span style={{ color: "var(--color-brand)" }}>🦞</span>
            <span
              className="font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              claws studio running
            </span>
          </div>
          <div
            className="mt-1 ml-5 text-[12px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            gateway   → ws://localhost:3000
          </div>
          <div
            className="ml-5 text-[12px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            studio    → http://localhost:4319
          </div>
          <div className="mt-3" style={{ color: "var(--color-success)" }}>
            ✓ locked in. agents are listening.
          </div>
        </div>
      </div>
    </div>
  );
}

function Line({
  prompt,
  cmd,
  output,
}: {
  prompt?: boolean;
  cmd?: string;
  output?: string;
}) {
  if (output) {
    return (
      <div style={{ color: "var(--color-text-ghost)" }}>
        {"  "}
        {output}
      </div>
    );
  }
  return (
    <div>
      {prompt && <span style={{ color: "var(--color-success)" }}>$ </span>}
      <span style={{ color: "var(--color-text-primary)" }}>{cmd}</span>
    </div>
  );
}

function Spacer() {
  return <div className="h-2" />;
}

/* ─────────────────────────────────────────────────────────────
   Pillar 1 — Framework
   ───────────────────────────────────────────────────────────── */

function PillarOne() {
  return (
    <section
      id="framework"
      className="border-t px-6 py-24"
      style={{ borderColor: "var(--color-surface-3)" }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          tag="pillar-1"
          title="The framework for custom OpenClaw UIs"
          subtitle="Everything you need to ship a production dashboard on top of OpenClaw: SDK, Studio, template marketplace, Fly.io deploy."
        />

        <div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              key: "sdk",
              title: "@claws/sdk",
              body: "17 React hooks + WebSocket gateway client for OpenClaw Gateway v3. Typed end-to-end. 21 KB gzipped.",
            },
            {
              key: "studio",
              title: "Studio",
              body: "Visual template builder. Design your AI OS dashboard, configure the agent personality, drop in skills, deploy.",
            },
            {
              key: "templates",
              title: "AIOS Templates",
              body: "Package SOUL.md, AGENTS.md, skills, dashboard layout, themes, and crons into shareable templates.",
            },
            {
              key: "sync",
              title: "SmartSync",
              body: "Three-way merge keeps deployed workspaces in sync with template upgrades without losing customization.",
            },
            {
              key: "fly",
              title: "Fly.io deploy",
              body: "One click to provision a persistent OpenClaw VPS on your subdomain. TLS, nginx, stats server bundled.",
            },
            {
              key: "workspace",
              title: "Workspace sync",
              body: "Bi-directional sync between CLI and cloud. SOUL, memory, and skills stay in lockstep wherever you work.",
            },
          ].map((feat) => (
            <FeatureCard
              key={feat.key}
              label={feat.key}
              title={feat.title}
              body={feat.body}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card-interactive rounded-lg p-5">
      <div
        className="mono mb-3 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mb-2 text-[15px] font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {title}
      </div>
      <div
        className="text-[13px] leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {body}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Pillar 2 — Experimental OS
   ───────────────────────────────────────────────────────────── */

function PillarTwo() {
  return (
    <section
      id="os"
      className="border-t px-6 py-24"
      style={{
        borderColor: "var(--color-surface-3)",
        background: "var(--color-surface-1)",
      }}
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          tag="pillar-2"
          tagColor="var(--color-warning)"
          title={
            <>
              An experimental agent OS for Vercelians{" "}
              <span className="inline-block">👽🦞</span>
            </>
          }
          subtitle="A local-first multi-agent runtime built on the Vercel stack. Gateway, dashboard, CLI, worker in one turborepo. Playground or second backend for the Claws framework."
        />

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="space-y-2">
            {[
              {
                label: "gateway",
                port: ":4317",
                desc: "Agent runtime, AI routing, streaming SSE chat, fallback across 4 providers",
              },
              {
                label: "dashboard",
                port: ":4318",
                desc: "Next.js 15 app with chat, traces, approvals, sessions, projects",
              },
              {
                label: "studio",
                port: ":4319",
                desc: "Live control panel with gateway metrics, polls every 3s",
              },
              {
                label: "cli",
                port: null,
                desc: "Interactive REPL, slash commands, aliases, full operator TUI",
              },
              {
                label: "worker",
                port: null,
                desc: "Background loop for async agents and workflow advancement",
              },
            ].map((svc) => (
              <ServiceRow
                key={svc.label}
                label={svc.label}
                port={svc.port}
                desc={svc.desc}
              />
            ))}
          </div>

          <div className="flex items-start justify-center">
            <div className="w-full max-w-sm space-y-2">
              {[
                "next.js 15 · app router",
                "vercel ai sdk v6",
                "typescript · turborepo",
                "tailwind v4 · geist",
                "playwright · jsonl sessions",
                "openrouter · openai · anthropic",
              ].map((tech) => (
                <div
                  key={tech}
                  className="mono rounded border px-4 py-2.5 text-center text-[12px]"
                  style={{
                    borderColor: "var(--color-surface-3)",
                    background: "var(--color-bg)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ServiceRow({
  label,
  port,
  desc,
}: {
  label: string;
  port: string | null;
  desc: string;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-md border p-4"
      style={{
        borderColor: "var(--color-surface-3)",
        background: "var(--color-bg)",
      }}
    >
      <div
        className="mono flex h-10 min-w-[56px] items-center justify-center rounded border px-2 text-[11px] font-medium"
        style={{
          borderColor: "var(--color-surface-3)",
          background: "var(--color-surface-1)",
          color: "var(--color-brand)",
        }}
      >
        {port ?? "cli"}
      </div>
      <div className="flex-1">
        <div
          className="mono text-[12px] font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {label}
        </div>
        <div
          className="text-[12.5px]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Quick Start
   ───────────────────────────────────────────────────────────── */

function QuickStart() {
  return (
    <section
      id="start"
      className="border-t px-6 py-24"
      style={{ borderColor: "var(--color-surface-3)" }}
    >
      <div className="mx-auto max-w-3xl text-center">
        <SectionHeader
          tag="quickstart"
          title="Get started in 60 seconds"
          subtitle="Install the SDK, connect to your OpenClaw gateway, build a dashboard."
          centered
        />

        <div className="mt-12 space-y-3 text-left">
          {[
            {
              num: "01",
              cmd: "npm install @claws/sdk",
              desc: "install the framework",
            },
            {
              num: "02",
              cmd: 'import { useGateway } from "@claws/sdk/react"',
              desc: "import the react hooks",
            },
            {
              num: "03",
              cmd: "claws dev",
              desc: "start studio + connect to openclaw",
            },
          ].map((step) => (
            <StepRow
              key={step.num}
              num={step.num}
              cmd={step.cmd}
              desc={step.desc}
            />
          ))}
        </div>

        <div className="mt-10">
          <div
            className="inline-flex items-center gap-3 rounded-md border px-4 py-2.5"
            style={{
              borderColor: "var(--color-surface-3)",
              background: "var(--color-surface-1)",
            }}
          >
            <code
              className="mono text-[12px]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              $ npm install @claws/sdk
            </code>
            <CopyButton text="npm install @claws/sdk" />
          </div>
        </div>

        <div
          className="mono mt-4 text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          // or try the experimental agent OS ↓
        </div>
        <div className="mt-2">
          <div
            className="inline-flex items-center gap-3 rounded-md border px-4 py-2.5"
            style={{
              borderColor: "var(--color-surface-3)",
              background: "var(--color-surface-1)",
            }}
          >
            <code
              className="mono text-[12px]"
              style={{ color: "var(--color-brand)" }}
            >
              $ npx @claws-so/create
            </code>
            <CopyButton text="npx @claws-so/create" />
          </div>
        </div>

        <div className="mt-16">
          <a
            href="https://github.com/houstongolden/claws"
            target="_blank"
            rel="noopener noreferrer"
            className="link-muted mono inline-flex items-center gap-2 text-[12px] no-underline"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            star on github
          </a>
        </div>
      </div>
    </section>
  );
}

function StepRow({
  num,
  cmd,
  desc,
}: {
  num: string;
  cmd: string;
  desc: string;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-md border p-3.5"
      style={{
        borderColor: "var(--color-surface-3)",
        background: "var(--color-surface-1)",
      }}
    >
      <div
        className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded text-[11px] font-bold"
        style={{
          background: "var(--color-brand)",
          color: "#ffffff",
        }}
      >
        {num}
      </div>
      <div className="flex-1 overflow-hidden">
        <code
          className="mono block truncate text-[12.5px]"
          style={{ color: "var(--color-text-primary)" }}
        >
          {cmd}
        </code>
        <div
          className="mono text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared — SectionHeader
   ───────────────────────────────────────────────────────────── */

function SectionHeader({
  tag,
  tagColor = "var(--color-brand)",
  title,
  subtitle,
  centered = false,
}: {
  tag: string;
  tagColor?: string;
  title: React.ReactNode;
  subtitle: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "text-center" : ""}>
      <div
        className="mono mb-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-wider"
        style={{ color: tagColor }}
      >
        <span style={{ color: "var(--color-text-muted)" }}>//</span> {tag}
      </div>
      <h2
        className="mb-4 text-3xl font-bold md:text-4xl"
        style={{
          color: "var(--color-text-primary)",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
      <p
        className={`text-[14px] ${centered ? "mx-auto max-w-xl" : "max-w-2xl"}`}
        style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}
      >
        {subtitle}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Footer
   ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer
      className="border-t px-6 py-8"
      style={{ borderColor: "var(--color-surface-3)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
        <div
          className="mono flex items-center gap-3 text-[11px]"
          style={{ color: "var(--color-text-ghost)" }}
        >
          <span>🦞 claws</span>
          <span>·</span>
          <span>mit licensed</span>
          <span>·</span>
          <span>v0.1.0</span>
        </div>
        <div
          className="mono flex gap-5 text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <a
            href="https://github.com/houstongolden/claws"
            target="_blank"
            rel="noopener noreferrer"
            className="link-muted no-underline"
          >
            github
          </a>
          <a href="#framework" className="link-muted no-underline">
            framework
          </a>
          <a href="#os" className="link-muted no-underline">
            agent-os
          </a>
        </div>
      </div>
    </footer>
  );
}
