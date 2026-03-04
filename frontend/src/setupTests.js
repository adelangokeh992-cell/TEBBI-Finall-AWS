import '@testing-library/jest-dom';

// So API calls in tests (e.g. MSW) use a consistent base URL
if (typeof process.env.REACT_APP_BACKEND_URL === 'undefined') {
  process.env.REACT_APP_BACKEND_URL = 'http://localhost:8001';
}
