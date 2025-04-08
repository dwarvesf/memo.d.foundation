#!/bin/bash

# Script to rename markdown files by adding the date from their frontmatter
# Usage: ./rename_by_date.sh [file or directory path]

set -e

# Check if a path was provided
if [ $# -eq 0 ]; then
  echo "Usage: $0 [file or directory path]"
  exit 1
fi

# Function to process a single file
process_file() {
  local file="$1"
  
  # Check if it's a markdown file
  if [[ ! "$file" =~ \.(md|markdown)$ ]]; then
    echo "Skipping non-markdown file: $file"
    return
  fi
  
  # Check if file exists
  if [ ! -f "$file" ]; then
    echo "File does not exist: $file"
    return
  fi
  
  echo "Processing: $file"
  
  # Extract the date from frontmatter
  # Looking for line with "date:" followed by YYYY-MM-DD format
  date_line=$(grep "date:" "$file" | head -1)
  
  if [ -z "$date_line" ]; then
    echo "  No date found in frontmatter for: $file"
    return
  fi
  
  # Extract the date value using sed, handling both quoted and unquoted dates
  # This pattern extracts YYYY-MM-DD from various formats like:
  # date: 2021-06-10
  # date: "2021-06-10"
  date_value=$(echo "$date_line" | sed -E 's/.*date:[ \t]*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?.*/\1/')
  
  # If we couldn't extract a valid date, skip this file
  if [[ ! "$date_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "  Invalid date format in: $file"
    return
  fi
  
  # Get directory and filename
  dir_path=$(dirname "$file")
  filename=$(basename "$file")
  
  # Check if file already has date prefix
  if [[ "$filename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}- ]]; then
    echo "  File already has date prefix: $filename"
    return
  fi
  
  # New filename with date prefix
  new_filename="${date_value}-${filename}"
  new_path="${dir_path}/${new_filename}"
  
  # Rename the file
  echo "  Renaming to: $new_filename"
  mv "$file" "$new_path"
}

# Check if path is a file or directory
target="$1"
if [ -f "$target" ]; then
  process_file "$target"
elif [ -d "$target" ]; then
  # Process all markdown files in the directory
  # Fix find command to properly handle multiple file patterns
  find "$target" -type f \( -name "*.md" -o -name "*.markdown" \) | while read -r file; do
    process_file "$file"
  done
else
  echo "Path does not exist: $target"
  exit 1
fi

echo "Done!" 