import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../context/AuthContext.js';

// Mock the API client
vi.mock('../api/client.js', () => ({
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  loadTokens: vi.fn(),
  auth: {
    me: vi.fn().mockRejectedValue(new Error('No token')),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

// Test component that consumes useAuth
function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) {
    return (
      <div>
        <div>Not logged in</div>
        <button onClick={() => login('test@test.com', 'password123')}>Login</button>
      </div>
    );
  }
  return (
    <div>
      <div>Logged in as {user!.name}</div>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows not authenticated when no token exists', async () => {
    const { auth } = await import('../api/client.js');
    vi.mocked(auth.me).mockRejectedValue(new Error('No token'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Not logged in')).toBeDefined();
    });
  });

  it('shows user when token is valid', async () => {
    const { auth } = await import('../api/client.js');
    vi.mocked(auth.me).mockResolvedValue({ user: { id: '1', email: 'test@test.com', name: 'Test User' } } as any);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Logged in as Test User')).toBeDefined();
    });
  });

  it('logs in user on login()', async () => {
    const { auth, setTokens } = await import('../api/client.js');
    vi.mocked(auth.me).mockRejectedValue(new Error('No token'));
    vi.mocked(auth.login).mockResolvedValue({
      user: { id: '1', email: 'test@test.com', name: 'Test User' },
      accessToken: 'access123',
      refreshToken: 'refresh123',
    } as any);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText('Not logged in'));

    await act(async () => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Logged in as Test User')).toBeDefined();
    });
    expect(setTokens).toHaveBeenCalledWith('access123', 'refresh123');
  });

  it('logs out user on logout()', async () => {
    const { auth, clearTokens } = await import('../api/client.js');
    vi.mocked(auth.me).mockResolvedValue({ user: { id: '1', email: 'test@test.com', name: 'Test User' } } as any);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => screen.getByText('Logged in as Test User'));

    await act(async () => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(screen.getByText('Not logged in')).toBeDefined();
    });
    expect(clearTokens).toHaveBeenCalled();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress error boundary output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
