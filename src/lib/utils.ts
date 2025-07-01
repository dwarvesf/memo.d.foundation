import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ITocItem } from '@/types';
export const wordDict: Record<string, string> = {
  ogif: 'OGIF',
  llm: 'LLM',
  ai: 'AI',
  nda: 'NDA',
  aarrr: 'AARRR',
  wala: 'WALA',
  ui: 'UI',
  ux: 'UX',
  rag: 'RAG',
  rfc: 'RFC',
  seo: 'SEO',
  mcp: 'MCP',
  defi: 'DeFi',
  dapp: 'DApp',
  mma: 'MMA',
  moc: 'MoC',
  saas: 'SaaS',
  web3: 'Web3',
  pm: 'PM',
  qa: 'QA',
  qc: 'QC',
  mbti: 'MBTI',
  dx: 'DX',
  etl: 'ETL',
  evm: 'EVM',
  iot: 'IoT',
  sql: 'SQL',
  nosql: 'NoSQL',
  api: 'API',
  sdk: 'SDK',
};
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function slugToTitle(slug = '') {
  const words = slug.split('-');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    words[i] =
      wordDict[word] ||
      (i == 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word);
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

export function uppercaseSpecialWords(str = '', separator = ' ') {
  return str
    ?.toString()
    .split(separator)
    .map(word => {
      return wordDict[word.toLowerCase()] || word;
    })
    .join(separator);
}
export function formatAddress(address: string) {
  const formattedAddress = `${address.substring(
    0,
    6,
  )}...${address.substring(address.length - 4)}`;
  return formattedAddress;
}

// Helper to flatten TOC items for easier navigation
export const flattenTocItems = (items: ITocItem[]): ITocItem[] => {
  let flattened: ITocItem[] = [];
  items.forEach(item => {
    flattened.push(item);
    if (item.children && item.children.length > 0) {
      flattened = flattened.concat(flattenTocItems(item.children));
    }
  });
  return flattened;
};
