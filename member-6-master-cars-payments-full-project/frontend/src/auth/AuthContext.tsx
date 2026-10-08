import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiPost, type Role, type User } from '../api/client';

interface AuthResult { accessToken: string; user: User; }
interface AuthContextValue { user: User | null; ready: boolean; login: (email: string, password: string, role: Role) => Promise<User>; register: (data: { name: string; email: string; phone: string; password: string }) => Promise<User>; logout: () => void; }
const Context = createContext<AuthContextValue | null>(null);

function storedUser(): User | null {
  try {
    const value = localStorage.getItem('driveright.user');
    if (!value) return null;
    const user = JSON.parse(value) as User;
    const role = localStorage.getItem('driveright.role');
    return role && ['student', 'instructor', 'admin'].includes(role) ? { ...user, role: role as User['role'] } : user;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(storedUser);
  const [ready] = useState(true);
  const save = (result: AuthResult) => { localStorage.setItem('driveright.token', result.accessToken); localStorage.setItem('driveright.user', JSON.stringify(result.user)); localStorage.setItem('driveright.role', result.user.role); setUser(result.user); return result.user; };
  const value = useMemo<AuthContextValue>(() => ({
    user, ready,
    login: async (email, password, role) => save(await apiPost<AuthResult>('/auth/login', { email, password, role })),
    register: async (data) => save(await apiPost<AuthResult>('/auth/register', data)),
    logout: () => { localStorage.removeItem('driveright.token'); localStorage.removeItem('driveright.user'); localStorage.removeItem('driveright.role'); setUser(null); },
  }), [user, ready]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() { const value = useContext(Context); if (!value) throw new Error('useAuth must be inside AuthProvider'); return value; }
