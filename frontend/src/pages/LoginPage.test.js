import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import LoginPage from './LoginPage';

expect.extend(toHaveNoViolations);

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    t: (ar, en) => en,
    toggleLanguage: jest.fn(),
    language: 'en',
    getRedirectPath: jest.fn(() => '/dashboard'),
  }),
}));

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

test('LoginPage renders and shows sign in form', () => {
  renderLoginPage();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test('LoginPage should have no accessibility violations', async () => {
  const { container } = renderLoginPage();
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
