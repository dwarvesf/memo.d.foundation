import fs from 'fs/promises';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const PLAUSIBLE_API_TOKEN = process.env.PLAUSIBLE_API_TOKEN;

const PAGEVIEWS_OUTPUT_PATH = path.join(
  process.cwd(),
  'public/content/pageviews.json',
);

interface PageviewApiResponse {
  results: Array<{
    metrics: [number];
    dimensions: [string];
  }>;
}

interface PageviewsMap {
  [page: string]: number;
}

async function fetchPageviews(): Promise<PageviewApiResponse> {
  const apiUrl = 'https://plausible.io/api/v2/query';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PLAUSIBLE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_id: 'memo.d.foundation',
      date_range: 'all',
      metrics: ['pageviews'],
      dimensions: ['event:page'],
    }),
  });

  if (!response.ok) {
    throw new Error(`API call failed with status: ${response.status}`);
  }

  return response.json();
}

function processPageviews(data: PageviewApiResponse): PageviewsMap {
  const pageviews: PageviewsMap = {};

  for (const item of data.results) {
    const pagePath = item.dimensions[0];
    const views = item.metrics[0];

    // Normalize path by removing trailing slash unless it's the root '/'
    const normalizedPath =
      pagePath.endsWith('/') && pagePath.length > 1
        ? pagePath.slice(0, -1)
        : pagePath;

    pageviews[normalizedPath] = (pageviews[normalizedPath] || 0) + views;
  }

  return pageviews;
}

async function generatePageviewsJSON() {
  try {
    const apiResponse = await fetchPageviews();
    const processedData = processPageviews(apiResponse);

    await fs.writeFile(
      PAGEVIEWS_OUTPUT_PATH,
      JSON.stringify(processedData, null, 2),
    );
    console.log(`Pageviews data written to ${PAGEVIEWS_OUTPUT_PATH}`);
  } catch (error) {
    console.error('Error generating pageviews:', error);
  }
}

generatePageviewsJSON();
