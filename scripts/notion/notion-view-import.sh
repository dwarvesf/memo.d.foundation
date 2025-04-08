#!/bin/bash

# notion-view-import.sh - Helper script to run the Notion view to Markdown converter

# Check if an argument is provided
if [ "$#" -lt 1 ]; then
    echo "Usage: ./scripts/notion/notion-view-import.sh <NOTION_URL_OR_DATABASE_ID> [NOTION_API_KEY] [USE_FILTER]"
    echo "Example with URL: ./scripts/notion/notion-view-import.sh https://www.notion.so/dwarves/686816b59d5c41a68e67ddec6729f8f1 your_api_key life"
    echo "Example with IDs: ./scripts/notion/notion-view-import.sh 686816b59d5c41a68e67ddec6729f8f1 your_api_key life"
    echo ""
    echo "Available filter options:"
    echo "  life     - Filter for pages with 'Life', 'Life at DF', or 'Life at Dwarves'"
    echo "  projects - Filter for pages with Type = 'Project'"
    echo "  recent   - Filter for pages created in the last 30 days"
    echo "  none     - No filtering (default if not specified)"
    echo ""
    echo "For more filters, you can add them to the scripts/notion/filters.ts file."
    exit 1
fi

# Set environment variables
NOTION_URL_OR_DB=$1

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

# Set database ID from the URL or directly
export NOTION_DATABASE_ID=$NOTION_URL_OR_DB

# Check if filter type is provided
if [ "$#" -ge 3 ]; then
    FILTER_TYPE=$3
    export FILTER_TYPE=$FILTER_TYPE
    export USE_CUSTOM_FILTER="true"
    echo "Using custom filter: $FILTER_TYPE"
else
    export USE_CUSTOM_FILTER="false"
    echo "No custom filter specified. Will retrieve all pages."
fi

# Run the script
echo "Starting Notion to Markdown conversion..."
echo "API Key: ${NOTION_API_KEY:0:5}..."
echo "Database/URL: ${NOTION_URL_OR_DB}"

npx tsx scripts/notion/notion-view-to-markdown.ts

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo "Conversion completed successfully!"
    echo "Your Notion pages have been imported to scripts/notion/notion-output/"
    
    # Count the number of files
    MD_COUNT=$(find scripts/notion/notion-output/content -name "*.md" | wc -l)
    IMG_COUNT=$(find scripts/notion/notion-output/assets -name "*.png" | wc -l)
    
    echo "Imported ${MD_COUNT} markdown files and ${IMG_COUNT} images."
    echo ""
    echo "Next steps:"
    echo "1. Review the markdown files in scripts/notion/notion-output/content/"
    echo "2. Move them to your desired location in the project"
    echo "3. Run your build or development server to see the changes"
else
    echo "Conversion failed. Please check the error messages above."
fi 