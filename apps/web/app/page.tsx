import { CopyButton } from "./copy-button";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-[#ededed]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <span className="text-lg font-bold tracking-tight">Claws</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-[#888] md:flex">
            <a href="#framework" className="transition hover:text-white">
              Framework
            </a>
            <a href="#os" className="transition hover:text-white">
              Agent OS
            </a>
            <a href="#templates" className="transition hover:text-white">
              Templates
            </a>
            <a href="#get-started" className="transition hover:text-white">
              Get Started
            </a>
            <a
              href="https://github.com/houstongolden/claws"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              GitHub
            </a>
          </div>
          <a
            href="#get-started"
            className="rounded-lg bg-[#ff3344] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#ff4d5c]"
          >
            Install SDK
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20 text-center">
        {/* Glow */}
        <div
          className="pointer-events-none absolute top-[-200px] left-1/2 -translate-x-1/2"
          style={{
            width: 900,
            height: 700,
            background:
              "radial-gradient(ellipse at center, rgba(255,51,68,0.14) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-1.5 text-xs text-[#888]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff3344]" />
            Open Source &middot; Local-First &middot; Vercel-Native
          </div>
          <h1
            className="mb-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl"
            style={{ letterSpacing: "-0.04em" }}
          >
            The front-end framework
            <br />
            <span className="bg-gradient-to-r from-[#ff3344] to-[#f5a623] bg-clip-text text-transparent">
              for OpenClaw UIs.
            </span>
          </h1>
          <p className="mx-auto mb-4 max-w-2xl text-lg leading-relaxed text-[#a3a3a3]">
            React hooks, a visual Studio, and a template marketplace for building custom
            dashboards, mission-control UIs, and workflow managers on top of OpenClaw.
          </p>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-[#737373]">
            Plus an experimental agent OS for Vercelians <span className="text-[#ededed]">👽🦞</span>
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="#get-started"
              className="rounded-xl bg-[#ff3344] px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#ff4d5c]"
            >
              Install @claws/sdk
            </a>
            <a
              href="https://github.com/houstongolden/claws"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-[#333] px-8 py-3.5 text-base font-semibold transition hover:border-[#555] hover:bg-[#111]"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Terminal preview */}
        <div className="relative z-10 mx-auto mt-20 w-full max-w-2xl">
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] shadow-2xl shadow-black/50">
            <div className="flex items-center gap-2 border-b border-[#1a1a1a] px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-[#ff3344]" />
              <span className="h-3 w-3 rounded-full bg-[#f5a623]" />
              <span className="h-3 w-3 rounded-full bg-[#30a46c]" />
              <span className="ml-4 text-xs text-[#555]">terminal</span>
            </div>
            <div
              className="p-6 text-sm leading-relaxed"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <div className="text-[#888]">
                <span className="text-[#30a46c]">$</span> npm install @claws/sdk
              </div>
              <div className="mt-3 text-[#555]">
                {"  "}added 1 package in 2s
              </div>
              <div className="mt-3 text-[#888]">
                <span className="text-[#30a46c]">$</span> import {"{"} useGateway, useSkills {"}"} from &quot;@claws/sdk/react&quot;
              </div>
              <div className="mt-3 text-[#888]">
                <span className="text-[#30a46c]">$</span> claws dev
              </div>
              <div className="mt-3">
                <span className="text-[#ff3344]">{"  "}🦞</span>{" "}
                <span className="font-semibold text-white">
                  Claws Studio running
                </span>
              </div>
              <div className="text-[#555]">
                {"  "}Gateway   → ws://localhost:3000 (OpenClaw)
              </div>
              <div className="text-[#555]">
                {"  "}Studio    → http://localhost:3001
              </div>
              <div className="mt-3 text-[#30a46c]">
                {"  "}Locked in. Agents are listening.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Framework pillar */}
      <section id="framework" className="border-t border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-1.5 text-xs text-[#ff3344]">
              Pillar 1
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              The framework for custom OpenClaw UIs
            </h2>
            <p className="mx-auto max-w-2xl text-[#888]">
              Everything you need to ship a production dashboard on top of OpenClaw:
              SDK, Studio, template marketplace, and workspace deployment.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "⚡",
                title: "@claws/sdk",
                description:
                  "17 React hooks + WebSocket gateway client for OpenClaw Gateway v3. Skills, tools, sessions, presence, config, channels, cron — all typed, all streaming.",
              },
              {
                icon: "🎨",
                title: "Claws Studio",
                description:
                  "Visual template builder. Design your AI OS dashboard, configure the agent personality, drop in skills — then deploy to a persistent workspace.",
              },
              {
                icon: "📦",
                title: "AIOS Templates",
                description:
                  "Package SOUL.md, AGENTS.md, skills, dashboard layout, themes, and crons into shareable templates. Fork, version, publish to the marketplace.",
              },
              {
                icon: "🔄",
                title: "SmartSync versioning",
                description:
                  "Three-way merge algorithm keeps deployed workspaces up to date with template upgrades without losing your customization.",
              },
              {
                icon: "🚀",
                title: "Fly.io deployment",
                description:
                  "One click to provision a persistent OpenClaw VPS on your subdomain. TLS, JWT auth, nginx, stats server, ttyd web terminal — all bundled.",
              },
              {
                icon: "🧠",
                title: "Workspace sync",
                description:
                  "Bi-directional sync between CLI and cloud. Your SOUL, memory, and skills stay in lockstep wherever you work.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 transition hover:border-[#333] hover:bg-[#111]"
              >
                <div className="mb-4 text-2xl">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-[#888]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Experimental OS pillar */}
      <section
        id="os"
        className="border-t border-[#1a1a1a] bg-[#0a0a0a] py-32"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#000000] px-4 py-1.5 text-xs text-[#f5a623]">
              Pillar 2
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              An experimental agent OS for Vercelians{" "}
              <span className="inline-block">👽🦞</span>
            </h2>
            <p className="mx-auto max-w-2xl text-[#888]">
              A local-first multi-agent runtime built on the Vercel stack. Gateway,
              dashboard, CLI, and worker in one Next.js turborepo. Use it as your
              playground or as a second backend for the Claws framework.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              {[
                {
                  label: "Gateway",
                  port: "4317",
                  desc: "Agent runtime, AI routing, tool execution, streaming SSE chat, fallback chain across 4 providers",
                },
                {
                  label: "Dashboard",
                  port: "4318",
                  desc: "Next.js 15 app with streaming chat, traces, approvals, sessions, projects",
                },
                {
                  label: "CLI",
                  port: null,
                  desc: "Interactive REPL, one-shot prompts, slash commands, aliases, full operator TUI",
                },
                {
                  label: "Worker",
                  port: null,
                  desc: "Background job runner for async agent loops and workflow advancement",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-4 rounded-lg border border-[#1a1a1a] p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#141414] text-sm font-mono text-[#ff3344]">
                    {item.port ? `:${item.port}` : "CLI"}
                  </div>
                  <div>
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-sm text-[#888]">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm space-y-3">
                {[
                  "Next.js 15 &middot; App Router",
                  "Vercel AI SDK v6",
                  "TypeScript &middot; Turborepo",
                  "Tailwind CSS v4 &middot; Geist",
                  "Playwright &middot; PGlite",
                  "OpenRouter &middot; OpenAI &middot; Anthropic",
                ].map((tech) => (
                  <div
                    key={tech}
                    className="rounded-lg border border-[#1a1a1a] bg-[#141414] px-4 py-3 text-center text-sm"
                    dangerouslySetInnerHTML={{ __html: tech }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Templates marketplace teaser */}
      <section id="templates" className="border-t border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-1.5 text-xs text-[#888]">
              Coming Soon
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              Template Marketplace
            </h2>
            <p className="mx-auto max-w-2xl text-[#888]">
              Fork, version, and publish AIOS templates. Ship your own dashboard in
              one click.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "FounderOS", role: "Solo founder", color: "#ff3344" },
              { name: "DevOS", role: "Engineering team", color: "#4a9eff" },
              { name: "CompanyOS", role: "Small company", color: "#f5a623" },
              { name: "ResearchOS", role: "AI research lab", color: "#30a46c" },
            ].map((tmpl) => (
              <div
                key={tmpl.name}
                className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6"
              >
                <div
                  className="mb-3 inline-block h-1 w-8 rounded-full"
                  style={{ background: tmpl.color }}
                />
                <div className="font-semibold">{tmpl.name}</div>
                <div className="text-xs text-[#737373]">{tmpl.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get Started */}
      <section id="get-started" className="border-t border-[#1a1a1a] py-32">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            Get started in 60 seconds
          </h2>
          <p className="mx-auto mb-12 max-w-lg text-[#888]">
            Install the SDK, connect to your OpenClaw gateway, build a dashboard.
          </p>

          <div className="mx-auto max-w-lg space-y-4 text-left">
            {[
              {
                step: "1",
                cmd: "npm install @claws/sdk",
                desc: "Install the framework",
              },
              {
                step: "2",
                cmd: 'import { useGateway } from "@claws/sdk/react"',
                desc: "Import the React hooks",
              },
              {
                step: "3",
                cmd: "claws dev",
                desc: "Start Studio + connect to OpenClaw",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-center gap-4 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ff3344] text-sm font-bold text-white">
                  {item.step}
                </div>
                <div className="flex-1 overflow-hidden">
                  <code
                    className="block truncate text-sm text-white"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {item.cmd}
                  </code>
                  <div className="text-xs text-[#555]">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="inline-flex items-center gap-3 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] px-6 py-3">
              <code
                className="text-sm text-[#888]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                npm install @claws/sdk
              </code>
              <CopyButton text="npm install @claws/sdk" />
            </div>
          </div>

          <div className="mt-4 text-xs text-[#555]">
            Or try the experimental agent OS:{" "}
            <code
              className="text-[#ff3344]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              npx @claws-so/create
            </code>
          </div>

          <div className="mt-16">
            <a
              href="https://github.com/houstongolden/claws"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[#888] transition hover:text-white"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-[#555] md:flex-row">
          <div className="flex items-center gap-2">
            <span>🦞</span>
            <span>Claws</span>
            <span>&middot;</span>
            <span>MIT licensed</span>
          </div>
          <div className="flex gap-6">
            <a
              href="https://github.com/houstongolden/claws"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-white"
            >
              GitHub
            </a>
            <a href="#framework" className="transition hover:text-white">
              Framework
            </a>
            <a href="#os" className="transition hover:text-white">
              Agent OS
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
