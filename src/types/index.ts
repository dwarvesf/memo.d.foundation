import { AsPlainObject } from 'minisearch';

export interface ITocItem {
  id: string;
  value: string;
  depth: number;
  children: ITocItem[];
}

export interface IMetadata {
  created: string;
  updated: string;
  author: string;
  coAuthors: string[];
  tags: string[];
  folder: string;
  wordCount: number;
  readingTime: string;
  characterCount: number;
  blocksCount: number;

  //mint entry
  tokenId: string;
  permaStorageId: string;
  title: string;
  authorRole?: string;
  image?: string;

  firstImage?: string;
}

export interface ITreeNode {
  label: string;
  children: Record<string, ITreeNode>;
  count?: number;
  url?: string; // Add url property
}

export interface IBackLinkItem {
  title: string;
  path: string;
}
export interface IMiniSearchIndex {
  index?: AsPlainObject;
  documents: Partial<Document>[];
}

export interface IRecentPageStorageItem {
  path: string;
  title: string;
  timestamp: number;
}
export interface ISearchResultItem {
  id: string;
  title: string;
  description: string;
  path: string;
  category: string;
  icon?: React.ReactNode;
  action?: string;
  index?: number;
}

export interface RootLayoutPageProps {
  directoryTree?: Record<string, ITreeNode>;
  searchIndex?: IMiniSearchIndex | null;
  pinnedNotes?: Array<{
    title: string;
    url: string;
    date: string;
  }>;
  tags?: string[]; // Assuming getTags returns string[]
}

export interface IMemoItem {
  content: string;
  title: string;
  short_title?: string;
  date: string;
  description?: string;
  authors?: string[];
  tags?: string[];
  draft?: boolean;
  pinned?: boolean;
  hiring?: boolean;

  filePath: string;
  slugArray: string[];
}
