import { Octokit, RestEndpointMethodTypes } from '@octokit/rest';
import { queryDuckDB } from '../src/lib/db/utils.js';
import fs from 'fs/promises';
import path from 'path';
import { MochiUserProfile, UserProfile } from '../src/types/user.js';

const MOCHI_PROFILE_API = process.env.MOCHI_PROFILE_API;
const GITHUB_TOKEN = process.env.DWARVES_PAT;

async function fetchMochiProfile(githubUsername: string) {
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

async function getAllAuthors() {
  const authorsResult = await queryDuckDB(`
        SELECT DISTINCT UNNEST(authors) AS author
        FROM vault
        WHERE authors IS NOT NULL;
      `);

  // Additionally, check for any manually created MDX files in vault/contributor/
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
    manualAuthors = mdxFiles.map(file => {
      const fileName = file.name.replace(/\.mdx$/, ''); // Remove .mdx extension
      return fileName; // Return the slug without the directory prefix
    });
  } catch (error) {
    console.error('Error reading vault/contributor directory:', error);
    // Continue without manual paths if directory doesn't exist or error occurs
  }
  const allAuthors = [
    ...authorsResult.map(row => row.author as string), // Include contributor paths from DuckDB
    ...manualAuthors, // Include manual contributor MDX paths
  ].map(i => i.toLocaleLowerCase());
  // Deduplicate paths based on slug
  const uniquePaths = Array.from(new Set(allAuthors));
  return uniquePaths;
}

async function getUserProfileByGithubUsername(githubUsername: string) {
  let githubData:
    | RestEndpointMethodTypes['users']['getByUsername']['response']['data']
    | null = null;
  let mochiData: MochiUserProfile | null = null;
  try {
    // Assuming the contributor slug can be used as a GitHub username
    const octokit = new Octokit({ auth: GITHUB_TOKEN }); // Use Octokit
    // Fetch user profile details (username, avatar, bio)
    const { data: githubUser } = await octokit.rest.users.getByUsername({
      username: githubUsername,
    });
    if (!githubUser) {
      console.error(`No GitHub data found for ${githubUsername}`);
      return null;
    }
    githubData = githubUser;
  } catch (error) {
    console.error(`Failed to fetch GitHub data for ${githubUsername}:`, error);
    // Handle errors, maybe set githubData to null or an error state
  }
  try {
    mochiData = await fetchMochiProfile(githubUsername);
    if (!mochiData) {
      console.error(
        `No Mochi data found for ${githubUsername}. Please check the username.`,
      );
    }
  } catch (error) {
    console.error(
      `Failed to fetch Mochi profile for ${githubUsername}:`,
      error,
    );
    return null;
  }
  if (!mochiData && !githubData) {
    return null;
  }
  const discordData = mochiData?.associated_accounts?.find(acc => {
    return acc.platform === 'discord';
  });
  const sortedAccounts = mochiData?.associated_accounts?.sort((a, b) => {
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
  const lastWalletAccount = sortedAccounts?.find(acc => {
    return acc.platform === 'wallet' && acc.is_wallet;
  });
  return {
    ...mochiData,
    id: mochiData?.id || githubData?.id,
    bio: githubData?.bio,
    avatar: mochiData?.avatar || githubData?.avatar_url,
    websiteLink: githubData?.blog,
    name: mochiData?.profile_name || githubData?.name,

    twitter_username: githubData?.twitter_username,

    discord_id: discordData?.discord_id || discordData?.platform_identifier,
    discord_username: discordData?.platform_metadata?.username,

    github_username: githubData?.login || githubUsername,
    github_url: githubData?.html_url,

    last_wallet_account: lastWalletAccount,

    github: {
      id: githubData?.id,
      login: githubData?.login,
      avatar_url: githubData?.avatar_url,
      name: githubData?.name,
      bio: githubData?.bio,
      twitter_username: githubData?.twitter_username,
      html_url: githubData?.html_url,
      blog: githubData?.blog,
    },
  } satisfies UserProfile;
}

async function saveUserProfiles(userProfiles: Record<string, UserProfile>) {
  const outputPath = path.join(
    process.cwd(),
    'public/content/userProfiles.json',
  );

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Write the profiles object to the file
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
  const allAuthors = await getAllAuthors();
  console.log(`Found ${allAuthors.length} unique authors`);

  const userProfiles = await Promise.allSettled(
    allAuthors.map(getUserProfileByGithubUsername),
  );

  const successfulProfiles = userProfiles
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => (result as PromiseFulfilledResult<UserProfile>).value);

  console.log(
    `Successfully fetched ${successfulProfiles.length} profiles out of ${allAuthors.length} authors`,
  );

  // Create a combined object with GitHub usernames as keys
  const profilesObject: Record<string, UserProfile> = {};
  successfulProfiles.forEach(profile => {
    if (profile.github_username) {
      profilesObject[profile.github_username] = profile;
    }
  });
  await saveUserProfiles(profilesObject);
}

main()
  .then(() => console.log('User profiles generation complete'))
  .catch(error => console.error('Error in main process:', error));
