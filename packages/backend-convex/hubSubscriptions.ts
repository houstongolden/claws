// @ts-nocheck
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================================
// Hub Subscriptions — Workspace hubs subscribe to platform/research hubs
// Enables cross-pollination of knowledge from source hubs to subscribers
// ============================================================================

// Subscribe a workspace hub to a source hub
export const subscribe = mutation({
  args: {
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    if (args.subscriber_hub_id === args.source_hub_id) {
      throw new Error("Cannot subscribe a hub to itself");
    }

    // Validate both hubs exist
    const subscriberHub = await ctx.db.get(args.subscriber_hub_id);
    if (!subscriberHub) throw new Error("Subscriber hub not found");
    const sourceHub = await ctx.db.get(args.source_hub_id);
    if (!sourceHub) throw new Error("Source hub not found");

    // Limit subscriptions per hub (prevent resource exhaustion)
    const currentSubs = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriber_hub_id", args.subscriber_hub_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();
    if (currentSubs.length >= 50) {
      throw new Error("Subscription limit reached (max 50 per hub)");
    }

    // Dedupe via by_pair index
    const existing = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_pair", (q) =>
        q
          .eq("subscriber_hub_id", args.subscriber_hub_id)
          .eq("source_hub_id", args.source_hub_id)
      )
      .first();

    if (existing) {
      // Reactivate if paused
      if (existing.status === "paused") {
        await ctx.db.patch(existing._id, { status: "active" });
        return existing._id;
      }
      return existing._id;
    }

    return await ctx.db.insert("hub_subscriptions", {
      subscriber_hub_id: args.subscriber_hub_id,
      source_hub_id: args.source_hub_id,
      subscribed_at: Date.now(),
      status: "active",
    });
  },
});

// Unsubscribe (delete the record)
export const unsubscribe = mutation({
  args: {
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_pair", (q) =>
        q
          .eq("subscriber_hub_id", args.subscriber_hub_id)
          .eq("source_hub_id", args.source_hub_id)
      )
      .first();

    if (sub) {
      await ctx.db.delete(sub._id);
    }
  },
});

// Get all source hubs a hub subscribes to
export const getSubscriptions = query({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriber_hub_id", args.hub_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const sourceHubs = await Promise.all(
      subs.map(async (s) => {
        const hub = await ctx.db.get(s.source_hub_id);
        return hub ? { ...hub, subscription_id: s._id, subscribed_at: s.subscribed_at } : null;
      })
    );

    return sourceHubs.filter(Boolean);
  },
});

// Get all subscriber hubs for a source hub
export const getSubscribers = query({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_source", (q) => q.eq("source_hub_id", args.hub_id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const subscriberHubs = await Promise.all(
      subs.map(async (s) => {
        const hub = await ctx.db.get(s.subscriber_hub_id);
        return hub ? { ...hub, subscription_id: s._id, subscribed_at: s.subscribed_at } : null;
      })
    );

    return subscriberHubs.filter(Boolean);
  },
});

// Pause a subscription (keeps record, stops cross-pollination)
export const pause = mutation({
  args: {
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_pair", (q) =>
        q
          .eq("subscriber_hub_id", args.subscriber_hub_id)
          .eq("source_hub_id", args.source_hub_id)
      )
      .first();

    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "paused") return sub._id;

    await ctx.db.patch(sub._id, { status: "paused" });
    return sub._id;
  },
});

// Resume a paused subscription
export const resume = mutation({
  args: {
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_pair", (q) =>
        q
          .eq("subscriber_hub_id", args.subscriber_hub_id)
          .eq("source_hub_id", args.source_hub_id)
      )
      .first();

    if (!sub) throw new Error("Subscription not found");
    if (sub.status === "active") return sub._id;

    await ctx.db.patch(sub._id, { status: "active" });
    return sub._id;
  },
});

// Get subscription stats for a hub
export const getStats = query({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const asSubscriber = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriber_hub_id", args.hub_id))
      .collect();

    const asSource = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_source", (q) => q.eq("source_hub_id", args.hub_id))
      .collect();

    return {
      subscribedTo: asSubscriber.filter((s) => s.status === "active").length,
      subscribedToPaused: asSubscriber.filter((s) => s.status === "paused").length,
      subscribers: asSource.filter((s) => s.status === "active").length,
      totalSubscribers: asSource.length,
    };
  },
});

// Get all subscriptions for a hub (including paused) — for management UI
export const getAllSubscriptions = query({
  args: { hub_id: v.id("hubs") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("hub_subscriptions")
      .withIndex("by_subscriber", (q) => q.eq("subscriber_hub_id", args.hub_id))
      .collect();

    const enriched = await Promise.all(
      subs.map(async (s) => {
        const hub = await ctx.db.get(s.source_hub_id);
        return hub
          ? {
              subscription_id: s._id,
              source_hub: hub,
              status: s.status,
              subscribed_at: s.subscribed_at,
            }
          : null;
      })
    );

    return enriched.filter(Boolean);
  },
});

// Get recent cross-pollinated knowledge that arrived via subscriptions
export const getRecentCrossPollinated = query({
  args: {
    hub_id: v.id("hubs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxItems = args.limit ?? 20;

    // Cross-pollinated knowledge has contributor_platform "hubify-network"
    // and title starts with "[Cross-ref]"
    const knowledge = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.hub_id))
      .order("desc")
      .filter((q) => q.eq(q.field("contributor_platform"), "hubify-network"))
      .take(maxItems);

    // Enrich with source hub name from contributor_agent_id
    const enriched = [];
    for (const k of knowledge) {
      // contributor_agent_id often contains the source agent/hub reference
      let sourceHubName: string | undefined;
      if (k.contributor_agent_id) {
        // Try to find the source hub by matching contributor info
        const parts = k.contributor_agent_id.split("/");
        if (parts.length > 1) sourceHubName = parts[0];
      }
      // Also extract from title prefix pattern "[Source Hub] Title"
      const titleMatch = k.title.match(/^\[([^\]]+)\]\s*/);
      if (titleMatch) sourceHubName = titleMatch[1].replace("Cross-ref from ", "");

      enriched.push({
        _id: k._id,
        title: k.title.replace(/^\[Cross-ref(?:\s+from\s+[^\]]+)?\]\s*/, ""),
        body: k.body,
        knowledge_type: k.knowledge_type,
        confidence: k.confidence,
        tags: k.tags,
        status: k.status,
        created_at: k.created_at,
        source_hub: sourceHubName,
      });
    }
    return enriched;
  },
});

// Get knowledge items that originated from a specific source hub
// Useful for seeing "what did I get from subscribing to hub X?"
export const getKnowledgeFromSource = query({
  args: {
    subscriber_hub_id: v.id("hubs"),
    source_hub_id: v.id("hubs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxItems = args.limit ?? 20;

    // Get the source hub to build the cross-ref prefix
    const sourceHub = await ctx.db.get(args.source_hub_id);
    if (!sourceHub) return [];

    // Cross-pollinated knowledge has contributor_platform "hubify-network"
    // and title contains the source hub name
    const knowledge = await ctx.db
      .query("hub_knowledge")
      .withIndex("by_hub", (q) => q.eq("hub_id", args.subscriber_hub_id))
      .order("desc")
      .filter((q) => q.eq(q.field("contributor_platform"), "hubify-network"))
      .take(maxItems * 3); // Over-fetch then filter

    // Filter to items that came from this specific source
    const fromSource = knowledge.filter((k) =>
      k.contributor_agent_id.includes(sourceHub.name) ||
      k.title.includes(sourceHub.display_name || sourceHub.name)
    ).slice(0, maxItems);

    return fromSource.map((k) => ({
      _id: k._id,
      title: k.title.replace("[Cross-ref] ", ""),
      body: k.body,
      knowledge_type: k.knowledge_type,
      confidence: k.confidence,
      tags: k.tags,
      status: k.status,
      created_at: k.created_at,
    }));
  },
});
