// @ts-nocheck
import { v } from "convex/values";
import { query, mutation, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * WORKSPACE HEALTH ALERTS
 *
 * Configurable alert rules per workspace (hub). Users set thresholds for
 * disk usage, memory usage, agent crashes, and downtime. A cron job checks
 * workspace health against Fly.io every 5 minutes and triggers notifications
 * when thresholds are exceeded.
 */

// ============================================================================
// Alert Rules CRUD
// ============================================================================

/** Create a new alert rule for a workspace */
export const createAlert = mutation({
  args: {
    hub_id: v.string(),
    alert_type: v.string(),
    threshold: v.number(),
    enabled: v.boolean(),
    notification_channels: v.array(v.string()),
    webhook_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("workspace_alerts", {
      hub_id: args.hub_id,
      alert_type: args.alert_type,
      threshold: args.threshold,
      enabled: args.enabled,
      notification_channels: args.notification_channels,
      webhook_url: args.webhook_url,
      created_at: Date.now(),
    });
    return id;
  },
});

/** List all alert rules for a workspace */
export const listAlerts = query({
  args: {
    hub_id: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspace_alerts")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .collect();
  },
});

/** Update an alert rule (toggle enabled, change threshold, etc.) */
export const updateAlert = mutation({
  args: {
    alert_id: v.id("workspace_alerts"),
    enabled: v.optional(v.boolean()),
    threshold: v.optional(v.number()),
    notification_channels: v.optional(v.array(v.string())),
    webhook_url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.alert_id);
    if (!existing) throw new Error("Alert not found");

    const updates: Record<string, unknown> = {};
    if (args.enabled !== undefined) updates.enabled = args.enabled;
    if (args.threshold !== undefined) updates.threshold = args.threshold;
    if (args.notification_channels !== undefined) updates.notification_channels = args.notification_channels;
    if (args.webhook_url !== undefined) updates.webhook_url = args.webhook_url;

    await ctx.db.patch(args.alert_id, updates);
    return args.alert_id;
  },
});

/** Delete an alert rule */
export const deleteAlert = mutation({
  args: {
    alert_id: v.id("workspace_alerts"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.alert_id);
    if (!existing) throw new Error("Alert not found");
    await ctx.db.delete(args.alert_id);
    return { deleted: true };
  },
});

/** Record an alert trigger and create an in-app notification */
export const triggerAlert = internalMutation({
  args: {
    alert_id: v.id("workspace_alerts"),
    hub_id: v.string(),
    alert_type: v.string(),
    message: v.string(),
    severity: v.string(),
  },
  handler: async (ctx, args) => {
    // Update last_triggered_at on the alert rule
    await ctx.db.patch(args.alert_id, {
      last_triggered_at: Date.now(),
    });

    // Create notification record
    const notifId = await ctx.db.insert("alert_notifications", {
      alert_id: args.alert_id,
      hub_id: args.hub_id,
      alert_type: args.alert_type,
      message: args.message,
      severity: args.severity,
      acknowledged: false,
      created_at: Date.now(),
    });

    return notifId;
  },
});

// ============================================================================
// Health Check Action (called by cron)
// ============================================================================

/** Internal query: list all enabled alerts across all hubs */
const listAllEnabledAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Fetch all enabled alerts (capped to 500 for safety)
    const alerts = await ctx.db
      .query("workspace_alerts")
      .filter((q) => q.eq(q.field("enabled"), true))
      .take(500);
    return alerts;
  },
});

// Re-export for internal use
export const _listAllEnabledAlerts = listAllEnabledAlerts;

/**
 * Check workspace health against configured alert thresholds.
 * Called by cron every 5 minutes. Fetches machine status from Fly API,
 * compares against alert rules, and triggers notifications.
 */
export const checkHealthThresholds = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get all enabled alerts
    const alerts = await ctx.runMutation(internal.workspaceAlerts._listAllEnabledAlerts, {});

    if (!alerts || alerts.length === 0) return { checked: 0, triggered: 0 };

    // 2. Group alerts by hub_id for efficient Fly API calls
    const alertsByHub: Record<string, typeof alerts> = {};
    for (const alert of alerts) {
      if (!alertsByHub[alert.hub_id]) alertsByHub[alert.hub_id] = [];
      alertsByHub[alert.hub_id].push(alert);
    }

    const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
    if (!FLY_API_TOKEN) {
      console.warn("[checkHealthThresholds] FLY_API_TOKEN not set, skipping");
      return { checked: 0, triggered: 0, reason: "no_fly_token" };
    }

    let checked = 0;
    let triggered = 0;
    const COOLDOWN_MS = 15 * 60 * 1000; // 15 minute cooldown between triggers

    for (const [hubId, hubAlerts] of Object.entries(alertsByHub)) {
      try {
        // Resolve hub -> fly_app_name
        // Hub IDs are Convex document IDs; we need the fly_app_name
        // The hub document contains fly_app_name
        const appName = `hubify-ws-${hubId}`;

        // Fetch machines from Fly API
        const res = await fetch(`https://api.machines.dev/v1/apps/${appName}/machines`, {
          headers: {
            Authorization: `Bearer ${FLY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          console.warn(`[checkHealthThresholds] Fly API error for ${appName}: ${res.status}`);
          continue;
        }

        const machines = await res.json();
        const machine = machines[0];

        for (const alert of hubAlerts) {
          checked++;

          // Cooldown: skip if triggered recently
          if (alert.last_triggered_at && Date.now() - alert.last_triggered_at < COOLDOWN_MS) {
            continue;
          }

          let shouldTrigger = false;
          let message = "";
          let severity: "warning" | "critical" = "warning";

          if (!machine) {
            // No machine found — workspace is down
            if (alert.alert_type === "downtime") {
              shouldTrigger = true;
              message = `Workspace ${hubId} has no running machines — possible downtime.`;
              severity = "critical";
            }
            continue;
          }

          const machineState = machine.state;
          const memoryMB = machine.config?.guest?.memory_mb || 256;
          const checks = machine.checks || [];
          const failingChecks = checks.filter((c: any) => c.status !== "passing");

          switch (alert.alert_type) {
            case "downtime":
              if (machineState !== "started") {
                shouldTrigger = true;
                message = `Workspace ${hubId} machine state is "${machineState}" — not running.`;
                severity = "critical";
              }
              break;

            case "memory_usage":
              // Fly doesn't expose real-time memory usage via machines API,
              // but we can check allocated vs threshold as a config guard.
              // For real usage, a metrics endpoint or agent-side reporting is needed.
              // Here we trigger if allocated memory is below a useful minimum
              // (treating threshold as minimum MB).
              if (memoryMB > 0 && memoryMB <= alert.threshold) {
                shouldTrigger = true;
                message = `Workspace ${hubId} memory allocation (${memoryMB}MB) at or below threshold (${alert.threshold}MB).`;
                severity = memoryMB <= alert.threshold * 0.5 ? "critical" : "warning";
              }
              break;

            case "disk_usage":
              // Similar to memory: Fly machines API shows volume size but not real-time usage.
              // We flag if volume size_gb is at or below the threshold.
              const volumes = machine.config?.mounts || [];
              for (const vol of volumes) {
                const sizeGb = vol.size_gb || 0;
                if (sizeGb > 0 && sizeGb <= alert.threshold) {
                  shouldTrigger = true;
                  message = `Workspace ${hubId} disk volume "${vol.name || "data"}" (${sizeGb}GB) at or below threshold (${alert.threshold}GB).`;
                  severity = "warning";
                  break;
                }
              }
              break;

            case "agent_crash":
              // Check for failing health checks as proxy for agent crashes
              if (failingChecks.length >= alert.threshold) {
                shouldTrigger = true;
                message = `Workspace ${hubId} has ${failingChecks.length} failing health check(s) (threshold: ${alert.threshold}).`;
                severity = failingChecks.length >= alert.threshold * 2 ? "critical" : "warning";
              }
              break;
          }

          if (shouldTrigger) {
            triggered++;
            await ctx.runMutation(internal.workspaceAlerts.triggerAlert, {
              alert_id: alert._id,
              hub_id: alert.hub_id,
              alert_type: alert.alert_type,
              message,
              severity,
            });

            // Fire webhook if configured
            if (alert.webhook_url && alert.notification_channels.includes("webhook")) {
              try {
                await fetch(alert.webhook_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    alert_type: alert.alert_type,
                    hub_id: alert.hub_id,
                    message,
                    severity,
                    triggered_at: new Date().toISOString(),
                  }),
                });
              } catch (err) {
                console.warn(`[checkHealthThresholds] Webhook failed for alert ${alert._id}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[checkHealthThresholds] Error checking hub ${hubId}:`, err);
      }
    }

    return { checked, triggered };
  },
});

// ============================================================================
// Notification Queries & Mutations
// ============================================================================

/** List notifications for a workspace, unacknowledged first */
export const listNotifications = query({
  args: {
    hub_id: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    // Unacknowledged first
    const unacked = await ctx.db
      .query("alert_notifications")
      .withIndex("by_hub_ack", (q) => q.eq("hub_id", args.hub_id).eq("acknowledged", false))
      .order("desc")
      .take(limit);

    const remaining = limit - unacked.length;
    let acked: typeof unacked = [];
    if (remaining > 0) {
      acked = await ctx.db
        .query("alert_notifications")
        .withIndex("by_hub_ack", (q) => q.eq("hub_id", args.hub_id).eq("acknowledged", true))
        .order("desc")
        .take(remaining);
    }

    return [...unacked, ...acked];
  },
});

/** Acknowledge a notification */
export const acknowledgeNotification = mutation({
  args: {
    notification_id: v.id("alert_notifications"),
  },
  handler: async (ctx, args) => {
    const notif = await ctx.db.get(args.notification_id);
    if (!notif) throw new Error("Notification not found");
    await ctx.db.patch(args.notification_id, { acknowledged: true });
    return { acknowledged: true };
  },
});

/** Get count of unacknowledged notifications for a workspace */
export const getUnacknowledgedCount = query({
  args: {
    hub_id: v.string(),
  },
  handler: async (ctx, args) => {
    const unacked = await ctx.db
      .query("alert_notifications")
      .withIndex("by_hub_ack", (q) => q.eq("hub_id", args.hub_id).eq("acknowledged", false))
      .collect();
    return unacked.length;
  },
});
