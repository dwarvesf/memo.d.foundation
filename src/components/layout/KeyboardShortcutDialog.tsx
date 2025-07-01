import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface KeyboardShortcutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  label: string;
  keys: string[];
}

interface ShortcutSection {
  title: string;
  shortcuts: Shortcut[];
}

const isMac =
  typeof window !== 'undefined' &&
  navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="text-[var(--muted-foreground) rounded border bg-[var(--border)] px-1 py-1.5 text-[11px] leading-1">
    {children}
  </kbd>
);

const shortcutData: ShortcutSection[] = [
  {
    title: 'Site-wide',
    shortcuts: [
      {
        label: 'Open search command',
        keys: [isMac ? '⌘' : 'Ctrl', 'K'],
      },
      {
        label: 'Toggle reading mode',
        keys: [isMac ? '⌘' : 'Ctrl', 'Shift', 'F'],
      },
      {
        label: 'Bring up this help dialog',
        keys: ['?'],
      },
    ],
  },
  {
    title: 'Memo navigation',
    shortcuts: [
      {
        label: 'Jump to top of page',
        keys: ['G', 'G'],
      },
      {
        label: 'Jump to bottom of page',
        keys: ['Shift', 'G'],
      },
      {
        label: 'Next heading (any level)',
        keys: [']'],
      },
      {
        label: 'Previous heading (any level)',
        keys: ['['],
      },
      {
        label: 'Search and navigate headings',
        keys: ['G', 'H'],
      },
    ],
  },
];

const KeyboardShortcutDialog: React.FC<KeyboardShortcutDialogProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full !max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle id="keyboard-shortcuts-title">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {shortcutData.map((section, sectionIndex) => (
            <div key={sectionIndex} className="rounded-md border">
              <div className="border-b bg-[var(--border)]/25 px-3 py-2">
                <h3 className="font-sans text-sm font-medium">
                  {section.title}
                </h3>
              </div>
              <ul className="divide-border divide-y">
                {section.shortcuts.map((shortcut, shortcutIndex) => (
                  <li
                    key={shortcutIndex}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <span className="text-[var(--muted-foreground) font-mono text-xs">
                      {shortcut.label}
                    </span>
                    <span className="flex items-center space-x-1 font-mono text-sm text-gray-600 dark:text-gray-300">
                      {shortcut.keys.map((key, keyIndex) => (
                        <Kbd key={keyIndex}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default KeyboardShortcutDialog;
