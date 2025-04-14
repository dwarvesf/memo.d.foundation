import { IMemoItem } from '@/types';

export function getFirstMemoImage(
  memo: Pick<IMemoItem, 'filePath' | 'content'>,
  fallback: string | null = '/assets/home_cover.webp',
) {
  // Extract first image from content if available
  const imageMatch = memo.content?.match(/!\[.*?\]\((.*?)\)/);
  const extractedImage = imageMatch ? imageMatch[1] : null;
  if (extractedImage) {
    if (extractedImage.startsWith('/') || extractedImage.startsWith('http')) {
      return extractedImage;
    } else {
      // Construct path based on file location
      const basePath = memo.filePath
        .toLowerCase()
        .replace(/\/[^/]+\.md$/, '')
        .replace(/ /g, '-')
        .replace(/[^a-zA-Z0-9\/_\.-]+/g, '-')
        .replace(/(-\/|-$|_index$)/g, '');

      return `/content/${basePath}/${extractedImage}`;
    }
  }

  // Fallback image
  return fallback;
}

export function formatMemoPath(filePath: string): string {
  let formattedPath = filePath
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/ /g, '-')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/(-\/|-$|_index$)/g, '');

  // Remove trailing slash if present
  if (formattedPath.endsWith('/')) {
    formattedPath = formattedPath.slice(0, -1);
  }

  // Ensure the path starts with a single slash
  if (formattedPath.startsWith('/')) {
    return formattedPath; // Already starts with slash, return as is
  } else {
    return `/${formattedPath}`; // Prepend slash
  }
}
