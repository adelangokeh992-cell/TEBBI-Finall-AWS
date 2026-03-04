/**
 * MSW request handlers for API mocking in tests.
 * Use with setupServer in test file; base URL should match api.js (e.g. http://localhost:8001/api).
 */

import { http, HttpResponse } from 'msw';

const API = 'http://localhost:8001/api';

export const handlers = [
  http.get(`${API}/patients`, () => HttpResponse.json([])),
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await request.json();
    if (body?.email && body?.password) {
      return HttpResponse.json({
        access_token: 'mock-jwt-token',
        token_type: 'bearer',
        user: { id: 'user-1', email: body.email, name: 'Test User', role: 'doctor' },
      });
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
  }),
];
