/**
 * Integration tests with API mocked via MSW.
 * REACT_APP_BACKEND_URL must be http://localhost:8001 so requests hit the mock server.
 */

import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { authAPI, patientsAPI } from './api';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API with MSW', () => {
  test('authAPI.login returns mock user when credentials provided', async () => {
    const res = await authAPI.login('doctor@test.com', 'pass');
    expect(res.data.access_token).toBe('mock-jwt-token');
    expect(res.data.user.email).toBe('doctor@test.com');
    expect(res.data.user.role).toBe('doctor');
  });

  test('patientsAPI.getAll returns mocked empty list', async () => {
    const res = await patientsAPI.getAll();
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data).toHaveLength(0);
  });
});
