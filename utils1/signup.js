const { readSignupData } = require('./excelReader');

async function signupUser(page) {
  // 1. Read first row from Excel
  const raw = readSignupData()[0];

  // 2. Map Excel headers to form fields (convert numbers to strings)
  const data = {
    name: raw["name"],
    email: String(raw["email"]),
    password: String(raw["password"]),
    first_name: raw["first name"],
    last_name: raw["last name"],
    address: raw["address 1"],
    country: raw["country"],
    state: raw["state"],
    city: raw["city"],
    zipcode: String(raw["zipcode"]),
    mobile: String(raw["mobile number"])
  };

  console.log("Using Excel Data:", data);

  // 3. Generate unique email every run
  const uniqueEmail = `${data.email.split("@")[0]}_${Date.now()}@${data.email.split("@")[1]}`;

  console.log("Generated Email:", uniqueEmail);

  // 4. Navigate to signup page
  await page.goto('https://automationexercise.com/signup');

  // 5. Fill Name + Email
  await page.fill('input[name="name"]', data.name);
  await page.fill('input[data-qa="signup-email"]', uniqueEmail);

  // 6. Click Signup
  await page.click('button[data-qa="signup-button"]');

  // 7. Detect and auto-fix if email already exists (rare, but safe)
  const existsMsg = page.locator('text=Email Address already exist!');
  if (await existsMsg.isVisible()) {
    const newEmail2 = `${data.email.split("@")[0]}_${Math.floor(Math.random() * 999999)}@${data.email.split("@")[1]}`;
    console.log("Retry Email:", newEmail2);

    await page.fill('input[data-qa="signup-email"]', newEmail2);
    await page.click('button[data-qa="signup-button"]');
  }

  // 8. Wait for account info page to load
  await page.waitForSelector('input[name="password"]', { timeout: 20000 });

  // 9. Fill account information
  await page.fill('input[name="password"]', data.password);
  await page.check('input[value="Mr"]'); // title
  await page.selectOption('select[name="days"]', '10');
  await page.selectOption('select[name="months"]', '5');
  await page.selectOption('select[name="years"]', '1990');

  // 10. Address Info
  await page.fill('input[name="first_name"]', data.first_name);
  await page.fill('input[name="last_name"]', data.last_name);
  await page.fill('input[name="address1"]', data.address);
  await page.selectOption('select[name="country"]', { label: data.country });
  await page.fill('input[name="state"]', data.state);
  await page.fill('input[name="city"]', data.city);
  await page.fill('input[name="zipcode"]', data.zipcode);
  await page.fill('input[name="mobile_number"]', data.mobile);

  // 11. Submit form
  await page.click('button[data-qa="create-account"]');

  // 12. Verify account created
  await page.waitForSelector('text=Account Created!', { timeout: 15000 });

  console.log("Signup Successful!");
}

module.exports = { signupUser };