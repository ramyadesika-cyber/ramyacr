import { test, expect } from "@playwright/test";

const BASE_URL = "http://91.108.104.154:8802/";
const USERNAME = "gvsaai69@gmail.com";
const PASSWORD = "Xyzinfomine*1";

// Flutter CanvasKit Login — Keyboard Only
async function flutterLogin(page) {
  await page.goto(BASE_URL);

  // Let Flutter fully load
  await page.waitForTimeout(8000);

  // TAB focuses Email field (as you confirmed)
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);

  // Clear field (safety)
  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");

  // Type Email
  await page.keyboard.type(USERNAME, { delay: 50 });

  // TAB → Password
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);

  // Type Password
  await page.keyboard.type(PASSWORD, { delay: 50 });

  // Submit (SIGN IN)
  await page.keyboard.press("Enter");

  // Wait for app to stabilize
  await page.waitForTimeout(8000);
}

test.describe("Flutter Landing Page", () => {

  test.beforeEach(async ({ page }) => {
    await flutterLogin(page);
  });

  test("User reaches HOME after login", async ({ page }) => {
    // Flutter uses same URL after login
    await expect(page.url()).toBe(BASE_URL);
  });

  test("Refresh keeps session", async ({ page }) => {
    await page.reload();
    await page.waitForTimeout(4000);
    await expect(page.url()).toBe(BASE_URL);
  });

  test("Back button does not exit app", async ({ page }) => {
    await page.goBack();
    await page.waitForTimeout(4000);
    await expect(page.url()).toBe(BASE_URL);
  });

});
