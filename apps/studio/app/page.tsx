import { LivePanel } from "./live-panel";

export default function StudioHome() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
      <Header />
      <LivePanel />
      <NextSteps />
      <HookReference />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="mb-12">
      <div
        className="mono mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-wider"
        style={{
          borderColor: "var(--color-surface-3)",
          background: "var(--color-surface-1)",
          color: "var(--color-brand)",
        }}
      >
        <span
          className="h-1 w-1 rounded-full"
          style={{ background: "var(--color-brand)" }}
        />
        studio · v0.1
      </div>
      <h1
        className="mb-4 text-5xl font-extrabold md:text-6xl"
        style={{
          color: "var(--color-text-primary)",
          letterSpacing: "-0.035em",
          lineHeight: 1.05,
        }}
      >
        <span className="text-2xl">🦞</span> Claws Studio
      </h1>
      <p
        className="max-w-2xl text-base"
        style={{ color: "var(--color-text-secondary)", lineHeight: 1.6 }}
      >
        The visual control room for building dashboards on top of OpenClaw or
        the experimental Claws agent OS. Live metrics from the connected
        gateway below.
      </p>
    </header>
  );
}

function NextSteps() {
  const steps = [
    {
      num: "01",
      title: "Full template editor",
      body: "Restore StudioLayout + template config + deploy flow from _legacy/components-hubify/. Needs a backend decision (Convex vs local file store).",
    },
    {
      num: "02",
      title: "Agent tree visualization",
      body: "Use SessionEventStream from @claws/runtime-db to render a live agent tree with WorkerState status dots. Data model is ready; UI is not.",
    },
    {
      num: "03",
      title: "Template marketplace",
      body: "Port /templates and /store routes from _legacy/app-hubify/. Replace Convex queries with a local HTTP backend or actual Convex project.",
    },
    {
      num: "04",
      title: "Fly.io one-click deploy",
      body: "Wire the workspaces API route (from _legacy) to provision a Fly machine using the validated pipeline. See PHASE-G-FLY-INFRA-VALIDATION.md.",
    },
  ];

  return (
    <section className="mb-16">
      <div
        className="mono mb-4 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        // next-steps
      </div>
      <h2
        className="mb-6 text-xl font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        Roadmap
      </h2>
      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.num}
            className="flex gap-4 rounded-md border p-4"
            style={{
              borderColor: "var(--color-surface-3)",
              background: "var(--color-surface-1)",
            }}
          >
            <div
              className="mono flex h-7 w-10 shrink-0 items-center justify-center rounded text-[11px] font-bold"
              style={{
                background: "var(--color-brand)",
                color: "#ffffff",
              }}
            >
              {step.num}
            </div>
            <div>
              <div
                className="text-[14px] font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {step.title}
              </div>
              <div
                className="text-[12.5px]"
                style={{ color: "var(--color-text-secondary)", lineHeight: 1.55 }}
              >
                {step.body}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HookReference() {
  const hooks = [
    "GatewayProvider",
    "useGateway",
    "useGatewayContext",
    "useChatSession",
    "useSessions",
    "useCronJobs",
    "useChannels",
    "useExecApprovals",
    "useNodes",
    "useToolsInvoke",
    "useToolsCatalog",
    "useWorkspaceFiles",
    "useSkills",
    "useConfig",
    "usePresence",
    "useAcpSession",
    "useSmartPoll",
    "useFocusTrap",
  ];

  return (
    <section className="mb-16">
      <div
        className="mono mb-4 text-[10px] uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        // sdk-hooks
      </div>
      <h2
        className="mb-3 text-xl font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        Available hooks
      </h2>
      <p
        className="mono mb-6 text-[12px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        import {"{"} ... {"}"} from &quot;@claws/sdk/react&quot;
      </p>
      <div className="grid gap-1.5 md:grid-cols-3">
        {hooks.map((hook) => (
          <div
            key={hook}
            className="mono rounded border px-3 py-1.5 text-[11.5px]"
            style={{
              borderColor: "var(--color-surface-3)",
              background: "var(--color-surface-1)",
              color: "var(--color-text-secondary)",
            }}
          >
            {hook}
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="mt-16 border-t pt-6"
      style={{ borderColor: "var(--color-surface-3)" }}
    >
      <div
        className="mono flex flex-wrap items-center justify-between gap-3 text-[11px]"
        style={{ color: "var(--color-text-ghost)" }}
      >
        <div>
          🦞 claws studio · the front-end framework for openclaw uis
        </div>
        <a
          href="https://github.com/houstongolden/claws"
          target="_blank"
          rel="noopener noreferrer"
          className="no-underline transition-colors hover:text-white"
        >
          github →
        </a>
      </div>
    </footer>
  );
}
