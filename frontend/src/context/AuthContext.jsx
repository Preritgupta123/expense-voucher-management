import { createContext, useContext, useState } from 'react';
import api from '../api';

// Context = a shared box any component can read, so we don't pass "user"
// down through every component by hand (prop drilling).
const AuthContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw && localStorage.getItem('token') ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Passing a function means it runs only once, on the first render.
  // Reading localStorage here keeps you logged in after a page refresh.
  const [user, setUser] = useState(readStoredUser);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
