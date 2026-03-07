/**
 * `claws init` — Legacy workspace scaffold. Delegates to onboard.
 */

import { banner, hint, blank, fmt } from "../ui.mjs";

export async function runInit(rawArgs = []) {
  banner("init");

  console.log(`  ${fmt.dim("claws init")} has been replaced by ${fmt.cyan("claws onboard")}.`);
  blank();
  hint(`  Run ${fmt.cyan("claws onboard")} for the full guided setup.`);
  hint(`  Run ${fmt.cyan("claws onboard --yes")} for non-interactive mode.`);
  blank();

  // Auto-forward if --yes is provided
  if (rawArgs.includes("--yes") || rawArgs.includes("-y")) {
    const { runOnboard } = await import("./onboard.mjs");
    await runOnboard(rawArgs);
  }
}
