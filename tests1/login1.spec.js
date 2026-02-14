const { test, expect } = require('@playwright/test');

test('Valid Login', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.fill('input[name="username"]', 'Admin');
  await page.fill('input[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
});

test('should display an error for invalid password', async ({ page }) => {
  await page.goto('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login');
  await page.fill('input[name="username"]', 'Admin');
  await page.fill('input[name="password"]', 'aadmin12'); // wrong password
  await page.click('button[type="submit"]');

  // Wait for the alert to appear before asserting its content
  await page.waitForSelector('.oxd-alert-content-text'); 

  // Assert that the alert contains the expected error message
  await expect(page.locator('.oxd-alert-content-text')).toContainText('Invalid credentials');
  
  // Assert that the URL is still on the login page
  await expect(page).toHaveURL(/auth\/login/);
});