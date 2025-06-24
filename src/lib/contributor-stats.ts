import { ContributorProfile } from '@/types/user';
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
