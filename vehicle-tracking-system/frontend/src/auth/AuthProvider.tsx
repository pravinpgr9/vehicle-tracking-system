import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '../api/client';
import type { AuthResponse, User } from '../api/types';
import { AuthContext, type AuthContextValue } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setIsRestoring(false);
      return;
    }
    api
      .get<User>('/users/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setIsRestoring(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(email, password) {
        const response = await api.post<AuthResponse>('/auth/login', {
          email,
          password,
        });
        setToken(response.accessToken);
        setUser(response.user);
      },
      async register(name, email, password) {
        const response = await api.post<AuthResponse>('/auth/register', {
          name,
          email,
          password,
        });
        setToken(response.accessToken);
        setUser(response.user);
      },
      logout() {
        setToken(null);
        setUser(null);
      },
    }),
    [user],
  );

  if (isRestoring) {
    return null;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
