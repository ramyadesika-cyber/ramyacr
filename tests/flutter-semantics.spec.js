import { test, expect, chromium } from "@playwright/test";

test("Flutter semantics experiment", async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create CDP session
  const client = await context.newCDPSession(page);

  // Enable accessibility domain
  await client.send("Accessibility.enable");

  await page.goto("http://91.108.104.154:8802/");

  // Wait for Flutter
  await page.waitForTimeout(8000);

  // Dump accessibility tree (debug)
  const tree = await client.send("Accessibility.getFullAXTree");
  console.log("AX TREE SIZE:", tree.nodes.length);

  // Try locating elements
  await page.getByRole("textbox").first().click();
  await page.keyboard.type("test@example.com");

  await browser.close();
});
