#!/bin/bash

# markdown-processor.sh
# A comprehensive Markdown processor script to improve file quality
#
# Features:
# - Creates backups of files before processing
# - Runs markdownlint to fix common issues
# - Uses LLM to reformat metadata sections according to handbook guidelines
# - Ensures image filenames are properly formatted
#
# Usage:
#   ./scripts/markdown-processor.sh [options] <file-or-directory>
#
# Options:
#   -h, --help     Show this help message
#   -d, --dry-run  Show what would be changed without modifying files
#   -v, --verbose  Show detailed information during processing
#
# Requirements:
#   - markdownlint-cli (npm install -g markdownlint-cli)
#   - curl (for API calls)
#   - jq (for JSON processing)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_EXTENSION=".original"
VERBOSE=false
DRY_RUN=false
LLM_API_URL=${LLM_API_URL:-"https://api.openai.com/v1/chat/completions"}
LLM_API_KEY=${LLM_API_KEY:-""}  # Set your API key in environment or here
LLM_MODEL=${LLM_MODEL:-"gpt-3.5-turbo"}
MAX_RETRIES=3
ERROR_LOG="/tmp/markdown-processor-errors.log"

# Color formatting
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handling and cleanup
cleanup() {
  # Any cleanup tasks go here
  if [ -f "$ERROR_LOG" ]; then
    if [ "$VERBOSE" = true ]; then
      echo -e "\n${YELLOW}Error log:${NC}"
      cat "$ERROR_LOG"
    fi
    rm -f "$ERROR_LOG"
  fi
  
  echo -e "\n${YELLOW}Script execution interrupted. Exiting gracefully.${NC}"
  exit 1
}

# Set trap for various signals
trap cleanup SIGINT SIGTERM ERR

# Error handler function
handle_error() {
  local line_no=$1
  local error_code=$2
  echo -e "${RED}Error at line $line_no (code: $error_code)${NC}" | tee -a "$ERROR_LOG"
}
trap 'handle_error ${LINENO} $?' ERR

# Show usage information
show_usage() {
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "${GREEN}Markdown Processor${NC}"
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "Improves the quality of Markdown files by:"
  echo -e "  - Fixing markdownlint issues"
  echo -e "  - Reformatting metadata sections"
  echo -e "  - Ensuring proper image references"
  echo -e "\n${YELLOW}Usage:${NC}"
  echo -e "  $0 [options] <file-or-directory>"
  echo -e "\n${YELLOW}Options:${NC}"
  echo -e "  -h, --help     Show this help information"
  echo -e "  -d, --dry-run  Show what would be changed without modifying files"
  echo -e "  -v, --verbose  Show detailed information during processing"
  echo -e "\n${YELLOW}Examples:${NC}"
  echo -e "  $0 vault/updates/changelog/my-file.md"
  echo -e "  $0 --verbose vault/playground"
  echo -e "\n${YELLOW}Notes:${NC}"
  echo -e "- Creates backups with ${BACKUP_EXTENSION} extension before processing"
  echo -e "- You need markdownlint-cli installed: npm install -g markdownlint-cli"
  echo -e "- Set LLM_API_KEY environment variable for metadata formatting"
  echo -e "${BLUE}=======================================================${NC}"
}

# Parse command line arguments
parse_args() {
  POSITIONAL=()
  while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
      -h|--help)
        show_usage
        exit 0
        ;;
      -v|--verbose)
        VERBOSE=true
        shift
        ;;
      -d|--dry-run)
        DRY_RUN=true
        shift
        ;;
      *)
        POSITIONAL+=("$1")
        shift
        ;;
    esac
  done

  # Restore positional parameters
  set -- "${POSITIONAL[@]}"

  # Check for required argument
  if [ $# -lt 1 ]; then
    echo -e "${RED}Error: Missing file or directory path${NC}"
    show_usage
    exit 1
  fi

  TARGET_PATH="$1"
  
  # Check if path exists
  if [ ! -e "$TARGET_PATH" ]; then
    echo -e "${RED}Error: Path does not exist: $TARGET_PATH${NC}"
    exit 1
  fi
}

# Check if required tools are installed
check_dependencies() {
  local missing_deps=false
  local markdownlint_available=true

  # Check for markdownlint (optional)
  if ! command -v markdownlint &> /dev/null; then
    echo -e "${YELLOW}Warning: markdownlint-cli is not installed${NC}"
    echo -e "${YELLOW}Skipping markdownlint checks. Install with: npm install -g markdownlint-cli${NC}"
    markdownlint_available=false
  fi

  # Check for curl
  if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    missing_deps=true
  fi

  # Check for jq
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo -e "Please install it with: ${YELLOW}brew install jq${NC} (on macOS)"
    missing_deps=true
  fi

  if [ "$missing_deps" = true ]; then
    exit 1
  fi

  # Warn if LLM API key is not set
  if [ -z "$LLM_API_KEY" ]; then
    echo -e "${YELLOW}Warning: LLM_API_KEY is not set. Metadata formatting will be skipped.${NC}"
  fi
  
  # Export markdownlint availability for other functions
  export MARKDOWNLINT_AVAILABLE=$markdownlint_available
}

# Create a backup of a file before processing
create_backup() {
  local file="$1"
  local backup="${file}${BACKUP_EXTENSION}"
  
  if [ "$DRY_RUN" = true ]; then
    [ "$VERBOSE" = true ] && echo -e "  Would create backup: ${YELLOW}$backup${NC}"
    return 0
  fi
  
  cp "$file" "$backup"
  [ "$VERBOSE" = true ] && echo -e "  Created backup: ${YELLOW}$backup${NC}"
  return 0
}

# Run markdownlint to fix common issues
fix_markdown_lint() {
  local file="$1"
  
  # Skip if markdownlint is not available
  if [ "$MARKDOWNLINT_AVAILABLE" != "true" ]; then
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}Skipping markdownlint for: $file (not installed)${NC}"
    return 0
  fi
  
  if [ "$DRY_RUN" = true ]; then
    [ "$VERBOSE" = true ] && echo -e "  Would run markdownlint on: ${YELLOW}$file${NC}"
    markdownlint --fix "$file" --dry-run 2>/dev/null || true
    return 0
  fi
  
  if [ "$VERBOSE" = true ]; then
    echo -e "  Running markdownlint on: ${YELLOW}$file${NC}"
    markdownlint --fix "$file" || true
  else
    markdownlint --fix "$file" 2>/dev/null || true
  fi
  
  return 0
}

# Use LLM to reformat metadata according to guidelines
reformat_metadata() {
  local file="$1"
  
  # Skip if LLM API key is not set
  if [ -z "$LLM_API_KEY" ]; then
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}Skipping metadata formatting for: $file (no API key)${NC}"
    return 0
  fi
  
  local frontmatter
  local content
  
  # Extract frontmatter and content
  if grep -q "^---$" "$file"; then
    frontmatter=$(sed -n '/^---$/,/^---$/p' "$file")
    content=$(sed '1,/^---$/!p;//d' "$file" | sed '1d')
  else
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}No frontmatter found in: $file${NC}"
    return 0
  fi
  
  # If frontmatter is empty, skip
  if [ -z "$frontmatter" ]; then
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}Empty frontmatter in: $file${NC}"
    return 0
  fi
  
  [ "$VERBOSE" = true ] && echo -e "  Reformatting metadata for: ${YELLOW}$file${NC}"
  
  # Create prompt for LLM
  local prompt=$(cat <<EOT
Your task is to improve the metadata (frontmatter) section of a Markdown file. Follow these guidelines strictly:

1. Keep metadata descriptions concise (exactly 2 sentences)
2. First sentence summarizes content, second highlights benefits/applications
3. Reflect content accurately and include relevant keywords naturally
4. Use specific, descriptive metadata that communicates unique value
5. Write in active voice for clarity and impact

Here is the current frontmatter:
$frontmatter

Return ONLY the improved frontmatter, maintaining the exact same structure and fields, but with improved description and other metadata fields as needed. Keep all existing metadata fields and values unless they need improvement. Do not add any explanation before or after the frontmatter.
EOT
)

  if [ "$DRY_RUN" = true ]; then
    [ "$VERBOSE" = true ] && echo -e "  Would send request to LLM API for: ${YELLOW}$file${NC}"
    return 0
  fi
  
  # Call LLM API with retry logic
  local retry_count=0
  local improved_frontmatter=""
  
  while [ $retry_count -lt $MAX_RETRIES ]; do
    improved_frontmatter=$(curl -s -X POST "$LLM_API_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $LLM_API_KEY" \
      -d "{
        \"model\": \"$LLM_MODEL\",
        \"messages\": [{
          \"role\": \"system\",
          \"content\": \"You are an expert in improving markdown metadata.\"
        }, {
          \"role\": \"user\",
          \"content\": \"$prompt\"
        }],
        \"temperature\": 0.3
      }" | jq -r '.choices[0].message.content')
    
    # Check if we got a valid response
    if [ -n "$improved_frontmatter" ] && [[ "$improved_frontmatter" == ---* ]]; then
      break
    fi
    
    retry_count=$((retry_count + 1))
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}Retrying LLM API call ($retry_count/$MAX_RETRIES)${NC}"
    sleep 2
  done
  
  if [ -z "$improved_frontmatter" ] || [[ "$improved_frontmatter" != ---* ]]; then
    echo -e "  ${RED}Failed to reformat metadata for: $file${NC}"
    return 1
  fi
  
  # Update the file with the improved frontmatter
  echo -e "$improved_frontmatter\n$content" > "$file"
  [ "$VERBOSE" = true ] && echo -e "  ${GREEN}Updated metadata for: $file${NC}"
  
  return 0
}

# Clean up image filenames in markdown links
clean_image_references() {
  local file="$1"
  
  [ "$VERBOSE" = true ] && echo -e "  Cleaning image references in: ${YELLOW}$file${NC}"
  
  if [ "$DRY_RUN" = true ]; then
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}(Dry run mode - no changes will be made)${NC}"
  fi
  
  local content
  content=$(cat "$file")
  local updated_content="$content"
  
  # Find all image references with more diverse patterns
  local image_refs=""
  
  # Standard markdown image pattern with content in brackets
  local std_refs=$(grep -o -E '!\[[^\]]*\]\([^)]+\)' "$file" | grep -o -E '\([^)]+\)' | tr -d '()' || echo "")
  if [ -n "$std_refs" ]; then
    image_refs="$image_refs $std_refs"
  fi
  
  # Empty bracket pattern: ![](...) 
  local empty_refs=$(grep -o -E '!\[\]\([^)]+\)' "$file" | grep -o -E '\([^)]+\)' | tr -d '()' || echo "")
  if [ -n "$empty_refs" ]; then
    image_refs="$image_refs $empty_refs"
  fi
  
  # HTML image pattern
  local html_refs=$(grep -o -E '<img[^>]+src="[^"]+"[^>]*>' "$file" | grep -o -E 'src="[^"]+"' | cut -d'"' -f2 || echo "")
  if [ -n "$html_refs" ]; then
    image_refs="$image_refs $html_refs"
  fi
  
  # Obsidian-style image references
  local obsidian_refs=$(grep -o -E '!\[\[[^\]]+\]\]' "$file" | sed 's/!\[\[\(.*\)\]\]/\1/' || echo "")
  if [ -n "$obsidian_refs" ]; then
    image_refs="$image_refs $obsidian_refs"
  fi
  
  # Trim whitespace
  image_refs=$(echo "$image_refs" | xargs)
  
  if [ -z "$image_refs" ]; then
    [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}No image references found in: $file${NC}"
    return 0
  fi
  
  [ "$VERBOSE" = true ] && echo -e "  Found image references: ${BLUE}$image_refs${NC}"
  
  # Process each image reference
  for img_ref in $image_refs; do
    # Skip if it's a URL
    if [[ "$img_ref" =~ ^https?:// ]]; then
      [ "$VERBOSE" = true ] && echo -e "  ${YELLOW}Skipping URL: $img_ref${NC}"
      continue
    fi
    
    # Get the directory and base filename
    local img_dir
    local img_base
    
    if [[ "$img_ref" == */* ]]; then
      img_dir=$(dirname "$img_ref")
      img_base=$(basename "$img_ref")
    else
      img_dir="."
      img_base="$img_ref"
    fi
    
    [ "$VERBOSE" = true ] && echo -e "  Analyzing image: dir=${BLUE}$img_dir${NC}, name=${BLUE}$img_base${NC}"
    
    # Clean up the filename if needed
    if [[ "$img_base" =~ [[:space:]] || "$img_base" =~ [A-Z] || ! "$img_base" =~ ^[a-z0-9._-]+\.[a-z]+$ ]]; then
      # Convert to lowercase and replace spaces with hyphens
      local clean_name
      clean_name=$(echo "$img_base" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
      
      # Replace other special characters with hyphens
      clean_name=$(echo "$clean_name" | sed 's/[^a-z0-9._-]/-/g')
      
      # Only process if the filename actually changed
      if [ "$clean_name" != "$img_base" ]; then
        [ "$VERBOSE" = true ] && echo -e "  Would clean image filename: ${YELLOW}$img_base${NC} -> ${GREEN}$clean_name${NC}"
        
        if [ "$DRY_RUN" = true ]; then
          continue
        fi
        
        # Update reference in the file content
        if [ "$img_dir" = "." ]; then
          updated_content=$(echo "$updated_content" | sed "s|$img_base|$clean_name|g")
        else
          updated_content=$(echo "$updated_content" | sed "s|$img_dir/$img_base|$img_dir/$clean_name|g")
        fi
      else
        [ "$VERBOSE" = true ] && echo -e "  ${GREEN}Image filename already clean: $img_base${NC}"
      fi
    else
      [ "$VERBOSE" = true ] && echo -e "  ${GREEN}Image filename already clean: $img_base${NC}"
    fi
  done
  
  # Write the updated content back if it changed
  if [ "$updated_content" != "$content" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo -e "  ${YELLOW}Would update image references in: $file${NC}"
    else
      echo "$updated_content" > "$file"
      echo -e "  ${GREEN}Updated image references in: $file${NC}"
    fi
  else
    [ "$VERBOSE" = true ] && echo -e "  ${GREEN}No image reference changes needed${NC}"
  fi
  
  return 0
}

# Process a single markdown file
process_file() {
  local file="$1"
  
  # Check if it's a markdown file
  if [[ ! "$file" =~ \.(md|markdown)$ ]]; then
    [ "$VERBOSE" = true ] && echo -e "${YELLOW}Skipping non-markdown file: $file${NC}"
    return 0
  fi
  
  # Check if file exists and is readable
  if [ ! -f "$file" ] || [ ! -r "$file" ]; then
    echo -e "${RED}Error: Cannot read file: $file${NC}" | tee -a "$ERROR_LOG"
    return 1
  fi
  
  echo -e "${BLUE}Processing: ${GREEN}$file${NC}"
  
  # Create backup first
  create_backup "$file" || { 
    echo -e "${RED}Error: Failed to create backup for $file${NC}" | tee -a "$ERROR_LOG"
    return 1
  }
  
  # Fix markdown lint issues
  fix_markdown_lint "$file" || {
    echo -e "${YELLOW}Warning: markdownlint encountered issues with $file${NC}" | tee -a "$ERROR_LOG"
    # Continue processing as this is non-critical
  }
  
  # Reformat metadata
  reformat_metadata "$file" || {
    echo -e "${YELLOW}Warning: Metadata reformatting failed for $file${NC}" | tee -a "$ERROR_LOG"
    # Continue processing as this is non-critical
  }
  
  # Clean up image references
  clean_image_references "$file" || {
    echo -e "${YELLOW}Warning: Image reference cleanup failed for $file${NC}" | tee -a "$ERROR_LOG"
    # Continue processing as this is non-critical
  }
  
  echo -e "${GREEN}✓ Completed processing: $file${NC}"
  return 0
}

# Process a directory recursively
process_directory() {
  local dir="$1"
  
  # Check if directory exists and is readable
  if [ ! -d "$dir" ] || [ ! -r "$dir" ]; then
    echo -e "${RED}Error: Cannot access directory: $dir${NC}" | tee -a "$ERROR_LOG"
    return 1
  fi
  
  echo -e "${BLUE}Processing directory: ${GREEN}$dir${NC}"
  
  # Find all markdown files in the directory and process each one
  local count=0
  local errors=0
  
  while IFS= read -r -d '' file; do
    ((count++))
    process_file "$file" || ((errors++))
  done < <(find "$dir" -type f \( -name "*.md" -o -name "*.markdown" \) -print0)
  
  if [ $count -eq 0 ]; then
    echo -e "${YELLOW}No markdown files found in directory: $dir${NC}"
  else
    echo -e "${GREEN}✓ Completed processing directory: $dir${NC}"
    echo -e "  Processed $count files with $errors errors."
  fi
  
  if [ $errors -gt 0 ]; then
    echo -e "${YELLOW}There were $errors errors during processing. Check the logs for details.${NC}"
    return 1
  fi
  
  return 0
}

# Main function
main() {
  # Create empty error log
  > "$ERROR_LOG"
  
  parse_args "$@"
  check_dependencies
  
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}Running in dry-run mode. No files will be modified.${NC}"
  fi
  
  local exit_code=0
  
  # Process the target path
  if [ -f "$TARGET_PATH" ]; then
    process_file "$TARGET_PATH" || exit_code=1
  elif [ -d "$TARGET_PATH" ]; then
    process_directory "$TARGET_PATH" || exit_code=1
  else
    echo -e "${RED}Error: Path is neither a file nor a directory: $TARGET_PATH${NC}" | tee -a "$ERROR_LOG"
    exit_code=1
  fi
  
  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ All processing completed successfully${NC}"
  else
    echo -e "${YELLOW}Processing completed with errors. Check the logs for details.${NC}"
    if [ "$VERBOSE" = true ] && [ -s "$ERROR_LOG" ]; then
      echo -e "\n${YELLOW}Error log:${NC}"
      cat "$ERROR_LOG"
    fi
  fi
  
  # Clean up error log if empty
  if [ ! -s "$ERROR_LOG" ]; then
    rm -f "$ERROR_LOG"
  else
    echo -e "${YELLOW}Errors were logged to: $ERROR_LOG${NC}"
  fi
  
  return $exit_code
}

# Run the script
main "$@" || exit $? 