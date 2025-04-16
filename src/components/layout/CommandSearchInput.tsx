import React from 'react';
import { SearchIcon } from 'lucide-react';
import HighlightWithinTextarea from 'react-highlight-within-textarea';
import 'draft-js/dist/Draft.css'; // Import draft.js styles
import {
  SEARCH_AUTHOR_REGEX,
  SEARCH_DIR_REGEX,
  SEARCH_TAG_REGEX,
} from '@/constants/regex';

interface CommandSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// Regex patterns for different types of highlights
const highlights = [
  {
    // Match @ followed by any non-space characters
    highlight: SEARCH_AUTHOR_REGEX,
    className: 'bg-primary/10 text-primary rounded px-1',
  },
  {
    // Match # followed by any non-space characters
    highlight: SEARCH_TAG_REGEX,
    className: 'bg-primary/10 text-primary rounded px-1',
  },
  {
    // Match / followed by any non-space characters
    highlight: SEARCH_DIR_REGEX,
    className: 'bg-primary/10 text-primary rounded px-1',
  },
];

export const CommandSearchInput: React.FC<CommandSearchInputProps> = ({
  value,
  onChange,
  inputRef,
}) => {
  const handleChange = (val: string) => {
    onChange(val);
  };

  return (
    <div className="border-border border-b p-4">
      <div className="flex items-center">
        <SearchIcon className="text-muted-foreground mr-2 h-5 w-5" />
        <div className="relative flex-1">
          <HighlightWithinTextarea
            ref={inputRef}
            value={value}
            onChange={handleChange}
            highlight={highlights}
            placeholder="Search (e.g., @tom, #ai, /playbook)..."
          />
        </div>
      </div>
    </div>
  );
};
