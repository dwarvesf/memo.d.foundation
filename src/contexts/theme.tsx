import {
  createContext,
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ITheme = 'light' | 'dark';
export interface ThemeContextType {
  theme: 'light' | 'dark';
  setTheme: (theme: ITheme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  isThemeLoaded: boolean;
}
const DefaultContextValues = {
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
  isThemeLoaded: false,
} satisfies ThemeContextType;

export const ThemeContext =
  createContext<ThemeContextType>(DefaultContextValues);
export const ThemeProvider = (props: PropsWithChildren) => {
  const { children } = props;
  const [theme, setThemeInternal] = useState<ITheme>('light');
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const setTheme = useCallback((updater: SetStateAction<ITheme>) => {
    setThemeInternal(prev => {
      const theme = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      return theme;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, [setTheme]);

  useEffect(() => {
    // Initialize theme from localStorage
    const savedTheme = localStorage?.getItem('theme') as
      | 'light'
      | 'dark'
      | 'system'
      | null;
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;

    let initialTheme: 'light' | 'dark';
    if (savedTheme === 'light' || savedTheme === 'dark') {
      // If we have a direct light/dark preference, use it
      initialTheme = savedTheme;
    } else {
      // For 'system' or null, use system preference
      initialTheme = prefersDark ? 'dark' : 'light';
    }

    // Set the theme state
    setTheme(initialTheme);
    setIsThemeLoaded(true);
    // No need to handle system theme changes since we're not using 'system' theme anymore
    // We'll still keep the media query for initial setup, but we won't need the change handler
  }, [setTheme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'dark',
        isThemeLoaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
