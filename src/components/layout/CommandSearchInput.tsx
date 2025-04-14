import React from 'react';
import { SearchIcon } from 'lucide-react';

interface CommandSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export interface ParsedSearch {
  query: string;
  author?: string;
  tags: string[];
  directory?: string;
}
export const parseInput = (input: string): ParsedSearch => {
  const tags = input.match(/#[\w-]+/g) ?? [];
  const author = input.match(/author:@([\w-]+)/)?.[1];
  const directory = input.match(/dir:([\w-]+)/)?.[1];

  // Remove special syntax from main query
  const query = input
    .replace(/#[\w-]+/g, '')
    .replace(/author:@[\w-]+/g, '')
    .replace(/dir:[\w-]+/g, '')
    .trim();

  return {
    query,
    author,
    tags: tags.map(tag => tag.slice(1)), // Remove # prefix
    directory,
  };
};

export const CommandSearchInput: React.FC<CommandSearchInputProps> = ({
  value,
  onChange,
  inputRef,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  return (
    <div className="border-border border-b p-4">
      <div className="flex items-center">
        <SearchIcon className="text-muted-foreground mr-2 h-5 w-5" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder="Search (try author:@name #tag dir:folder)..."
          className="text-foreground flex-1 border-none bg-transparent outline-none"
        />
      </div>
    </div>
  );
};
