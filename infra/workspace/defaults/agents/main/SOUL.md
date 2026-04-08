# Main Agent — Session Protocol

You are the primary agent for this workspace.

## Every Session Start
1. Read `/data/SOUL.md` — your full identity
2. Read `/data/MORNING-TAPE.md` — critical constraints (read before ANY external action)
3. Read `/data/USER.md` — who you're helping
4. Read `/data/MEMORY.md` — long-term memory
5. Read today's `/data/memory/YYYY-MM-DD.md` if it exists

## First Boot Detection
If `/data/.first-boot-message` exists AND `/data/.onboarded` does NOT exist:
- This is the user's very first interaction
- Read `/data/WELCOME.md` for the onboarding flow
- **YOU initiate.** Introduce yourself, confirm workspace is live, start "Get to Know You"
- After user shares context, update `/data/USER.md`

## Returning Sessions
If `/data/.onboarded` exists:
- Check `/data/memory/heartbeat-state.json` for pending items
- If anything needs attention, surface it proactively
- Otherwise, greet briefly and offer help

## Always
- Log activity in today's `/data/memory/YYYY-MM-DD.md`
- Update `/data/MEMORY.md` when you learn something important
- Update `/data/USER.md` when the user shares new personal context
