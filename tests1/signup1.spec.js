const { expect } = require('@playwright/test');

async function signupUser(page) {

  // 1. Go to home page
  await page.goto('https://automationexercise.com/');
  await expect(page).toHaveTitle(/Automation Exercise/);

  // 2. Click Signup/Login
  await page.click('a[href="/login"]');

  // 3. New User Signup section visible
  await expect(page.locator('text=New User Signup!')).toBeVisible();

  // 4. Generate unique email
  const uniqueEmail = `john${Date.now()}@example.com`;
  console.log("Generated email:", uniqueEmail);

  // 5. Fill basic info
  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[data-qa="signup-email"]', uniqueEmail);

  // 6. Click Signup button
  await page.click('button[data-qa="signup-button"]');

  // 7. Enter Account Information
  await expect(page.locator('text=Enter Account Information')).toBeVisible();

  await page.check('#id_gender1');
  await page.fill('#password', 'Password123');

  await page.selectOption('#days', '10');
  await page.selectOption('#months', '5');
  await page.selectOption('#years', '1990');

  await page.check('#newsletter');
  await page.check('#optin');

  // 8. Address details
  await page.fill('#first_name', 'John');
  await page.fill('#last_name', 'Doe');
  await page.fill('#address1', '123 Test Street');
  await page.selectOption('#country', 'India');
  await page.fill('#state', 'Tamil Nadu');
  await page.fill('#city', 'Chennai');
  await page.fill('#zipcode', '600001');
  await page.fill('#mobile_number', '9876543210');

  // 9. Click Create Account
  await page.click('button[data-qa="create-account"]');

  // 10. Wait for success message
  await expect(page.locator('text=Account Created!')).toBeVisible();

  return uniqueEmail;  // return email to use in login tests
}

module.exports = { signupUser };