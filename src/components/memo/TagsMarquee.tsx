import { Marquee } from '../ui/marquee';
import Tag from '../ui/tag';
import { ITreeNode } from '@/types';
import { useMemo } from 'react';

interface TagsMarqueeProps {
  directoryTree: Record<string, ITreeNode>;
}

function TagsMarquee(props: TagsMarqueeProps) {
  const { directoryTree } = props;
  const tags = useMemo(() => {
    if (!directoryTree) return [];
    const tagsNode = directoryTree['/tags'].children;

    if (!tagsNode) return []; // Add this check as well, just in case children is null/undefined

    return Object.entries(tagsNode).sort(([a], [b]) => a.localeCompare(b));
  }, [directoryTree]);

  const chunks = tags.reduce(
    (acc, tag, index) => {
      if (index % 10 === 0) {
        acc.push([]);
      }
      acc[acc.length - 1].push(tag);
      return acc;
    },
    [] as [string, ITreeNode][][],
  );

  return (
    <div className="relative mt-5 flex flex-col items-center justify-center overflow-hidden">
      {chunks.map((chunk, index) => {
        return (
          <Marquee
            key={`marquee-${index}`}
            pauseOnHover
            reverse={index % 2 === 1}
            className="[--duration:150s]"
          >
            {chunk.map(([path, node]) => (
              <Tag key={path} href={path}>
                {node.label} ({node.count})
              </Tag>
            ))}
          </Marquee>
        );
      })}
      <div className="from-background pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r"></div>
      <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l"></div>
    </div>
  );
}

export default TagsMarquee;
