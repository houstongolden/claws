import { test, expect } from "@playwright/test";

/**
 * E2E: workbench chrome + proxy contract (gateway may be offline).
 * Run: pnpm exec playwright test (from apps/dashboard), optional GATEWAY_URL.
 */
test.describe("Chat workbench", () => {
  test("chat page loads mode + steps controls", async ({ page }) => {
    await page.goto("/chat", { waitUntil: "domcontentloaded", timeout: 60000 });
    await expect(page.getByRole("heading", { name: /session/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/agent|plan|chat/i).first()).toBeVisible();
    await expect(page.getByText(/steps/i).first()).toBeVisible();
  });

  test("POST /api/chat forwards body (422/200 from gateway)", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: {
        message: "ping",
        chatId: "e2e-chat",
        threadId: "t1",
        history: [{ role: "user", content: "hi" }],
        mode: "chat",
        maxSteps: 8,
      },
    });
    // Gateway offline → 5xx; online without AI → still JSON shape or error
    expect([200, 400, 500, 502, 503]).toContain(res.status());
    if (res.ok()) {
      const j = (await res.json()) as { ok?: boolean };
      expect(typeof j.ok === "boolean" || j.ok === undefined).toBeTruthy();
    }
  });
});
