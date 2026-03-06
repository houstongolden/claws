# Claws.so — Final Creative Director Pass

**Goal:** Feel credible next to ChatGPT, Claude, Perplexity, and Cursor — *“ChatGPT + Cursor + Vercel AI tools combined into a single AI OS.”*

---

## 1. Product clarity

**Before:** Session asked “What would you like to do?” with a feature list. Command chips used dev jargon (“status”, “project scaffold”, “task event”, “tool registry”). No single-line value prop.

**After:**

- **Session empty state**
  - Headline: **“Your AI workspace”**
  - Subline: **“Chat, build, and ship in one place. Projects, tasks, memory, and tools—all connected.”**
  - Suggestions label: **“Try these”** (action-oriented).
- **Command chips** (display labels only; commands unchanged):
  - Check status · New project · Log task · New draft · Search memory · List tools
- **Suggested prompts:** Added **“See workspace status”** as first suggestion (command: `status`) with note “View gateway, tools, and workspace root.” so new users have a safe first action.
- **Session header (when connected):** Subtitle set to **“Chat, build, and ship — projects, tasks, memory & tools”**.
- **Nav:** Session link description set to **“Chat, projects & tools”** (under “Session” in sidebar).
- **Context panel:** Intro copy set to **“Live context from this session: project focus, touched files, approvals, and traces.”**

**Result:** One clear value prop, friendlier first-touch language, and an obvious “start here” (status) suggestion.

---

## 2. Visual hierarchy

- **Existing:** Page titles (15px semibold), descriptions (13px muted), shell breadcrumb (Session → Page). Empty states use icon + title + description + optional CTA. No change made; hierarchy is already clear.
- **Recommendation:** If you add a marketing or landing layer, keep Session as the primary surface and use a single hero line (e.g. “Your AI workspace”) plus one subline so hierarchy stays consistent.

---

## 3. Interaction quality

- **Composer**
  - Placeholder: **“Message Claws…”** → **“Ask Claws anything…”** (aligned with ChatGPT/Claude).
  - When history is empty, help text under composer: **“Enter to send · Shift+Enter for new line · Try a suggestion above.”** When there is history: **“Enter to send · Shift+Enter for new line.”**
- **Sidecar empty states** (Context panel) — copy tightened and made more inviting:
  - Overview → Current task: “No task linked to this session yet.”
  - Overview → Current project: “Create or mention a project in chat to see it here.”
  - Overview → Files touched: “Files you read or write in chat will appear here.”
  - Project tab: “Create or mention a project in chat to see it here.” (unchanged)
  - Files tab: “No tracked file touches in this session yet.” (unchanged)
  - Approvals: “All clear. When Claws needs your approval, it’ll show here first.”
  - Memory: “Search memory in chat to see results here.”
  - Traces: “Tool calls and traces will appear here as you chat.”
  - Workflow: “Long-running workflows will appear here when started.”

**Result:** Clearer input affordance, contextual keyboard/onboarding hint, and consistent “what happens next” in empty states.

---

## 4. Polish level

- **Labels:** Command chips and Session subtitle now use product language, not internal/API terms.
- **Empty states:** Session hero + suggestions + sidecar copy all reinforce “your AI workspace” and what to do next.
- **Onboarding hints:** First suggestion = “See workspace status”; composer hint points to “suggestion above” when chat is empty.
- **Help text:** Context panel and composer hints updated as above. Page-level help (e.g. Approvals “What happens when you approve”) was already good; left as is.
- **Command suggestions:** Four suggested prompts including “See workspace status”; quick chips use the new labels.

---

## 5. Final polish improvements applied (summary)

| Area | Change |
|------|--------|
| Session empty | Headline “Your AI workspace”; subline “Chat, build, and ship…”; “Try these” |
| Suggested prompts | Added “See workspace status” first; kept 3 others |
| Command chips | Check status, New project, Log task, New draft, Search memory, List tools |
| Composer | Placeholder “Ask Claws anything…” |
| Composer help | “Try a suggestion above” when history empty |
| Session header | “Chat, build, and ship — projects, tasks, memory & tools” when online |
| Nav Session | Description “Chat, projects & tools” |
| Context panel | “Live context from this session: project focus, touched files, approvals, and traces.” |
| Sidecar empty copy | All nine empty states shortened and made action/outcome clear |

---

## 6. Remaining product quality gaps

**Credibility vs. ChatGPT / Claude / Perplexity / Cursor**

- **Gateway-down experience:** When the gateway is offline, the Session subtitle shows “Connecting…” but there’s no explicit “Connect the gateway to chat” or “Run the Claws gateway to get started” in the composer area. **Recommendation:** When `status?.gateway !== "online"` and hydrated, show a slim banner above the composer (e.g. “Connect the Claws gateway to chat and use tools”) with a link to docs or .env.example.
- **First-run / setup:** No in-app “First time here? Run the gateway and add your API keys” flow. **Recommendation:** Optional short setup checklist or link from the Session header when gateway has never been seen online.
- **Project drill-in breadcrumb:** On `/projects/[slug]`, the shell breadcrumb is “Session → Projects”. Showing the project name (“Session → Projects → My App”) would require layout/shell to resolve the slug to a name (e.g. from route or API). **Recommendation:** Low priority; add when you have a clean way to inject dynamic segment titles.
- **Visual identity:** Logo is 🦞; no custom wordmark or lockup. For a “final pass before public,” consider a simple “Claws” wordmark and favicon so it feels like a product, not a prototype.
- **Responsive:** Session context panel is `hidden xl:flex`; on smaller viewports there’s no way to see “live context” without going to other pages. **Recommendation:** Consider a drawer or bottom sheet for Context on tablet/mobile, or a “Context” pill that opens a slide-over.
- **Loading and errors:** Error state in chat is a single line of destructive text. **Recommendation:** Optional retry button or “Check gateway” link when error message suggests connectivity.
- **Accessibility:** Theme toggle and nav already have aria-labels; pagination and Create button were improved in QA. **Recommendation:** Run a quick pass with axe or Lighthouse to confirm contrast and focus order.

---

## 7. Conclusion

- **Product clarity:** Strong single-line value (“Your AI workspace” + “Chat, build, and ship…”) and friendlier labels/suggestions make the product understandable at a glance and comparable to leading AI UIs.
- **Visual hierarchy:** Already clear; no structural changes.
- **Interaction quality:** Composer placeholder, keyboard hint, and sidecar empty states now guide users and set expectations.
- **Polish:** Labels, empty states, onboarding hint, and command suggestions are aligned with an “AI OS” positioning.

With the gateway connected and API keys set, Claws now reads as a coherent “chat + build + ship” workspace. The main remaining gaps are **gateway-offline messaging**, **first-run/setup**, and **branding (wordmark/favicon)**; addressing those will bring it in line with the credibility bar of ChatGPT, Claude, Perplexity, and Cursor for a public launch.
