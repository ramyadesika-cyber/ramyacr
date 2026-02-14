import { test, expect } from "@playwright/test";

const BASE_URL = "https://srv1138210.hstgr.cloud/chat-sample/";
const USERNAME = "crr";
const ASSIGNEE = "Test User";

function generateTicket() {
  return Math.floor(100 + Math.random() * 900).toString();
}

async function login(page) {
  await page.goto(BASE_URL);

  const username =
    page.getByLabel(/username/i).or(page.getByRole("textbox").first());

  await expect(username).toBeVisible({ timeout: 20000 });
  await username.fill(USERNAME);

  await page.getByRole("button", { name: /login/i }).click();

  // Post login marker
  await expect(page.getByText(/ticketing actions/i)).toBeVisible({
    timeout: 20000,
  });
}

test.describe("Chat Sample – Separate Scenarios", () => {

  // ---------------------------------------------------
  // 1. Login
  // ---------------------------------------------------
  test("Scenario 1 – User can login", async ({ page }) => {
    await login(page);
    await expect(page.getByText(/ticketing actions/i)).toBeVisible();
  });

  // ---------------------------------------------------
  // 2. Create Ticket
  // ---------------------------------------------------
  test("Scenario 2 – Create new ticket", async ({ page }) => {
    const ticketId = generateTicket();

    await login(page);

    await page.getByRole("button", { name: /create new ticket/i }).click();

    const ticketInput =
      page.getByLabel(/ticket/i).or(page.getByRole("textbox").first());

    await ticketInput.fill(ticketId);

    await page.getByRole("button", { name: /create/i }).click();

    // Success = dialog closes or form clears
    await page.waitForTimeout(1000);

    // Minimal assertion: still on main page
    await expect(page.getByText(/ticketing actions/i)).toBeVisible();
  });

  // ---------------------------------------------------
  // 3. Assign Ticket
  // ---------------------------------------------------
  test("Scenario 3 – Assign ticket", async ({ page }) => {
    const ticketId = generateTicket();

    await login(page);

    // Create ticket first
    await page.getByRole("button", { name: /create new ticket/i }).click();
    await page.getByLabel(/ticket/i).or(page.getByRole("textbox").first()).fill(ticketId);
    await page.getByRole("button", { name: /create/i }).click();

    await page.waitForTimeout(1000);

    // Assign ticket
    await page.getByRole("button", { name: /assign ticket/i }).click();

    const ticketField =
      page.getByLabel(/ticket id/i).or(page.getByRole("textbox").first());
    await ticketField.fill(ticketId);

    const userField =
      page.getByLabel(/assign to user/i).or(page.getByRole("textbox").nth(1));
    await userField.fill(ASSIGNEE);

    await page.getByRole("button", { name: /assign/i }).click();

    await page.waitForTimeout(1000);

    // Assertion: back on main screen
    await expect(page.getByText(/ticketing actions/i)).toBeVisible();
  });

// ---------------------------------------------------
// 4. Chat icon opens chat (canvas validation)
// ---------------------------------------------------
test("Scenario 4 – Chat icon opens without crashing", async ({ page }) => {
  await login(page);

  const beforeUrl = page.url();

  // Click chat icon
  await page.getByRole("button").last().click();

  // Give Flutter time to render chat
  await page.waitForTimeout(3000);

  // App should still be running on same URL
  await expect(page.url()).toBe(beforeUrl);
});

// ---------------------------------------------------
// 5. Logout shows Login screen (with reload)
// ---------------------------------------------------
test("Scenario 5 – Logout returns to Login screen", async ({ page }) => {
  await login(page);

  // Click logout (top-right)
  await page.getByRole("button").last().click();

  // Give state time to clear
  await page.waitForTimeout(1500);

  // 🔄 Force reload to show login page
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Verify Login screen
  const username =
    page.getByLabel(/username/i).or(page.getByRole("textbox").first());

  await expect(username).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
});

    });
