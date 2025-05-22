import { cn } from '@/lib/utils';
import React from 'react';
import { promptCardStyles } from './styles';
import {
  Activity,
  Code2,
  PencilLine,
  Calculator,
  Component,
} from 'lucide-react';
import Link from 'next/link';

export const categoryIcons = {
  general: Activity,
  coding: Code2,
  operating: Calculator,
  writing: PencilLine,
  misc: Component,
};

interface CategoriesHeaderProps {
  categories: { id: string; title: string; count: number }[];
}

const getHashId = () => {
  if (typeof window !== 'undefined') {
    return window.location.hash.replace('#', '');
  }
  return '';
};

const CategoriesHeader: React.FC<CategoriesHeaderProps> = ({ categories }) => {
  return (
    <nav className="mb-4 overflow-x-auto">
      <ul className="flex flex-nowrap gap-2">
        {categories.map(({ id, title, count }) => {
          const Icon =
            categoryIcons[title.toLowerCase() as keyof typeof categoryIcons];
          return (
            <li key={id} className="flex items-center whitespace-nowrap">
              <Link
                href={`#${id}`}
                className={cn(
                  promptCardStyles.categoryLink,
                  id === getHashId() ? 'after:scale-x-100' : 'after:scale-x-0',
                )}
                shallow
                // scroll={false}
              >
                <Icon size={14} className="text-neutral-500" />
                {title} ({count})
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default CategoriesHeader;
