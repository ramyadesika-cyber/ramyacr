const { test, expect } = require('@playwright/test');
const { signupUser } = require('../utils/signup');

test('Add 2 items to cart on automationexercise.com', async ({ page }) => {
  await page.goto('https://automationexercise.com/');
  await expect(page).toHaveTitle(/Automation Exercise/);

  await page.click('a[href="/products"]');
  await expect(page).toHaveURL(/products/);

  await page.hover('.productinfo');
  await page.click('a[data-product-id="1"]');

  const modal = page.locator('#cartModal');
  await expect(modal).toBeVisible();

  await page.click('.btn.btn-success.close-modal.btn-block');
  await expect(modal).toBeHidden();

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
