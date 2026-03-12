import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Mock the API client
vi.mock('../api/client', () => ({
  setTokens: vi.fn(),
  loadTokens: vi.fn(),
  clearTokens: vi.fn(),
  auth: {
    me: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    login: vi.fn().mockResolvedValue({
      user: { id: '1', email: 'test@test.com', name: 'Test User' },
      accessToken: 'token',
      refreshToken: 'refresh',
    }),
    register: vi.fn().mockResolvedValue({
      user: { id: '1', email: 'test@test.com', name: 'Test User' },
      accessToken: 'token',
      refreshToken: 'refresh',
    }),
  },
}));

function TestConsumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.name : 'none'}</span>
      <button onClick={() => login('test@test.com', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides user as null when not authenticated', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('provides login and updates user', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('Test User');
  });

  it('provides logout and clears user', async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('Test User');

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleError.mockRestore();
  });
});
