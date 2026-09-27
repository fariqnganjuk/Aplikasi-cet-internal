'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'akselera_tech_theme';

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

export function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export function storeTheme(theme: Theme) {
  window.localStorage.setItem(THEME_KEY, theme);
}

/**
 * Tema global aplikasi. Dipakai bersama oleh halaman login dan halaman chat
 * supaya light/dark mode berlaku di semua layar (Fitur Wajib #6).
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    applyThemeClass(stored);
    setReady(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      storeTheme(next);
      applyThemeClass(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme, ready };
}
