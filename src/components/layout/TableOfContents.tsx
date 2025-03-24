import React, { useState, useEffect } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
  children?: TOCItem[];
}

interface TableOfContentsProps {
  items: TOCItem[];
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ items }) => {
  const [activeId, setActiveId] = useState<string>('');

  // Function to calculate heading level classes
  const getHeadingLevelClass = (level: number) => {
    return `heading-level-${level}`;
  };

  // Function to render TOC items recursively
  const renderTOCItems = (items: TOCItem[]) => {
    return (
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a 
              href={`#${item.id}`}
              className={`${getHeadingLevelClass(item.level)} ${activeId === item.id ? 'text-primary' : ''} block text-sm transition-colors rounded hover:bg-muted py-1`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(item.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(item.id);
                }
              }}
            >
              {item.text}
            </a>
            {item.children && item.children.length > 0 && renderTOCItems(item.children)}
          </li>
        ))}
      </ul>
    );
  };

  // Track scroll position to highlight current section
  useEffect(() => {
    const headingElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .filter(heading => heading.id);
      
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // Offset for better UX
      
      // Find the last heading that's above current scroll position
      for (let i = headingElements.length - 1; i >= 0; i--) {
        const heading = headingElements[i] as HTMLElement;
        if (heading.offsetTop <= scrollPosition) {
          setActiveId(heading.id);
          return;
        }
      }
      
      // If no heading is found, set the first one as active
      if (headingElements.length > 0) {
        setActiveId((headingElements[0] as HTMLElement).id);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [items]);

  return renderTOCItems(items);
};

export default TableOfContents;