import { LivePanel } from "./live-panel";

export default function StudioHome() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-20">
      <header className="mb-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-1.5 text-xs text-[#ff3344]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff3344]" />
          Studio · v0.1
        </div>
        <h1 className="mb-4 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
          <span className="text-2xl">🦞</span>{" "}
          <span className="text-[#ededed]">Claws Studio</span>
        </h1>
        <p className="max-w-2xl text-lg text-[#a3a3a3]">
          The visual control room for building dashboards on top of OpenClaw
          or the experimental Claws agent OS. Live metrics from the connected
          gateway below.
        </p>
      </header>

      <LivePanel />

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Next steps</h2>
        <ul className="space-y-3 text-sm text-[#a3a3a3]">
          <Step
            num={1}
            title="Full template editor"
            body="Restore the StudioLayout + template config + deploy flow from _legacy/components-hubify/. Needs a backend decision (Convex vs local file store)."
          />
          <Step
            num={2}
            title="Agent tree visualization"
            body="Use SessionEventStream from @claws/runtime-db to render a live agent tree with WorkerState status dots. Data model is ready; UI is not."
          />
          <Step
            num={3}
            title="Template marketplace"
            body="Port /templates and /store routes from _legacy/app-hubify/. Replace Convex queries with a local HTTP backend or actual Convex project."
          />
          <Step
            num={4}
            title="Fly.io one-click deploy"
            body="Wire the workspaces API route (from _legacy) to provision a Fly machine using the validated pipeline. See PHASE-G-FLY-INFRA-VALIDATION.md."
          />
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">SDK hooks available</h2>
        <p className="mb-4 text-sm text-[#a3a3a3]">
          Import from{" "}
          <code className="rounded bg-[#141414] px-1.5 py-0.5 text-[#ff3344]">
            @claws/sdk/react
          </code>
          :
        </p>
        <div className="grid gap-2 font-mono text-xs text-[#a3a3a3] md:grid-cols-2">
          {[
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
          ].map((h) => (
            <div
              key={h}
              className="rounded border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2"
            >
              {h}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-20 border-t border-[#1f1f1f] pt-6 text-xs text-[#555]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>Claws Studio · the front-end framework for OpenClaw UIs</div>
          <a
            href="https://github.com/houstongolden/claws"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] hover:text-[#ededed]"
          >
            GitHub →
          </a>
        </div>
      </footer>
    </main>
  );
}

function Step({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff3344] text-xs font-bold text-white">
        {num}
      </div>
      <div>
        <div className="font-semibold text-[#ededed]">{title}</div>
        <div className="text-xs text-[#a3a3a3]">{body}</div>
      </div>
    </li>
  );
}
