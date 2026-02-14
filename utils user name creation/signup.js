function normalizeEmailVariant(baseEmail, variant) {
  const parts = String(baseEmail).split("@");
  if (parts.length !== 2) return `${baseEmail}+${variant}`;
  return `${parts[0]}+${variant}@${parts[1]}`;
}

async function safeClickAwaitNavigation(page, locator, timeout = 10000) {
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout }).catch(() => {}),
      locator.click().catch(() => {})
    ]);
  } catch (_) {}
}

async function signupUser(page, raw = {}, opts = {}) {
  const runId = opts.runId || Date.now();
  const index = opts.index || 0;
  const maxAttempts = opts.maxAttempts || 10;

  // canonicalized values
  const name = raw.Name || "Auto User";
  const baseEmail = raw.Email || `${name.replace(/\s+/g, "").toLowerCase()}@example.com`;
  const password = raw.Password || "Test@1234";

  const company = raw.Company || "";
  const address1 = raw.Address || "";
  const address2 = raw.Address2 || "";
  const country = raw.Country || "United States";
  const state = raw.State || "";
  const city = raw.City || "";

  // CRITICAL FIX: Convert these to strings ALWAYS
  const zipcodeStr = raw.Zipcode !== undefined && raw.Zipcode !== null ? String(raw.Zipcode) : "";
  const mobileStr = raw.Mobile !== undefined && raw.Mobile !== null ? String(raw.Mobile) : "";

  const day = String(raw.Day || "1");
  const month = String(raw.Month || "January");
  const year = String(raw.Year || "1990");

  let usedEmail = baseEmail;
  let attempt = 0;
  let status = "FAILED";
  let lastMessage = "";

  for (; attempt < maxAttempts; attempt++) {
    usedEmail = attempt === 0 ? baseEmail : normalizeEmailVariant(baseEmail, `${runId}-${attempt}`);

    try {
      // open signup page
      await page.goto("https://automationexercise.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 15000
      });

      // locate signup button
      let signupBtn = page.locator('button[data-qa="signup-button"]');
      if (!(await signupBtn.count())) {
        signupBtn = page.locator('button:has-text("Signup")');
      }
      if (!(await signupBtn.count())) {
        lastMessage = "Signup button not found";
        continue;
      }

      // scope to SIGNUP form ONLY
      const signupForm = signupBtn.locator("xpath=ancestor::form").first();
      if (!(await signupForm.count())) {
        lastMessage = "Signup form not found";
        continue;
      }

      const nameInput = signupForm.locator('input[data-qa="signup-name"], input[name="name"], input[placeholder="Name"]');
      const emailInput = signupForm.locator('input[data-qa="signup-email"]');

      await emailInput.waitFor({ timeout: 8000 });

      if (await nameInput.count()) {
        await nameInput.fill(name).catch(() => {});
      }

      await emailInput.fill(usedEmail).catch(() => {});

      // submit signup form
      await safeClickAwaitNavigation(page, signupBtn, 10000);

      // email exists?
      const existsMsg =
        page.locator("text=Email Address already exist!")
            .or(page.locator("text=already exists"))
            .or(page.locator("text=already exist"));

      if (await existsMsg.count()) {
        status = "EMAIL_EXISTS";
        lastMessage = "Email already exists";
        continue;
      }

      // wait for password field
      const passwordField = page.locator('input[name="password"]');
      await passwordField.waitFor({ timeout: 10000 }).catch(() => {});
      if (await passwordField.count()) await passwordField.fill(password);

      // DOB
      await page.locator("#days").selectOption({ label: day }).catch(() => {});
      await page.locator("#months").selectOption({ label: month }).catch(() => {});
      await page.locator("#years").selectOption({ label: year }).catch(() => {});

      // newsletter
      await page.locator("#newsletter").check().catch(() => {});
      await page.locator("#optin").check().catch(() => {});

      // address info
      await page.locator("#first_name").fill(name.split(" ")[0] || name).catch(() => {});
      await page.locator("#last_name").fill(name.split(" ")[1] || "Test").catch(() => {});
      await page.locator("#company").fill(company).catch(() => {});
      await page.locator("#address1").fill(address1).catch(() => {});
      await page.locator("#address2").fill(address2).catch(() => {});
      await page.locator("#country").selectOption({ label: country }).catch(() => {});
      await page.locator("#state").fill(state).catch(() => {});
      await page.locator("#city").fill(city).catch(() => {});

      // FIX: zipcode/mobile ALWAYS strings
      await page.locator("#zipcode").fill(zipcodeStr).catch(() => {});
      await page.locator("#mobile_number").fill(mobileStr).catch(() => {});

      // create account
      let createBtn =
        page.locator('button[data-qa="create-account"]')
            .or(page.locator('button:has-text("Create Account")'))
            .first();

      await safeClickAwaitNavigation(page, createBtn, 15000);

      // SUCCESS DETECTION
      const successBanner = page.locator("text=Account Created!");
      const loggedInIndicator = page.locator("text=Logged in as");
      const logoutLink = page.locator('a[href="/logout"]');

      if (
        (await successBanner.count()) ||
        (await loggedInIndicator.count()) ||
        (await logoutLink.count())
      ) {
        status = "SUCCESS";
        lastMessage = "Account Created Successfully";
        break;
      }

      // FIXED ERROR LOCATOR (NO COMMAS)
      const genericError =
        page.locator(".alert")
          .or(page.locator(".error"))
          .or(page.locator("text=Error"))
          .or(page.locator("text=failed"));

      if (await genericError.count()) {
        lastMessage = await genericError.innerText().catch(() => "Unknown error");
        status = "FAILED";
        continue;
      }

      lastMessage = "Unknown state";
      status = "FAILED";

    } catch (err) {
      lastMessage = err.message;
      status = "EXCEPTION";
    }
  }

  return {
    index,
    name,
    baseEmail,
    email: usedEmail,
    password,
    status,
    message: lastMessage,
    attempts: attempt + 1,
    timestamp: new Date().toISOString()
  };
}

module.exports = { signupUser };