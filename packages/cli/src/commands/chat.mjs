import { banner, fail, success, hint, blank, fmt } from "../ui.mjs";
import { loadConfig } from "../config.mjs";
import { resolveGatewayUrl } from "../probe.mjs";

export async function runChat(args = []) {
  const message = args.join(" ").trim();
  if (!message) {
    banner("chat");
    console.log(`  Send a message to the running Claws gateway.`);
    blank();
    console.log(`  ${fmt.bold("Usage")}`);
    console.log(`    ${fmt.cyan("claws chat")} ${fmt.dim('"your message here"')}`);
    blank();
    console.log(`  ${fmt.bold("Examples")}`);
    console.log(`    ${fmt.dim("$")} claws chat "What tasks are open?"`);
    console.log(`    ${fmt.dim("$")} claws chat "Summarize my workspace"`);
    blank();
    process.exitCode = 1;
    return;
  }

  const config = await loadConfig();
  const baseUrl = resolveGatewayUrl(config);

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      fail(`Gateway returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      process.exitCode = 1;
      return;
    }

    const data = await res.json();

    // Format the response
    if (data.reply || data.content || data.message) {
      const reply = data.reply || data.content || data.message;
      blank();
      console.log(`  ${fmt.cyan("ᐳᐸ")} ${reply}`);
      blank();
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    if (err?.name === "TimeoutError") {
      fail("Gateway did not respond within 30s");
    } else {
      fail(`Could not reach gateway at ${fmt.cyan(baseUrl)}`);
    }
    hint(`  Make sure the gateway is running: ${fmt.cyan("claws gateway")}`);
    hint(`  Check health: ${fmt.cyan("claws doctor")}`);
    process.exitCode = 1;
  }
}
