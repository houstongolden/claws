---
name: email-draft
version: "1.0.0"
tier: universal
category: communication
description: "Draft emails from context and tone — reads your style from USER.md, never sends without approval"
metadata:
  openclaw:
    triggers:
      - "draft an email"
      - "write an email"
      - "reply to"
      - "email draft"
      - "compose an email"
      - "write a reply"
    outputs:
      - chat_response
    try_me: 'Say: "Draft an email to my team about the product launch"'
---

# Email Draft

Draft professional emails using your context and tone. Never sends — always presents for your approval.

## Try It Now

Say: **"Draft an email to my team about the product launch"**

## What It Does

- Drafts emails matched to your communication style
- Reads USER.md for your name, role, and sign-off preferences
- Adapts tone: formal, casual, urgent, diplomatic
- Presents draft for review — NEVER sends automatically
- If gog (Gmail) skill is installed, can create a Gmail draft

## How It Works

When the user asks to draft an email:

1. **Gather context:**
   - Read USER.md for name, role, company, and communication preferences
   - Check if sign-off preference is specified (e.g., "Best," "Cheers," "Thanks,")
   - Understand the recipient and relationship from the request

2. **Determine tone** from context:
   - **Formal** — external clients, investors, partners
   - **Professional** — colleagues, vendors, general business
   - **Casual** — teammates, friends, informal updates
   - **Urgent** — time-sensitive, needs immediate action

3. **Draft the email:**

```
**To:** [recipient]
**Subject:** [clear, specific subject line]

---

[Email body — matched to tone and context]

[Sign-off from USER.md preferences or appropriate default]
[User's name]
```

4. **Present for review** — show the draft and ask:
   - "Ready to go, or want me to adjust anything?"
   - If gog skill is installed: "Want me to create this as a Gmail draft?"

5. **Never send directly** — this skill drafts only. The user reviews and sends.

## Outputs

- Chat response with the formatted email draft
- Optional: Gmail draft if gog skill is connected and user approves

## Configuration

No configuration needed. Works immediately.

To personalize:
- Add your sign-off preference to USER.md: `sign_off: "Best,"`
- Add your title/role: helps with appropriate closings
- Add communication style notes: "I prefer concise emails" or "always include a personal touch"

## Important

This skill will **never** send an email on your behalf. It drafts, you review and send. This is a core safety principle.
