const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const { readSignupData } = require(path.join(__dirname, '..', 'utils', 'excelReader'));
const { signupUser } = require(path.join(__dirname, '..', 'utils', 'signup'));

test.setTimeout(30 * 60 * 1000); // allow long runs

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const VIDEOS_DIR = path.join(REPORTS_DIR, 'videos');
const ERR_DIR = path.join(REPORTS_DIR, 'errors');

if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
if (!fs.existsSync(ERR_DIR)) fs.mkdirSync(ERR_DIR, { recursive: true });

function sanitizeFilename(s) {
  if (!s) return 'noemail';
  return String(s).replace(/[^a-zA-Z0-9\-_.@]/g, '_').replace(/_+/g, '_');
}

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
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Signup Results</title>
<style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px}</style>
</head>
<body>
<h1>Signup Results</h1>
<p>Run: ${new Date().toISOString()}</p>
<table>
<thead><tr><th>#</th><th>Name</th><th>Base Email</th><th>Used Email</th><th>Status</th><th>Message</th><th>Attempts</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function buildVideosIndex(videoEntries) {
  const rows = videoEntries.map(v => `
    <tr>
      <td>${v.attempt}</td>
      <td><a href="./${path.basename(v.file)}" target="_blank">${path.basename(v.file)}</a></td>
      <td>${v.email}</td>
      <td>${new Date(v.mtime).toLocaleString()}</td>
    </tr>`).join('');
  return `
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Attempt Videos</title>
<style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px}</style>
</head>
<body>
<h1>Attempt Videos</h1>
<table>
<thead><tr><th>Attempt</th><th>Video</th><th>Email</th><th>Recorded</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

async function saveErrorArtifacts(page, tag) {
  try {
    const ts = Date.now();
    const png = path.join(ERR_DIR, `${tag}-${ts}.png`);
    const html = path.join(ERR_DIR, `${tag}-${ts}.html`);
    await page.screenshot({ path: png, fullPage: true }).catch(() => {});
    const content = await page.content().catch(() => '<no html>');
    fs.writeFileSync(html, content, 'utf8');
    console.log(`Saved error artifacts: ${png}, ${html}`);
  } catch (e) {
    console.warn('Failed to save error artifacts', e && e.message);
  }
}

// Robust: click Continue if present (retries + graceful)
async function clickContinueIfPresent(page, opts = {}) {
  const maxRetries = opts.maxRetries || 2;
  const baseDelay = opts.baseDelay || 300;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const continueBtn = page.locator('a[data-qa="continue-button"], a:has-text("Continue")').first();
      if (await continueBtn.count() > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
          continueBtn.click().catch(() => {})
        ]);
        await page.waitForTimeout(300);
        return true;
      }
      return false;
    } catch (err) {
      console.warn(`clickContinueIfPresent attempt ${attempt} failed:`, err && err.message);
      if (attempt === maxRetries) {
        try { await saveErrorArtifacts(page, `continue-fail-${Date.now()}`); } catch(e){}
        return false;
      }
      await page.waitForTimeout(baseDelay * (2 ** attempt));
    }
  }
}

// Robust logout with retries, fallbacks, and silent failure handling
async function logoutIfLoggedIn(page, opts = {}) {
  const maxRetries = opts.maxRetries || 2;
  const baseDelay = opts.baseDelay || 300;

  async function tryClick(locator) {
    try {
      if (await locator.count() > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
          locator.click().catch(() => {})
        ]);
        await page.waitForTimeout(250);
        return true;
      }
    } catch (_) {}
    return false;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1) Try direct logout anchor
      if (await tryClick(page.locator('a[href="/logout"]').first())) return true;

      // 2) Try logout text
      if (await tryClick(page.locator('a:has-text("Logout")').first())) return true;

      // 3) Try JS redirect
      try {
        await page.evaluate(() => { window.location.href = '/logout'; });
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(250);
        return true;
      } catch (_) {}

      // 4) Last fallback — clear session manually
      try {
        await page.context().clearCookies().catch(() => {});
        await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch(e){} });
        await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(250);
        return true;
      } catch (_) {}

    } catch (err) {
      console.warn(`logoutIfLoggedIn attempt ${attempt} error:`, err && err.message);
      if (attempt === maxRetries) {
        try { await saveErrorArtifacts(page, `logout-fail-${Date.now()}`); } catch(e){}
        return false;
      }
      await page.waitForTimeout(baseDelay * (2 ** attempt));
    }
  }

  return false;
}

test('Signup sequentially from Excel until 10 users — per-attempt video, low res, video index', async ({ browser }) => {
  const rows = readSignupData();
  console.log('Rows from Excel:', rows.length);
  if (!rows || rows.length === 0) throw new Error('No rows found in Excel.');

  const results = [];
  const videoEntries = []; // { attempt, file, email, mtime }
  const targetSuccess = 10;
  let successCount = 0;
  let globalIndex = 0;
  const runId = Date.now();

  const perRowAttempts = 4;
  const attemptRetriesOnException = 1;

  for (let i = 0; i < rows.length && successCount < targetSuccess; i++) {
    const baseRow = Object.assign({}, rows[i]);
    const baseEmail = baseRow.Email || baseRow.email || `${(baseRow.Name || 'autouser').replace(/\s+/g,'').toLowerCase()}@example.com`;

    for (let attemptIdx = 0; attemptIdx < perRowAttempts && successCount < targetSuccess; attemptIdx++) {
      globalIndex++;

      // Create a unique per-attempt video folder
      const attemptDirName = `attempt-${globalIndex}-${Date.now()}`;
      const attemptVideoDir = path.join(VIDEOS_DIR, attemptDirName);
      if (!fs.existsSync(attemptVideoDir)) fs.mkdirSync(attemptVideoDir, { recursive: true });

      // Reduced resolution to save space (640x360)
      const context = await browser.newContext({
        recordVideo: { dir: attemptVideoDir, size: { width: 640, height: 360 } },
        viewport: { width: 640, height: 360 }
      });
      const page = await context.newPage();

      const attemptRow = Object.assign({}, baseRow);
      attemptRow.Email = attemptIdx === 0 ? baseEmail : baseEmail.replace('@', `+r${i}a${attemptIdx}@`);

      console.log(`Attempt #${globalIndex} (row ${i} attempt ${attemptIdx}) -> ${attemptRow.Email}`);

      let attemptResult = null;
      let callOk = false;

      for (let rtry = 0; rtry <= attemptRetriesOnException; rtry++) {
        try {
          attemptResult = await signupUser(page, attemptRow, { index: globalIndex, runId, maxAttempts: 6 });
          callOk = true;
          break;
        } catch (err) {
          console.warn(`signupUser threw (retry ${rtry}): ${err && err.message}`);
          await saveErrorArtifacts(page, `signupUser-ex-row${i}-g${globalIndex}-r${rtry}`);
          try { await page.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); } catch {}
          await page.waitForTimeout(500 * (rtry + 1));
        }
      }

      // close page and context to flush video file
      try { await page.close().catch(() => {}); } catch (e) {}
      try { await context.close().catch(() => {}); } catch (e) {}

      // find the produced video inside attemptVideoDir
      let producedVideo = null;
      try {
        const files = fs.readdirSync(attemptVideoDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4') || f.endsWith('.mkv'));
        if (files.length > 0) {
          producedVideo = path.join(attemptVideoDir, files[0]);
          const safeEmail = sanitizeFilename(attemptRow.Email);
          const destName = `attempt-${globalIndex}-${safeEmail}.webm`;
          const destPath = path.join(VIDEOS_DIR, destName);

          try {
            fs.renameSync(producedVideo, destPath);
            try {
              const remaining = fs.readdirSync(attemptVideoDir);
              if (remaining.length === 0) fs.rmdirSync(attemptVideoDir);
              else {
                remaining.forEach(f => {
                  try { fs.renameSync(path.join(attemptVideoDir, f), path.join(VIDEOS_DIR, `${attemptDirName}_${f}`)); } catch (e) {}
                });
                try { fs.rmdirSync(attemptVideoDir); } catch (e) {}
              }
            } catch (e) {}
            producedVideo = destPath;
            console.log('Saved video:', destPath);
          } catch (e) {
            console.warn('Could not move video file from attempt dir to videos root:', e && e.message);
            producedVideo = path.join(attemptVideoDir, files[0]);
          }
        } else {
          console.warn('No video file found inside', attemptVideoDir);
        }
      } catch (e) {
        console.warn('Error while finding/renaming video file', e && e.message);
      }

      if (!callOk) {
        const failed = {
          globalIndex,
          name: attemptRow.Name || attemptRow.name || 'n/a',
          baseEmail,
          email: attemptRow.Email,
          password: attemptRow.Password || 'n/a',
          status: 'EXCEPTION',
          message: 'signupUser threw exceptions (see reports/errors)',
          attempts: 0,
          timestamp: new Date().toISOString()
        };
        results.push(failed);
        if (producedVideo) {
          const stat = fs.existsSync(producedVideo) ? fs.statSync(producedVideo) : null;
          videoEntries.push({ attempt: globalIndex, file: producedVideo, email: attemptRow.Email, mtime: stat ? stat.mtimeMs : Date.now() });
        }
        continue;
      }

      attemptResult.globalIndex = globalIndex;
      results.push(attemptResult);

      if (producedVideo) {
        const stat = fs.existsSync(producedVideo) ? fs.statSync(producedVideo) : null;
        videoEntries.push({ attempt: globalIndex, file: producedVideo, email: attemptRow.Email, mtime: stat ? stat.mtimeMs : Date.now() });
      }

      if (attemptResult.status === 'SUCCESS') {
        successCount++;
        console.log(`Created user ${attemptResult.email} (success ${successCount}/${targetSuccess})`);
        const followCtx = await browser.newContext();
        const followPage = await followCtx.newPage();
        try {
          await followPage.goto('https://automationexercise.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await clickContinueIfPresent(followPage).catch(() => {});
          await logoutIfLoggedIn(followPage).catch(() => {});
          await followPage.waitForTimeout(300);
        } catch (e) {
          console.warn('Follow-up continue/logout failed:', e && e.message);
        } finally {
          await followPage.close().catch(() => {});
          await followCtx.close().catch(() => {});
        }
        break;
      }

      if (attemptResult.status === 'EMAIL_EXISTS') {
        console.log(`Email exists for ${attemptResult.email} — trying next variant`);
        await new Promise(res => setTimeout(res, 300));
        continue;
      }

      console.log(`Attempt result: ${attemptResult.status} - ${attemptResult.message}`);
      await new Promise(res => setTimeout(res, 300));
    } // perRowAttempts
  } // rows loop

  // synthetic attempts with per-attempt video if still short
  let synthIndex = 0;
  const fallbackBase = rows[0] || { Name: 'autotest', Email: `autotest${Date.now()}@example.com`, Password: 'Test@1234' };
  while (successCount < targetSuccess) {
    synthIndex++;
    globalIndex++;

    const attemptDirName = `attempt-${globalIndex}-${Date.now()}`;
    const attemptVideoDir = path.join(VIDEOS_DIR, attemptDirName);
    if (!fs.existsSync(attemptVideoDir)) fs.mkdirSync(attemptVideoDir, { recursive: true });

    const context = await browser.newContext({
      recordVideo: { dir: attemptVideoDir, size: { width: 640, height: 360 } },
      viewport: { width: 640, height: 360 }
    });
    const page = await context.newPage();

    const synthetic = Object.assign({}, fallbackBase);
    synthetic.Email = (fallbackBase.Email || 'autotest@example.com').replace('@', `+s${synthIndex}@`);
    console.log(`Synthetic attempt #${synthIndex} -> ${synthetic.Email}`);

    let synthResult = null;
    try {
      synthResult = await signupUser(page, synthetic, { index: globalIndex, runId, maxAttempts: 6 });
    } catch (err) {
      console.warn('Synthetic signup threw:', err && err.message);
      await saveErrorArtifacts(page, `synth-ex-${synthIndex}`);
    }

    try { await page.close().catch(() => {}); } catch (e) {}
    try { await context.close().catch(() => {}); } catch (e) {}

    let producedVideo = null;
    try {
      const files = fs.readdirSync(attemptVideoDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4') || f.endsWith('.mkv'));
      if (files.length > 0) {
        producedVideo = path.join(attemptVideoDir, files[0]);
        const safeEmail = sanitizeFilename(synthetic.Email);
        const destName = `synthetic-${globalIndex}-${safeEmail}.webm`;
        const destPath = path.join(VIDEOS_DIR, destName);
        try {
          fs.renameSync(producedVideo, destPath);
          producedVideo = destPath;
          try {
            const remaining = fs.readdirSync(attemptVideoDir);
            if (remaining.length === 0) fs.rmdirSync(attemptVideoDir);
          } catch (e) {}
        } catch (e) {
          console.warn('Could not move synth video:', e && e.message);
          producedVideo = path.join(attemptVideoDir, files[0]);
        }
      }
    } catch (e) {
      console.warn('Video handling error for synthetic attempt', e && e.message);
    }

    if (producedVideo) {
      const stat = fs.existsSync(producedVideo) ? fs.statSync(producedVideo) : null;
      videoEntries.push({ attempt: globalIndex, file: producedVideo, email: synthetic.Email, mtime: stat ? stat.mtimeMs : Date.now() });
    }

    if (synthResult) {
      synthResult.globalIndex = globalIndex;
      results.push(synthResult);
      if (synthResult.status === 'SUCCESS') {
        successCount++;
        const followCtx = await browser.newContext();
        const followPage = await followCtx.newPage();
        try { await clickContinueIfPresent(followPage).catch(() => {}); await logoutIfLoggedIn(followPage).catch(() => {}); } catch (e) {}
        await followPage.close().catch(() => {}); await followCtx.close().catch(() => {});
      }
    } else {
      results.push({
        globalIndex,
        name: synthetic.Name || synthetic.name || 'n/a',
        baseEmail: fallbackBase.Email,
        email: synthetic.Email,
        password: synthetic.Password || 'n/a',
        status: 'EXCEPTION',
        message: 'signupUser threw or returned undefined',
        attempts: 0,
        timestamp: new Date().toISOString()
      });
    }
  } // synthetic loop

  // Write results and videos index
  fs.writeFileSync(path.join(REPORTS_DIR, 'signup_results.json'), JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(path.join(REPORTS_DIR, 'signup_results.html'), buildHtmlReport(results), 'utf8');

  videoEntries.sort((a,b) => a.attempt - b.attempt);
  if (videoEntries.length > 0) {
    const indexHtml = buildVideosIndex(videoEntries);
    fs.writeFileSync(path.join(VIDEOS_DIR, 'index.html'), indexHtml, 'utf8');
    console.log('Videos index written to', path.join(VIDEOS_DIR, 'index.html'));
  } else {
    console.log('No video entries recorded.');
  }

  console.log(`Completed run: created ${results.filter(r => r.status === 'SUCCESS').length} users`);
  expect(results.filter(r => r.status === 'SUCCESS').length).toBeGreaterThanOrEqual(targetSuccess);
});