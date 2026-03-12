export type SandboxProvider = "vercel" | "local" | "none";

export function resolveSandboxConfig(): {
  enabled: boolean;
  provider: SandboxProvider;
} {
  const enabled =
    String(process.env.CLAWS_SANDBOX_ENABLED ?? "false") === "true";
  const provider = (process.env.CLAWS_SANDBOX_PROVIDER ?? "none") as SandboxProvider;
  return { enabled, provider };
}

async function runWithVercelSandbox(code: string, language?: string): Promise<{
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}> {
  try {
    // Dynamic import; @vercel/sandbox may not be installed
    const mod = await (Function("return import('@vercel/sandbox')")() as Promise<{ Sandbox?: { create: (opts: unknown) => Promise<{ runCommand: (opts: unknown) => Promise<unknown> }> } }>).catch(() => null);
    if (!mod?.Sandbox) {
      return {
        ok: false,
        error: "Vercel Sandbox SDK not installed. Run: pnpm add @vercel/sandbox (requires Node.js 22+).",
      };
    }

    const runtime = language === "python" ? "python3" : "node24";
    const sandbox = await mod.Sandbox.create({
      source: { type: "empty" as const },
      runtime,
    });

    const cmd = runtime === "python3" ? "python3" : "node";
    const args = runtime === "python3" ? ["-c", code] : ["-e", code];

    const chunksOut: Buffer[] = [];
    const chunksErr: Buffer[] = [];
    const outStream = {
      write(chunk: Buffer | string, ...args: unknown[]) {
        chunksOut.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const cb = args[args.length - 1];
        if (typeof cb === "function") (cb as () => void)();
      },
      end(chunk?: Buffer | string, ...args: unknown[]) {
        if (chunk) chunksOut.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const cb = args[args.length - 1];
        if (typeof cb === "function") (cb as () => void)();
      },
    };
    const errStream = {
      write(chunk: Buffer | string, ...args: unknown[]) {
        chunksErr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const cb = args[args.length - 1];
        if (typeof cb === "function") (cb as () => void)();
      },
      end(chunk?: Buffer | string, ...args: unknown[]) {
        if (chunk) chunksErr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const cb = args[args.length - 1];
        if (typeof cb === "function") (cb as () => void)();
      },
    };

    const result = await sandbox.runCommand({
      cmd,
      args,
      stdout: outStream as NodeJS.WritableStream,
      stderr: errStream as NodeJS.WritableStream,
    });

    const stdout = chunksOut.length ? Buffer.concat(chunksOut).toString("utf8") : "";
    const stderr = chunksErr.length ? Buffer.concat(chunksErr).toString("utf8") : "";
    const exitCode = typeof (result as { exitCode?: number }).exitCode === "number"
      ? (result as { exitCode: number }).exitCode
      : undefined;

    return {
      ok: exitCode === 0,
      stdout: stdout || undefined,
      stderr: stderr || undefined,
      exitCode,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function createSandboxTools() {
  return {
    "sandbox.exec": async (args: Record<string, unknown>) => {
      const config = resolveSandboxConfig();

      if (!config.enabled) {
        return {
          ok: false,
          error:
            "Sandbox is disabled. Set CLAWS_SANDBOX_ENABLED=true and CLAWS_SANDBOX_PROVIDER=vercel|local to enable.",
          config,
        };
      }

      if (config.provider === "vercel") {
        const code = typeof args.code === "string" ? args.code : "";
        const language = typeof args.language === "string" ? args.language : undefined;
        if (!code.trim()) {
          return { ok: false, error: "Missing code", config };
        }
        const result = await runWithVercelSandbox(code, language);
        return { ...result, config };
      }

      if (config.provider === "local") {
        return {
          ok: false,
          error:
            "Local sandbox adapter not yet implemented. Use Vercel Sandbox for untrusted code.",
          config,
        };
      }

      return {
        ok: false,
        error: `Unknown sandbox provider: ${config.provider}`,
        config,
      };
    },
  };
}
