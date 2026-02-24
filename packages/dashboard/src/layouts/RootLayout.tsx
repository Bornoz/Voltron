import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../stores/themeStore';

export function RootLayout() {
  const themeMode = useThemeStore((s) => s.mode);
  const themeAccent = useThemeStore((s) => s.accent);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    document.documentElement.setAttribute('data-accent', themeAccent);
  }, [themeMode, themeAccent]);

  return <Outlet />;
}
