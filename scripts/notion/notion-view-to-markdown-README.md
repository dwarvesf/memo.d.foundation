# Notion Database to Markdown Converter

This script helps you convert Notion pages from a database to Markdown files for use in the Dwarves Memo project.

## What This Script Does

This script:

1. **Accepts a full Notion URL** - You can provide the URL of your Notion database
2. **Extracts the database ID** - The script parses the URL to get the database ID automatically
3. **Supports custom filtering** - You can apply predefined filters to match specific pages
4. **Handles pagination** - Retrieves all matching pages, even if there are more than 100 results

## Custom Filtering

While the Notion API doesn't support direct view filtering, this script includes a flexible filter configuration system. Filters are defined in a separate configuration file:

```
scripts/notion/filters.ts
```

Current available filters include:

- **"life"** - Finds pages with "Life", "Life at Dwarves", or "Life at DF" in their Name property, or with "Life at Dwarves" in their Content Type property.
- **"projects"** - Finds pages with Type property equal to "Project"
- **"recent"** - Finds pages created in the last 30 days

You can specify a filter when running the script:

```bash
./scripts/notion/notion-view-import.sh your_database_url your_api_key life
```

## Pagination Support

The script automatically handles pagination for databases with more than 100 pages, retrieving all matching records regardless of size. This is done by:

1. Making an initial query with a page size of 100 (Notion API's maximum)
2. Checking if there are more results to fetch
3. Making additional queries with the pagination cursor until all results are retrieved

## Prerequisites

Before using this script, you'll need to:

1. Create a Notion integration and get an API key from [Notion Integrations page](https://www.notion.so/my-integrations)
2. Share your Notion database with your integration
3. Copy your database URL

## Installation

Install the required dependencies:

```bash
pnpm add @notionhq/client axios --save-dev
```

## Usage

Run the script with the Notion URL, your API key, and optional filter:

```bash
./scripts/notion/notion-view-import.sh "https://www.notion.so/dwarves/686816b59d5c41a68e67ddec6729f8f1" your_notion_api_key life
```

The third parameter (`life` in this example) is the filter type. Currently supported values:

- `life` - Filters for Life at Dwarves/DF content
- If omitted, no filter is applied (all pages are retrieved)

Alternatively, if you have the `NOTION_API_KEY` environment variable set, you can just provide the URL and filter:

```bash
export NOTION_API_KEY=your_notion_api_key
./scripts/notion/notion-view-import.sh "https://www.notion.so/dwarves/686816b59d5c41a68e67ddec6729f8f1" "" life
```

## Features

- Extract database ID from Notion URLs
- Apply custom filters similar to Notion views
- Support pagination for large databases (>100 pages)
- Convert all matching pages to Markdown
- Download and save images locally
- Create frontmatter with page metadata
- Support multiple block types (headings, lists, code, etc.)
- Prioritize custom "Created at" fields over system metadata

## Output Structure

The script creates the following structure:

```
scripts/
└── notion/
    └── notion-output/
        ├── content/        # Contains all the markdown files
        │   ├── page-1.md
        │   ├── page-2.md
        │   └── ...
        └── assets/         # Contains all downloaded images
            ├── notion-image-xxxxx.png
            └── ...
```

## Adding Custom Filters

You can easily add your own custom filters by editing the `scripts/notion/filters.ts` file. The filter structure follows the [Notion API filter object format](https://developers.notion.com/reference/post-database-query-filter).

> **Important**: Make sure the property names and types in your filters match exactly with your Notion database. For example, if a property in Notion is a multi-select property, you must use `multi_select` in your filter (not `select`). Getting the property type wrong will result in a "database property [type] does not match filter [type]" error.

Example of the filter configuration file:

```typescript
// Filter definitions object
const filters: Record<string, FilterType> = {
  // Life filter
  life: {
    or: [
      { property: 'Name', rich_text: { contains: 'Life' } },
      // ... other conditions
    ],
  },

  // Add your custom filter here
  myCustomFilter: {
    property: 'Status',
    select: {
      equals: 'Published',
    },
  },
};

export default filters;
```

After adding your filter, you can use it by name:

```bash
./scripts/notion/notion-view-import.sh your_database_url your_api_key myCustomFilter
```

## Troubleshooting

If you encounter errors:

1. Make sure your Notion API key is correct
2. Ensure your Notion integration has access to the database
3. Check if the URL format is correct (the script expects a standard Notion URL)
4. Verify that property names in custom filters match exactly with your Notion database
5. For large databases, the script may take some time to process all pages

## API Limitations

The Notion API has several limitations that affect this script:

1. **No direct view-based filtering**: Our custom filters approximate what you see in views
2. **Maximum of 100 pages per request**: We handle this via pagination
3. **Rate limiting**: Very large databases may trigger Notion's rate limits

These limitations are from Notion's API design, not the script itself.

## Downloading a Single Page

If you want to download just a single Notion page (not from a database), you can use the single-page converter script:

```bash
./scripts/notion/notion-page-import.sh "https://www.notion.so/dwarves/My-Page-686816b59d5c41a68e67ddec6729f8f1" your_notion_api_key
```

This is useful when you want to convert a standalone Notion page rather than querying pages from a database.

## Downloading Multiple Pages

If you want to download multiple Notion pages at once, you can use the bulk import script. Create a text file containing one Notion page URL or ID per line:

```text
# pages.txt - Comments are supported (lines starting with #)
https://www.notion.so/dwarves/Page-1-686816b59d5c41a68e67ddec6729f8f1
https://www.notion.so/dwarves/Page-2-789916b59d5c41a68e67ddec6729f8f2
686816b59d5c41a68e67ddec6729f8f3  # You can use page IDs directly too
```

Then run the bulk import script:

```bash
./scripts/notion/notion-bulk-import.sh pages.txt your_notion_api_key [max_depth] [include_subpages]
```

### Subpage Support

The script now supports downloading subpages with configurable depth:

- `max_depth`: How many levels of subpages to download (default: 1)

  - 0: Only the main page
  - 1: Main page and its immediate subpages
  - 2: Main page, its subpages, and their subpages
  - etc.

- `include_subpages`: Whether to include subpages at all (default: true)
  - true: Download subpages up to max_depth
  - false: Only download the main pages

Example with subpage options:

```bash
# Download pages and their immediate subpages
./scripts/notion/notion-bulk-import.sh pages.txt your_api_key 1 true

# Download pages and two levels of subpages
./scripts/notion/notion-bulk-import.sh pages.txt your_api_key 2 true

# Download only the main pages, no subpages
./scripts/notion/notion-bulk-import.sh pages.txt your_api_key 0 false
```

### Metadata Handling

The script now preserves all custom metadata from Notion pages in the markdown frontmatter. For example, if your Notion page has custom properties like "Status", "Category", or "Tags", they will be included in the markdown file:

```yaml
---
title: 'My Notion Page'
date: '2024-01-20'
last_edited: '2024-01-21'
status: 'Published'
category: 'Engineering'
tags: ['typescript', 'notion', 'markdown']
source: 'https://notion.so/...'
parent_page: '...' # If this is a subpage
parent_database: '...' # If this page is from a database
---
```

### Subpage Types

The script handles different types of subpages:

1. **Regular Pages**: Converted to markdown with all their content
2. **Database Pages**: Preserved as links in the parent page
3. **Embedded Content**: Referenced appropriately in the markdown

The script will:

1. Process each page in sequence
2. Skip empty lines and comments
3. Show progress and status for each page
4. Process subpages according to the depth settings
5. Include all custom metadata in the frontmatter
6. Provide a summary of successful and failed conversions
7. Include a small delay between pages to avoid rate limiting
