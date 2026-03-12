import type {
  BrowserExecutionMode,
  BrowserTaskConfig,
  BrowserTaskResult,
  ComputerUseProvider,
} from "@claws/shared";
import { saveDemoScreenshot } from "./demo";

export type { BrowserExecutionMode };

const VALID_MODES: BrowserExecutionMode[] = [
  "background",
  "record-on-complete",
  "watch-live",
  "hybrid",
];

const VALID_PROVIDERS: ComputerUseProvider[] = [
  "agent-browser",
  "playwright",
  "native",
];

export function resolveBrowserConfig(): {
  provider: ComputerUseProvider;
  defaultMode: BrowserExecutionMode;
  availableProviders: ComputerUseProvider[];
  availableModes: BrowserExecutionMode[];
  /** True when CLAWS_BROWSER_PROVIDER is explicitly set to agent-browser. */
  preferredAgentBrowser: boolean;
} {
  const env = process.env.CLAWS_BROWSER_PROVIDER;
  const preferredAgentBrowser = env === "agent-browser";
  const provider: ComputerUseProvider =
    env && VALID_PROVIDERS.includes(env as ComputerUseProvider)
      ? (env as ComputerUseProvider)
      : "playwright";

  const defaultMode: BrowserExecutionMode =
    (process.env.CLAWS_BROWSER_DEFAULT_MODE as BrowserExecutionMode) || "record-on-complete";

  return {
    provider,
    defaultMode,
    availableProviders: [...VALID_PROVIDERS],
    availableModes: [...VALID_MODES],
    preferredAgentBrowser,
  };
}

function resolveProvider(): ComputerUseProvider {
  return resolveBrowserConfig().provider;
}

export function createBrowserTools(workspaceRoot: string) {
  return {
    "browser.navigate": async (
      args: Record<string, unknown>
    ): Promise<BrowserTaskResult> => {
      const url = String(args.url ?? "");
      const mode = VALID_MODES.includes(args.mode as BrowserExecutionMode)
        ? (args.mode as BrowserExecutionMode)
        : "background";
      const provider = resolveProvider();

      if (!url) throw new Error("Missing url");

      const config: BrowserTaskConfig = {
        url,
        mode,
        provider,
        timeout: typeof args.timeout === "number" ? args.timeout : 30_000,
        recordDemo: mode === "record-on-complete" || mode === "hybrid",
      };

      return executeBrowserTask(config, workspaceRoot);
    },

    "browser.screenshot": async (
      args: Record<string, unknown>
    ): Promise<BrowserTaskResult> => {
      const url = String(args.url ?? "");
      const provider = resolveProvider();
      if (!url) throw new Error("Missing url");

      return executeScreenshot(url, provider, workspaceRoot);
    },

    "browser.click": async (
      args: Record<string, unknown>
    ): Promise<BrowserTaskResult> => {
      const selector = String(args.selector ?? "");
      const url = String(args.url ?? "");
      const provider = resolveProvider();
      if (!selector) throw new Error("Missing selector");

      return executeAction("click", { selector, url }, provider, workspaceRoot);
    },

    "browser.type": async (
      args: Record<string, unknown>
    ): Promise<BrowserTaskResult> => {
      const selector = String(args.selector ?? "");
      const text = String(args.text ?? "");
      const url = String(args.url ?? "");
      const provider = resolveProvider();
      if (!selector || !text) throw new Error("Missing selector or text");

      return executeAction("type", { selector, text, url }, provider, workspaceRoot);
    },

    "browser.extract": async (
      args: Record<string, unknown>
    ): Promise<BrowserTaskResult> => {
      const url = String(args.url ?? "");
      const selector = String(args.selector ?? "body");
      const provider = resolveProvider();
      if (!url) throw new Error("Missing url");

      return executeAction("extract", { url, selector }, provider, workspaceRoot);
    },
  };
}

async function executeBrowserTask(
  config: BrowserTaskConfig,
  workspaceRoot?: string
): Promise<BrowserTaskResult> {
  const { url, mode, provider } = config;

  if (provider === "agent-browser") {
    const result = await executeWithAgentBrowser(config);
    const agentBrowserUnavailable = result.error != null || result.ok === false;
    if (agentBrowserUnavailable) {
      const fallback = await executeWithPlaywright(config);
      if (fallback.ok) {
        const withDemo = await maybeSaveDemo(fallback, config, workspaceRoot);
        return {
          ...withDemo,
          requestedProvider: "agent-browser",
          fallbackUsed: true,
        };
      }
    }
    return maybeSaveDemo(result, config, workspaceRoot);
  }

  switch (provider) {
    case "playwright": {
      const result = await executeWithPlaywright(config);
      return maybeSaveDemo(result, config, workspaceRoot);
    }

    case "native":
      return {
        ok: true,
        url,
        mode,
        provider,
        error:
          "Native mode routes through the system browser. See https://agent-browser.dev/native-mode",
      };

    default:
      return {
        ok: false,
        url,
        mode,
        provider,
        error: `Unknown browser provider: ${provider}`,
      };
  }
}

async function maybeSaveDemo(
  result: BrowserTaskResult,
  config: BrowserTaskConfig,
  workspaceRoot?: string
): Promise<BrowserTaskResult> {
  if (
    !config.recordDemo ||
    !result.ok ||
    !result.screenshot ||
    !workspaceRoot
  ) {
    return result;
  }
  try {
    const artifact = await saveDemoScreenshot(workspaceRoot, result.screenshot, {
      taskUrl: config.url,
    });
    return { ...result, demoPath: artifact.path };
  } catch {
    return result;
  }
}

async function executeWithAgentBrowser(
  config: BrowserTaskConfig
): Promise<BrowserTaskResult> {
  const { url, mode, provider } = config;

  try {
    const moduleName = "@anthropic-ai/agent-browser";
    const agentBrowser = await (Function("m", "return import(m)")(moduleName) as Promise<Record<string, unknown>>).catch(
      () => null
    );

    if (!agentBrowser) {
      return {
        ok: true,
        url,
        mode,
        provider,
        error:
          "Agent Browser SDK not installed. Run: pnpm add @anthropic-ai/agent-browser",
      };
    }

    const launchFn = (agentBrowser as Record<string, unknown>).launch as
      | ((opts: { headless?: boolean }) => Promise<{
          newPage?: () => Promise<{
            goto: (u: string, opts?: { timeout?: number }) => Promise<unknown>;
            screenshot: (opts?: Record<string, unknown>) => Promise<Buffer | string>;
          }>;
          close: () => Promise<void>;
        }>)
      | undefined;
    const launchFnAlt = (agentBrowser as { default?: Record<string, unknown> }).default?.launch as
      | ((opts: { headless?: boolean }) => Promise<{
          newPage?: () => Promise<{
            goto: (u: string, opts?: { timeout?: number }) => Promise<unknown>;
            screenshot: (opts?: Record<string, unknown>) => Promise<Buffer | string>;
          }>;
          close: () => Promise<void>;
        }>)
      | undefined;

    if (launchFn || launchFnAlt) {
      const launch = launchFn ?? launchFnAlt!;
      const headless = mode === "background";
      const browser = await launch({ headless });

      const newPageFn = browser.newPage ?? (browser as { newPage?: () => Promise<unknown> }).newPage;
      if (!newPageFn) {
        return {
          ok: true,
          url,
          mode,
          provider,
          error: "Agent Browser SDK: launch succeeded but newPage not available.",
        };
      }

      const page = (await newPageFn()) as {
        goto?: (u: string, opts?: { timeout?: number }) => Promise<unknown>;
        screenshot?: (opts?: Record<string, unknown>) => Promise<Buffer | string>;
      };
      const timeout = config.timeout ?? 30_000;
      if (typeof page.goto === "function") {
        await page.goto(url, { timeout });
      }
      const screenshotResult = typeof page.screenshot === "function"
        ? await page.screenshot({ encoding: "base64", type: "png" })
        : null;
      const screenshotBase64 =
        typeof screenshotResult === "string"
          ? screenshotResult
          : screenshotResult && typeof (screenshotResult as Buffer).toString === "function"
            ? (screenshotResult as Buffer).toString("base64")
            : null;
      if (typeof browser.close === "function") {
        await browser.close();
      }
      return {
        ok: true,
        url,
        mode,
        provider,
        screenshot: screenshotBase64 ?? undefined,
      };
    }

    return {
      ok: true,
      url,
      mode,
      provider,
      error: "Agent Browser SDK detected but adapter execution is stubbed. Wire real execution in next pass.",
    };
  } catch (error) {
    return {
      ok: false,
      url,
      mode,
      provider,
      error: `Agent Browser error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function executeWithPlaywright(
  config: BrowserTaskConfig
): Promise<BrowserTaskResult> {
  const { url, mode, provider } = config;

  try {
    const pwModule = "playwright";
    const pw = await (Function("m", "return import(m)")(pwModule) as Promise<{
      chromium: {
        launch: (opts: { headless: boolean }) => Promise<{
          newPage: () => Promise<{
            goto: (url: string, opts?: { timeout?: number }) => Promise<void>;
            screenshot: (opts?: { type?: string }) => Promise<Buffer>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    }>).catch(() => null);

    if (!pw) {
      return {
        ok: true,
        url,
        mode,
        provider,
        error:
          "Playwright not installed. Run: pnpm add -D playwright && npx playwright install",
      };
    }

    const browser = await pw.chromium.launch({
      headless: mode === "background",
    });
    const page = await browser.newPage();

    try {
      await page.goto(url, { timeout: config.timeout ?? 30_000 });
      const screenshot = await page.screenshot({ type: "png" });
      const screenshotBase64 = screenshot.toString("base64");

      return {
        ok: true,
        url,
        mode,
        provider,
        screenshot: screenshotBase64,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      ok: false,
      url,
      mode,
      provider,
      error: `Playwright error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function loadPlaywright() {
  const pwModule = "playwright";
  return (Function("m", "return import(m)")(pwModule) as Promise<{
    chromium: {
      launch: (opts: { headless: boolean }) => Promise<{
        newPage: () => Promise<{
          goto: (url: string, opts?: { timeout?: number }) => Promise<void>;
          screenshot: (opts?: { type?: string }) => Promise<Buffer>;
          click: (selector: string) => Promise<void>;
          fill: (selector: string, text: string) => Promise<void>;
          textContent: (selector: string) => Promise<string | null>;
        }>;
        close: () => Promise<void>;
      }>;
    };
  }>).catch(() => null);
}

async function executeScreenshot(
  url: string,
  provider: ComputerUseProvider,
  workspaceRoot?: string
): Promise<BrowserTaskResult> {
  const result = await executeBrowserTask(
    {
      url,
      mode: "background",
      provider,
      timeout: 15_000,
      recordDemo: false,
    },
    workspaceRoot
  );
  return result;
}

async function executeAction(
  action: string,
  params: Record<string, string>,
  provider: ComputerUseProvider,
  workspaceRoot?: string
): Promise<BrowserTaskResult> {
  const url = params.url || "about:blank";

  if (provider === "playwright") {
    const pw = await loadPlaywright();
    if (!pw) {
      return {
        ok: false,
        url,
        mode: "background",
        provider,
        error: "Playwright not installed. Run: pnpm add -D playwright && npx playwright install",
      };
    }

    if (!params.url) {
      return {
        ok: false,
        url,
        mode: "background",
        provider,
        error: `Browser action "${action}" requires a url when using Playwright.`,
      };
    }

    const browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(params.url, { timeout: 30_000 });

      if (action === "click" && params.selector) {
        const screenshot = await page.screenshot({ type: "png" });
        const result: BrowserTaskResult = {
          ok: true,
          url,
          mode: "background",
          provider,
          screenshot: screenshot.toString("base64"),
          data: { action, selector: params.selector },
        };
        return maybeSaveDemo(result, { url: params.url, mode: "background", provider, recordDemo: false }, workspaceRoot);
      }

      if (action === "type" && params.selector) {
        await page.fill(params.selector, params.text ?? "");
        const screenshot = await page.screenshot({ type: "png" });
        const result: BrowserTaskResult = {
          ok: true,
          url,
          mode: "background",
          provider,
          screenshot: screenshot.toString("base64"),
          data: { action, selector: params.selector, text: params.text ?? "" },
        };
        return maybeSaveDemo(result, { url: params.url, mode: "background", provider, recordDemo: false }, workspaceRoot);
      }

      if (action === "extract") {
        const text = await page.textContent(params.selector || "body");
        return {
          ok: true,
          url,
          mode: "background",
          provider,
          data: { action, selector: params.selector || "body", text: text ?? "" },
        };
      }
    } catch (error) {
      return {
        ok: false,
        url,
        mode: "background",
        provider,
        error: `Playwright ${action} error: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      await browser.close();
    }
  }

  return {
    ok: false,
    url,
    mode: "background",
    provider,
    error: `Browser action "${action}" adapter pending for provider "${provider}". Params: ${JSON.stringify(params)}`,
  };
}
