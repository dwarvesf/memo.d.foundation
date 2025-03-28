import path from 'path';

export function getContentPath(slug: string) {
  const contentDir = path.join(process.cwd(), 'public/content');

  return path.join(contentDir, slug);
}
