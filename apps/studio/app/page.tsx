import { PROTOCOL_VERSION, METHODS, EVENTS } from "@claws/sdk";

export default function StudioHome() {
  const methodCount = Object.keys(METHODS).length;
  const eventCount = Object.keys(EVENTS).length;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-20">
      <header className="mb-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-1.5 text-xs text-[#ff3344]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff3344]" />
          Studio &middot; Salvage state
        </div>
        <h1 className="mb-4 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
          <span className="text-2xl">🦞</span>{" "}
          <span className="text-[#ededed]">Claws Studio</span>
        </h1>
        <p className="max-w-2xl text-lg text-[#a3a3a3]">
          Visual template builder for OpenClaw UIs. The SDK is wired and
          builds; the Studio UI shell runs. Full template editor lands in a
          future phase.
        </p>
      </header>

      <section className="mb-12 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-8">
        <h2 className="mb-4 text-xl font-semibold">SDK Integration Proof</h2>
        <p className="mb-6 text-sm text-[#a3a3a3]">
          This page imports directly from{" "}
          <code className="rounded bg-[#141414] px-1.5 py-0.5 text-[#ff3344]">
            @claws/sdk
          </code>
          . If you see these values, the workspace linking works.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Protocol version" value={String(PROTOCOL_VERSION)} />
          <Stat label="RPC methods" value={methodCount.toString()} />
          <Stat label="Gateway events" value={eventCount.toString()} />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold">Next steps</h2>
        <ul className="space-y-3 text-sm text-[#a3a3a3]">
          <Step
            num={1}
            title="Decide backend"
            body="Salvaged Convex functions live in packages/backend-convex. Either wire a fresh Convex project or replace with a simpler HTTP/SQLite backend."
          />
          <Step
            num={2}
            title="Restore StudioLayout"
            body="Move _legacy/components-hubify/StudioLayout.tsx into app/components/, rewrite imports from @/convex/_generated/api and @/lib/studio/* to the new paths."
          />
          <Step
            num={3}
            title="Wire GatewayProvider"
            body="Wrap layout.tsx in <GatewayProvider url={process.env.NEXT_PUBLIC_OPENCLAW_URL} /> so all pages can use the SDK hooks."
          />
          <Step
            num={4}
            title="Hook up template marketplace"
            body="Port /templates and /store routes from _legacy/app-hubify to the new app/ directory. Swap Convex queries for the chosen backend."
          />
        </ul>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Available SDK hooks</h2>
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
          <div>
            Claws Studio &middot; salvaged from hubify on 2026-04-08 &middot;
            status: NOT YET RUNNABLE END-TO-END
          </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#141414] p-4">
      <div className="text-xs uppercase tracking-wide text-[#737373]">
        {label}
      </div>
      <div className="mt-2 font-mono text-2xl text-[#ededed]">{value}</div>
    </div>
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
