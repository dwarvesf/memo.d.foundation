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
  pageViewCount: number;
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
  summary?: string;
}

export interface ITreeNode {
  label: string;
  children: Record<string, ITreeNode>;
  hidden?: boolean;
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
}

export interface ContributorLayoutPageProps {
  directoryTree?: Record<string, ITreeNode>;
  searchIndex?: IMiniSearchIndex | null;
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
  slugArray?: string[];

  image?: string | null;

  tokenId?: string | null;
  authorAvatars?: string[];
}

// Define the CollectMemo type
export interface CollectMemo {
  title: string;
  filePath: string;
  date: string;
  tokenId: string;
  type: 'collect'; // To distinguish from regular memos
}

// Define the Activity type (union of IMemoItem and CollectMemo)
export type Activity = IMemoItem | CollectMemo;

/**
 * Interface for menu file paths within a group
 */
export interface MenuFilePath {
  file_path: string;
  title: string;
  date: string; // Keep date for sorting
}

export interface NestedMenuPathTree {
  [key: string]: string | NestedMenuPathTree;
  // The key is the path, and the value can be a string or another nested object
  // representing subdirectories.
}

/**
 * Interface for grouped path data (menu hierarchy node)
 */
export interface GroupedPath {
  grouped_path: string; // The path of the directory itself
  file_paths: MenuFilePath[]; // Files directly within this directory
  next_path: Record<string, GroupedPath>; // Subdirectories
}

export interface IPromptItem {
  title: string;
  description: string;
  tags: string[];
  category: string;
  authors: string[];
  models: string[];
  source: string;
  private: boolean;
  metadata: Record<string, unknown>;
  mdContent: string;
  lastUpdatedAt: string;
  filePath: string;
  modelPromptUrl: string;
  repo: string;
}
