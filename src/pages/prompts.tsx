import { queryDuckDB } from '@/lib/db/utils';
import { IPromptItem } from '@/types';
import { Json } from '@duckdb/node-api';
import React from 'react';

interface Props {
  prompts: IPromptItem[];
}

export const getStaticProps = async () => {
  try {
    const data = await queryDuckDB(
      `
      SELECT *
      FROM prompt
      ORDER BY last_updated_at DESC;
    `,
      {
        filePath: 'public/content/prompts.parquet',
        tableName: 'prompt',
      },
    );

    const prompts = convertToPromptItems(data);

    return {
      props: { prompts },
    };
  } catch (error) {
    console.error('Error fetching prompts:', error);
    return {
      props: { prompts: [] },
    };
  }
};

const PromptsPage = ({ prompts }: Props) => {
  return (
    <div>
      <h1>All Prompts</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {prompts.map((prompt, index) => (
          <div
            key={index}
            className="rounded-lg border p-4 shadow-md transition-shadow hover:shadow-lg"
          >
            <h2 className="mb-2 text-lg font-bold">{prompt.title}</h2>
            <p className="mb-2 text-sm text-gray-600">{prompt.description}</p>
            <p className="text-xs text-gray-500">
              Tags: {prompt.tags.join(', ')}
            </p>
            <p className="text-xs text-gray-500">Category: {prompt.category}</p>
            <p className="text-xs text-gray-500">
              Authors: {prompt.authors.join(', ')}
            </p>
            <p className="text-xs text-gray-500">
              Last Updated: {prompt.lastUpdatedAt}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PromptsPage;

function convertToPromptItems(data: Record<string, Json>[]): IPromptItem[] {
  return data.map(item => {
    return {
      title: item.title as string,
      description: item.description as string,
      tags: item.tags as string[],
      category: item.category as string,
      authors: item.authors as string[],
      models: item.models as string[],
      source: item.source as string,
      private: item.private as boolean,
      metadata: item.metadata as Record<string, unknown>,
      mdContent: item.md_content as string,
      lastUpdatedAt: item.last_updated_at as string,
      filePath: item.file_path as string,
      repo: item.repo as string,
    };
  });
}
