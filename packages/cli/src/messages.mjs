/**
 * Reusable copy pool for the Claws CLI.
 *
 * Tone: dry, clever, short, slightly absurd, crustacean-meets-robot.
 * Not every step should be funny. Mix clear messages with occasional delightful ones.
 */

// ─── Boot / Wake ────────────────────────────────────────────────
export const BOOT = [
  "Waking the claws…",
  "Stretching the pincers…",
  "Shaking sand out of the shell…",
  "Surfacing gently…",
  "Clicking into existence…",
  "Booting the crustacean cortex…",
  "Looking around suspiciously…",
  "Finding the nearest tidepool…",
  "Pouring my coffee…",
  "Getting my bearings on the seafloor…",
];

// ─── Setup / Install ───────────────────────────────────────────
export const SETUP = [
  "Pinching the code into place…",
  "Arranging pebbles in the workspace…",
  "Tidying the tidepool…",
  "Wiring the shell…",
  "Crawling through the config…",
  "Nesting into the filesystem…",
  "Anchoring the workspace…",
  "Laying down the coral foundations…",
  "Sorting the sand grains…",
  "Clicking things into alignment…",
];

// ─── Sniffing / Checking ───────────────────────────────────────
export const CHECK = [
  "Sniffing around for env vars…",
  "Tapping the glass on the runtime…",
  "Sifting through the sand…",
  "Following the current…",
  "Checking the tide…",
  "Scanning for loose ends…",
  "Counting my claws…",
  "Looking for missing pieces…",
  "Snapping to attention…",
  "Peeking into the logs…",
  "Listening for strange splashes…",
  "Reading the room temperature of the ocean…",
];

// ─── Working / Processing ──────────────────────────────────────
export const WORKING = [
  "Dusting off the dashboard…",
  "Polishing the shell…",
  "Spinning up the current…",
  "Carefully rearranging things…",
  "Wiring neurons to pincers…",
  "Calibrating the claw pressure…",
  "Making tiny adjustments…",
  "Connecting the pieces…",
  "Running through the checklist…",
  "Preparing the tidepool…",
];

// ─── Completion / Confidence ───────────────────────────────────
export const DONE = [
  "Claws are sharp. Ready when you are.",
  "Tide looks good. Let's build.",
  "Shell secured. Systems nominal.",
  "Workspace is live. Try not to spill coffee on it.",
  "Everything's humming under the surface.",
  "Ready to pinch through some work.",
  "I'm awake. Let's make something useful.",
  "The tide is in. You're good to go.",
  "All pincers accounted for.",
  "Good to go. The ocean is calm.",
];

// ─── Welcome / Greeting ───────────────────────────────────────
export const WELCOME = [
  "Hey. I'm Claws.",
  "Claws here. Let's get set up.",
  "Hello from the seafloor.",
  "Morning. Or evening. I live underwater, I can't tell.",
  "Claws, reporting for duty.",
];

// ─── Error / Warning ──────────────────────────────────────────
export const OOPS = [
  "That doesn't look right.",
  "Something's off.",
  "Hmm. A loose end.",
  "Found a crack in the shell.",
  "That's going to need attention.",
];

// ─── Misc / Filler ─────────────────────────────────────────────
export const MISC = [
  "One sec…",
  "Almost there…",
  "Hang on…",
  "Bear with me…",
  "Nearly done…",
];

/**
 * Pick a deterministic-ish message from a pool based on a seed.
 * Falls back to random if no seed is given.
 */
export function pick(pool, seed) {
  if (seed !== undefined) {
    let hash = 0;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) % 2147483647;
    }
    return pool[Math.abs(hash) % pool.length];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Pick a random message from a pool. Simple.
 */
export function rand(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}
