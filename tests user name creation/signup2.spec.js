const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.setTimeout(30 * 60 * 1000); // allow up to 30 minutes for this long-running flow

const { readSignupData } = require(path.join(__dirname, '..', 'utils', 'excelReader'));
const { signupUser } = require(path.join(__dirname, '..', 'utils', 'signup'));

const REPORTS_DIR = path.join(__dirname, '../reports');
const ERR_DIR = path.join(REPORTS_DIR, 'errors');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(ERR_DIR)) fs.mkdirSync(ERR_DIR, { recursive: true });

function buildHtmlReport(results) {
  const rows = results.map(r => `
    <tr class="${r.status}">
      <td>${r.globalIndex}</td>
      <td>${r.name}</td>
      <td>${r.baseEmail}</td>
      <td>${r.email}</td>
      <td>${r.status}</td>
      <td>${r.message}</td>
      <td>${r.attempts}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signup Results</title>
  <style>
    table { border-collapse: collapse; width: 100%; font-family: Arial; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align:left; vertical-align:top; }
    th { background: #eee; }
    .SUCCESS { background: #d4edda; }
    .FAILED, .UNKNOWN_ERROR, .EXCEPTION { background: #f8d7da; }
    .EMAIL_EXISTS { background: #fff3cd; }
  </style>
</head>
<body>
  <h1>Signup Results</h1>
  <p>Run: ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Base Email</th><th>Used Email</th>
        <th>Status</th><th>Message</th><th>Attempts</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

async function clickContinueIfPresent(page) {
  const continueBtn = page.locator('a[data-qa="continue-button"], a:has-text("Continue")').first();
  if (await continueBtn.count() > 0) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      continueBtn.click().catch(() => {})
    ]);
    await page.waitForTimeout(500);
  }
}

async function logoutIfLoggedIn(page) {
  try {
    // click /logout link if present
    const logoutAnchor = page.locator('a[href="/logout"]').first();
    if (await logoutAnchor.count() > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        logoutAnchor.click().catch(() => {})
      ]);
      await page.waitForTimeout(400);
      return;
    }
    const logoutByText = page.locator('a:has-text("Logout")').first();
    if (await logoutByText.count() > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
        logoutByText.click().catch(() => {})
      ]);
      await page.waitForTimeout(400);
      return;
    }
    // fallback navigate
    await page.goto('https://automationexercise.com/logout', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
  } catch (e) {
    // ignore and continue
    try { await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}); } catch {}
  }
}

async function saveErrorArtifacts(page, tag) {
  try {
    const ts = Date.now();
    const png = path.join(ERR_DIR, `${tag}-${ts}.png`);
    const html = path.join(ERR_DIR, `${tag}-${ts}.html`);
    await page.screenshot({ path: png, fullPage: true }).catch(() => {});
    const content = await page.content().catch(() => '<no html>');
    fs.writeFileSync(html, content, 'utf8');
    console.log(`Saved error artifacts: ${png} , ${html}`);
  } catch (e) {
    console.warn('Failed to save error artifacts', e?.message || e);
  }
}

test('Resilient signup: sequentially from Excel until 10 successful users', async ({ page }) => {
  // raise page-level timeouts since this is a long flow
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  const rows = readSignupData();
  console.log('TEST: rows read from Excel =', rows.length);
  if (!rows || rows.length === 0) throw new Error('No rows found in Excel.');

  const results = [];
  const targetSuccess = 10;
  let successCount = 0;
  let globalIndex = 0;
  const runId = Date.now();

  const perRowAttempts = 4;          // variants per row
  const attemptRetriesOnException = 2; // retry signupUser call on transient exception
  const baseDelayMs = 500;          // exponential backoff base

  for (let i = 0; i < rows.length && successCount < targetSuccess; i++) {
    const baseRow = Object.assign({}, rows[i]);
    const baseEmail = baseRow.Email || baseRow.email || `${(baseRow.Name || 'autouser').replace(/\s+/g,'').toLowerCase()}@example.com`;

    for (let attemptIdx = 0; attemptIdx < perRowAttempts && successCount < targetSuccess; attemptIdx++) {
      globalIndex++;
      const attemptRow = Object.assign({}, baseRow);
      attemptRow.Email = attemptIdx === 0 ? baseEmail : baseEmail.replace('@', `+r${i}a${attemptIdx}@`);

      console.log(`TEST: Row ${i} attempt ${attemptIdx} -> ${attemptRow.Email} (global #${globalIndex})`);

      // call signupUser with retry-on-exception
      let attemptResult = null;
      let callOk = false;
      for (let rtry = 0; rtry <= attemptRetriesOnException; rtry++) {
        try {
          attemptResult = await signupUser(page, attemptRow, { index: globalIndex, runId, maxAttempts: 6 });
          callOk = true;
          break;
        } catch (err) {
          // likely a timeout or navigation error — capture artifacts and retry
          console.warn(`Transient error calling signupUser (rtry=${rtry}): ${err && err.message ? err.message : err}`);
          await saveErrorArtifacts(page, `signupUser-exception-row${i}-try${rtry}`);
          // reload page and wait before retrying
          try { await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); } catch {}
          const waitMs = baseDelayMs * (2 ** rtry);
          console.log(`Waiting ${waitMs}ms before retrying signupUser...`);
          await page.waitForTimeout(waitMs);
        }
      }

      if (!callOk) {
        // record a synthetic failure and move to next variant/row
        const failed = {
          globalIndex,
          name: attemptRow.Name || attemptRow.name || 'n/a',
          baseEmail,
          email: attemptRow.Email,
          password: attemptRow.Password || 'n/a',
          status: 'EXCEPTION',
          message: 'signupUser consistently threw exceptions (see reports/errors/)',
          attempts: 0,
          timestamp: new Date().toISOString()
        };
        results.push(failed);
        console.log(`TEST: signupUser failed repeatedly for ${attemptRow.Email}, moving on.`);
        continue;
      }

      attemptResult.globalIndex = globalIndex;
      results.push(attemptResult);

      // If signupUser returned EXCEPTION or UNKNOWN_ERROR, treat as transient and try to recover
      if (attemptResult.status === 'EXCEPTION' || attemptResult.status === 'UNKNOWN_ERROR') {
        console.warn(`TEST: Attempt returned ${attemptResult.status} - ${attemptResult.message}`);
        await saveErrorArtifacts(page, `attempt-${globalIndex}-${attemptResult.status}`);
        // reload / goto login to repair the session, then try next variant or move on
        try { await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); } catch {}
        await page.waitForTimeout(500);
        continue; // will try next variant for same row
      }

      if (attemptResult.status === 'EMAIL_EXISTS') {
        console.log(`TEST: email exists for ${attemptResult.email}; trying another variant of this row.`);
        await page.waitForTimeout(300);
        continue; // try next variant
      }

      if (attemptResult.status === 'SUCCESS') {
        successCount++;
        console.log(`TEST: Created user ${attemptResult.email} (success ${successCount}/${targetSuccess})`);
        // click continue (Account Created page) if present, then logout
        try {
          await clickContinueIfPresent(page);
        } catch (e) { /* ignore */ }

        try {
          await logoutIfLoggedIn(page);
        } catch (e) { /* ignore */ }

        // clear cookies & storage to start fresh (helps avoid session leakage)
        try {
          await page.context().clearCookies().catch(() => {});
          await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
        } catch (e) {}

        await page.waitForTimeout(500);
        break; // move to next Excel row
      }

      // other statuses (FAILED) — log and continue to next variant
      console.log(`TEST: non-success status ${attemptResult.status} - ${attemptResult.message}`);
      await page.waitForTimeout(300);
    } // end perRowAttempts
  } // end rows loop

  // produce synthetic users if still short
  let synthIndex = 0;
  const fallbackBase = rows[0] || { Name: 'autotest', Email: `autotest${Date.now()}@example.com`, Password: 'Test@1234' };
  while (successCount < targetSuccess) {
    synthIndex++;
    globalIndex++;
    const synthetic = Object.assign({}, fallbackBase);
    synthetic.Email = (fallbackBase.Email || 'autotest@example.com').replace('@', `+s${synthIndex}@`);
    console.log(`TEST: Synthetic attempt ${synthIndex} -> ${synthetic.Email}`);

    let syntheticResult = null;
    try {
      syntheticResult = await signupUser(page, synthetic, { index: globalIndex, runId, maxAttempts: 6 });
    } catch (err) {
      console.warn('Synthetic signupUser threw exception:', err && err.message);
      await saveErrorArtifacts(page, `synthetic-ex-${synthIndex}`);
      // try again after small wait
      await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(500);
      continue;
    }

    syntheticResult.globalIndex = globalIndex;
    results.push(syntheticResult);

    if (syntheticResult.status === 'SUCCESS') {
      successCount++;
      try { await clickContinueIfPresent(page); } catch (e) {}
      try { await logoutIfLoggedIn(page); } catch (e) {}
      await page.context().clearCookies().catch(() => {});
      await page.waitForTimeout(500);
    } else {
      await saveErrorArtifacts(page, `synthetic-fail-${synthIndex}`);
      await page.waitForTimeout(300);
    }
  }

  // final assertions
  console.log(`TEST: Completed. Created ${successCount} users (target ${targetSuccess})`);
  expect(results.filter(r => r.status === 'SUCCESS').length).toBeGreaterThanOrEqual(targetSuccess);

  // write reports
  fs.writeFileSync(path.join(REPORTS_DIR, 'signup_results.json'), JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(path.join(REPORTS_DIR, 'signup_results.html'), buildHtmlReport(results), 'utf8');

  console.log('Reports and artifacts saved to', REPORTS_DIR);
});
