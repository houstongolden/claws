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
        return {
          ok: false,
          error:
            "Vercel Sandbox adapter not yet wired. Requires @vercel/sandbox SDK.",
          config,
        };
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
