export interface PlatformMetadata {
  avatar?: string;
  username?: string;
  ans?: string;
  bns?: string;
  ens?: string;
  sns?: string;
}

export interface AssociatedAccount {
  id: string;
  profile_id: string;
  platform: string;
  platform_identifier: string;
  platform_metadata: PlatformMetadata;
  discord_id: string;
  created_at: string;
  updated_at: string;
  total_amount: string;
  pnl: string;
  is_guild_member: boolean;
  is_wallet: boolean;
}

export interface GithubProfile {
  login: string;
  id: number;
  avatar_url: string;
  url: string;
  name: string;
  location: string;
  bio: string;
  twitter_username: string;
}

export interface MochiUserProfile {
  // Mochi user profile
  id: string;
  created_at: string;
  updated_at: string;
  associated_accounts: AssociatedAccount[];
  associated_account_pendings: null | any[];
  profile_name: string;
  avatar: string;
  pnl: string;
  type: 'user' | 'application';
  active_score: number;
  application_id: null | string;
  application: null | any;
}

export interface UserProfile extends Partial<MochiUserProfile> {
  bio?: string;
  websiteLink?: string;
  name?: string;

  discord_id?: string;
  discord_username?: string;

  twitter_username?: string;

  github_username?: string;
  github_url?: string;

  last_wallet_account?: AssociatedAccount;

  github?: {
    id: number;
    login: string;
    avatar_url?: string;
    name?: string;
    bio?: string;
    twitter_username?: string;
    html_url?: string;
    blog?: string;
  } | null;
}

export interface UserProfileJson {
  data: Record<string, UserProfile>;
  updated_at: string;
}

export interface GithubMetadata {
  name: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  public_repos: number | null;
  followers: number | null;
  following: number | null;
  hireable: boolean | null;
  twitter_username: string | null;
  blog: string | null;
  email: string | null;
  error: boolean;
}

export interface LinkedInMetadata {
  name?: string;
  headline?: string;
  location?: string;
  current_company?: string;
  current_position?: string;
  connections?: number;
  followers?: number | null;
  about?: string;
  industry?: string;
  education?: string;
  skills?: any[];
  experiences?: any[];
  experience_count?: number;
}

export interface ProfileAnalysis {
  attributes: Attributes;
  summary: string;
  confidence: number;
  articleCount: number;
  topArticles: TopArticle[];
  updatedAt: string;
}

interface Attributes {
  technician: number;
  manager: number;
  operator: number;
  consultant: number;
  builder: number;
}

interface TopArticle {
  title: string;
  score: number;
  primaryAttribute: string;
}

export interface ContributorProfile {
  profile_url: string;
  username: string;
  github_url: string;
  linkedin_url: string;
  discord_usernames: string;
  analysis_result?: ProfileAnalysis;
  github_crawl_status: string;
  last_attempted_at: number;
  github_extraction_error: string;
  github_crawled_at: number;
  github_metadata?: GithubMetadata;
  linkedin_crawl_status: string;
  last_crawled_at: number;
  linkedin_metadata?: LinkedInMetadata;
  facebook_url: string;
  mochi_profile_url?: string;
  mochi_profile_crawl_status?: string;
  mochi_profile_metadata?: MochiUserProfile;
}

export interface CompactContributorProfile {
  github_handle: string;
  username: string;
  name?: string;
  bio: string;
  discord_handle: string;
  website_url: string;
  linkedin_url?: string;
  facebook_url?: string;
  github_url?: string;
  x_url?: string;
  x_username?: string;
  avatar?: string;
  current_position?: string;
  company?: string;
  wallet_address?: string;
  analysis_result?: ProfileAnalysis;
  is_alumni?: boolean;
}
