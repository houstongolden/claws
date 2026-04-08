---
name: strava
description: Read Strava activity data for fitness tracking, accountability, and weekly summaries. Requires a connected Strava account via Hubify integrations.
homepage: https://www.strava.com/api/v3
metadata:
  {
    "openclaw": {
      "icon": "strava",
      "requires": { "env": ["STRAVA_ACCESS_TOKEN"] },
      "integration": "strava"
    }
  }
---

# Strava Skill

Access Strava activity data via the Strava API v3. Use this for fitness tracking, accountability nudges, weekly summaries, and workout logging.

## Setup

Connect your Strava account at `{{SUBDOMAIN}}/integrations`. Once connected, `STRAVA_ACCESS_TOKEN` will be available automatically and refreshed as needed.

## Authentication

Strava uses OAuth2. Tokens are managed by Hubify — do not store them manually.

```bash
# Test connection
curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  https://www.strava.com/api/v3/athlete | jq '.firstname, .lastname'
```

## Common Operations

### Get Recent Activities
```bash
# Last 10 activities
curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  "https://www.strava.com/api/v3/athlete/activities?per_page=10" | \
  jq '[.[] | {name, type, distance, moving_time, start_date_local, suffer_score}]'
```

### Today's Activity Check
```bash
# Activities from today (Unix timestamp for midnight today)
TODAY=$(date -d "today 00:00" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M" "$(date +%Y-%m-%d) 00:00" +%s)
curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  "https://www.strava.com/api/v3/athlete/activities?after=$TODAY&per_page=5" | \
  jq 'length'
```

### Weekly Summary
```bash
# Activities from this week
WEEK_START=$(date -d "last monday" +%s 2>/dev/null || date -v-mon +%s)
curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  "https://www.strava.com/api/v3/athlete/activities?after=$WEEK_START&per_page=20" | \
  jq '[.[] | {type, distance_km: (.distance/1000 | . * 10 | round / 10), duration_min: (.moving_time/60 | floor)}]'
```

### Athlete Stats
```bash
# Get athlete ID first
ATHLETE_ID=$(curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  https://www.strava.com/api/v3/athlete | jq -r '.id')

# Then get stats
curl -s -H "Authorization: Bearer $STRAVA_ACCESS_TOKEN" \
  "https://www.strava.com/api/v3/athletes/$ATHLETE_ID/stats" | \
  jq '{
    ytd_run_km: (.ytd_run_totals.distance/1000 | round),
    ytd_swim_km: (.ytd_swim_totals.distance/1000 | round),
    ytd_ride_km: (.ytd_ride_totals.distance/1000 | round)
  }'
```

## Accountability Logic

```
If no activity logged today AND time > 19:00 local:
  → Send accountability nudge
  
If no activity logged in 3+ days:
  → Goggins mode: stronger nudge, ask what's going on

If weekly target set in USER.md AND pace is behind:
  → Flag on Sunday evening
```

## Distance Units

Strava returns distances in **meters**. Convert:
- Kilometers: `distance / 1000`
- Miles: `distance / 1609.34`

Moving time is in **seconds**. Convert to minutes: `moving_time / 60`

## Notes

- Read-only access is sufficient for accountability tracking
- Strava rate limits: 100 requests/15min, 1000/day — batch checks conservatively
- Token auto-refreshes via Hubify every 6 hours
