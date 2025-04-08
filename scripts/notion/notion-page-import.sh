#!/bin/bash

# notion-page-import.sh - Helper script to convert a single Notion page to Markdown

# Check if an argument is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: ./scripts/notion/notion-page-import.sh <NOTION_PAGE_URL_OR_ID> [NOTION_API_KEY]"
    echo "Example with URL: ./scripts/notion/notion-page-import.sh https://www.notion.so/dwarves/My-Page-686816b59d5c41a68e67ddec6729f8f1 your_api_key"
    echo "Example with ID: ./scripts/notion/notion-page-import.sh 686816b59d5c41a68e67ddec6729f8f1 your_api_key"
    exit 1
fi

# Set environment variables
NOTION_PAGE_URL_OR_ID=$1

# Check if API key is provided as second argument
if [ "$#" -ge 2 ]; then
    export NOTION_API_KEY=$2
else
    # If no API key provided, check if it's already set in environment
    if [ -z "$NOTION_API_KEY" ]; then
        echo "No Notion API key provided. Please provide it as the second argument or set the NOTION_API_KEY environment variable."
        exit 1
    fi
fi

# Set page ID from the URL or directly
export NOTION_PAGE_ID=$NOTION_PAGE_URL_OR_ID

# Run the script
echo "Starting single Notion page to Markdown conversion..."
echo "API Key: ${NOTION_API_KEY:0:5}..."
echo "Page URL/ID: ${NOTION_PAGE_URL_OR_ID}"

npx tsx scripts/notion/notion-page-to-markdown.ts 