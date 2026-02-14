const { test, expect } = require('@playwright/test');
const { signupUser } = require('../utils/signup');

test('Full flow: Signup + Add 2 items to cart', async ({ page }) => {

  // STEP 1: SIGNUP
  await signupUser(page);

  // After signup, go back to homepage
  await page.click('a[href="/"]');
  await expect(page).toHaveURL('https://automationexercise.com/');

  // STEP 2: Add 2 items to the cart

  // Go to products
  await page.click('a[href="/products"]');
  await expect(page).toHaveURL(/products/);

  // Add first item
  await page.hover('.productinfo');
  await page.click('a[data-product-id="1"]');
   
  const modal = page.locator('#cartModal');
  await expect(modal).toBeVisible();

  await page.click('.btn.btn-success.close-modal.btn-block'); // Continue Shopping

  // Add second item
  await page.hover('.productinfo >> nth=1');
  await page.click('a[data-product-id="2"]');
   
  await expect(modal).toBeVisible();

  const viewCartLink = modal.locator('a[href="/view_cart"]');
  await viewCartLink.click();

  await expect(page).toHaveURL(/view_cart/);

  const cartRows = page.locator('tr[id^="product-"]');
  await expect(cartRows).toHaveCount(2);

  await expect(page.locator('#product-1 .cart_description')).toContainText('Blue Top');
  await expect(page.locator('#product-2 .cart_description')).toContainText('Men Tshirt');
});