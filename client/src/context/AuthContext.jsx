import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api';
import { readStoredAuth, setUnauthorizedHandler, storeAuth } from '../api/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => readStoredAuth()); // { token, user }
  const [checking, setChecking] = useState(Boolean(readStoredAuth()?.token));

  const logout = useCallback(() => {
    storeAuth(null);
    setAuth(null);
  }, []);

  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Refresh the user from the server once on load (catches deactivated accounts / expired tokens).
  useEffect(() => {
    if (!auth?.token) return;
    authApi
      .me()
      .then(({ data }) => {
        const next = { token: auth.token, user: data };
        storeAuth(next);
        setAuth(next);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email, password, role) => {
    const { data } = await authApi.login(email, password, role);
    storeAuth(data);
    setAuth(data);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user: auth?.user || null, token: auth?.token || null, checking, login, logout }),
    [auth, checking, login, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
