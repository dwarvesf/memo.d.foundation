#!/bin/bash

# Script to detect if a file/image is referenced in any markdown files
# 
# Usage:
#   ./scripts/find-file-references.sh [options] <file-to-search>
# 
# Options:
#   -h, --help    Show help information
#   -q, --quiet   Reduce output verbosity
# 
# Example:
#   ./scripts/find-file-references.sh vault/assets/home_cover.webp
#   ./scripts/find-file-references.sh home_cover.webp
#   ./scripts/find-file-references.sh --quiet image.jpg

# Configuration
MARKDOWN_EXTENSIONS=("md" "mdx")
BASE_DIRS=("vault" "docs" "content")
EXCLUDE_DIRS=(".git" "node_modules" ".next" "out" ".obsidian")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default options
QUIET=false

# Function to display usage information
show_usage() {
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "${GREEN}File References Finder${NC}"
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "This script searches for references to a file in markdown documents."
  echo -e "\n${YELLOW}Usage:${NC}"
  echo -e "  $0 [options] <file-to-search>"
  echo -e "\n${YELLOW}Options:${NC}"
  echo -e "  -h, --help    Show this help information"
  echo -e "  -q, --quiet   Reduce output verbosity"
  echo -e "\n${YELLOW}Examples:${NC}"
  echo -e "  $0 vault/assets/home_cover.webp"
  echo -e "  $0 home_cover.webp"
  echo -e "  $0 --quiet image.jpg"
  echo -e "\n${YELLOW}Notes:${NC}"
  echo -e "- You can provide either a full path or just a filename"
  echo -e "- The script will search for the file basename in markdown files"
  echo -e "- The script searches in the following directories: ${YELLOW}${BASE_DIRS[*]}${NC}"
  echo -e "${BLUE}=======================================================${NC}"
}

# Parse command line arguments
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -h|--help)
      show_usage
      exit 0
      ;;
    -q|--quiet)
      QUIET=true
      shift # past argument
      ;;
    *)
      POSITIONAL+=("$1") # save it in an array for later
      shift # past argument
      ;;
  esac
done
set -- "${POSITIONAL[@]}" # restore positional parameters

# Check if a filename is provided
if [ $# -lt 1 ]; then
  echo -e "${RED}Error: No target file specified${NC}"
  show_usage
  exit 1
fi

TARGET_FILE="$1"
TARGET_BASENAME=$(basename "$TARGET_FILE")
FOUND_REFERENCES=0
TEMP_RESULTS=$(mktemp)

# Check if the file exists (optional, as we might want to search for deleted files too)
if [ -n "$TARGET_FILE" ] && [ ! -f "$TARGET_FILE" ] && [ "$QUIET" = false ]; then
  echo -e "${YELLOW}Warning: File '$TARGET_FILE' not found. Searching for references anyway.${NC}"
  
  # If a specific path was provided but doesn't exist, try to find the file in the project
  if [[ "$TARGET_FILE" != "$TARGET_BASENAME" ]]; then
    echo -e "${YELLOW}Attempting to locate file with basename: $TARGET_BASENAME${NC}"
    FOUND_FILES=$(find . -name "$TARGET_BASENAME" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -5)
    
    if [ -n "$FOUND_FILES" ]; then
      echo -e "${GREEN}Found similar files:${NC}"
      echo "$FOUND_FILES" | sed "s/^/  /"
    fi
  fi
fi

if [ "$QUIET" = false ]; then
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "${GREEN}Searching for references to: ${YELLOW}$TARGET_FILE${NC}"
  echo -e "${GREEN}Checking for file basename: ${YELLOW}$TARGET_BASENAME${NC}"
  echo -e "${BLUE}=======================================================${NC}"
fi

# Search for markdown files and check for references
for dir in "${BASE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    if [ "$QUIET" = false ]; then
      echo -e "\n${BLUE}Searching in ${YELLOW}$dir${BLUE}...${NC}"
    fi
    
    # Find all markdown files
    find_cmd="find \"$dir\" -type f"
    
    # Add exclude patterns
    for exclude in "${EXCLUDE_DIRS[@]}"; do
      find_cmd="$find_cmd -not -path \"*/$exclude/*\""
    done
    
    # Add file extension patterns
    find_cmd="$find_cmd \\( "
    first=true
    for ext in "${MARKDOWN_EXTENSIONS[@]}"; do
      if $first; then
        find_cmd="$find_cmd -name \"*.$ext\""
        first=false
      else
        find_cmd="$find_cmd -o -name \"*.$ext\""
      fi
    done
    find_cmd="$find_cmd \\)"
    
    # Execute the find command and search for references
    eval $find_cmd | while read -r file; do
      # Look for any reference to the file
      if grep -q "$TARGET_BASENAME" "$file"; then
        # Common patterns for images in markdown
        if grep -q "!\[\].*$TARGET_BASENAME" "$file" || # ![](image.jpg)
           grep -q "!\[.*\].*$TARGET_BASENAME" "$file" || # ![alt](image.jpg)
           grep -q "!\[\[$TARGET_BASENAME" "$file" || # ![[image.jpg]]
           grep -q "\[\[$TARGET_BASENAME" "$file" || # [[image.jpg]]
           grep -q "<img.*src=.*$TARGET_BASENAME" "$file"; then # <img src="image.jpg">
          echo "$file" >> "$TEMP_RESULTS"
          # We can't reliably update FOUND_REFERENCES here because of subshell issues
          # Will count from temp file later
          
          # Print the matching line with nicer formatting
          if [ "$QUIET" = false ]; then
            echo -e "  ${GREEN}✓ Reference found in:${NC} $file"
            grep -n "$TARGET_BASENAME" "$file" | head -1 | 
              sed "s/^\([0-9]\+\):\(.*\)$/${YELLOW}\1${NC}:${BLUE}\2${NC}/"
          fi
        fi
      fi
    done
  fi
done

# Count the total number of references (handles subshell variable limitation)
if [ -f "$TEMP_RESULTS" ]; then
  FOUND_REFERENCES=$(wc -l < "$TEMP_RESULTS" | tr -d ' ')
fi

# Display summary of results
if [ "$QUIET" = false ]; then
  echo -e "\n${BLUE}=======================================================${NC}"
fi

if [ "$FOUND_REFERENCES" -eq 0 ]; then
  if [ "$QUIET" = false ]; then
    echo -e "${YELLOW}No references found to this file.${NC}"
    echo -e "${YELLOW}This file appears to be unused in markdown files.${NC}"
  fi
else
  if [ "$QUIET" = false ]; then
    if [ "$FOUND_REFERENCES" -eq 1 ]; then
      echo -e "${GREEN}Found 1 reference to the file in:${NC}"
    else
      echo -e "${GREEN}Found $FOUND_REFERENCES references to the file in:${NC}"
    fi
    cat "$TEMP_RESULTS" | nl -s ". " | sed "s/^/  /"
  else
    # In quiet mode, just print Found X references for parent script to parse
    echo "Found $FOUND_REFERENCES references"
  fi
fi

if [ "$QUIET" = false ]; then
  echo -e "${BLUE}=======================================================${NC}"
fi

# Clean up
rm -f "$TEMP_RESULTS"

# Exit with appropriate status code for programmatic usage
if [ "$FOUND_REFERENCES" -gt 0 ]; then
  exit 0  # Success, references found
else
  exit 1  # No references found
fi 