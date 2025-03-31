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
}

export interface ITreeNode {
  label: string;
  children: Record<string, ITreeNode>;
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
