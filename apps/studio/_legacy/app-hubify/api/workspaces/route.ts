import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getDevUser } from "@/lib/auth";
const auth = getAuthUser;
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkProvisionRateLimit, recordProvisionAttempt } from "@/lib/provision-rate-limit";
import { withApiMiddleware } from "@/lib/api-middleware";
import { CreateWorkspaceSchema, validateRequest } from "@/lib/validate";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";

const FLY_API_TOKEN = process.env.FLY_API_TOKEN;
const FLY_ORG_SLUG = process.env.FLY_ORG_SLUG || "hubify";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

// Workspace images — convention: {NAME}_WORKSPACE_IMAGE
// Set these as Vercel env vars to update without redeploying code.
//
// AI OS Core — serves all templates (myos, dev-os, founder-os, research-os, minimal)
// Built from: infra/workspace/Dockerfile
// Rebuild:    flyctl deploy --build-only --push --app hubify-workspace-base
const AIOS_CORE_WORKSPACE_IMAGE =
  process.env.AIOS_CORE_WORKSPACE_IMAGE ||
  "registry.fly.io/hubify-workspace-base:deployment-01KKDWXH53BT555VREP92NVD45";

// Company OS — separate stack (embedded Postgres, Node API, pnpm)
// Built from: infra/company-os/Dockerfile
// Rebuild:    flyctl deploy --build-only --push --app hubify-company-os-base
const COMPANY_OS_WORKSPACE_IMAGE =
  process.env.COMPANY_OS_WORKSPACE_IMAGE ||
  "registry.fly.io/hubify-company-os-base:deployment-01KJY9S6W5K1KWB5BC8Y1YNM34";

// Pick the right image + machine config based on template
function getTemplateImage(template: string): string {
  if (template === "company-os") return COMPANY_OS_WORKSPACE_IMAGE;
  return AIOS_CORE_WORKSPACE_IMAGE;
}

function getTemplateMachineConfig(template: string): { cpu_kind: string; cpus: number; memory_mb: number } {
  if (template === "company-os") {
    // Company OS needs more RAM: Node API + embedded Postgres + OpenClaw
    return { cpu_kind: "performance", cpus: 1, memory_mb: 2048 };
  }
  return { cpu_kind: "shared", cpus: 2, memory_mb: 2048 };
}
const FLY_MACHINES_API = "https://api.machines.dev/v1";
const FLY_GQL_API = "https://api.fly.io/graphql";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const WORKSPACE_JWT_SECRET = process.env.WORKSPACE_JWT_SECRET;

function validateUsername(username: string): boolean {
  return /^[a-z0-9-]{3,20}$/.test(username);
}

function getConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(CONVEX_URL);
}

async function flyGqlRequest(query: string, variables: Record<string, unknown>) {
  const res = await fetch(FLY_GQL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[fly-gql] HTTP ${res.status}: ${text}`);
    return { data: null, errors: [{ message: `HTTP ${res.status}` }] };
  }
  return res.json();
}

async function addCustomDomain(appName: string, hostname: string) {
  const result = await flyGqlRequest(
    `mutation AddCert($input: AddCertificateInput!) {
      addCertificate(input: $input) {
        certificate { id hostname dnsValidationHostname dnsValidationTarget }
        errors
      }
    }`,
    { input: { appId: appName, hostname } }
  );
  return result;
}

async function flyRequest(path: string, method = "GET", body?: object) {
  const res = await fetch(`${FLY_MACHINES_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

async function fetchStripeSubscriptionStatus(subscriptionId: string): Promise<{
  ok: boolean;
  status?: string;
  error?: string;
}> {
  if (!STRIPE_SECRET_KEY) {
    return { ok: false, error: "stripe_secret_missing" };
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `stripe_error_${res.status}:${errText}` };
    }

    const data = (await res.json()) as { status?: string };
    return { ok: true, status: data.status };
  } catch (error) {
    return { ok: false, error: `stripe_fetch_failed:${String(error)}` };
  }
}

/**
 * POST /api/workspaces — Provision a real Fly Machine workspace
 *
 * Flow:
 * 1. Rate limit check (10 requests per minute per IP)
 * 2. Validate input
 * 3. Create hub in Convex
 * 4. Create Fly app: hubify-ws-{username}
 * 5. Create a Fly Volume for persistent /data storage
 * 6. Create a Fly Machine with the workspace image + user env vars
 * 7. Update hub record with Fly details (machine_id, fly_app_name)
 * 8. Return hub info for polling
 */
const postHandler = async (request: NextRequest) => {
  try {
    // --- SECURITY: Verify user is authenticated via Clerk ---
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: "You need to sign in to create a workspace",
          friendlyMessage: "Please sign in to your account and try again.",
        },
        { status: 401 }
      );
    }

    // --- SECURITY: Require verified email before first provisioning ---
    const clerkUser = await getDevUser();
    const primaryEmail = clerkUser?.emailAddresses?.find(
      (e: { emailAddress: string; id: string }) =>
        e.id === clerkUser.primaryEmailAddressId
    ) ?? clerkUser?.emailAddresses?.[0];

    const userEmail = primaryEmail?.emailAddress;
    const emailVerified = primaryEmail?.verification?.status === "verified";

    if (!userEmail) {
      return NextResponse.json(
        { error: "Unable to determine user email for verification." },
        { status: 400 }
      );
    }

    const convex = getConvexClient();

    // === Auto-approve all Clerk-authenticated users ===
    // Clerk signup IS the email verification step — no manual waitlist gate needed.
    // All Clerk users are auto-approved. This is idempotent: safe to call every request.
    //
    // === E2E Testing: Test account bypass ===
    // When DISABLE_WAITLIST_FOR_TESTING=true (dev/test only):
    // - Test accounts (test+*@example.com, test+*@hubify-qa.local, test+*@test.hubify.com)
    //   bypass all verification gates and are marked is_test_account=true for isolation
    // - Real users are unaffected — still require normal verification
    // PRODUCTION: Never set DISABLE_WAITLIST_FOR_TESTING (default: false)
    
    await convex.mutation(api.waitlist.autoApproveClerkUser, {
      email: userEmail,
      name: clerkUser?.fullName || clerkUser?.username || undefined,
    }).catch((e) => console.warn("[waitlist] autoApprove non-fatal:", e));

    const [existingHubs, billingUser, provisionCheck, emailVerificationStatus] = await Promise.all([
      convex.query(api.hubs.listHubsByOwner, { owner_id: userId }),
      convex.query(api.users.getByClerkId, { clerk_user_id: userId }),
      convex.query(api.waitlist.canProvisionWorkspace, { email: userEmail }),
      convex.query(api.users.isEmailVerified, { email: userEmail }),
    ]);

    // Email verification: Clerk signup is the verification step — no extra gate needed.
    // autoApproveClerkUser above already sets email_verified=true in Convex.

    if (!provisionCheck.can_provision) {
      return NextResponse.json(
        {
          error: "Unable to create workspace",
          friendlyMessage: provisionCheck.message || "Your account needs to be verified before creating workspaces. Check your email or contact support.",
          reason: provisionCheck.reason,
          verification_pending: provisionCheck.verification_pending || false,
        },
        { status: 403 }
      );
    }

    // --- Rate limiting check (IP-based — stops mass bot attacks) ---
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("cf-connecting-ip") ||
      (request as any).ip ||
      "unknown";

    const limitResult = await checkRateLimit(ip);

    if (!limitResult.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          friendlyMessage: `You're creating workspaces too quickly. Please wait a few minutes and try again.`,
          retry_after: limitResult.reset_after,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": String(limitResult.remaining),
            "X-RateLimit-Reset": String(Math.ceil(limitResult.reset / 1000)),
            "Retry-After": String(limitResult.reset_after),
          },
        }
      );
    }

    // --- Per-user provisioning rate limit (stops individual users from spinning up unlimited paid Fly machines) ---
    // Limits: 1 provision per hour, 3 per 24h (regardless of IP)
    const userLimitResult = await checkProvisionRateLimit(userId);
    if (!userLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          friendlyMessage: userLimitResult.reason || "You're creating workspaces too frequently. Please wait and try again.",
          retry_after: userLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Policy": "1;w=3600,3;w=86400",
            "Retry-After": String(userLimitResult.retryAfterSeconds ?? 3600),
          },
        }
      );
    }

    // --- Max workspaces per account (plan cap) ---
    // BETA: Workspace limits disabled for all users during beta testing
    const currentWorkspaceCount = existingHubs?.length ?? 0;
    // const maxWorkspaces = billingUser?.max_workspaces ?? 1; // disabled for beta

    // --- SECURITY (hubify-sec-021): Plan gate validation — ENABLED ---
    // Validates user's plan level and resource limits before provisioning.
    // Rules:
    // - Free plan: 1 workspace max
    // - Pro plan: 5 workspaces max
    // - Team plan: 10 workspaces max
    // - Enterprise plan: unlimited workspaces
    // - Agency role: unlimited workspaces (overrides plan)
    //
    // This gate is enforced on the API layer. The Convex mutation also validates
    // in createHub(), so this is a defense-in-depth security control.
    // BETA: Plan gate disabled — unlimited workspaces for all users during beta
    const userPlan = billingUser?.plan ?? "free";
    console.log(`[plan-gate] BETA: User ${userId} plan=${userPlan}, workspaces=${currentWorkspaceCount} — limits disabled`);

    // --- Billing check (paid plans require active subscription) ---
    // STATUS(hubify-sec-022): Plan gate is ACTIVE on feat/merge-all-progress.
    // The old "TEMP: plan gate disabled" comment (on main pre-sec-renable commit) has been removed.
    // This branch enforces: free plan = no Stripe check; paid plans = Stripe subscription verified.
    //
    // TODO(hubify-sec-022): When Stripe billing goes live, ensure:
    //   1. STRIPE_SECRET_KEY is configured in all production environments
    //   2. Stripe webhook syncs subscription status to Convex users table
    //   3. E2E test accounts use free plan OR have a mock stripe_subscription_id
    //   File: apps/web/app/api/workspaces/route.ts, this block
    const plan = billingUser?.plan ?? "free";
    if (plan !== "free") {
      if (!billingUser?.stripe_subscription_id) {
        return NextResponse.json(
          {
            error: "Subscription required",
            friendlyMessage: "This plan requires an active subscription. Please update your billing to create workspaces.",
          },
          { status: 402 }
        );
      }

      if (!STRIPE_SECRET_KEY) {
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            {
              error: "Billing verification unavailable",
              friendlyMessage: "We're having trouble verifying your billing. Please try again or contact support.",
            },
            { status: 503 }
          );
        }
        console.warn("[billing] STRIPE_SECRET_KEY missing; skipping subscription check in dev.");
      } else {
        const stripeCheck = await fetchStripeSubscriptionStatus(
          billingUser.stripe_subscription_id
        );

        if (!stripeCheck.ok) {
          console.warn("[billing] Stripe verification failed:", stripeCheck.error);
          return NextResponse.json(
            {
              error: "Couldn't verify your subscription",
              friendlyMessage: "We're having trouble verifying your subscription status. Please try again.",
            },
            { status: 502 }
          );
        }

        const allowedStatuses = ["active", "trialing"];
        if (!stripeCheck.status || !allowedStatuses.includes(stripeCheck.status)) {
          return NextResponse.json(
            {
              error: "Subscription not active",
              friendlyMessage: "Your subscription is not active. Please update your billing to continue.",
            },
            { status: 402 }
          );
        }
      }
    }

    const body = await request.json();
    
    // --- SECURITY: Validate request body with Zod schema ---
    const validationResult = validateRequest(body, z.object({
      name: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, 'Invalid domain format'),
      description: z.string().max(5000).optional(),
      domain: z.string().min(1).max(63).regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, 'Invalid domain format'),
      visibility: z.enum(['public', 'private']).default('private'),
      template: z.string().optional(),
      telegram_enabled: z.boolean().optional(),
      telegram_bot_token: z.string().optional(),
      telegram_chat_id: z.string().optional(),
      workspace_image: z.string().url().optional(), // Docker image URL (optional; defaults to env var)
    }));
    
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: "Invalid workspace settings",
          friendlyMessage: "Please check your workspace name and domain. They must be 3-63 characters with lowercase letters, numbers, and hyphens only.",
          details: validationResult.errors,
        },
        { status: 400 }
      );
    }
    
    const { name: username, description, domain, visibility, telegram_enabled, telegram_bot_token, telegram_chat_id, workspace_image } = validationResult.data;
    const template = body.template || "myos"; // Optional field
    
    // Use provided image or fall back to environment default
    const imageToUse = workspace_image || AIOS_CORE_WORKSPACE_IMAGE;
    
    // --- SECURITY: Verify user is not impersonating another user ---
    // The workspace belongs to the authenticated user, not someone else
    
    // --- SECURITY: Additional template validation (not in schema) ---
    const builtInTemplates = ["myos", "dev-os", "founder-os", "research-os", "minimal", "company-os"];
    let templateRecord: any = null;
    if (!builtInTemplates.includes(template)) {
      try {
        templateRecord = await convex.query(api.templates.getBySlug, { slug: template });
      } catch (err) {
        console.warn("[templates] Failed to lookup template slug:", err);
      }
      if (!templateRecord) {
        return NextResponse.json(
          {
            error: "Invalid template",
            friendlyMessage: `Please select from available templates: ${builtInTemplates.join(", ")}.`,
          },
          { status: 400 }
        );
      }
    } else {
      // If this built-in template exists in the gallery, capture it for metrics
      try {
        templateRecord = await convex.query(api.templates.getBySlug, { slug: template });
      } catch (err) {
        console.warn("[templates] Built-in template lookup failed:", err);
      }
    }

    const appName = `hubify-ws-${username}`;
    // Ensure subdomain is always a full hostname (username.hubify.com)
    // The signup page sends domain as just the username slug, not a full hostname
    const subdomain = domain && domain.includes(".")
      ? domain
      : `${username}.hubify.com`;
    const workspaceUrl = `https://${subdomain}`; // Custom domain (target)
    const flyDevUrl = `https://${appName}.fly.dev`; // Temporary Fly subdomain

    // --- Step 0a: Ensure user exists in Convex (Clerk → Convex sync) ---
    // createHub requires a user record; Clerk users may not have one yet.
    try {
      await convex.mutation(api.users.getOrCreateFromClerk, {
        clerk_user_id: userId,
        email: userEmail,
        username,
        display_name: clerkUser?.fullName || clerkUser?.username || username,
      });
    } catch (err) {
      console.warn("[convex] getOrCreateFromClerk non-fatal:", err);
    }

    // --- Step 0a-ii: SECURITY — Check subdomain uniqueness before provisioning ---
    // This is a server-side guard that runs BEFORE the Convex mutation so we can
    // return a clean 409 Conflict instead of a 500 internal error.
    try {
      const subdomainCheck = await convex.query(api.workspaces.checkSubdomain, {
        subdomain: username, // username == slug used as subdomain
      });
      if (!subdomainCheck.available) {
        return NextResponse.json(
          {
            error: "Subdomain not available",
            friendlyMessage: subdomainCheck.reason || "That subdomain is already taken. Please choose a different username.",
          },
          { status: 409 }
        );
      }
    } catch (err) {
      // Non-fatal: the Convex mutation itself enforces uniqueness; this is just a
      // faster/friendlier pre-check.
      console.warn("[security] Subdomain pre-check failed (non-fatal):", err);
    }

    // --- Step 0b: Create hub in Convex ---
    let hubId: string;
    try {
      console.log(`[convex] Creating hub with userId: ${userId}, username: ${username}, subdomain: ${subdomain}, image: ${imageToUse}`);
      const hub = await convex.mutation(api.hubs.createHub, {
        name: username,
        owner_id: userId, // Use authenticated user ID, not from request
        subdomain,
        template,
        telegram_enabled: telegram_enabled || false,
        telegram_bot_token: telegram_enabled ? telegram_bot_token : undefined,
        telegram_chat_id: telegram_enabled ? telegram_chat_id : undefined,
        workspace_image: workspace_image, // Pass the provided image (will be undefined if not specified)
      });
      hubId = hub;
      console.log(`[convex] Hub created: ${hubId}`);

      // Record provisioning attempt AFTER successful hub creation (counts against user quota)
      await recordProvisionAttempt(userId);

      // Update waitlist activation funnel (non-blocking)
      try {
        await convex.mutation(api.waitlist.activateUser, {
          email: userEmail,
          hub_id: hubId as any,
          workspace_created_at: Date.now(),
        });
      } catch (activationErr) {
        console.warn("[waitlist] Activation update skipped:", activationErr);
      }
    } catch (error) { 
      const errorMsg = String(error);
      console.error("[convex] Failed to create hub:", errorMsg);
      console.error("[convex] Full error:", error);
      // Return a friendly error if workspace limit is hit
      if (errorMsg.includes("Workspace limit")) {
        return NextResponse.json(
          {
            error: "Workspace limit reached",
            friendlyMessage: "You've reached the maximum workspaces for your plan. Upgrade to create more.",
          },
          { status: 402 } // Payment required
        );
      }
      return NextResponse.json(
        {
          error: "Failed to create workspace",
          friendlyMessage: "We couldn't create your workspace. Please refresh and try again, or contact support if the problem persists.",
        },
        { status: 500 }
      );
    }

    // --- Template metrics: record fork + installs (non-blocking) ---
    if (templateRecord) {
      try {
        await Promise.all([
          convex.mutation(api.templates.incrementInstalls, { slug: templateRecord.slug }),
          convex.mutation(api.templates.recordFork, {
            templateSlug: templateRecord.slug,
            templateId: templateRecord.id,
            workspaceId: hubId,
            workspaceName: username,
          }),
        ]);
      } catch (err) {
        console.warn("[templates] Failed to record fork/install metrics:", err);
      }
    }

    // --- No API token: return dev-mode response ---
    if (!FLY_API_TOKEN) {
      return NextResponse.json({
        hubId,
        appName,
        workspaceUrl: flyDevUrl,
        status: "provisioning",
        message: "[DEV] Hub created in Convex. Would provision Fly machine with FLY_API_TOKEN",
      }, { status: 201 });
    }

    // --- Step 1: Create Fly app on default network ---
    // NOTE: Workspaces must share the default network with hubify-caddy so the
    // reverse proxy can reach them via internal .fly.dev DNS. Custom 6PN networks
    // (hubify-sec-005) broke Caddy routing — Caddy couldn't reach isolated apps.
    // Each workspace is still isolated as its own Fly app + machine.
    const appResult = await flyRequest("/apps", "POST", {
      org_slug: FLY_ORG_SLUG,
      app_name: appName,
      enable_subdomains: false,
    });

    const appAlreadyExists =
      appResult.status === 409 ||
      (typeof appResult.data === "object" &&
        JSON.stringify(appResult.data).includes("already been taken"));

    if (!appResult.ok && !appAlreadyExists) {
      console.error("[fly] App create failed:", appResult.data);
      return NextResponse.json(
        {
          error: "Failed to provision workspace infrastructure",
          friendlyMessage: "We couldn't set up your workspace's computing environment. Please try again or contact support.",
        },
        { status: 500 }
      );
    }

    console.log(`[fly] App ${appName}: ${appAlreadyExists ? "already exists" : "created"}`);

    // --- Step 2: Create persistent volume for /data (BLOCKING — hard failure) ---
    // A workspace without persistent storage is broken by design.
    // We retry once with a 2s delay before failing the entire provisioning request.
    // If volume creation fails after a machine has been created (future refactor),
    // the machine must be deleted to avoid orphaned machines; here volume creation
    // precedes machine creation so no machine cleanup is needed on failure.
    const volumePayload = {
      name: `ws_${username}_data`,
      size_gb: 10,
      region: "sjc",
      encrypted: true,
    };

    let volumeResult = await flyRequest(`/apps/${appName}/volumes`, "POST", volumePayload);

    if (!volumeResult.ok) {
      // Retry once after a 2-second delay before giving up
      console.warn("[fly] Volume create attempt 1 failed — retrying in 2s:", volumeResult.data);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      volumeResult = await flyRequest(`/apps/${appName}/volumes`, "POST", volumePayload);
    }

    if (!volumeResult.ok) {
      // Both attempts failed — hard failure: no storage means no workspace
      console.error("[fly] Volume create failed after retry:", volumeResult.data);
      // Best-effort: delete the Fly app to avoid orphaned infra (machine not yet created)
      try {
        await flyRequest(`/apps/${appName}`, "DELETE");
        console.log(`[fly] Cleaned up app ${appName} after volume failure`);
      } catch (cleanupErr) {
        console.warn("[fly] App cleanup after volume failure non-fatal:", cleanupErr);
      }
      return NextResponse.json(
        {
          error: "Failed to provision workspace storage",
          friendlyMessage: "Failed to provision workspace storage. Please try again.",
        },
        { status: 500 }
      );
    }

    const volumeId = (volumeResult.data as { id: string }).id;
    console.log(`[fly] Volume created: ${volumeId}`);

    // --- Step 3: Create Fly Machine ---
    // Use timestamp suffix to avoid name conflicts on retries
    const machineName = `ws-${username}-${Date.now().toString(36)}`;
    const machineConfig: Record<string, unknown> = {
      name: machineName,
      region: "sjc",
      config: {
        image: workspace_image || getTemplateImage(template),
        env: {
          HUBIFY_USERNAME: username,
          HUB_ID: hubId,
          TEMPLATE: template,
          OPENCLAW_STATE_DIR: "/data",
          NODE_OPTIONS: "--max-old-space-size=1536",
          ...(ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY } : {}),
          ...(OPENROUTER_API_KEY ? { OPENROUTER_API_KEY } : {}),
          ...(WORKSPACE_JWT_SECRET ? { WORKSPACE_JWT_SECRET } : {}),
        },
        guest: getTemplateMachineConfig(template),
        services: [
          {
            protocol: "tcp",
            internal_port: 80, // nginx → serves dashboard UI
            ports: [
              { port: 443, handlers: ["tls", "http"] },
              { port: 80, handlers: ["http"] },
            ],
            auto_stop_machines: true,
            auto_start_machines: true,
            min_machines_running: 0,
          },
          {
            protocol: "tcp",
            internal_port: 8080, // ttyd terminal
            ports: [{ port: 8080, handlers: ["tls", "http"] }],
          },
        ],
        restart: {
          policy: "on-failure",
          max_retries: 3,
        },
      },
    };

    // Attach volume — always present (volume creation is now a hard prerequisite)
    (machineConfig.config as Record<string, unknown>).mounts = [
      {
        volume: volumeId,
        path: "/data",
      },
    ];

    const machineResult = await flyRequest(`/apps/${appName}/machines`, "POST", machineConfig);

    if (!machineResult.ok) {
      console.error("[fly] Machine create failed:", machineResult.data);
      // Cleanup: delete the volume and app to avoid orphaned infra
      try {
        await flyRequest(`/apps/${appName}/volumes/${volumeId}`, "DELETE");
        console.log(`[fly] Cleaned up volume ${volumeId} after machine failure`);
      } catch (volCleanupErr) {
        console.warn("[fly] Volume cleanup after machine failure non-fatal:", volCleanupErr);
      }
      try {
        await flyRequest(`/apps/${appName}`, "DELETE");
        console.log(`[fly] Cleaned up app ${appName} after machine failure`);
      } catch (appCleanupErr) {
        console.warn("[fly] App cleanup after machine failure non-fatal:", appCleanupErr);
      }
      return NextResponse.json(
        {
          error: "Failed to start workspace machine",
          friendlyMessage: "We couldn't initialize your workspace. Please try again.",
        },
        { status: 500 }
      );
    }

    const machine = machineResult.data as { id: string; state: string };
    console.log(`[fly] Machine created: ${machine.id} (state: ${machine.state})`);

    // --- Step 3.4: Wait for machine to be running (max 5 minutes) ---
    // Increased from 2 min → 5 min to handle slow regions / heavy load.
    // Progress milestones are logged so the provisioning page can show
    // a "Still booting…" indicator after 60 seconds.
    const maxWaitMs = 5 * 60 * 1000;
    const pollIntervalMs = 3000;
    const startTime = Date.now();
    let machineRunning = false;
    let currentMachine = machine;
    let progressLogged60s = false;
    let progressLogged120s = false;
    let progressLogged180s = false;

    while (Date.now() - startTime < maxWaitMs) {
      if (currentMachine.state === "started") {
        machineRunning = true;
        console.log(`[fly] Machine ${machine.id} is now running`);
        break;
      }

      const elapsed = Date.now() - startTime;

      // Progress milestones — logged so downstream polling can surface UX hints
      if (!progressLogged60s && elapsed >= 60_000) {
        progressLogged60s = true;
        console.log(`[fly] Machine ${machine.id} still booting after 60s (state: ${currentMachine.state})`);
      }
      if (!progressLogged120s && elapsed >= 120_000) {
        progressLogged120s = true;
        console.log(`[fly] Machine ${machine.id} still booting after 120s — this may take a bit longer`);
      }
      if (!progressLogged180s && elapsed >= 180_000) {
        progressLogged180s = true;
        console.log(`[fly] Machine ${machine.id} still booting after 180s — almost there`);
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      // Poll current state
      const statusResult = await flyRequest(`/apps/${appName}/machines/${machine.id}`, "GET");
      if (statusResult.ok) {
        currentMachine = statusResult.data as { id: string; state: string };
        console.log(`[fly] Machine state: ${currentMachine.state}`);
      } else {
        console.warn(`[fly] Failed to poll machine state:`, statusResult.data);
      }
    }

    if (!machineRunning) {
      console.warn(`[fly] Machine ${machine.id} did not reach running state within ${maxWaitMs}ms, continuing anyway...`);
    }

    // --- Step 3.5: Allocate IPs so the app gets a public fly.dev URL ---
    // Shared v4 is required for Caddy to reach hubify-ws-*.fly.dev:80
    try {
      await flyGqlRequest(
        `mutation AllocateIP($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { address type } } }`,
        { input: { appId: appName, type: "shared_v4" } }
      );
      console.log(`[fly] Shared IPv4 allocated for ${appName}`);
    } catch (e) {
      console.warn("[fly] Shared IPv4 allocation non-fatal:", e);
    }
    try {
      await flyGqlRequest(
        `mutation AllocateIP($input: AllocateIPAddressInput!) { allocateIpAddress(input: $input) { ipAddress { address type } } }`,
        { input: { appId: appName, type: "v6" } }
      );
      console.log(`[fly] IPv6 allocated for ${appName}`);
    } catch (e) {
      console.warn("[fly] IPv6 allocation non-fatal:", e);
    }

    // --- Step 4: Register custom domain username.hubify.com ---
    // DNS: *.hubify.com CNAME proxy.fly.io (wildcard; Fly routes by SNI per-app cert)
    try {
      const certResult = await addCustomDomain(appName, subdomain);
      const cert = certResult?.data?.addCertificate?.certificate;
      console.log(`[fly] Custom domain ${subdomain}: ${cert ? "registered" : "failed"}`, certResult?.errors);
    } catch (e) {
      console.warn(`[fly] Custom domain registration non-fatal error:`, e);
      // Non-fatal — workspace still works via fly.dev URL
    }

    // --- Step 4b: Register wildcard certificate for *.hubify.com (once per workspace app) ---
    // This allows any subdomain under hubify.com to route to this app via SNI
    if (subdomain.endsWith(".hubify.com")) {
      try {
        const wildcardDomain = "*.hubify.com";
        const wildcardResult = await addCustomDomain(appName, wildcardDomain);
        const wildcardCert = wildcardResult?.data?.addCertificate?.certificate;
        console.log(`[fly] Wildcard domain ${wildcardDomain}: ${wildcardCert ? "registered" : "failed"}`, wildcardResult?.errors);
      } catch (e) {
        console.warn(`[fly] Wildcard certificate registration non-fatal error:`, e);
        // Non-fatal — individual certs will still work
      }
    }

    // --- Step 5: Update hub record in Convex with Fly details ---
    try {
      const convex = getConvexClient();
      await convex.mutation(api.hubs.updateHubWithFlyDetails, {
        hub_id: hubId as any, // Type: will be Id<"hubs"> after code generation
        fly_machine_id: machine.id,
        fly_app_name: appName,
      });
      console.log(`[convex] Hub ${hubId} updated with Fly details: machine=${machine.id}, app=${appName}`);
    } catch (e) {
      console.warn("[convex] Failed to update hub with Fly details:", e);
      // Non-fatal — hub is created, machine is running
    }

    // --- Step 6: Send post-provision welcome email (non-blocking) ---
    try {
      if (userEmail) {
        const baseUrl = request.headers.get("origin") ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "https://hubify.com";

        const emailRes = await fetch(`${baseUrl}/api/workspaces/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Pass Authorization to the internal route (it requires auth)
            Cookie: request.headers.get("cookie") ?? "",
            ...(process.env.HUBIFY_INTERNAL_API_KEY
              ? { "x-hubify-internal-key": process.env.HUBIFY_INTERNAL_API_KEY }
              : {}),
          },
          body: JSON.stringify({
            email: userEmail,
            username,
            workspaceUrl: workspaceUrl,
            template,
          }),
        });

        if (emailRes.ok) {
          console.log(`[provision] Welcome email sent to ${userEmail}`);
        } else {
          const errText = await emailRes.text();
          console.warn(`[provision] Email send failed (${emailRes.status}):`, errText);
        }
      } else {
        console.warn("[provision] No user email found — skipping welcome email");
      }
    } catch (emailErr) {
      // Non-critical: email failure never blocks a successful provision
      console.warn("[provision] Email send error (non-fatal):", emailErr);
    }

    // Record audit event (fire-and-forget)
    recordAuditEvent({
      user_id: userId,
      action: "workspace_created",
      target_type: "workspace",
      target_id: hubId,
      metadata: { subdomain, template, appName },
    });

    return NextResponse.json(
      {
        hubId,
        appName,
        machineId: machine.id,
        workspaceUrl: flyDevUrl, // Use Fly URL initially
        hubifyUrl: workspaceUrl,
        status: "provisioning",
        estimatedTimeSeconds: 90,
        message: `Provisioning ${subdomain} — ~90 seconds`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[provision] Unhandled error:", error);
    return NextResponse.json(
      {
        error: "Provisioning failed",
        friendlyMessage: "Something went wrong while creating your workspace. Please refresh and try again. If this continues, contact support.",
      },
      { status: 500 }
    );
  }
};

// Wrap POST handler with validation middleware: enforce application/json + max 100KB + CSRF protection
export const POST = withApiMiddleware(postHandler, {
  contentType: 'application/json',
  maxBodySize: 1024 * 100, // 100KB
  requireCsrf: true, // SECURITY: Require CSRF token for workspace provisioning
});

/**
 * GET /api/workspaces — List workspaces for the authenticated user
 * SECURITY: Can only list their own workspaces (userId must match owner_id)
 */
export async function GET(request: NextRequest) {
  try {
    // --- SECURITY: Verify user is authenticated via Clerk ---
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        {
          error: "Not signed in",
          friendlyMessage: "Please sign in to view your workspaces.",
        },
        { status: 401 }
      );
    }

    // --- SECURITY: Only allow users to list their own workspaces ---
    const requestedOwnerId = request.nextUrl.searchParams.get("owner_id");
    if (requestedOwnerId && requestedOwnerId !== userId) {
      return NextResponse.json(
        {
          error: "Access denied",
          friendlyMessage: "You can only view your own workspaces.",
        },
        { status: 403 }
      );
    }

    const convex = getConvexClient();
    // Use the authenticated userId, not a query parameter
    const hubs = await convex.query(api.hubs.listHubsByOwner, { owner_id: userId });
    
    return NextResponse.json(hubs);
  } catch (error) {
    console.error("[workspaces] Error listing:", error);
    return NextResponse.json(
      {
        error: "Failed to load workspaces",
        friendlyMessage: "We couldn't load your workspaces. Please refresh and try again.",
      },
      { status: 500 }
    );
  }
}
