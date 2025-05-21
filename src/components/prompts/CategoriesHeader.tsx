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

export const categoryIcons = {
  general: Activity,
  coding: Code2,
  operating: Calculator,
  writing: PencilLine,
  misc: Component,
};

interface CategoriesHeaderProps {
  categories: { id: string; title: string; count: number }[];
  activeCategory: string;
  onCategoryClick: (category: string) => void;
}

const CategoriesHeader: React.FC<CategoriesHeaderProps> = ({
  categories,
  activeCategory,
  onCategoryClick,
}) => {
  return (
    <nav className="mb-4">
      <ul className="flex flex-wrap gap-2">
        {categories.map(({ id, title, count }) => {
          const Icon =
            categoryIcons[title.toLowerCase() as keyof typeof categoryIcons];
          return (
            <li key={id} className="flex items-center">
              <span
                onClick={() => onCategoryClick(id)}
                className={cn(
                  promptCardStyles.categoryLink,
                  id === activeCategory
                    ? 'after:scale-x-100'
                    : 'after:scale-x-0',
                )}
              >
                <Icon size={14} className="text-neutral-500" />
                {title} ({count})
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default CategoriesHeader;
