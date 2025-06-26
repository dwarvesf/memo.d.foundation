import {
  CompactContributorProfile,
  ContributorProfile,
  MochiUserProfile,
} from '@/types/user';
import path from 'path';
import fs from 'fs/promises';

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
    const evmAccounts = profileData?.associated_accounts.filter(
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

function getContributorName(data: ContributorProfile) {
  const mochiProfile = data.mochi_profile_metadata;
  const githubName = data.github_metadata?.name
    .replace(data.username, '')
    .trim();

  if (githubName) {
    return githubName;
  }

  if (
    mochiProfile?.associated_accounts &&
    mochiProfile?.associated_accounts.length > 0
  ) {
    // Look for github account
    const githubAccount = mochiProfile?.associated_accounts.find(
      account => account.platform === 'github',
    );
    if (githubAccount?.platform_metadata?.username) {
      return githubAccount.platform_metadata.username;
    }

    // Look for discord account
    const discordAccount = mochiProfile?.associated_accounts.find(
      account => account.platform === 'discord',
    );
    if (discordAccount?.platform_metadata?.username) {
      return discordAccount.platform_metadata.username;
    }

    // Look for twitter account
    const twitterAccount = mochiProfile?.associated_accounts.find(
      account => account.platform === 'twitter',
    );
    if (twitterAccount?.platform_metadata?.username) {
      return twitterAccount.platform_metadata.username;
    }
  }

  return data.username || null;
}

export async function getCompactContributorsFromContentJSON(): Promise<
  CompactContributorProfile[]
> {
  try {
    const jsonContributorsPath = path.join(
      process.cwd(),
      'public/content/contributors.json',
    );
    const jsonProfilesString = await fs.readFile(jsonContributorsPath, 'utf8');

    const jsonProfiles = JSON.parse(jsonProfilesString) as ContributorProfile[];

    return jsonProfiles.map(profile => {
      const {
        facebook_url = null,
        linkedin_url = null,
        username,
        github_url = null,
        github_metadata,
        mochi_profile_metadata,
        linkedin_metadata,
        analysis_result,
        member_type,
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

      const bio = github_metadata?.bio || linkedin_metadata?.about || null;

      const wallet_address = getContributorWalletAddress(
        mochi_profile_metadata as MochiUserProfile | null,
      );

      return {
        facebook_url,
        linkedin_url,
        username,
        name: getContributorName(profile),
        github_url,
        avatar:
          mochi_avatar || github_avatar || github_avatar_from_mochi || null,
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
        analysis_result,
        member_type,
      } as CompactContributorProfile;
    });
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return [];
  }
}
