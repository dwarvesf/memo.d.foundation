import { cn } from '@/lib/utils';
import {
  Activity,
  Calculator,
  Code2,
  Component,
  PencilLine,
} from 'lucide-react';
// import Link from 'next/link'; // Link component might not be needed if handling click via prop
import React from 'react';
import { promptCardStyles } from './styles';

export const categoryIcons = {
  general: Activity,
  coding: Code2,
  operating: Calculator,
  writing: PencilLine,
  misc: Component,
};

interface CategoriesHeaderProps {
  categories: { id: string; title: string; count: number }[];
  onSelectCategory: (categorySlug: string) => void; // Added prop
}

const getHashId = () => {
  if (typeof window !== 'undefined') {
    return window.location.hash.replace('#', '');
  }
  return '';
};

const CategoriesHeader: React.FC<CategoriesHeaderProps> = ({
  categories,
  onSelectCategory,
}) => {
  return (
    <nav className="mb-4 overflow-x-auto">
      <ul className="flex flex-nowrap gap-2">
        {categories.map(({ id, title, count }) => {
          const Icon =
            categoryIcons[title.toLowerCase() as keyof typeof categoryIcons];
          return (
            <li key={id} className="flex items-center whitespace-nowrap">
              <button
                type="button"
                onClick={() => onSelectCategory(id)}
                className={cn(
                  promptCardStyles.categoryLink,
                  id === getHashId() ? 'after:scale-x-100' : 'after:scale-x-0',
                  'rounded focus:ring-2 focus:ring-blue-500 focus:outline-none', // Added focus styles for accessibility
                )}
              >
                <Icon size={14} className="text-neutral-500" />
                {title} ({count})
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default CategoriesHeader;
