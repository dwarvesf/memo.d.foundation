import Script from 'next/script';
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

  const flipImageSource = useCallback((theme: ITheme) => {
    document.querySelectorAll('picture').forEach(element => {
      const img = element.querySelector('img');
      const darkSource = element.querySelector(
        "source[media='(prefers-color-scheme: dark)']",
      ) as HTMLSourceElement | undefined;
      if (!darkSource || !img) return;

      let lightSource = element.querySelector(
        "source[media='(prefers-color-scheme: light)']",
      ) as HTMLSourceElement | undefined;
      if (!lightSource) {
        lightSource = document.createElement('source');
        lightSource.media = '(prefers-color-scheme: light)';
        lightSource.srcset = img.src;
        element.prepend(lightSource);
      }

      if (theme === 'dark') {
        img.src = darkSource.srcset;
      } else {
        img.src = lightSource.srcset;
      }
    });
  }, []);

  const updateColorSchemeMeta = (theme: ITheme) => {
    let meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'color-scheme');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', theme);
  };

  const setTheme = useCallback(
    (updater: SetStateAction<ITheme>) => {
      setThemeInternal(prev => {
        const theme = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        document.documentElement.setAttribute('data-theme', theme);
        updateColorSchemeMeta(theme);
        flipImageSource(theme);
        return theme;
      });
    },
    [flipImageSource],
  );

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
    flipImageSource(initialTheme);
    // No need to handle system theme changes since we're not using 'system' theme anymore
    // We'll still keep the media query for initial setup, but we won't need the change handler
  }, [setTheme, flipImageSource]);

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
      <Script id="theme-init" strategy="beforeInteractive">
        {`
              (function () {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.add(theme);
                  document.documentElement.setAttribute('data-theme', theme);

                  var meta = document.querySelector('meta[name="color-scheme"]');
                  if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', 'color-scheme');
                    document.head.appendChild(meta);
                  }
                  meta.setAttribute('content', theme);

                  function flipImageSource(theme) {
                    document.querySelectorAll("picture").forEach(function(element) {
                      var img = element.querySelector("img");
                      var darkSource = element.querySelector(
                        "source[media='(prefers-color-scheme: dark)']"
                      );
                      if (!darkSource || !img) return;

                      var lightSource = element.querySelector(
                        "source[media='(prefers-color-scheme: light)']"
                      );
                      if (!lightSource) {
                        lightSource = document.createElement("source");
                        lightSource.media = "(prefers-color-scheme: light)";
                        lightSource.srcset = img.src;
                        element.prepend(lightSource);
                      }

                      if (theme === "dark") {
                        img.src = darkSource.srcset;
                      } else {
                        img.src = lightSource.srcset;
                      }
                    });
                  }
                  flipImageSource(theme);
                } catch (e) {}
              })();
            `}
      </Script>
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
