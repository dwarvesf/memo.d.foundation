import {
  CompactContributorProfile,
  ContributorProfile,
  MochiUserProfile,
} from '@/types/user';
import { queryDuckDB } from './db/utils';

/**
 * Gets the list of contributor stats
 * @returns Array of contributor stats
 */
export async function getContributorFromParquet(): Promise<
  ContributorProfile[]
> {
  try {
    const profiles = await queryDuckDB(`SELECT * FROM contributors;`, {
      filePath: 'public/content/contributor-stats.parquet',
      tableName: 'contributors',
    });

    const jsonProfiles = (profiles as any[]).map(profile => {
      const output: Record<string, any> = {};

      Object.keys(profile).forEach(key => {
        try {
          output[key] = JSON.parse(profile[key]);
        } catch {
          output[key] = profile[key];
        }
      });

      return output;
    });

    return jsonProfiles as unknown as ContributorProfile[];
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return [];
  }
}

/**
 * Get the contributor's wallet address from their Mochi profile.
 */
function getContributorWalletAddress(mochiProfile: MochiUserProfile | null) {
  const profileData = mochiProfile;

  // Look for EVM accounts in the associated_accounts
  if (
    profileData?.associated_accounts &&
    profileData?.associated_accounts.length > 0
  ) {
    // Filter only EVM chain accounts
    const evmAccounts = profileData.associated_accounts.filter(
      (account: any) => account.platform === 'evm-chain',
    );

    if (evmAccounts.length > 0) {
      // Sort by updated_at in descending order (latest first)
      // If updated_at is not available, those accounts will be ordered last
      const sortedAccounts = evmAccounts.sort((a: any, b: any) => {
        if (!a.updated_at) return 1;
        if (!b.updated_at) return -1;
        return (
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
      });

      // Return the most recently updated EVM account
      return sortedAccounts[0].platform_identifier;
    }
  }

  return null; // No wallet address found
}

export async function getCompactContributorFromParquet(): Promise<
  CompactContributorProfile[]
> {
  try {
    const profiles = await queryDuckDB(`SELECT * FROM contributors;`, {
      filePath: 'public/content/contributor-stats.parquet',
      tableName: 'contributors',
    });

    const jsonProfiles = (profiles as any[]).map(profile => {
      const output: Record<string, any> = {};

      Object.keys(profile).forEach(key => {
        try {
          output[key] = JSON.parse(profile[key]);
        } catch {
          output[key] = profile[key];
        }
      });

      return output;
    }) as ContributorProfile[];

    return jsonProfiles.map(profile => {
      const {
        facebook_url = null,
        linkedin_url = null,
        username,
        github_url = null,
        github_metadata,
        mochi_profile_metadata,
        linkedin_metadata,
      } = profile;

      let github_handle = '';
      if (github_url) {
        github_handle = github_url.split('/').pop() || '';
      }
      const github_avatar = github_handle
        ? `https://github.com/${github_handle}.png?size=200`
        : null;

      const mochi_avatar = mochi_profile_metadata?.avatar;
      const discord_username =
        mochi_profile_metadata?.associated_accounts?.find(
          account => account.platform === 'discord',
        )?.platform_metadata?.username;

      const github_avatar_from_mochi =
        mochi_profile_metadata?.associated_accounts?.find(
          account => account.platform === 'github',
        )?.platform_metadata?.avatar;

      const bio = github_metadata?.bio || linkedin_metadata?.about;

      const wallet_address = getContributorWalletAddress(
        mochi_profile_metadata as MochiUserProfile | null,
      );

      return {
        facebook_url,
        linkedin_url,
        username,
        name:
          github_metadata?.name.replace(username, '').trim() ||
          username ||
          null,
        github_url,
        avatar:
          mochi_avatar || github_avatar_from_mochi || github_avatar || null,
        bio,
        discord_handle: discord_username ?? null,
        github_handle: username,
        website_url: github_metadata?.blog,
        company: linkedin_metadata?.current_company || github_metadata?.company,
        position: linkedin_metadata?.current_position ?? null,
        x_username: github_metadata?.twitter_username ?? null,
        x_url: github_metadata?.twitter_username
          ? `https://x.com/${github_metadata?.twitter_username}`
          : null,
        wallet_address,
      } as CompactContributorProfile;
    }) as CompactContributorProfile[];
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return [];
  }
}
