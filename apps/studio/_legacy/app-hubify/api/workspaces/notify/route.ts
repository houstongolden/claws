import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { apiUnauthorized, apiError, apiServerError } from "@/lib/api-errors";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Hubify <hello@hubify.com>";
const HUBIFY_INTERNAL_API_KEY = process.env.HUBIFY_INTERNAL_API_KEY;

function buildEmail({
  username,
  workspaceUrl,
  template,
}: {
  username: string;
  workspaceUrl: string;
  template: string;
}) {
  const subject = "Your Hubify workspace is ready";
  const intro = `Your workspace is live at ${workspaceUrl}.`;
  const nextSteps = [
    "Open your workspace and complete onboarding",
    "Connect your local OpenClaw instance: run `npx hubify connect`",
    "Invite agents or teammates and start deploying skills",
  ];

  const text = [
    subject,
    "",
    intro,
    "",
    `Workspace URL: ${workspaceUrl}`,
    `Workspace name: ${username}`,
    `Template: ${template}`,
    "Connect command: npx hubify connect",
    "",
    "Next steps:",
    ...nextSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Need help? Reply to this email and we’ll jump in.",
  ].join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #1f1f1f;">
      <h2 style="margin: 0 0 12px;">${subject}</h2>
      <p style="margin: 0 0 12px;">${intro}</p>
      <p style="margin: 0 0 12px;">
        <strong>Workspace URL:</strong>
        <a href="${workspaceUrl}">${workspaceUrl}</a><br />
        <strong>Workspace name:</strong> ${username}<br />
        <strong>Template:</strong> ${template}
      </p>
      <p style="margin: 0 0 16px;"><strong>Connect command:</strong></p>
      <pre style="margin: 0 0 16px; padding: 12px; background: #f6f6f6; border-radius: 8px;">npx hubify connect</pre>
      <p style="margin: 16px 0 8px;"><strong>Next steps</strong></p>
      <ol style="margin: 0 0 16px 18px; padding: 0;">
        ${nextSteps.map((step) => `<li style="margin-bottom: 6px;">${step}</li>`).join("")}
      </ol>
      <p style="margin: 0;">Need help? Reply to this email and we’ll jump in.</p>
    </div>
  `;

  return { subject, text, html };
}

export async function POST(request: NextRequest) {
  try {
    const internalKey = request.headers.get("x-hubify-internal-key");
    const isInternal =
      HUBIFY_INTERNAL_API_KEY && internalKey === HUBIFY_INTERNAL_API_KEY;

    // SECURITY: Verify user is authenticated via Clerk (unless internal key is provided)
    if (!isInternal) {
      const { userId } = await auth();
      if (!userId) {
        return apiUnauthorized();
      }
    }

    const { email, username, workspaceUrl, template } = await request.json();

    if (!email || !username || !workspaceUrl) {
      return apiError('Missing required fields: email, username, and workspaceUrl are all required', 400, 'BAD_REQUEST');
    }

    if (!RESEND_API_KEY) {
      return apiServerError('Email service is not configured — contact support');
    }

    const { subject, text, html } = buildEmail({
      username,
      workspaceUrl,
      template: template || "myos",
    });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject,
        text,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("[resend] Failed:", errorText);
      return apiError('Failed to send workspace welcome email — the email service returned an error', 500, 'INTERNAL_ERROR');
    }

    const data = await resendResponse.json();

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error("[resend] Error:", error);
    return apiServerError('Failed to send workspace welcome email');
  }
}
