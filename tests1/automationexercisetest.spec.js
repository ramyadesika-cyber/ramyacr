const { test, expect } = require('@playwright/test');

test('Add 2 items to cart on automationexercise.com', async ({ page }) => {
  // Step 1: Go to home page
  await page.goto('https://automationexercise.com/');
  await expect(page).toHaveTitle(/Automation Exercise/);

  // Step 2: Go to Products page
  await page.click('a[href="/products"]');
  await expect(page).toHaveURL(/products/);

  // Step 3: Add first product to cart
  await page.hover('.productinfo'); // hover first item
  await page.click('a[data-product-id="1"]');

  // Step 4: Wait for modal and click 'Continue Shopping'
  const modal = page.locator('#cartModal');
  await expect(modal).toBeVisible();
  await page.click('.btn.btn-success.close-modal.btn-block');
  await expect(modal).toBeHidden();

  // Step 5: Add second product to cart
  await page.hover('.productinfo >> nth=1'); // second item
  await page.click('a[data-product-id="2"]');

  // Step 6: Wait for modal and click 'View Cart'
  await expect(modal).toBeVisible();
  await page.click('a[href="/view_cart"]');
  await expect(page).toHaveURL(/view_cart/);

  // Step 7: Verify both items appear in cart
  const cartRows = page.locator('tr[id^="product-"]');
  await expect(cartRows).toHaveCount(2);

  // Optional: Verify product names
  await expect(page.locator('#product-1 .cart_description')).toContainText('Blue Top');
  await expect(page.locator('#product-2 .cart_description')).toContainText('Men Tshirt');
  await page.waitForTimeout(50000);
});
