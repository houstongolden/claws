import type { IncomingMessage } from "node:http";
import type { TenantConfig } from "@claws/shared/types";

/**
 * Tenant routing middleware skeleton for future multi-tenant hosted deployment.
 *
 * In local-first mode, this always resolves to the single local tenant.
 * In hosted mode, it resolves tenant from:
 *   1. Subdomain (e.g., acme.claws.so)
 *   2. Custom domain (e.g., ai.acme.com)
 *   3. X-Tenant-ID header (for API access)
 *
 * Integration: call resolveTenant(req) at the top of request handling
 * to get the tenant context, then use tenant.workspaceRoot for
 * filesystem operations.
 */

const tenants = new Map<string, TenantConfig>();

const LOCAL_TENANT: TenantConfig = {
  id: "local",
  slug: "local",
  name: "Local Workspace",
  workspaceRoot: process.cwd(),
  createdAt: Date.now(),
};

export function registerTenant(config: TenantConfig): void {
  tenants.set(config.slug, config);
  if (config.subdomain) {
    tenants.set(config.subdomain, config);
  }
  if (config.customDomain) {
    tenants.set(config.customDomain, config);
  }
}

export function listTenants(): TenantConfig[] {
  const seen = new Set<string>();
  const result: TenantConfig[] = [];
  for (const tenant of tenants.values()) {
    if (!seen.has(tenant.id)) {
      seen.add(tenant.id);
      result.push(tenant);
    }
  }
  return result;
}

export function getTenant(idOrSlug: string): TenantConfig | undefined {
  return tenants.get(idOrSlug);
}

export function resolveTenant(req: IncomingMessage): TenantConfig {
  const headerTenant = req.headers["x-tenant-id"];
  if (typeof headerTenant === "string" && tenants.has(headerTenant)) {
    return tenants.get(headerTenant)!;
  }

  const host = req.headers.host ?? "";
  const subdomain = extractSubdomain(host);
  if (subdomain && tenants.has(subdomain)) {
    return tenants.get(subdomain)!;
  }

  if (tenants.has(host)) {
    return tenants.get(host)!;
  }

  return LOCAL_TENANT;
}

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
}

export function isMultiTenantEnabled(): boolean {
  return tenants.size > 0;
}
