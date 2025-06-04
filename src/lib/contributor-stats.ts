import { Json } from '@duckdb/node-api';
import { queryDuckDB } from './db/utils';

export interface ContributorStats {
  username: string;
  analysis_result: Record<string, any>;
}

function convertToContributorStats(
  data: Record<string, Json>[],
): ContributorStats[] {
  return data.map(item => {
    return {
      username: item.username as string,
      analysis_result: item.analysis_result as Record<string, any>,
    };
  });
}

/**
 * Gets the list of contributor stats
 * @returns Array of contributor stats
 */
export async function getContributorStats(): Promise<
  Record<string, ContributorStats>
> {
  try {
    const data = await queryDuckDB(
      `
      SELECT 
        username,
        analysis_result
      FROM contributors;
    `,
      {
        filePath: 'public/content/contributor-stats.parquet',
        tableName: 'contributors',
      },
    );

    const stats = convertToContributorStats(data);

    // Convert array to object keyed by username
    return stats.reduce(
      (acc: Record<string, ContributorStats>, item: ContributorStats) => {
        acc[item.username] = item;
        return acc;
      },
      {},
    );
  } catch (error) {
    console.error('Error fetching contributor stats:', error);
    return {};
  }
}
