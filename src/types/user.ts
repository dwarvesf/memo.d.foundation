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
