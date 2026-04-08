/**
 * Interactive REPL — the default mode when `claws` is run with no args.
 *
 * Features:
 *  - SSE streaming chat with live terminal rendering
 *  - Tool call display with box-drawing
 *  - Slash commands: /status, /doctor, /help, /model, /clear, /quit
 *  - Session history within the REPL
 *  - Braille spinner during thinking
 */

import { createInterface } from "node:readline";
import { loadConfig } from "../config.mjs";
import { resolveGatewayUrl, fetchGateway } from "../probe.mjs";
import { fmt, banner, blank, success, fail, hint, hr } from "../ui.mjs";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const SLASH_COMMANDS = {
  "/help": "Show available commands",
  "/status": "Quick runtime summary",
  "/doctor": "Run health check",
  "/model": "Show or set AI model",
  "/clear": "Clear conversation history",
  "/tools": "List available tools",
  "/quit": "Exit the REPL",
  "/exit": "Exit the REPL",
};

export async function runRepl(initialPrompt) {
  const config = await loadConfig();
  const baseUrl = resolveGatewayUrl(config);

  // Check gateway is reachable
  try {
    const status = await fetchGateway(baseUrl, "/api/status", 3000);
    if (!status?.ok) throw new Error("not ok");
  } catch {
    blank();
    fail("Gateway is not running");
    hint(`  Start it with: ${fmt.cyan("claws gateway")}`);
    hint(`  Then try again: ${fmt.cyan("claws")}`);
    blank();
    process.exitCode = 1;
    return;
  }

  // Fetch status for model info
  let aiModel = config?.ai?.model || "unknown";
  try {
    const st = await fetchGateway(baseUrl, "/api/status", 3000);
    if (st?.status?.ai?.model) aiModel = st.status.ai.model;
  } catch {}

  blank();
  console.log(`  ${fmt.cyan("🦞")} ${fmt.bold("Claws")} ${fmt.dim("— interactive mode")}`);
  console.log(`  ${fmt.dim("Model:")} ${fmt.cyan(aiModel)}  ${fmt.dim("Gateway:")} ${fmt.green("●")} ${fmt.dim(baseUrl)}`);
  console.log(`  ${fmt.dim("Type a message to chat. /help for commands. /quit to exit.")}`);
  blank();

  const history = [];

  // Handle initial prompt if provided (one-shot style but in REPL context)
  if (initialPrompt) {
    await streamChat(baseUrl, initialPrompt, history);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `  ${fmt.cyan("›")} `,
    terminal: process.stdin.isTTY !== false,
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    // Slash commands
    if (input.startsWith("/")) {
      await handleSlashCommand(input, baseUrl, history, rl);
      rl.prompt();
      return;
    }

    // Chat
    await streamChat(baseUrl, input, history);
    rl.prompt();
  });

  rl.on("close", () => {
    blank();
    console.log(`  ${fmt.dim("🦞 See you.")}`);
    blank();
    process.exit(0);
  });
}

async function handleSlashCommand(input, baseUrl, history, rl) {
  const [cmd, ...args] = input.split(/\s+/);

  switch (cmd) {
    case "/help":
    case "/h":
      blank();
      console.log(`  ${fmt.bold("Commands")}`);
      for (const [name, desc] of Object.entries(SLASH_COMMANDS)) {
        const padded = name.padEnd(14);
        console.log(`    ${fmt.cyan(padded)} ${fmt.dim(desc)}`);
      }
      blank();
      break;

    case "/status":
    case "/st":
      try {
        const st = await fetchGateway(baseUrl, "/api/status", 5000);
        const s = st?.status;
        blank();
        console.log(`  ${fmt.bold("Status")}`);
        console.log(`    ${fmt.dim("AI:")}         ${fmt.cyan(s?.ai?.model || "unknown")} via ${s?.ai?.provider || "unknown"}`);
        console.log(`    ${fmt.dim("Tools:")}      ${s?.registeredTools?.length || 0} registered`);
        console.log(`    ${fmt.dim("Agents:")}     ${s?.agents?.map(a => a.id).join(", ") || "none"}`);
        console.log(`    ${fmt.dim("Workflows:")}  ${s?.workflows?.count || 0}`);
        console.log(`    ${fmt.dim("Approvals:")}  ${s?.approvals?.pending || 0} pending`);
        blank();
      } catch {
        fail("Could not reach gateway");
      }
      break;

    case "/doctor":
      try {
        const { runDoctor } = await import("./doctor.mjs");
        await runDoctor([]);
      } catch (e) {
        fail(e.message);
      }
      break;

    case "/model":
      if (args.length > 0) {
        hint(`  Model switching in REPL not yet supported. Set AI_MODEL in .env.local.`);
      } else {
        try {
          const st = await fetchGateway(baseUrl, "/api/status", 3000);
          console.log(`  ${fmt.dim("Current model:")} ${fmt.cyan(st?.status?.ai?.model || "unknown")}`);
          console.log(`  ${fmt.dim("Provider:")}      ${st?.status?.ai?.provider || "unknown"}`);
        } catch {
          fail("Could not reach gateway");
        }
      }
      break;

    case "/tools":
      try {
        const st = await fetchGateway(baseUrl, "/api/status", 3000);
        const tools = st?.status?.registeredTools || [];
        blank();
        console.log(`  ${fmt.bold("Tools")} ${fmt.dim(`(${tools.length})`)}`);
        const cols = 3;
        for (let i = 0; i < tools.length; i += cols) {
          const row = tools.slice(i, i + cols).map(t => fmt.dim(t.padEnd(24))).join("");
          console.log(`    ${row}`);
        }
        blank();
      } catch {
        fail("Could not reach gateway");
      }
      break;

    case "/clear":
      history.length = 0;
      console.log(`  ${fmt.dim("Conversation cleared.")}`);
      break;

    case "/quit":
    case "/exit":
    case "/q":
      rl.close();
      break;

    default:
      console.log(`  ${fmt.dim("Unknown command:")} ${fmt.red(cmd)}`);
      console.log(`  ${fmt.dim("Try /help")}`);
  }
}

async function streamChat(baseUrl, message, history) {
  history.push({ role: "user", content: message });

  // Start spinner
  let spinnerFrame = 0;
  let spinnerInterval;
  let isThinking = true;

  if (process.stdout.isTTY) {
    spinnerInterval = setInterval(() => {
      if (isThinking) {
        const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
        process.stdout.write(`\r  ${fmt.cyan(frame)} ${fmt.dim("Thinking...")}`);
        spinnerFrame++;
      }
    }, 80);
  }

  const stopSpinner = () => {
    isThinking = false;
    if (spinnerInterval) {
      clearInterval(spinnerInterval);
      if (process.stdout.isTTY) {
        process.stdout.write("\r" + " ".repeat(40) + "\r");
      }
    }
  };

  try {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(0, -1).slice(-20), // last 20 turns
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      stopSpinner();
      const errText = await res.text().catch(() => "");
      fail(`Gateway error ${res.status}: ${errText.slice(0, 200)}`);
      return;
    }

    // Read SSE stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let firstDelta = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process SSE events
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        let event;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        switch (event.type) {
          case "thinking":
            // Already showing spinner
            break;

          case "text-delta": {
            if (firstDelta) {
              stopSpinner();
              blank();
              process.stdout.write(`  ${fmt.cyan("🦞")} `);
              firstDelta = false;
            }
            const text = event.text || "";
            fullText += text;
            process.stdout.write(text);
            break;
          }

          case "tool_call": {
            if (firstDelta) {
              stopSpinner();
              blank();
              firstDelta = false;
            }
            const toolName = event.toolName || "unknown";
            const args = event.args || {};
            const argSummary = Object.entries(args)
              .map(([k, v]) => {
                const val = typeof v === "string" ? v : JSON.stringify(v);
                return `${k}: ${val.length > 60 ? val.slice(0, 57) + "..." : val}`;
              })
              .join(", ");
            console.log();
            console.log(`  ${fmt.dim("╭─")} ${fmt.yellow(toolName)} ${fmt.dim("─")}`);
            if (argSummary) {
              console.log(`  ${fmt.dim("│")} ${fmt.dim(argSummary)}`);
            }
            break;
          }

          case "tool_result": {
            const ok = event.ok !== false;
            const icon = ok ? fmt.green("✓") : fmt.red("✗");
            const toolName = event.toolName || "";
            console.log(`  ${fmt.dim("╰─")} ${icon} ${fmt.dim(toolName)}`);
            break;
          }

          case "error": {
            stopSpinner();
            if (!firstDelta) console.log();
            blank();
            fail(event.error || "Stream error");

            // Show fallback hint if rate limited
            const msg = (event.error || "").toLowerCase();
            if (msg.includes("limit") || msg.includes("rate") || msg.includes("429")) {
              hint(`  The AI provider is rate-limited. The gateway will auto-fallback to other providers.`);
              hint(`  Or add more API keys in ${fmt.cyan(".env.local")}`);
            }
            break;
          }

          case "step_limit": {
            console.log();
            console.log(`  ${fmt.yellow("⚠")} ${fmt.dim(`Reached ${event.maxSteps} steps. Reply "Continue" for more.`)}`);
            break;
          }

          case "complete": {
            if (firstDelta && event.text) {
              stopSpinner();
              blank();
              console.log(`  ${fmt.cyan("🦞")} ${event.text}`);
              fullText = event.text;
            }
            // Add to history
            if (fullText || event.text) {
              history.push({ role: "assistant", content: fullText || event.text || "" });
            }
            break;
          }
        }
      }
    }

    stopSpinner();
    if (!firstDelta) {
      console.log(); // newline after streamed text
    }
    blank();
  } catch (err) {
    stopSpinner();
    if (err?.name === "TimeoutError") {
      fail("Request timed out (120s)");
    } else if (err?.cause?.code === "ECONNREFUSED") {
      fail("Gateway not reachable");
      hint(`  Start it with: ${fmt.cyan("claws gateway")}`);
    } else {
      fail(err.message || "Stream error");
    }
    blank();
  }
}
