# Hubify wildcard routing — DNS + Fly cert setup

This app (`hubify-caddy`) is the wildcard gateway for `*.hubify.com` and must be fronted by Fly-managed TLS.

## Current Fly cert status
```
flyctl certs list -a hubify-caddy
# *.hubify.com  Fly  Not verified
```

## Required DNS records
Use **one** of the two routing options below, plus the ACME challenge.

### Option 1 — A/AAAA (recommended)
```
A    *.hubify.com   66.241.125.37
AAAA *.hubify.com   2a09:8280:1::d7:4df6:0
```

### Option 2 — CNAME
```
CNAME *.hubify.com   9lgdn5x.hubify-caddy.fly.dev
```

### ACME DNS challenge (required for wildcard cert)
```
CNAME _acme-challenge.hubify.com   hubify.com.9lgdn5x.flydns.net
```

## Important
- **Remove or update any explicit subdomain records** (e.g., `houston.hubify.com`) that bypass the wildcard.
- The wildcard record must route to **hubify-caddy**, not the individual workspace apps.

## Verify
After DNS propagates:
```
flyctl certs show '*.hubify.com' -a hubify-caddy
# Status should become "Ready"
```

Then test routing via Caddy:
```
curl -I https://hubify-caddy.fly.dev -H "Host: houston.hubify.com"
# Expect 301/302 to https://houston.hubify.com (from workspace)
```

Finally, confirm a real wildcard host resolves:
```
curl -I https://<username>.hubify.com
```
