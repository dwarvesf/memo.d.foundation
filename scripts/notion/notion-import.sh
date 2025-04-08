#!/bin/bash

# notion-import.sh - Helper script to run the Notion to Markdown converter

# Check if both arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: ./scripts/notion/notion-import.sh <NOTION_API_KEY> <NOTION_DATABASE_ID>"
    echo "Example: ./scripts/notion/notion-import.sh secret_XYZ123 d12345abcdef"
    exit 1
fi

# Set environment variables
export NOTION_API_KEY=$1
export NOTION_DATABASE_ID=$2

# Run the script
echo "Starting Notion to Markdown conversion..."
echo "API Key: ${NOTION_API_KEY:0:5}..."
echo "Database ID: ${NOTION_DATABASE_ID:0:5}..."

npx tsx scripts/notion/notion-to-markdown.ts

# Check if the script executed successfully
if [ $? -eq 0 ]; then
    echo "Conversion completed successfully!"
    echo "Your Notion pages have been imported to scripts/notion/notion-output/"
    
    # Count the number of files
    MD_COUNT=$(find scripts/notion/notion-output/content -name "*.md" | wc -l)
    IMG_COUNT=$(find scripts/notion/notion-output/images -name "*.png" | wc -l)
    
    echo "Imported ${MD_COUNT} markdown files and ${IMG_COUNT} images."
    echo ""
    echo "Next steps:"
    echo "1. Review the markdown files in scripts/notion/notion-output/content/"
    echo "2. Move them to your desired location in the project"
    echo "3. Run your build or development server to see the changes"
else
    echo "Conversion failed. Please check the error messages above."
fi 