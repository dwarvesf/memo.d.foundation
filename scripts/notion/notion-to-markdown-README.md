# Notion to Markdown Converter

This script helps you convert Notion pages (from a Notion database) to Markdown files for use in the Dwarves Memo project.

## Prerequisites

Before using this script, you'll need to:

1. Create a Notion integration and get an API key from [Notion Integrations page](https://www.notion.so/my-integrations)
2. Share your Notion database with your integration
3. Note your Notion database ID (from the database URL)

## Installation

Install the required dependencies:

```bash
pnpm add @notionhq/client axios --save-dev
```

## Usage

1. Set your Notion API key and database ID as environment variables:

```bash
export NOTION_API_KEY=your_notion_api_key
export NOTION_DATABASE_ID=your_database_id
```

2. Run the script using the helper script:

```bash
./scripts/notion/notion-import.sh your_notion_api_key your_database_id
```

Or directly with tsx:

```bash
npx tsx scripts/notion/notion-to-markdown.ts
```

## Features

- Extracts all pages from your Notion database
- Converts each page to Markdown, preserving structure (headings, lists, code blocks, etc.)
- Downloads and saves images locally in `scripts/notion/notion-output/images/`
- Updates image references in the Markdown
- Creates frontmatter with page properties
- Saves as .md files in `scripts/notion/notion-output/content/` directory
- Captures creation and last edited dates from Notion pages
- Prioritizes custom "Created at" fields over system metadata

## Output Structure

The script creates the following structure:

```
scripts/
└── notion/
    ├── notion-to-markdown.ts       # Main conversion script
    ├── notion-import.sh            # Helper shell script
    ├── notion-to-markdown-README.md # This documentation
    └── notion-output/              # Generated content
        ├── content/                # Contains all the markdown files
        │   ├── page-1.md
        │   ├── page-2.md
        │   └── ...
        └── images/                 # Contains all downloaded images
            ├── notion-image-xxxxx.png
            └── ...
```

## Supported Notion Block Types

The script supports converting the following Notion block types to Markdown:

- Paragraphs
- Headings (levels 1-3)
- Bulleted lists
- Numbered lists
- Code blocks (with language support)
- Quotes
- Dividers
- Images (with captions)

## Frontmatter Metadata

The script extracts the following metadata for the frontmatter:

- `title`: The title of the page
- `date`: The creation date of the page, determined in this priority order:
  1. Custom "Created at" or "Created" field from Notion properties (date type)
  2. Other date fields like "date", "published", "published at", etc.
  3. System creation time from Notion's metadata
  4. Current date as fallback
- `last_edited`: The last edited date of the page (from Notion's metadata)
- `tags`: Any tags associated with the page
- `description`: The page's description

## Troubleshooting

If you encounter errors:

1. Make sure your Notion API key and database ID are correct
2. Ensure your Notion integration has access to the database
3. Check the console output for specific error messages

## Note on Page Properties

The script attempts to extract properties from your Notion pages with sensible fallbacks:

- Creation date prioritizes custom date fields in Notion over system metadata
- The script specifically looks for fields named "Created at" or "Created" (case insensitive)
- Properties from the database columns are converted as well
- Empty values are skipped in the frontmatter
