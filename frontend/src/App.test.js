import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import App from './App';

expect.extend(toHaveNoViolations);

// Mock AuthContext to avoid needing backend
jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({
    token: null,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    t: (ar, en) => en,
    language: 'en',
    toggleLanguage: jest.fn(),
    getRedirectPath: jest.fn(() => '/dashboard'),
  }),
}));

test('renders app and shows login or redirect', () => {
  render(<App />);
  const authProvider = screen.queryByTestId('auth-provider');
  expect(authProvider).toBeInTheDocument();
});

test('App should have no accessibility violations', async () => {
  const { container } = render(<App />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
