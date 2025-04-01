import { useIsMounted } from '@/hooks/useIsMounted';
import {
  ComponentType,
  createContext,
  PropsWithChildren,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ILayout = 'light' | 'dark';
export interface LayoutContextType {
  readingMode: boolean;
  setReadingMode: (readingMode: boolean) => void;
  toggleReadingMode: () => void;
  isOpenSidebar: boolean;
  setIsOpenSidebar: (isOpenSidebar: boolean) => void;
  toggleIsOpenSidebar: () => void;
}
const DefaultContextValues = {
  readingMode: false,
  setReadingMode: () => {},
  toggleReadingMode: () => {},
  isOpenSidebar: false,
  setIsOpenSidebar: () => {},
  toggleIsOpenSidebar: () => {},
} satisfies LayoutContextType;

export const LayoutContext =
  createContext<LayoutContextType>(DefaultContextValues);
export const LayoutProvider = (props: PropsWithChildren) => {
  const { children } = props;
  const [isOpenSidebar, setIsOpenSidebar] = useState(false);
  const [readingMode, setReadingModeInternal] = useState(false);
  const isMounted = useIsMounted();

  const toggleIsOpenSidebar = useCallback(() => {
    setIsOpenSidebar(prev => !prev);
  }, [setIsOpenSidebar]);

  const setReadingMode = useCallback((updater: SetStateAction<boolean>) => {
    setReadingModeInternal(prev => {
      const isReadingMode =
        typeof updater === 'function' ? updater(prev) : updater;
      document.documentElement.setAttribute(
        'data-reading-mode',
        isReadingMode ? 'true' : 'false',
      );
      localStorage.setItem('readingMode', isReadingMode.toString());
      return isReadingMode;
    });
  }, []);

  const toggleReadingMode = useCallback(() => {
    setReadingMode(prev => !prev);
  }, [setReadingMode]);

  useEffect(() => {
    if (!isMounted()) return;
    const savedReadingMode = localStorage?.getItem('readingMode') === 'true';
    setReadingMode(savedReadingMode);
  }, [setReadingMode]);

  return (
    <LayoutContext.Provider
      value={{
        readingMode,
        setReadingMode,
        toggleReadingMode,
        isOpenSidebar,
        setIsOpenSidebar,
        toggleIsOpenSidebar,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutContext = () => {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

export function withLayoutContext<P extends object>(
  Component: ComponentType<P>,
): ComponentType<P> {
  const WithLayoutContext = (props: P) => {
    return (
      <LayoutProvider>
        <Component {...props} />
      </LayoutProvider>
    );
  };

  // Preserve display name for debugging
  const displayName = Component.displayName || Component.name || 'Component';
  WithLayoutContext.displayName = `WithLayoutContext(${displayName})`;

  return WithLayoutContext;
}
