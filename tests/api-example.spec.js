import { test, expect } from '@playwright/test';

test('GET user API', async ({ request }) => {
  const response = await request.get('https://reqres.in/api/users/2');
  expect(response.status()).toBe(200);

  const json = await response.json();
  expect(json.data.first_name).toBe('Janet');
});
