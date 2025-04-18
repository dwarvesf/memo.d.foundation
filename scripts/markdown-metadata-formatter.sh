#!/bin/bash

# markdown-metadata-formatter.sh
# Reformats Markdown metadata sections using LLM
#
# Features:
# - Creates backups of files before processing
# - Uses LLM to reformat metadata sections according to handbook guidelines
#
# Usage:
#   ./scripts/markdown-metadata-formatter.sh [options] <file-or-directory>
#
# Options:
#   -h, --help     Show this help message
#   -d, --dry-run  Show what would be changed without modifying files
#   -v, --verbose  Show detailed information during processing
#   -m, --model    Specify LLM model to use (default: gpt-3.5-turbo)
#
# Requirements:
#   - curl (for API calls)
#   - jq (for JSON processing)
#   - LLM_API_KEY environment variable must be set

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
ERROR_LOG="/tmp/markdown-metadata-formatter-errors.log"

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
  echo -e "${GREEN}Markdown Metadata Formatter${NC}"
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "Improves the quality of Markdown files by:"
  echo -e "  - Reformatting metadata sections using LLM"
  echo -e "\n${YELLOW}Usage:${NC}"
  echo -e "  $0 [options] <file-or-directory>"
  echo -e "\n${YELLOW}Options:${NC}"
  echo -e "  -h, --help     Show this help information"
  echo -e "  -d, --dry-run  Show what would be changed without modifying files"
  echo -e "  -v, --verbose  Show detailed information during processing"
  echo -e "  -m, --model    Specify LLM model to use (default: $LLM_MODEL)"
  echo -e "\n${YELLOW}Examples:${NC}"
  echo -e "  $0 vault/updates/changelog/my-file.md"
  echo -e "  $0 --verbose vault/playground"
  echo -e "  $0 -m gpt-4 vault/updates/changelog"
  echo -e "\n${YELLOW}Notes:${NC}"
  echo -e "- Creates backups with ${BACKUP_EXTENSION} extension before processing"
  echo -e "- Set LLM_API_KEY environment variable for metadata formatting"
  echo -e "- Metadata formatting follows these guidelines:"
  echo -e "  * Descriptions are concise (exactly 2 sentences)"
  echo -e "  * First sentence summarizes content, second highlights benefits"
  echo -e "  * Uses active voice and includes relevant keywords naturally"
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
      -m|--model)
        LLM_MODEL="$2"
        shift 2
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

  # Check if LLM API key is set
  if [ -z "$LLM_API_KEY" ]; then
    echo -e "${RED}Error: LLM_API_KEY environment variable is not set.${NC}"
    echo -e "${YELLOW}Please set it with: export LLM_API_KEY=\"your-api-key\"${NC}"
    exit 1
  fi
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

# Use LLM to reformat metadata according to guidelines
reformat_metadata() {
  local file="$1"
  
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
    [ "$VERBOSE" = true ] && echo -e "  Using model: ${BLUE}$LLM_MODEL${NC}"
    return 0
  fi
  
  [ "$VERBOSE" = true ] && echo -e "  Using model: ${BLUE}$LLM_MODEL${NC}"
  
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
  echo -e "  ${GREEN}Updated metadata for: $file${NC}"
  
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
  
  # Reformat metadata
  reformat_metadata "$file" || {
    echo -e "${YELLOW}Warning: Metadata reformatting failed for $file${NC}" | tee -a "$ERROR_LOG"
    return 1
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