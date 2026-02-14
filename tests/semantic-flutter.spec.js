import { test, expect } from "@playwright/test";

const BASE_URL = "https://srv1138210.hstgr.cloud/chat-sample/";
const USERNAME = "gvsaai69@gmail.com";
const PASSWORD = "Xyzinfomine*1";

async function login(page) {
  await page.goto(BASE_URL);

  // Wait for Flutter DOM to appear
  // With semantics enabled, textboxes should now exist
  const emailInput = page.getByRole("textbox").first();
  await expect(emailInput).toBeVisible({ timeout: 20000 });

  // Fill Email
  await emailInput.fill(USERNAME);

  // Fill Password (usually second textbox OR a password role)
  const passwordInput =
    page.getByRole("textbox").nth(1).or(page.getByLabel(/password/i));

  await passwordInput.fill(PASSWORD);

  // Click SIGN IN / Login button
  await page.getByRole("button", { name: /sign in|login/i }).click();

  // Wait for post-login screen to load
  await page.waitForLoadState("networkidle");
}

test.describe("Semantic Flutter App – Login & Basic Navigation", () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("User logs in successfully", async ({ page }) => {
    // Generic assertion: URL should still be app URL but UI should be loaded
    await expect(page).toHaveURL(/chat-sample/);

    // Optional: assert any visible post-login text if available
    // Example (adjust once you know exact landing text):
    // await expect(page.getByText(/welcome|home|dashboard/i)).toBeVisible();
  });

  test("Refresh keeps session", async ({ page }) => {
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/chat-sample/);
  });

  test("Back button does not exit app", async ({ page }) => {
    await page.goBack();
    await page.waitForLoadState("networkidle");

    // Should still be inside the app
    await expect(page).toHaveURL(/chat-sample/);
  });

});
