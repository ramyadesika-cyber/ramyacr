const { test, expect } = require('@playwright/test');

test('User Sign Up with Name and Email', async ({ page }) => {
  // Step 1: Navigate to the sign-up page
  await page.goto('https://www.automationexercise.com/signup');

  // Step 2: Ensure the New User Signup section is visible
  const newUserSignupSection = page.locator('text=New User Signup!');
  await expect(newUserSignupSection).toBeVisible();  // Ensure that the section is visible
  const uniqueEmail = `john.doe${Math.floor(Math.random() * 1000)}@example.com`;  // Example: john.doe123@example.com

  // Step 4: Fill in the Name and dynamically generated Email fields under the "New User Signup!" section
  await page.fill('input[name="name"]', 'John Doe'); // Name field
  await page.fill('input[data-qa="signup-email"]', uniqueEmail); // Dynamic Email field

  console.log("Generated email:", uniqueEmail); // For debugging, to see the generated email
  
  // Step 4: Click the "Signup" button to proceed to the next page
  const signupButton = page.locator('button[data-qa="signup-button"]'); // Target the correct sign-up button
  await expect(signupButton).toBeEnabled();  // Ensure the Signup button is enabled
  await signupButton.click();  // Click the Signup button

  // Step 5: Wait for the "Enter Account Information" section to load (checking for a password field)
  await page.waitForSelector('input[name="password"]');  // This selector waits for the password field

  // Step 6: Fill in the Account Information (Title, Password, Date of Birth, etc.)
  await page.check('input[name="title"][value="Mr"]'); // Check 'Mr' title
  await page.fill('input[name="password"]', 'password123'); // Password
  await page.selectOption('select[name="days"]', '10'); // Select Day of birth
  await page.selectOption('select[name="months"]', '5'); // Select Month of birth
  await page.selectOption('select[name="years"]', '1990'); // Select Year of birth
  await page.check('input[name="newsletter"]'); // Sign up for the newsletter
  await page.check('input[name="optin"]'); // Receive special offers from partners

  // Step 7: Fill in Address Information (First Name, Last Name, Address, Country, etc.)
  await page.fill('input[name="first_name"]', 'John');
  await page.fill('input[name="last_name"]', 'Doe');
  await page.fill('input[name="address1"]', '123 Main Street');
  await page.fill('input[name="address2"]', 'Apt 101');
  await page.selectOption('select[name="country"]', 'India');
  await page.fill('input[name="state"]', 'California');
  await page.fill('input[name="city"]', 'Los Angeles');
  await page.fill('input[name="zipcode"]', '90001');
  await page.fill('input[name="mobile_number"]', '9876543210');

  // Step 8: Click the "Create Account" button to complete the registration
  const createAccountButton = page.locator('button[data-qa="create-account"]'); // Target the create account button
  await expect(createAccountButton).toBeEnabled();  // Ensure button is enabled before clicking
  await createAccountButton.click();  // Submit the form

  // Step 9: Wait for the "Account Created!" message
  const accountCreatedMessage = page.locator('text=Account Created!'); // Locator for "Account Created!" message
  await expect(accountCreatedMessage).toBeVisible();  // Ensure the "Account Created!" message is visible

  // Step 10: End the test as passed since the account creation is successful
  console.log("Account created successfully. Test passed.");
});