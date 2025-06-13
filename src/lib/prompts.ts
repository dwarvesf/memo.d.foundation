import { IPromptItem } from '@/types';
import { Json } from '@duckdb/node-api';
import { queryDuckDB } from './db/utils';

function capitalizeFirstLetter(string: string): string {
  const words = string.split(' ');
  const capitalizedWords = words.map(word => {
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  return capitalizedWords.join(' ');
}

function convertToPromptItems(data: Record<string, Json>[]): IPromptItem[] {
  return data.map(item => {
    return {
      title: (item.title as string) ?? 'Untitled',
      description: item.description as string,
      tags: item.tags as string[],
      category: capitalizeFirstLetter((item.category as string) ?? 'Misc'),
      authors: item.authors as string[],
      models: item.models as string[],
      source: item.source as string,
      private: item.private as boolean,
      metadata: item.metadata as Record<string, unknown>,
      mdContent: item.md_content as string,
      lastUpdatedAt: item.last_updated_at as string,
      filePath: item.file_path as string,
      modelPromptUrl: item.model_prompt_url as string,
      repo: item.repo as string,
    };
  });
}

/**
 * Gets the list of available prompts
 * TODO: Implement this function to fetch prompts from a source
 * @returns Array of prompts
 */
export async function getPrompts(): Promise<IPromptItem[]> {
  try {
    const data = await queryDuckDB(
      `
      SELECT *
      FROM prompt
      WHERE title IS NOT NULL AND title != ''
      ORDER BY last_updated_at DESC;
    `,
      {
        filePath: 'public/content/prompts.parquet',
        tableName: 'prompt',
      },
    );

    const prompts = convertToPromptItems(data);
    return prompts;
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return [];
  }
}
