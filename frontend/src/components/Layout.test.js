import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import Layout from './Layout';

expect.extend(toHaveNoViolations);

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User', role: 'doctor', allowed_features: ['dashboard', 'patients'] },
    logout: jest.fn(),
    logoutAll: jest.fn(),
    t: (ar, en) => en,
    language: 'en',
    toggleLanguage: jest.fn(),
    isRTL: false,
  }),
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn(), resolvedTheme: 'light' }),
}));

jest.mock('./NotificationBell', () => () => <div data-testid="notification-bell">Bell</div>);

function Wrapper() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<span>Dashboard content</span>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

test('Layout renders and shows outlet content', () => {
  render(<Wrapper />);
  expect(screen.getByText('Dashboard content')).toBeInTheDocument();
});

test('Layout should have no accessibility violations', async () => {
  const { container } = render(<Wrapper />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
