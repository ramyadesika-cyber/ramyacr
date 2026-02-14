import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

test('Direct DB upload via API', async ({ request }) => {
  // Load your data file (CSV/JSON for DB import)
  const filePath = resolve('fixtures/users.csv');  // adjust path
  const fileBuffer = readFileSync(filePath);

  // POST the file to your API endpoint
  const response = await request.post('https://your-api.com/api/upload-to-db', {
    multipart: {
      file: {
        name: 'users.csv',
        mimeType: 'text/csv',
        buffer: fileBuffer,  // binary content
      },
      // Optional: add other form fields
      table: 'users',
      overwrite: 'true',
    },
  });

  // Assert success
  expect(response.status()).toBe(200);
  const result = await response.json();
  expect(result.message).toContain('upload successful');
  expect(result.recordsProcessed).toBeGreaterThan(0);
});
