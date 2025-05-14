import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { queryDuckDB } from '../src/lib/db/utils.js';
import fs from 'fs/promises';
import path from 'path';
import { MochiUserProfile, UserProfile } from '../src/types/user.js';

const MOCHI_PROFILE_API = process.env.MOCHI_PROFILE_API;
const GITHUB_TOKEN = process.env.DWARVES_PAT;
console.log('MOCHI_PROFILE_API: ', MOCHI_PROFILE_API?.length);
console.log('GITHUB_TOKEN: ', GITHUB_TOKEN?.length);

async function fetchMochiProfile(
  githubUsername: string,
): Promise<MochiUserProfile | null> {
  try {
    const response = await fetch(`${MOCHI_PROFILE_API}/${githubUsername}`, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `Error fetching data for ${githubUsername}: ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    return data as MochiUserProfile;
  } catch (error) {
    console.error(`Failed to fetch profile for ${githubUsername}:`, error);
    return null;
  }
}

async function getAllAuthors(): Promise<string[]> {
  const authorsResult = await queryDuckDB(`
        SELECT DISTINCT UNNEST(authors) AS author
        FROM vault
        WHERE authors IS NOT NULL;
      `);

  const contributorVaultDir = path.join(process.cwd(), 'vault/contributor');
  let manualAuthors: string[] = [];
  try {
    const files = await fs.readdir(contributorVaultDir, {
      withFileTypes: true,
    });
    const excludeFiles = ['index.mdx', 'README.md', '[slug].mdx'];
    const mdxFiles = files.filter(
      dirent =>
        dirent.isFile() &&
        dirent.name.endsWith('.mdx') &&
        !excludeFiles.includes(dirent.name),
    );
    manualAuthors = mdxFiles.map(file => file.name.replace(/\.mdx$/, ''));
  } catch (error) {
    console.error('Error reading vault/contributor directory:', error);
  }

  const allAuthors = [
    ...authorsResult.map(row => row.author as string),
    ...manualAuthors,
  ].map(i => i.toLowerCase());

  return Array.from(new Set(allAuthors));
}

async function getUserProfileByGithubUsername(
  githubUsername: string,
  existingProfiles: Record<string, UserProfile>,
): Promise<UserProfile | null> {
  const existingProfile = existingProfiles[githubUsername.toLowerCase()];
  if (existingProfile && (existingProfile.id || existingProfile.avatar)) {
    console.log(`Skipping fetch for ${githubUsername}, profile already exists.`);
    return existingProfile;
  }

  let githubData:
    | RestEndpointMethodTypes['users']['getByUsername']['response']['data']
    | undefined = undefined;
  let mochiData: MochiUserProfile | null = null;

  try {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Check GitHub rate limit before making the request
    const { data: rateLimit } = await octokit.rest.rateLimit.get();
    const coreLimit = rateLimit.resources.core;
    console.log(`GitHub Core Rate Limit: Remaining - ${coreLimit.remaining}, Reset - ${new Date(coreLimit.reset * 1000).toLocaleTimeString()}`);

    if (coreLimit.remaining < 50) { // Check if remaining calls are low (e.g., less than 50)
      const resetTime = new Date(coreLimit.reset * 1000);
      const timeToWait = resetTime.getTime() - Date.now() + 5000; // Add a 5-second buffer
      const MAX_WAIT_TIME_MS = 30000; // Maximum wait time in milliseconds (30 seconds)

      if (timeToWait > MAX_WAIT_TIME_MS) {
        console.warn(`Calculated wait time (${timeToWait}ms) exceeds maximum allowed (${MAX_WAIT_TIME_MS}ms). Skipping GitHub fetch for ${githubUsername}.`);
        // Skip the GitHub API call and proceed with available data (or null if no existing profile)
        return existingProfile || null; // Return existing profile if available, otherwise null
      } else if (timeToWait > 0) {
        console.log(`Rate limit low, waiting for ${timeToWait}ms until reset for ${githubUsername}.`);
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
    }

    const { data: githubUser } = await octokit.rest.users.getByUsername({
      username: githubUsername,
    });
    githubData = githubUser;
    // Original fixed delay is no longer needed with dynamic checking
    // await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
  } catch (error) {
    console.error(`Failed to fetch GitHub data for ${githubUsername}:`, error);
  }

  try {
    mochiData = await fetchMochiProfile(githubUsername);
  } catch (error) {
    console.error(
      `Failed to fetch Mochi profile for ${githubUsername}:`,
      error,
    );
  }

  if (!mochiData && !githubData) {
    return null;
  }

  const discordData = mochiData?.associated_accounts?.find(
    acc => acc.platform === 'discord',
  );
  const sortedAccounts = mochiData?.associated_accounts?.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  const lastWalletAccount = sortedAccounts?.find(
    acc => acc.platform === 'wallet' && acc.is_wallet,
  );

  return {
    ...mochiData,
    id: mochiData?.id || githubData?.id?.toString() || '',
    bio: githubData?.bio || undefined,
    avatar: mochiData?.avatar || githubData?.avatar_url || undefined,
    websiteLink: githubData?.blog || undefined,
    name:
      mochiData?.profile_name ||
      githubData?.name ||
      githubData?.login ||
      undefined,
    twitter_username: githubData?.twitter_username || undefined,
    discord_id: discordData?.discord_id || discordData?.platform_identifier,
    discord_username: discordData?.platform_metadata?.username,
    github_username: githubData?.login || githubUsername,
    github_url: githubData?.html_url,
    last_wallet_account: lastWalletAccount,
    github: githubData
      ? {
          id: githubData.id,
          login: githubData.login,
          avatar_url: githubData.avatar_url,
          name: githubData.name || undefined,
          bio: githubData.bio || undefined,
          twitter_username: githubData.twitter_username || undefined,
          html_url: githubData?.html_url,
          blog: githubData?.blog || undefined,
        }
      : undefined,
  } satisfies UserProfile;
}

async function saveUserProfiles(userProfiles: Record<string, UserProfile>) {
  const outputPath = path.join(
    process.cwd(),
    'public/content/userProfiles.json',
  );

  try {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      outputPath,
      JSON.stringify(
        {
          data: userProfiles,
          updated_at: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf8',
    );

    console.log(`User profiles successfully saved to ${outputPath}`);
  } catch (error) {
    console.error(`Error saving user profiles to ${outputPath}:`, error);
  }
}

async function main() {
  const existingProfilesPath = path.join(
    process.cwd(),
    'public/content/userProfiles.json',
  );
  let existingProfiles: Record<string, UserProfile> = {};
  try {
    const data = await fs.readFile(existingProfilesPath, 'utf8');
    existingProfiles = JSON.parse(data).data || {};
    console.log(`Loaded ${Object.keys(existingProfiles).length} existing profiles`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No existing userProfiles.json found, starting fresh.');
    } else {
      console.error('Error loading existing user profiles:', error);
    }
  }

  const allAuthors = await getAllAuthors();
  console.log(`Found ${allAuthors.length} unique authors`);

  const profilesObject: Record<string, UserProfile> = {};
  const successfulProfiles: UserProfile[] = [];

  for (const author of allAuthors) {
    const profile = await getUserProfileByGithubUsername(author, existingProfiles);
    if (profile !== null) {
      successfulProfiles.push(profile);
    }
  }

  console.log(
    `Successfully fetched ${successfulProfiles.length} profiles out of ${allAuthors.length} authors`,
  );
  successfulProfiles.forEach(profile => {
    if (profile.github_username) {
      profilesObject[profile.github_username.toLowerCase()] = profile;
    }
  });

  await saveUserProfiles(profilesObject);
}

main()
  .then(() => console.log('User profiles generation complete'))
  .catch(error => console.error('Error in main process:', error));
