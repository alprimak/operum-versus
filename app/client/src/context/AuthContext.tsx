import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, clearTokens, getAccessToken, loadTokens, setTokens, subscribeToTokenChanges } from '../api/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    loadTokens();
    setToken(getAccessToken());

    const unsubscribe = subscribeToTokenChanges((nextToken) => {
      setToken(nextToken);
    });

    if (getAccessToken()) {
      auth.me()
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          clearTokens();
          setUser(null);
        });
    }

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const data = await auth.login({ email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  };

  const logout = (): void => {
    clearTokens();
    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
    }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
