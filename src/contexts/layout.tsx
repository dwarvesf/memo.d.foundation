import KeyboardShortcutDialog from '@/components/layout/KeyboardShortcutDialog';
import ShareDialog from '@/components/ShareDialog';
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
import { useHotkeys } from 'react-hotkeys-hook';

export type ILayout = 'light' | 'dark';
export interface LayoutContextType {
  readingMode: boolean;
  setReadingMode: (readingMode: boolean) => void;
  isShareDialogOpen: boolean;
  setIsShareDialogOpen: (open: boolean) => void;
  toggleReadingMode: () => void;
  openShortcutDialog: () => void;
  closeShortcutDialog: () => void;
  isOpenSidebar: boolean;
  setIsOpenSidebar: (isOpenSidebar: boolean) => void;
  toggleIsOpenSidebar: () => void;
  isMacOS: boolean;
}
const DefaultContextValues = {
  readingMode: false,
  setReadingMode: () => {},
  isShareDialogOpen: false,
  setIsShareDialogOpen: () => {},
  toggleReadingMode: () => {},
  openShortcutDialog: () => {},
  closeShortcutDialog: () => {},
  isOpenSidebar: false,
  setIsOpenSidebar: () => {},
  toggleIsOpenSidebar: () => {},
  isMacOS: true,
} satisfies LayoutContextType;

export const LayoutContext =
  createContext<LayoutContextType>(DefaultContextValues);
export const LayoutProvider = (props: PropsWithChildren) => {
  const { children } = props;
  const [isOpenSidebar, setIsOpenSidebar] = useState(false);
  const [readingMode, setReadingModeInternal] = useState(false);
  const isMounted = useIsMounted();
  const [isMacOS, setIsMacOS] = useState(true);

  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const openShortcutDialog = useCallback(() => {
    setIsShortcutDialogOpen(true);
  }, []);

  const closeShortcutDialog = useCallback(() => {
    setIsShortcutDialogOpen(false);
  }, []);

  useHotkeys(
    '?',
    event => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      event.preventDefault();
      openShortcutDialog();
    },
    { useKey: true },
    [openShortcutDialog],
  );

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

  useEffect(() => {
    setIsMacOS(window.navigator.userAgent.includes('Macintosh'));
  }, []);

  useHotkeys(
    'cmd+shift+f, ctrl+shift+f', // Listen for cmd+f and ctrl+f
    event => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }
      // Explicitly check for shift key
      // Avoid default browser search behavior
      if (!event.shiftKey) {
        return;
      }
      event.preventDefault();
      toggleReadingMode();
    },
    { useKey: true },
    [toggleReadingMode],
  );

  useHotkeys(
    ['mod+s', 'ctrl+s'],
    () => {
      setIsShareDialogOpen(true);
    },
    {
      preventDefault: true,
      enableOnFormTags: false,
    },
  );

  return (
    <LayoutContext.Provider
      value={{
        readingMode,
        setReadingMode,
        toggleReadingMode,
        isOpenSidebar,
        setIsOpenSidebar,
        toggleIsOpenSidebar,
        openShortcutDialog,
        closeShortcutDialog,
        isShareDialogOpen,
        setIsShareDialogOpen,
        isMacOS,
      }}
    >
      {children}
      <KeyboardShortcutDialog
        isOpen={isShortcutDialogOpen}
        onClose={closeShortcutDialog}
      />
      <ShareDialog
        isOpen={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
      />
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
