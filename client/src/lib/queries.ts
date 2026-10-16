import { useQuery } from '@tanstack/react-query';
import { get, qs } from './api';
import type { Paged } from './types';
import { api } from './api';

/** Public collection list (`/public/c/:key`). */
export function useCollection<T>(key: string, params: Record<string, string | number | undefined> = {}, enabled = true) {
  return useQuery({
    queryKey: ['c', key, params],
    queryFn: () => api<Paged<T>>(`/public/c/${key}${qs(params)}`),
    enabled,
    staleTime: 60_000,
  });
}

export function usePublic<T>(path: string, enabled = true) {
  return useQuery({ queryKey: ['p', path], queryFn: () => get<T>(path), enabled, staleTime: 60_000, retry: (n, e) => (e as { status?: number })?.status !== 404 && n < 2 });
}
