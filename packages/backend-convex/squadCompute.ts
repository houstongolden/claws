// @ts-nocheck
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * FLY.IO SQUAD COMPUTE MANAGEMENT
 *
 * Provisions and manages Fly.io Machines for squad compute environments.
 * Each squad can have a dedicated machine with pre-installed tools.
 *
 * Env vars:
 *   npx convex env set FLY_API_TOKEN <token>
 *   npx convex env set FLY_APP_NAME hubify-squads  (or your app name)
 *   npx convex env set FLY_ORG_SLUG <your-org>
 *
 * Machine image: Ubuntu + Node.js + Python + standard research tools
 * Default size: shared-cpu-2x (2 vCPU, 512MB) — ~$5/mo when running
 *
 * Docs: https://fly.io/docs/machines/api/
 */

const FLY_API_BASE = "https://api.machines.dev/v1";

function getFlyToken(): string | null {
  return ((globalThis as any).process?.env?.FLY_API_TOKEN as string | undefined) || null;
}

function getFlyAppName(): string {
  return ((globalThis as any).process?.env?.FLY_APP_NAME as string | undefined) || "hubify-squads";
}

interface FlyMachine {
  id: string;
  name: string;
  state: string; // "created", "starting", "started", "stopping", "stopped", "destroying", "destroyed"
  region: string;
  instance_id: string;
  config: {
    image: string;
    size: string;
    env: Record<string, string>;
  };
  created_at: string;
  updated_at: string;
}

interface FlyMachineConfig {
  image: string;
  size?: string;
  env: Record<string, string>;
  guest?: {
    cpu_kind: string;
    cpus: number;
    memory_mb: number;
  };
  auto_destroy?: boolean;
  restart?: {
    policy: string;
  };
  services?: {
    ports: { port: number; handlers: string[] }[];
    protocol: string;
    internal_port: number;
  }[];
  mounts?: { volume: string; path: string }[];
  init?: {
    exec?: string[];
    cmd?: string[];
  };
  processes?: { cmd: string[] }[];
}

// ============================================================================
// Machine Lifecycle
// ============================================================================

/**
 * Provision a new Fly.io Machine for a squad.
 */
export const provisionMachine = internalAction({
  args: {
    squad_id: v.id("squads"),
    squad_name: v.string(),
    compute_class: v.union(v.literal("light"), v.literal("standard"), v.literal("heavy")),
    region: v.optional(v.string()), // e.g., "iad", "sjc", "lhr"
    env_vars: v.optional(v.any()), // Record<string, string>
  },
  handler: async (ctx, args) => {
    const token = getFlyToken();
    if (!token) {
      return { error: "FLY_API_TOKEN not set. Run: npx convex env set FLY_API_TOKEN <token>" };
    }

    const appName = getFlyAppName();
    const region = args.region || "iad"; // US East default

    // Map compute class to machine size
    const sizeMap: Record<string, { cpu_kind: string; cpus: number; memory_mb: number }> = {
      light: { cpu_kind: "shared", cpus: 1, memory_mb: 256 },
      standard: { cpu_kind: "shared", cpus: 2, memory_mb: 512 },
      heavy: { cpu_kind: "shared", cpus: 4, memory_mb: 1024 },
    };

    const guest = sizeMap[args.compute_class] || sizeMap.standard;

    const config: FlyMachineConfig = {
      image: "ubuntu:22.04",
      // size is determined by guest config, not passed to Fly API
      env: {
        SQUAD_ID: args.squad_id,
        SQUAD_NAME: args.squad_name,
        DEBIAN_FRONTEND: "noninteractive",
        ...(args.env_vars as Record<string, string> || {}),
      },
      guest,
      auto_destroy: false,
      restart: { policy: "on-failure" },
      services: [
        {
          ports: [{ port: 443, handlers: ["tls", "http"] }],
          protocol: "tcp",
          internal_port: 8080,
        },
      ],
    };

    const response = await fetch(`${FLY_API_BASE}/apps/${appName}/machines`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `squad-${args.squad_name}`,
        region,
        config,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine creation failed (${response.status}): ${text}`);
      return { error: `Fly.io API returned ${response.status}: ${text}` };
    }

    const machine: FlyMachine = await response.json();

    // Store machine ID on the squad
    await ctx.runMutation(internal.squadCompute.updateSquadMachine, {
      squad_id: args.squad_id,
      machine_id: machine.id,
      machine_state: machine.state,
      region: machine.region,
    });

    return {
      machine_id: machine.id,
      state: machine.state,
      region: machine.region,
    };
  },
});

/**
 * Start a stopped machine.
 */
export const startMachine = internalAction({
  args: {
    machine_id: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}/start`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine start failed (${response.status}): ${text}`);
      return { error: `Failed to start machine: ${text}` };
    }

    return { success: true, state: "starting" };
  },
});

/**
 * Stop a running machine.
 */
export const stopMachine = internalAction({
  args: {
    machine_id: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}/stop`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine stop failed (${response.status}): ${text}`);
      return { error: `Failed to stop machine: ${text}` };
    }

    return { success: true, state: "stopping" };
  },
});

/**
 * Destroy a machine permanently.
 */
export const destroyMachine = internalAction({
  args: {
    machine_id: v.string(),
    squad_id: v.id("squads"),
  },
  handler: async (ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}?force=true`,
      {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine destroy failed (${response.status}): ${text}`);
      return { error: `Failed to destroy machine: ${text}` };
    }

    // Clear machine info from squad
    await ctx.runMutation(internal.squadCompute.updateSquadMachine, {
      squad_id: args.squad_id,
      machine_id: "",
      machine_state: "destroyed",
      region: "",
    });

    return { success: true };
  },
});

// ============================================================================
// Machine Status & Monitoring
// ============================================================================

/**
 * Get current machine status.
 */
export const getMachineStatus = internalAction({
  args: {
    machine_id: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}`,
      {
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine status failed (${response.status}): ${text}`);
      return { error: `Failed to get machine status: ${text}` };
    }

    const machine: FlyMachine = await response.json();
    return {
      id: machine.id,
      name: machine.name,
      state: machine.state,
      region: machine.region,
      created_at: machine.created_at,
      updated_at: machine.updated_at,
    };
  },
});

/**
 * List all machines for the Fly.io app.
 */
export const listMachines = internalAction({
  args: {},
  handler: async (_ctx) => {
    const token = getFlyToken();
    if (!token) return { machines: [], error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines`,
      {
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io list machines failed (${response.status}): ${text}`);
      return { machines: [], error: `Failed to list machines: ${text}` };
    }

    const machines: FlyMachine[] = await response.json();
    return {
      machines: machines.map((m) => ({
        id: m.id,
        name: m.name,
        state: m.state,
        region: m.region,
      })),
    };
  },
});

/**
 * Execute a command on a running machine via Fly.io exec.
 */
export const execCommand = internalAction({
  args: {
    machine_id: v.string(),
    command: v.array(v.string()), // e.g., ["python3", "script.py"]
    timeout_seconds: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();
    const timeout = args.timeout_seconds || 60;

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}/exec`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cmd: args.command.join(" "),
          timeout: timeout,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io exec failed (${response.status}): ${text}`);
      return { error: `Exec failed: ${text}`, stdout: "", stderr: "", exit_code: -1 };
    }

    const result = await response.json();
    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      exit_code: result.exit_code ?? 0,
    };
  },
});

// ============================================================================
// Internal Mutations — Update squad records
// ============================================================================

export const updateSquadMachine = internalMutation({
  args: {
    squad_id: v.id("squads"),
    machine_id: v.string(),
    machine_state: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    const squad = await ctx.db.get(args.squad_id);
    if (!squad) return;

    await ctx.db.patch(args.squad_id, {
      compute_environment: {
        ...squad.compute_environment,
        runtime: "fly-machines",
        fly_machine_id: args.machine_id,
        fly_machine_state: args.machine_state,
        fly_region: args.region,
      } as any,
    });
  },
});

/**
 * Get squad compute status from DB.
 */
export const getSquadComputeStatus = internalQuery({
  args: {
    squad_id: v.id("squads"),
  },
  handler: async (ctx, args) => {
    const squad = await ctx.db.get(args.squad_id);
    if (!squad) return null;

    return {
      compute_environment: squad.compute_environment || null,
      has_machine: !!squad.compute_environment?.runtime,
    };
  },
});

// ============================================================================
// Volume Management
// ============================================================================

/**
 * Create a persistent volume on Fly.io.
 */
export const createVolume = internalAction({
  args: {
    name: v.string(),
    region: v.optional(v.string()),
    size_gb: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(`${FLY_API_BASE}/apps/${appName}/volumes`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        region: args.region || "iad",
        size_gb: args.size_gb || 10,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io volume creation failed (${response.status}): ${text}`);
      return { volume_id: "", name: args.name, size_gb: args.size_gb || 10, region: args.region || "iad", error: `Failed to create volume: ${text}` };
    }

    const volume = await response.json();
    return {
      volume_id: volume.id,
      name: volume.name,
      size_gb: volume.size_gb,
      region: volume.region,
    };
  },
});

/**
 * List all volumes for the Fly.io app.
 */
export const listVolumes = internalAction({
  args: {},
  handler: async (_ctx) => {
    const token = getFlyToken();
    if (!token) return { volumes: [], error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(`${FLY_API_BASE}/apps/${appName}/volumes`, {
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io list volumes failed (${response.status}): ${text}`);
      return { volumes: [], error: `Failed to list volumes: ${text}` };
    }

    const volumes: any[] = await response.json();
    return {
      volumes: volumes.map((vol) => ({
        id: vol.id,
        name: vol.name,
        size_gb: vol.size_gb,
        region: vol.region,
        state: vol.state,
      })),
    };
  },
});

/**
 * Delete a volume on Fly.io.
 */
export const deleteVolume = internalAction({
  args: {
    volume_id: v.string(),
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { success: false, error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    const response = await fetch(
      `${FLY_API_BASE}/apps/${appName}/volumes/${args.volume_id}`,
      {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io volume delete failed (${response.status}): ${text}`);
      return { success: false, error: `Failed to delete volume: ${text}` };
    }

    return { success: true };
  },
});

// ============================================================================
// Machine + Volume Provisioning
// ============================================================================

/**
 * Provision a machine with a persistent volume mounted at /workspace.
 */
export const provisionMachineWithVolume = internalAction({
  args: {
    squad_id: v.id("squads"),
    squad_name: v.string(),
    compute_class: v.union(v.literal("light"), v.literal("standard"), v.literal("heavy")),
    region: v.optional(v.string()),
    env_vars: v.optional(v.any()),
    volume_size_gb: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const token = getFlyToken();
    if (!token) {
      return { error: "FLY_API_TOKEN not set. Run: npx convex env set FLY_API_TOKEN <token>" };
    }

    const appName = getFlyAppName();
    const region = args.region || "iad";

    // Step 1: Create a volume
    const volumeResult: any = await ctx.runAction(internal.squadCompute.createVolume, {
      name: `squad_${args.squad_name.replace(/[^a-z0-9]/g, "_")}_vol`,
      region,
      size_gb: args.volume_size_gb || 10,
    });

    if (volumeResult.error) {
      return { error: `Volume creation failed: ${volumeResult.error}` };
    }

    // Step 2: Provision machine with the volume mounted
    const sizeMap: Record<string, { cpu_kind: string; cpus: number; memory_mb: number }> = {
      light: { cpu_kind: "shared", cpus: 1, memory_mb: 256 },
      standard: { cpu_kind: "shared", cpus: 2, memory_mb: 512 },
      heavy: { cpu_kind: "shared", cpus: 4, memory_mb: 1024 },
    };

    const guest = sizeMap[args.compute_class] || sizeMap.standard;

    const config: FlyMachineConfig = {
      image: "ubuntu:22.04",
      // size is determined by guest config, not passed to Fly API
      env: {
        SQUAD_ID: args.squad_id,
        SQUAD_NAME: args.squad_name,
        DEBIAN_FRONTEND: "noninteractive",
        ...(args.env_vars as Record<string, string> || {}),
      },
      guest,
      auto_destroy: false,
      restart: { policy: "on-failure" },
      services: [
        {
          ports: [{ port: 443, handlers: ["tls", "http"] }],
          protocol: "tcp",
          internal_port: 8080,
        },
      ],
      mounts: [
        { volume: volumeResult.volume_id, path: "/workspace" },
      ],
      init: {
        exec: ["/bin/sleep", "inf"],
      },
    };

    const response = await fetch(`${FLY_API_BASE}/apps/${appName}/machines`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `squad-${args.squad_name}`,
        region,
        config,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Fly.io machine creation failed (${response.status}): ${text}`);
      return { error: `Fly.io API returned ${response.status}: ${text}` };
    }

    const machine: FlyMachine = await response.json();

    // Update squad with machine ID and volume ID
    await ctx.runMutation(internal.squadCompute.updateSquadMachine, {
      squad_id: args.squad_id,
      machine_id: machine.id,
      machine_state: machine.state,
      region: machine.region,
    });

    await ctx.runMutation(internal.squadCompute.updateSquadVolume, {
      squad_id: args.squad_id,
      fly_volume_id: volumeResult.volume_id,
    });

    return {
      machine_id: machine.id,
      volume_id: volumeResult.volume_id,
      state: machine.state,
      region: machine.region,
    };
  },
});

// ============================================================================
// Bootstrap & Dev Environment
// ============================================================================

/**
 * Run a bootstrap script on a machine to install tools and configure the environment.
 */
export const runBootstrapScript = internalAction({
  args: {
    machine_id: v.string(),
    github_repo: v.optional(v.string()),
    github_username: v.optional(v.string()),
    github_email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const errors: string[] = [];
    let stepsCompleted = 0;

    // Step 1: Install base packages (backgrounded — apt-get can be slow)
    const installResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: [`bash -c "apt-get update -qq && apt-get install -y -qq python3 git curl jq"`],
      timeout_seconds: 120,
    });
    if (installResult.error || installResult.exit_code !== 0) {
      errors.push(`Package install: ${installResult.error || installResult.stderr}`);
    } else {
      stepsCompleted++;
    }

    // Step 2: Create workspace directory
    const mkdirResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: ["mkdir -p /workspace/.hubify"],
      timeout_seconds: 120,
    });
    if (mkdirResult.error || mkdirResult.exit_code !== 0) {
      errors.push(`mkdir: ${mkdirResult.error || mkdirResult.stderr}`);
    } else {
      stepsCompleted++;
    }

    // Step 3: Clone repo if provided
    if (args.github_repo) {
      const cloneResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
        machine_id: args.machine_id,
        command: [`git clone https://github.com/${args.github_repo}.git /workspace/repo`],
        timeout_seconds: 120,
      });
      if (cloneResult.error || cloneResult.exit_code !== 0) {
        errors.push(`git clone: ${cloneResult.error || cloneResult.stderr}`);
      } else {
        stepsCompleted++;
      }
    }

    // Step 4: Configure git user if provided
    if (args.github_username) {
      const nameResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
        machine_id: args.machine_id,
        command: [`git config --global user.name "${args.github_username}"`],
        timeout_seconds: 120,
      });
      if (nameResult.error || nameResult.exit_code !== 0) {
        errors.push(`git config name: ${nameResult.error || nameResult.stderr}`);
      } else {
        stepsCompleted++;
      }

      if (args.github_email) {
        const emailResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
          machine_id: args.machine_id,
          command: [`git config --global user.email "${args.github_email}"`],
          timeout_seconds: 120,
        });
        if (emailResult.error || emailResult.exit_code !== 0) {
          errors.push(`git config email: ${emailResult.error || emailResult.stderr}`);
        } else {
          stepsCompleted++;
        }
      }
    }

    // Step 5: Write bootstrap log
    const logResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: [`bash -c "echo 'Bootstrap complete: $(date)' > /workspace/.hubify/bootstrap.log"`],
      timeout_seconds: 120,
    });
    if (logResult.error || logResult.exit_code !== 0) {
      errors.push(`bootstrap log: ${logResult.error || logResult.stderr}`);
    } else {
      stepsCompleted++;
    }

    return {
      steps_completed: stepsCompleted,
      errors,
    };
  },
});

// ============================================================================
// Machine Health & File Operations
// ============================================================================

/**
 * Get machine health including disk usage and uptime.
 */
export const getMachineHealth = internalAction({
  args: {
    machine_id: v.string(),
  },
  handler: async (ctx, args) => {
    // Get machine status
    const statusResult: any = await ctx.runAction(internal.squadCompute.getMachineStatus, {
      machine_id: args.machine_id,
    });

    if (statusResult.error) {
      return { state: "unknown", disk_usage: "", uptime: "", error: statusResult.error };
    }

    // Get disk usage and uptime via exec
    const execResult: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: ["bash", "-c", "df -h /workspace && uptime"],
      timeout_seconds: 120,
    });

    if (execResult.error) {
      return { state: statusResult.state, disk_usage: "", uptime: "", error: execResult.error };
    }

    // Parse disk usage and uptime from stdout
    const lines = (execResult.stdout || "").split("\n");
    const diskLine = lines.find((l: string) => l.includes("/workspace")) || "";
    const uptimeLine = lines.find((l: string) => l.includes("up")) || "";

    return {
      state: statusResult.state,
      disk_usage: diskLine.trim(),
      uptime: uptimeLine.trim(),
    };
  },
});

/**
 * Save a file to a machine by base64-encoding the content.
 */
export const saveFile = internalAction({
  args: {
    machine_id: v.string(),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Base64 encode the content to safely transfer it
    const encoded = btoa(args.content);

    const result: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: [`bash -c "echo '${encoded}' | base64 -d > ${args.path}"`],
      timeout_seconds: 120,
    });

    if (result.error || result.exit_code !== 0) {
      return { success: false, error: result.error || result.stderr };
    }

    return { success: true };
  },
});

/**
 * Read a file from a machine.
 */
export const readFile = internalAction({
  args: {
    machine_id: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const result: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: ["cat", args.path],
      timeout_seconds: 120,
    });

    if (result.error || result.exit_code !== 0) {
      return { content: "", error: result.error || result.stderr };
    }

    return { content: result.stdout };
  },
});

/**
 * Git add, commit, pull --rebase, and push from a repo on the machine.
 */
export const gitSync = internalAction({
  args: {
    machine_id: v.string(),
    repo_path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const repoPath = args.repo_path || "/workspace/repo";

    const result: any = await ctx.runAction(internal.squadCompute.execCommand, {
      machine_id: args.machine_id,
      command: [
        `bash -c "cd ${repoPath} && git add -A && git commit -m 'Auto-sync: $(date +%Y-%m-%d_%H:%M)' --allow-empty && git pull --rebase && git push"`,
      ],
      timeout_seconds: 120,
    });

    if (result.error) {
      return { stdout: result.stdout || "", stderr: result.stderr || "", error: result.error };
    }

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  },
});

// ============================================================================
// Machine Config Updates
// ============================================================================

/**
 * Update a machine's config (env vars, image, guest, etc.).
 * This causes Fly.io to replace the machine with the new config.
 * The volume mount persists — only the root FS is replaced.
 */
export const updateMachineConfig = internalAction({
  args: {
    machine_id: v.string(),
    env_vars: v.optional(v.any()),  // Record<string, string> to merge into existing env
    image: v.optional(v.string()),
    guest: v.optional(v.any()),     // { cpu_kind, cpus, memory_mb }
  },
  handler: async (_ctx, args) => {
    const token = getFlyToken();
    if (!token) return { error: "FLY_API_TOKEN not set" };

    const appName = getFlyAppName();

    // First, get current machine config
    const getResp = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    if (!getResp.ok) {
      const text = await getResp.text();
      return { error: `Failed to get machine: ${text}` };
    }

    const machine = await getResp.json();
    const currentConfig = machine.config || {};

    // Merge updates into current config
    const updatedConfig: any = { ...currentConfig };

    if (args.env_vars) {
      updatedConfig.env = { ...(currentConfig.env || {}), ...(args.env_vars as Record<string, string>) };
    }
    if (args.image) {
      updatedConfig.image = args.image;
    }
    if (args.guest) {
      updatedConfig.guest = args.guest;
    }

    // Update machine (POST replaces config, triggers machine replacement)
    const updateResp = await fetch(
      `${FLY_API_BASE}/apps/${appName}/machines/${args.machine_id}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config: updatedConfig }),
      }
    );

    if (!updateResp.ok) {
      const text = await updateResp.text();
      return { error: `Failed to update machine: ${text}` };
    }

    const updated = await updateResp.json();
    return {
      success: true,
      machine_id: updated.id,
      state: updated.state,
    };
  },
});

// ============================================================================
// Internal Mutations — Volume tracking
// ============================================================================

/**
 * Update a squad's compute_environment with a volume ID.
 */
export const updateSquadVolume = internalMutation({
  args: {
    squad_id: v.id("squads"),
    fly_volume_id: v.string(),
  },
  handler: async (ctx, args) => {
    const squad = await ctx.db.get(args.squad_id);
    if (!squad) return;

    await ctx.db.patch(args.squad_id, {
      compute_environment: {
        ...squad.compute_environment,
        fly_volume_id: args.fly_volume_id,
      } as any,
    });
  },
});

// ============================================================================
// Public Wrappers — for manual provisioning via `npx convex run`
// ============================================================================

/**
 * Provision a Fly.io machine with volume for the improvement squad.
 * Run via: npx convex run --prod squadCompute:provisionImprovementSquadMachine
 */
export const provisionImprovementSquadMachine = action({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<Record<string, unknown>> => {
    // Find the improvement squad
    const squad = await ctx.runQuery(internal.squadPipeline.getImprovementSquad) as any;
    if (!squad) return { error: "No hubify-evolution-squad found" };

    // Check if already provisioned
    if (squad.compute_environment?.fly_machine_id) {
      return { already_provisioned: true, machine_id: squad.compute_environment.fly_machine_id };
    }

    // Provision with volume (short name to stay under 30 char limit)
    const result = await ctx.runAction(internal.squadCompute.provisionMachineWithVolume, {
      squad_id: squad._id,
      squad_name: "hubify_improve",
      compute_class: "standard",
      region: "iad",
      volume_size_gb: 10,
      env_vars: {
        CONVEX_URL: ((globalThis as any).process?.env?.CONVEX_URL as string | undefined) || "",
        ANTHROPIC_API_KEY: ((globalThis as any).process?.env?.ANTHROPIC_API_KEY as string | undefined) || "",
        GITHUB_PAT: ((globalThis as any).process?.env?.GITHUB_PAT as string | undefined) || "",
      },
    });

    return result as Record<string, unknown>;
  },
});
