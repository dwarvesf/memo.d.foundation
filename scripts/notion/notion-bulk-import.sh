#!/bin/bash

# notion-bulk-import.sh - Helper script to convert multiple Notion pages to Markdown

# Check if an argument is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: ./scripts/notion/notion-bulk-import.sh <INPUT_FILE> [NOTION_API_KEY] [MAX_DEPTH] [INCLUDE_SUBPAGES]"
    echo "Example: ./scripts/notion/notion-bulk-import.sh pages.txt your_api_key 2 true"
    echo ""
    echo "Parameters:"
    echo "  INPUT_FILE       - Text file containing Notion page URLs/IDs (one per line)"
    echo "  NOTION_API_KEY   - Your Notion API key (optional if set in environment)"
    echo "  MAX_DEPTH       - Maximum depth for subpage conversion (default: 1)"
    echo "  INCLUDE_SUBPAGES - Whether to include subpages (true/false, default: true)"
    echo ""
    echo "The input file should contain one Notion page URL or ID per line."
    echo "Example input file content:"
    echo "https://www.notion.so/dwarves/Page-1-686816b59d5c41a68e67ddec6729f8f1"
    echo "https://www.notion.so/dwarves/Page-2-789916b59d5c41a68e67ddec6729f8f2"
    echo "686816b59d5c41a68e67ddec6729f8f3"
    exit 1
fi

# Check if input file exists
INPUT_FILE=$1
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found."
    exit 1
fi

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

# Set max depth from argument or default to 1
if [ "$#" -ge 3 ]; then
    export NOTION_MAX_DEPTH=$3
else
    export NOTION_MAX_DEPTH=1
fi

# Set include subpages from argument or default to true
if [ "$#" -ge 4 ]; then
    export NOTION_INCLUDE_SUBPAGES=$4
else
    export NOTION_INCLUDE_SUBPAGES=true
fi

echo "Starting bulk Notion page to Markdown conversion..."
echo "API Key: ${NOTION_API_KEY:0:5}..."
echo "Reading pages from: ${INPUT_FILE}"
echo "Max subpage depth: ${NOTION_MAX_DEPTH}"
echo "Include subpages: ${NOTION_INCLUDE_SUBPAGES}"
echo ""

# Process each line in the input file
total_pages=0
successful_pages=0
failed_pages=0

while IFS= read -r page || [ -n "$page" ]; do
    # Skip empty lines and comments
    if [ -z "$page" ] || [[ "$page" =~ ^[[:space:]]*# ]]; then
        continue
    fi

    ((total_pages++))
    echo "Processing page $total_pages: $page"
    
    # Export page ID for the Node.js script
    export NOTION_PAGE_ID="$page"
    
    # Run the converter script
    if npx tsx scripts/notion/notion-page-to-markdown.ts; then
        ((successful_pages++))
        echo "✓ Successfully converted page: $page"
    else
        ((failed_pages++))
        echo "✗ Failed to convert page: $page"
    fi
    echo "-------------------"
    
    # Add a small delay to avoid rate limiting
    sleep 1
done < "$INPUT_FILE"

echo ""
echo "Conversion completed!"
echo "Total pages processed: $total_pages"
echo "Successfully converted: $successful_pages"
echo "Failed to convert: $failed_pages" 