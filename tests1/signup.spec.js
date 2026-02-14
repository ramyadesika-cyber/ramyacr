const { test } = require('@playwright/test');
const { signupUser } = require('../utils/signup');

test('Signup using Excel data', async ({ page }) => {
  await signupUser(page);
});