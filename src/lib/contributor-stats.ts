import { CompactContributorProfile, ContributorProfile } from '@/types/user';
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
        facebook_url,
        linkedin_url,
        username,
        github_url,
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

      return {
        facebook_url,
        linkedin_url,
        username,
        github_url,
        avatar:
          mochi_avatar || github_avatar_from_mochi || github_avatar || null,
        bio,
        discord_handle: discord_username,
        github_handle: username,
        website: github_metadata?.blog,
        company: linkedin_metadata?.current_company || github_metadata?.company,
        position: linkedin_metadata?.current_position,
        x_url: github_metadata?.twitter_username
          ? `https://x.com/${github_metadata?.twitter_username}`
          : undefined,
      } as CompactContributorProfile;
    }) as CompactContributorProfile[];
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return [];
  }
}
