# Claws Design System — DESIGN.md v2

**Status:** BINDING. Every Claws UI surface MUST follow this.
**Last updated:** 2026-04-08
**Applies to:** landing page (`apps/web`), Studio (`apps/studio`), experimental OS dashboard (`apps/dashboard`), CLI output (`packages/cli`)

> Agent instruction: when building or modifying any user-facing surface in Claws, read this file first. Match the tokens, the spacing scale, the component patterns, and the aesthetic rules below. If you find yourself wanting to invent a color, a font, a spacing value, or a component style that isn't in this doc — stop and update this doc first, then use it.

---

## Aesthetic direction

**"Terminal-native."** Claws looks like what happens when a senior engineer designs a GUI that respects the CLI: monospace everywhere structurally significant, minimal chrome, generous negative space, a single confident accent color, and zero decoration. No gradients beyond a single hero glow. No 3-column icon grids. No glassmorphism. No purple.

Reference feel: Cursor, Vercel, Linear's command palette, GitHub's `gh` CLI, a well-designed `tmux` session.
Not reference feel: Lovable, v0's marketing site, Notion, Stripe, Figma.

**Three rules, ordered:**
1. **Data over decoration.** If a pixel doesn't convey state, status, content, or input affordance, cut it.
2. **Monospace is primary for structure.** UI chrome, labels, stats, code, terminal output, agent names, and tool names ALL use mono. Prose and long-form reading use sans.
3. **One accent color, used sparingly.** Red is for action, status, and identity — not decoration. Most pixels are black, white, or gray.

---

## Color tokens

All colors are defined as CSS variables. **Never hardcode a color outside these tokens.**

### Dark mode (default — light mode comes later)

```css
:root {
  /* Background stack — 4 levels of elevation, all near-black */
  --color-bg:            #000000;  /* page background */
  --color-surface-1:     #0a0a0a;  /* cards, composer */
  --color-surface-2:     #141414;  /* raised (hover, active) */
  --color-surface-3:     #1f1f1f;  /* borders, dividers */

  /* Text — 4 levels of hierarchy */
  --color-text-primary:   #ededed;  /* default body + headings */
  --color-text-secondary: #a3a3a3;  /* subtitles, descriptions */
  --color-text-muted:     #737373;  /* labels, captions, placeholders */
  --color-text-ghost:     #555555;  /* disabled, hints, inline metadata */

  /* Brand accent — THE Claws red. Used for CTAs, active states, and identity. */
  --color-brand:          #ff3344;
  --color-brand-hover:    #ff4d5c;
  --color-brand-dim:      #7a1921;  /* dim bg tint for subtle brand presence */
  --color-brand-ring:     #ff334466; /* focus ring alpha */

  /* Status — used for state, NOT decoration */
  --color-success:        #30a46c;
  --color-warning:        #f5a623;
  --color-info:           #4a9eff;
  --color-error:          #ff3344;  /* same as brand — red is red */

  /* Agent states (Claws-specific, used in agent tree) */
  --color-agent-idle:     #737373;
  --color-agent-working:  #4a9eff;  /* pulses */
  --color-agent-blocked:  #f5a623;
  --color-agent-done:     #30a46c;
  --color-agent-error:    #ff3344;
}
```

### Forbidden colors

Do NOT use: purple, blue gradients, teal, pink, cyan, any neon, any unapproved hex. If you need a new color, it goes here first.

### Color usage rules

- **Red (`--color-brand`) only for:** primary CTAs, active nav item, error states, the Claws 🦞 mark, selected/active tabs, approval/alert counts when > 0
- **Green (`--color-success`) only for:** success messages, "connected" / "online" / "done" states, positive diff
- **Amber (`--color-warning`) only for:** warnings, "blocked" state, caution
- **Blue (`--color-info`) only for:** informational links, "working"/in-progress state, clickable but not primary
- **Everything else** is grayscale

---

## Typography

### Font stack

```css
--font-sans: 'Geist Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace;
```

### When to use which

| Context | Font |
|---------|------|
| Page titles, hero text | **Sans** (weight 700-800, tight tracking) |
| Section headings | **Sans** (weight 600) |
| Body prose, descriptions, long-form | **Sans** (weight 400) |
| **Labels, captions, stats, metric values** | **Mono** |
| **CLI commands, code blocks, file paths** | **Mono** |
| **Agent names, tool names, session IDs** | **Mono** |
| **Navigation items, sidebar items** | **Mono** (small) |
| Button text | **Sans** (weight 500-600) |
| Status pills, badges | **Mono** (uppercase, tight tracking) |

**The rule:** anything structurally significant or machine-identifiable (IDs, commands, paths, code, labels) gets monospace. Anything meant to be read as prose gets sans.

### Size scale

```css
--text-xs:    11px;  /* labels, captions, metric labels */
--text-sm:    12px;  /* body small, sidebar items, stats (mono) */
--text-base:  13px;  /* default body, sans */
--text-md:    14px;  /* emphasis, composer */
--text-lg:    16px;  /* small headings */
--text-xl:    18px;  /* H3 */
--text-2xl:   22px;  /* H2 */
--text-3xl:   28px;  /* page titles */
--text-4xl:   40px;  /* section heroes */
--text-5xl:   56px;  /* landing hero */
--text-6xl:   72px;  /* landing hero on desktop */
```

**Default body is 13px, not 16px.** Density matters. Claws users are developers who want to see more data on screen, not be hand-held by huge type.

### Line height + tracking

```css
body { line-height: 1.5; }
h1 { letter-spacing: -0.025em; }
h2 { letter-spacing: -0.020em; }
h3 { letter-spacing: -0.015em; }
.mono { letter-spacing: -0.005em; }
```

---

## Spacing

**4px base unit.** Every gap, padding, or margin must be a multiple of 4.

```css
--space-px:   1px;
--space-0:    0;
--space-1:    4px;
--space-2:    8px;
--space-3:    12px;
--space-4:    16px;
--space-5:    20px;
--space-6:    24px;
--space-8:    32px;
--space-10:   40px;
--space-12:   48px;
--space-16:   64px;
--space-20:   80px;
--space-24:   96px;
```

### Component-specific spacing

| Component | Value |
|-----------|-------|
| Card padding | `--space-5` (20px) |
| Composer padding | `--space-4` (16px) |
| Button padding Y | `--space-2` (8px) |
| Button padding X | `--space-4` (16px) |
| Section gap | `--space-6` to `--space-8` |
| Page top padding | `--space-20` (80px) — hero; `--space-12` (48px) — other pages |
| Sidebar width | 240px |
| Content max-width | 1280px (mission control); 720px (prose-heavy pages) |

---

## Border radius

```css
--radius-none:  0;
--radius-sm:    4px;   /* buttons, inputs, badges */
--radius-md:    6px;   /* default */
--radius-lg:    8px;   /* cards */
--radius-xl:    12px;  /* modals, hero panels */
--radius-full:  9999px; /* pills, status dots */
```

**Rule:** smaller than the Vercel dashboard, bigger than `tmux`. Use `--radius-md` (6px) as the default. Cards use `--radius-lg` (8px). Status pills use `--radius-full`.

---

## Shadows

Minimal. Dark mode mostly uses 1px borders instead of shadows.

```css
--shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md:    0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg:    0 8px 24px rgba(0, 0, 0, 0.5);
--shadow-glow:  0 0 24px rgba(255, 51, 68, 0.15);  /* brand glow, use SPARINGLY */
```

The hero section on the landing page can have ONE `--shadow-glow` behind the headline. Nowhere else in the app gets a glow. Cards use `--shadow-sm` or no shadow at all.

---

## Motion

```css
--duration-fast:    150ms;
--duration-normal:  200ms;
--duration-slow:    400ms;
--ease-out:         cubic-bezier(0.16, 1, 0.3, 1);
```

### Motion rules

- **Always `prefers-reduced-motion` aware.**
- **Hover:** 150ms ease-out
- **State transitions** (e.g., agent idle → working): 200ms ease-out
- **Agent "working" pulse:** 2s ease-in-out, 0.45 → 1.0 opacity
- **Page transitions:** NONE
- **Scroll animations:** NONE
- **Parallax:** NONE
- **Auto-playing carousels:** NONE
- **Animated background gradients:** NONE

---

## Components

### Buttons

Three variants only:

| Variant | Background | Text | Border | Use for |
|---------|-----------|------|--------|---------|
| **primary** | `--color-brand` | white | none | CTAs, submit, "Install" |
| **secondary** | `--color-surface-2` | `--color-text-primary` | 1px `--color-surface-3` | Secondary actions |
| **ghost** | transparent | `--color-text-secondary` | none (hover: surface-2) | Nav items, inline actions |

```css
.btn {
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
  letter-spacing: -0.005em;
}
.btn-sm { height: 28px; padding: 0 12px; font-size: 12px; }
.btn-lg { height: 40px; padding: 0 20px; font-size: 14px; }
```

Never use: gradient buttons, glow buttons, button shadows, animated button borders.

### Inputs

```css
.input {
  font-family: var(--font-mono);  /* YES, mono. Claws is terminal-native. */
  font-size: 13px;
  background: var(--color-surface-1);
  color: var(--color-text-primary);
  border: 1px solid var(--color-surface-3);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  height: 36px;
}
.input:focus {
  border-color: var(--color-brand);
  box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-brand-ring);
  outline: none;
}
```

### Cards

```css
.card {
  background: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: var(--radius-lg);
  padding: 20px;
}
.card-interactive:hover {
  border-color: color-mix(in srgb, var(--color-text-muted) 40%, var(--color-surface-3));
  background: var(--color-surface-2);
}
```

No card shadows by default. Borders do the job.

### Status pills

```css
.pill {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  border: 1px solid;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pill-success { color: var(--color-success); border-color: color-mix(in srgb, var(--color-success) 30%, transparent); background: color-mix(in srgb, var(--color-success) 8%, transparent); }
.pill-warning { color: var(--color-warning); border-color: color-mix(in srgb, var(--color-warning) 30%, transparent); background: color-mix(in srgb, var(--color-warning) 8%, transparent); }
.pill-brand   { color: var(--color-brand);   border-color: color-mix(in srgb, var(--color-brand) 30%, transparent);   background: color-mix(in srgb, var(--color-brand) 8%, transparent); }
.pill-muted   { color: var(--color-text-muted); border-color: var(--color-surface-3); background: var(--color-surface-1); }
```

### Agent status dots

```css
.agent-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.agent-dot[data-state="idle"]    { background: var(--color-agent-idle); }
.agent-dot[data-state="working"] { background: var(--color-agent-working); animation: agent-pulse 2s ease-in-out infinite; }
.agent-dot[data-state="blocked"] { background: var(--color-agent-blocked); }
.agent-dot[data-state="done"]    { background: var(--color-agent-done); }
.agent-dot[data-state="error"]   { background: var(--color-agent-error); }

@keyframes agent-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
}
```

### Terminal block

```css
.terminal {
  background: var(--color-surface-1);
  border: 1px solid var(--color-surface-3);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.55;
}
.terminal-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-surface-3);
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-bg);
}
.terminal-dot {
  width: 12px; height: 12px; border-radius: var(--radius-full);
}
.terminal-dot-1 { background: var(--color-brand); }
.terminal-dot-2 { background: var(--color-warning); }
.terminal-dot-3 { background: var(--color-success); }
.terminal-body {
  padding: 20px;
  color: var(--color-text-secondary);
}
.terminal-prompt { color: var(--color-success); }
.terminal-cmd    { color: var(--color-text-primary); }
.terminal-output { color: var(--color-text-muted); }
```

---

## Layout

### Page shell

```
┌──────────────────────────────────────────────────────────────┐
│  Nav (sticky, glass-bar, 56px)                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Content area                                                │
│  (max-width 1280px for dashboard, 720px for prose)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Dashboard shell (experimental OS)

```
┌──────────────────────────────────────────────────────────────┐
│  Nav (sticky, 44px)                                          │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                     │
│ Side   │  Main content                                       │
│ 240px  │  1040px max (1280 - 240)                           │
│        │                                                     │
├────────┴─────────────────────────────────────────────────────┤
│  Composer dock (floating, at bottom for chat views)          │
└──────────────────────────────────────────────────────────────┘
```

---

## Anti-patterns — NEVER

- ❌ Purple gradients
- ❌ 3-column icon feature grids with generic stock emojis
- ❌ Centered hero text with decorative blobs
- ❌ Glassmorphism beyond the 1 top-bar glass-bar
- ❌ Glowing buttons
- ❌ Auto-playing demos / videos
- ❌ "Trusted by" logo marquees
- ❌ Light theme v1 (dark-only until explicitly scoped)
- ❌ System/Arial/Inter/Roboto fallbacks showing — always load Geist
- ❌ Any non-token color
- ❌ Rounded corners > 12px (pill-shaped things being the only exception)
- ❌ Page transitions, scroll animations, parallax
- ❌ Skeuomorphic textures, paper textures, noise overlays
- ❌ Motion beyond 400ms

---

## Surface implementation checklist

When building any new page or component, verify:

- [ ] Uses only tokens from `--color-*`, `--space-*`, `--text-*`, `--radius-*`
- [ ] Monospace for all structural/identifier text
- [ ] Sans for all prose
- [ ] Body text is 13px by default
- [ ] No color outside the palette
- [ ] Brand red is used once or twice max per view (CTA + active state + logo mark)
- [ ] Borders over shadows for card separation
- [ ] Hover states respect 150ms timing
- [ ] `prefers-reduced-motion: reduce` media query present where motion exists
- [ ] No forbidden patterns
