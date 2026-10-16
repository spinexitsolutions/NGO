import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_NAVIGATION, DEFAULT_SETTINGS, DEFAULT_THEME, googleFontsHref, themeToCssVars, type Navigation, type PageDraft, type SiteSettings, type Theme } from '@ngo/shared';
import { get } from '@/lib/api';

export interface SiteData {
  theme: Theme;
  settings: SiteSettings;
  navigation: Navigation;
  version: number;
  paymentProvider: 'sandbox' | 'razorpay';
}

interface SiteContextValue extends SiteData {
  loading: boolean;
  error: boolean;
  mode: 'light' | 'dark';
  toggleMode: () => void;
  isPreview: boolean;
  /** Unpublished page draft posted by the page builder (preview iframe only). */
  previewPage: PageDraft | null;
}

const SiteContext = createContext<SiteContextValue | null>(null);
const MODE_KEY = 'ngo-color-mode';

function storedMode(): 'light' | 'dark' | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Applies a theme to the document: CSS variables, fonts and style hooks. */
export function applyTheme(theme: Theme, mode: 'light' | 'dark', root: HTMLElement = document.documentElement) {
  const vars = themeToCssVars(theme, mode);
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.classList.toggle('dark', mode === 'dark');
  root.dataset.btnStyle = theme.shape.buttonStyle;
  root.dataset.cardStyle = theme.shape.cardStyle;
  root.dataset.motion = theme.motion.enabled ? theme.motion.intensity : 'off';
  root.style.background = `rgb(${vars['--c-bg']})`;
  const href = googleFontsHref(theme);
  let link = document.getElementById('theme-fonts') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'theme-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.colors.primary);
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['site'], queryFn: () => get<SiteData>('/public/site'), staleTime: 60_000 });

  // Admin live preview: the customizer posts draft config into this window (same origin only).
  const [preview, setPreview] = useState<(Partial<Pick<SiteData, 'theme' | 'settings' | 'navigation'>> & { page?: PageDraft }) | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'ngo-preview') return;
      setPreview((p) => ({ ...p, ...e.data.payload }));
    };
    window.addEventListener('message', onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: 'ngo-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const theme = preview?.theme ?? data?.theme ?? DEFAULT_THEME;
  const settings = preview?.settings ?? data?.settings ?? DEFAULT_SETTINGS;
  const navigation = preview?.navigation ?? data?.navigation ?? DEFAULT_NAVIGATION;

  const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const [userMode, setUserMode] = useState<'light' | 'dark' | null>(storedMode);
  const mode: 'light' | 'dark' = theme.colorMode === 'user' ? (userMode ?? (systemDark() ? 'dark' : 'light')) : theme.colorMode;

  useEffect(() => applyTheme(theme, mode), [theme, mode]);

  const toggleMode = useCallback(() => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setUserMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, [mode]);

  // Published changes appear without a reload: poll the content version and refetch when it changes.
  useEffect(() => {
    if (!data) return;
    let current = data.version;
    const check = async () => {
      try {
        const { version } = await get<{ version: number }>('/public/site/version');
        if (version !== current) {
          current = version;
          await qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'admin' });
        }
      } catch {
        /* offline */
      }
    };
    const id = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, [data, qc]);

  const value = useMemo<SiteContextValue>(
    () => ({
      theme,
      settings,
      navigation,
      version: data?.version ?? 0,
      paymentProvider: data?.paymentProvider ?? 'sandbox',
      loading: isLoading,
      error: isError,
      mode,
      toggleMode,
      isPreview: Boolean(preview),
      previewPage: preview?.page ?? null,
    }),
    [theme, settings, navigation, data, isLoading, isError, mode, toggleMode, preview],
  );
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside SiteProvider');
  return ctx;
}

export function useMotionEnabled() {
  const { theme } = useSite();
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return theme.motion.enabled && !reduced;
}
