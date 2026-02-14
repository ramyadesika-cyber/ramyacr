const { test, expect } = require('@playwright/test');

test('Sign Up for a new user on automationexercise.com', async ({ page }) => {
  // Step 1: Go to the home page with increased timeout
  await page.goto('https://automationexercise.com/', { timeout: 60000 });  // Increased timeout to 60 seconds
  await expect(page).toHaveTitle(/Automation Exercise/);

  // Step 2: Go to Signup / Login page
  await page.click('a[href="/login"]'); // Click the "Signup / Login" link
  await expect(page).toHaveURL(/login/);

  // Step 3: Start new user signup
  await page.fill('input[name="name"]', 'Test User'); // Full Name for new user
  await page.fill('input[name="email"]', 'testuser@example.com'); // Email for new user
  await page.click('button[data-qa="signup-button"]'); // Submit the signup request

  // Step 4: Wait for the second part of the form to appear (user details) with increased timeout
  const passwordField = page.locator('input[name="password"]');
  await passwordField.waitFor({ state: 'visible', timeout: 60000 }); // Wait for password field to appear (max 60s)

  // Step 5: Fill in the rest of the user registration details
  await page.fill('input[name="password"]', 'TestPassword123'); // Password
  await page.fill('input[name="first_name"]', 'Test'); // First Name
  await page.fill('input[name="last_name"]', 'User'); // Last Name
  await page.fill('input[name="address1"]', '123 Test St'); // Address
  await page.fill('input[name="city"]', 'Test City'); // City
  await page.selectOption('select[name="state"]', { label: 'California' }); // State dropdown
  await page.fill('input[name="zipcode"]', '12345'); // Zipcode
  await page.fill('input[name="mobile_number"]', '1234567890'); // Mobile number

  // Step 6: Click 'Create Account' to submit the registration form
  await page.click('button[data-qa="create-account"]');

  // Step 7: Wait for navigation after account creation (wait for URL to change)
  await page.waitForNavigation({ timeout: 60000, waitUntil: 'networkidle' }); // Wait for navigation (max 60s)

  // Step 8: Wait for the success message after account creation
  const successMessage = await page.locator('.signup-msg'); // Success message locator
  await expect(successMessage).toContainText('Your Account Has Been Created!');
  
  // Step 9: Ensure that we are redirected to the "Account Created" page
  await expect(page).toHaveURL(/account_created/); // Verify the URL of the account creation page
});