import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const wordDict: Record<string, string> = {
  ogif: 'OGIF',
  llm: 'LLM',
  ai: 'AI',
};
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function slugToTitle(slug = '') {
  const words = slug.split('-');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    words[i] = wordDict[word] || word.charAt(0).toUpperCase() + word.slice(1);
  }

  return words.join(' ');
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (result, currentValue) => {
      const groupKey = currentValue[key] as unknown as string;
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(currentValue);
      return result;
    },
    {} as Record<string, T[]>,
  );
}
