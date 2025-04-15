import React from 'react';
import { SearchIcon } from 'lucide-react';
import HighlightWithinTextarea from 'react-highlight-within-textarea';
import 'draft-js/dist/Draft.css'; // Import draft.js styles

interface CommandSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// Regex patterns for different types of highlights
const highlights = [
  {
    // Match author:@ followed by any non-space characters
    highlight: /author:@[^\s]+/g,
    className: 'bg-primary/10 text-primary rounded px-1',
  },
  {
    // Match # followed by any non-space characters
    highlight: /#[^\s]+/g,
    className: 'bg-primary/10 text-primary rounded px-1',
  },
  {
    // Match dir: followed by any non-space characters
    highlight: /dir:[^\s]+/g,
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
            placeholder="Search (try author:@name #tag dir:folder)..."
          />
        </div>
      </div>
    </div>
  );
};
