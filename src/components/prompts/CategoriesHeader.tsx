import { cn } from '@/lib/utils';
import React from 'react';
import { promptCardStyles } from './styles';

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
        {categories.map(({ id, title, count }) => (
          <li key={id} className="flex items-center">
            <span
              onClick={() => onCategoryClick(id)}
              className={cn(
                promptCardStyles.categoryLink,
                id === activeCategory
                  ? 'font-bold after:scale-x-100'
                  : 'after:scale-x-0',
              )}
            >
              {title} ({count})
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default CategoriesHeader;
