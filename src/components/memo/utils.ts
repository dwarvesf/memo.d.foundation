import { IMemoItem } from '@/types';

export function getFirstMemoImage(memo: IMemoItem): string {
  // Extract first image from content if available
  const imageMatch = memo.content?.match(/!\[.*?\]\((.*?)\)/);
  const extractedImage = imageMatch ? imageMatch[1] : null;

  // Handle different image path scenarios
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
  return '/assets/home_cover.webp';
}

export function formatMemoPath(filePath: string): string {
  const formattedPath = filePath
    .toLowerCase()
    .replace(/\.md$/, '')
    .replace(/ /g, '-')
    .replace(/[^a-zA-Z0-9/_-]+/g, '-')
    .replace(/(-\/|-$|_index$)/g, '');

  return `/${formattedPath}`;
}
