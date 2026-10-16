import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SUPER_ADMIN_ROLE, type Permission } from '@ngo/shared';
import { get, send } from '@/lib/api';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: { key: string; name: string };
  permissions: string[];
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

interface AuthValue {
  user: StaffUser | null;
  loading: boolean;
  mfaPending: boolean;
  can: (...p: Permission[]) => boolean;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => get<{ user: StaffUser | null; mfaPending?: boolean }>('/auth/me'),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const user = data?.user ?? null;
  const value: AuthValue = {
    user,
    loading: isLoading,
    mfaPending: Boolean(data?.mfaPending),
    // UX only — the API enforces every permission server-side.
    can: (...p) => Boolean(user && (user.role.key === SUPER_ADMIN_ROLE || p.some((x) => user.permissions.includes(x)))),
    refresh: refetch,
    logout: async () => {
      await send('/auth/logout');
      qc.removeQueries({ queryKey: ['admin'] });
      await refetch();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
