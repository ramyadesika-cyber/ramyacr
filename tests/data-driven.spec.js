// tests/data-driven.spec.js
import { test, expect } from '@playwright/test';
import { readAllSheets } from '../utils/excelReader.js'; // ensure this file exists and exports readAllSheets

const EXCEL_PATH = process.env.TEST_DATA_PATH || '/mnt/data/CloudKampus_Test_Data_840_Records.xlsx';

/**
 * Map common data keys to selectors used in forms.
 * Extend this map for fields present in your sheets.
 */
const selectorsMap = {
  Username: 'input[name="username"], input#username, input[type="text"]',
  Password: 'input[name="password"], input#password, input[type="password"]',
  Product_Name: 'input[name="product"], input#search',
  Quantity: 'input[name="quantity"], input[type="number"]',
  Email: 'input[type="email"], input[name="email"]',
  Login_Button: 'button[type="submit"], input[type="submit"], button#loginBtn'
};

async function fillFormFields(page, row) {
  for (const [key, value] of Object.entries(row)) {
    if (!value) continue;
    const selector = selectorsMap[key];
    if (!selector) continue;
    if (key.toLowerCase().includes('button') || key.toLowerCase().includes('action')) continue;
    try {
      await page.fill(selector, value);
    } catch (err) {
      // fallback: set value via JS if fill fails (element may exist but not visible)
      try {
        await page.evaluate(({ selector, value }) => {
          const el = document.querySelector(selector);
          if (el) el.value = value;
        }, { selector, value });
      } catch (e) {
        // ignore - field might not exist on that page
      }
    }
  }
}

const FIRST_N = process.env.FIRST_N_SHEETS ? Number(process.env.FIRST_N_SHEETS) : 10;
const SHEETS_ENV = process.env.SHEETS;

test.describe('Data-driven tests from Excel sheets', () => {
  let allSheets = {};

  test.beforeAll(async () => {
    allSheets = await readAllSheets(EXCEL_PATH);
    if (!allSheets || Object.keys(allSheets).length === 0) {
      throw new Error(`No sheets found in workbook: ${EXCEL_PATH}`);
    }
  });

  const sheetNames = (() => {
    if (SHEETS_ENV && SHEETS_ENV.trim().length > 0) {
      return SHEETS_ENV.split(',').map(s => s.trim()).filter(Boolean);
    }
    const names = Object.keys(allSheets);
    return names.slice(0, Math.max(1, FIRST_N));
  })();

  for (const sheetName of sheetNames) {
    const rows = allSheets[sheetName] || [];
    if (!rows || rows.length === 0) {
      test(`${sheetName} - (no rows)`, async () => {
        test.info().annotations.push({ type: 'info', description: `Sheet ${sheetName} had no rows` });
      });
      continue;
    }

    rows.forEach((row, idx) => {
      const id = row.TC_ID || row.TestCaseID || row.Test_Case_Name || `row-${idx + 1}`;
      const shortName = (row.Test_Case_Name || sheetName).toString().slice(0, 60);

      test(`${sheetName} | ${id} | ${shortName}`, async ({ page }) => {
        const startUrl = row.URL || row.StartURL || row.Expected_URL || 'https://learntest.xdemo.in/views/admin/login.php';
        await page.goto(startUrl);

        await fillFormFields(page, row);

        // click login / action button if present
        try {
          if (await page.$(selectorsMap.Login_Button)) {
            await page.click(selectorsMap.Login_Button).catch(() => {});
          } else {
            const pwSelector = selectorsMap.Password;
            if (pwSelector && await page.$(pwSelector)) {
              await page.press(pwSelector, 'Enter').catch(() => {});
            }
          }
        } catch (e) {
          // ignore click/press errors - will be captured by assertions later
        }

        // Use try/catch for URL assertion so we can attach debug artifacts
        if (row.Expected_URL && row.Expected_URL.length > 0) {
          try {
            await expect(page).toHaveURL(row.Expected_URL, { timeout: 7000 });
          } catch (err) {
            const actualUrl = await page.url();
            // attach URL (text)
            try {
              await test.info().attach('page-url-on-failure', {
                body: actualUrl,
                contentType: 'text/plain'
              });
            } catch (e) { /* ignore attach errors */ }

            // attach a screenshot
            try {
              const shot = await page.screenshot();
              await test.info().attach('screenshot-on-failure', {
                body: shot,
                contentType: 'image/png'
              });
            } catch (e) { /* ignore attach errors */ }

            // rethrow a helpful error
            throw new Error(`Expected URL ${row.Expected_URL} but actual ${actualUrl}`);
          }
        }

        // Check expected error message if provided
        if (row.Expected_Error_Message && row.Expected_Error_Message.length > 0) {
          const locator = page.locator(`text=${row.Expected_Error_Message}`);
          await expect(locator).toBeVisible({ timeout: 5000 });
        }

        // Password masking check (example TC)
        if (row.TC_ID === 'CK_LOGIN_010' || (row.Test_Case_Name && row.Test_Case_Name.toLowerCase().includes('password masking'))) {
          const pwSelector = selectorsMap.Password;
          if (pwSelector && await page.$(pwSelector)) {
            const el = page.locator(pwSelector);
            const typeAttr = await el.getAttribute('type');
            expect(typeAttr).toBe('password');
          }
        }

        // For XSS test rows - ensure no dialog popped
        if (/xss/i.test(sheetName) || /xss/i.test(row.Test_Case_Name || '')) {
          let dialogShown = false;
          page.on('dialog', () => { dialogShown = true; });
          await page.waitForTimeout(500);
          expect(dialogShown).toBeFalsy();
        }
      });
    });
  }
});
