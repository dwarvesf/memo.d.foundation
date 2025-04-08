#!/bin/bash

# Script to identify unused assets in a folder and relocate them to a temporary folder
# 
# Usage:
#   ./scripts/relocate-unused-assets.sh [options] <assets-folder-or-file> [destination-folder]
# 
# Options:
#   -h, --help        Show help information
#   -d, --dry-run     Preview what files would be moved without actually moving them
#   -q, --quiet       Reduce output verbosity for faster processing
# 
# Example:
#   ./scripts/relocate-unused-assets.sh vault/assets
#   ./scripts/relocate-unused-assets.sh -d vault/playground/01_literature/assets ./unused-assets
#   ./scripts/relocate-unused-assets.sh -q -d vault/assets
#   ./scripts/relocate-unused-assets.sh vault/assets/image.webp

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Path to find-file-references.sh script
FIND_REFS_SCRIPT="./scripts/find-file-references.sh"

# Default options
DRY_RUN=false
QUIET=false

# Function to display usage information
show_usage() {
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "${GREEN}Relocate Unused Assets${NC}"
  echo -e "${BLUE}=======================================================${NC}"
  echo -e "This script identifies unused assets and relocates them to a temporary folder."
  echo -e "\n${YELLOW}Usage:${NC}"
  echo -e "  $0 [options] <assets-folder-or-file> [destination-folder]"
  echo -e "\n${YELLOW}Options:${NC}"
  echo -e "  -h, --help        Show this help information"
  echo -e "  -d, --dry-run     Preview what files would be moved without actually moving them"
  echo -e "  -q, --quiet       Reduce output verbosity for faster processing"
  echo -e "\n${YELLOW}Examples:${NC}"
  echo -e "  $0 vault/assets"
  echo -e "  $0 -d vault/playground/01_literature/assets ./unused-assets"
  echo -e "  $0 -q -d vault/assets"
  echo -e "\n${YELLOW}Notes:${NC}"
  echo -e "- If destination folder is not specified, unused assets will be moved to './unused-assets'"
  echo -e "- The script uses find-file-references.sh to detect references to assets"
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
    -d|--dry-run)
      DRY_RUN=true
      shift # past argument
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

# Check if find-file-references.sh exists and is executable
if [ ! -x "$FIND_REFS_SCRIPT" ]; then
  echo -e "${RED}Error: $FIND_REFS_SCRIPT not found or not executable${NC}"
  echo -e "Make sure the script exists and has execute permissions:"
  echo -e "  chmod +x $FIND_REFS_SCRIPT"
  exit 1
fi

# Check if assets folder/file is provided
if [ $# -lt 1 ]; then
  echo -e "${RED}Error: No assets folder or file specified${NC}"
  show_usage
  exit 1
fi

# Get the assets folder/file and destination folder
ASSETS_PATH="$1"
DEST_FOLDER="${2:-./unused-assets}"

# Check if assets path exists
if [ ! -e "$ASSETS_PATH" ]; then
  echo -e "${RED}Error: Path '$ASSETS_PATH' not found${NC}"
  exit 1
fi

# Create destination folder if it doesn't exist and not in dry run mode
if [ ! -d "$DEST_FOLDER" ] && [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}Creating destination folder: $DEST_FOLDER${NC}"
  mkdir -p "$DEST_FOLDER"
  
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to create destination folder${NC}"
    exit 1
  fi
fi

# Temporary files to store asset lists
TEMP_LIST=$(mktemp)
ASSETS_LIST=$(mktemp)

echo -e "${BLUE}=======================================================${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN MODE: No files will be moved${NC}"
fi
if [ "$QUIET" = true ]; then
  echo -e "${YELLOW}QUIET MODE: Reduced output for faster processing${NC}"
fi

# Check if the assets path is a directory or a file
if [ -d "$ASSETS_PATH" ]; then
  echo -e "${GREEN}Scanning assets in directory: ${YELLOW}$ASSETS_PATH${NC}"
  # Get all files in the directory
  find "$ASSETS_PATH" -type f | sort > "$ASSETS_LIST"
  ASSET_MODE="directory"
else
  echo -e "${GREEN}Checking single asset: ${YELLOW}$ASSETS_PATH${NC}"
  # Just add the single file to the list
  echo "$ASSETS_PATH" > "$ASSETS_LIST"
  ASSET_MODE="file"
fi

if [ "$DRY_RUN" = false ]; then
  echo -e "${GREEN}Unused assets will be moved to: ${YELLOW}$DEST_FOLDER${NC}"
else
  echo -e "${GREEN}Unused assets would be moved to: ${YELLOW}$DEST_FOLDER${NC}"
fi
echo -e "${BLUE}=======================================================${NC}"

# Count variables
TOTAL_ASSETS=$(wc -l < "$ASSETS_LIST" | tr -d ' ')
USED_ASSETS=0
UNUSED_ASSETS=0
MOVED_ASSETS=0
FAILED_ASSETS=0

echo -e "Found $TOTAL_ASSETS asset(s) to check"

if [ "$QUIET" = true ] && [ "$TOTAL_ASSETS" -gt 10 ]; then
  echo -e "${YELLOW}Processing assets... This may take a while.${NC}"
  echo -e "Each dot represents 10 processed files: "
  progress_counter=0
fi

# Process each asset
counter=0
while read -r asset; do
  counter=$((counter + 1))
  
  # Extract the basename of the asset
  BASENAME=$(basename "$asset")
  
  # Show progress differently based on quiet mode
  if [ "$QUIET" = true ]; then
    if [ $((counter % 10)) -eq 0 ]; then
      echo -n "."
      progress_counter=$((progress_counter + 1))
      
      # Add a newline every 50 dots (500 files)
      if [ $((progress_counter % 50)) -eq 0 ]; then
        echo ""
      fi
    fi
  else
    echo -e "\n${BLUE}Checking asset ($counter/$TOTAL_ASSETS): ${YELLOW}$BASENAME${NC}"
  fi
  
  # Build options for find-file-references.sh
  FIND_REFS_OPTS=""
  if [ "$QUIET" = true ]; then
    FIND_REFS_OPTS="--quiet"
  fi
  
  # Run find-file-references.sh and check exit code
  # Exit code 0 = references found, Exit code 1 = no references found
  "$FIND_REFS_SCRIPT" $FIND_REFS_OPTS "$asset" > /dev/null 2>&1
  REFS_EXIT_CODE=$?
  
  if [ $REFS_EXIT_CODE -eq 0 ]; then
    # References found (exit code 0)
    if [ "$QUIET" = false ]; then
      echo -e "${GREEN}✓ Asset is used${NC}"
    fi
    USED_ASSETS=$((USED_ASSETS + 1))
  elif [ $REFS_EXIT_CODE -eq 1 ]; then
    # No references found (exit code 1)
    if [ "$QUIET" = false ]; then
      echo -e "${YELLOW}✗ No references found for: $BASENAME${NC}"
    fi
    echo "$asset" >> "$TEMP_LIST"
    UNUSED_ASSETS=$((UNUSED_ASSETS + 1))
  else
    # Other error occurred (exit code other than 0 or 1)
    if [ "$QUIET" = false ]; then
      echo -e "${RED}! Error checking references for: $BASENAME (exit code: $REFS_EXIT_CODE)${NC}"
    fi
    FAILED_ASSETS=$((FAILED_ASSETS + 1))
  fi
done < "$ASSETS_LIST"

# Add a final newline in quiet mode
if [ "$QUIET" = true ]; then
  echo ""
fi

# Read the list of unused assets and move them (unless in dry run mode)
if [ -f "$TEMP_LIST" ] && [ -s "$TEMP_LIST" ]; then
  echo -e "\n${BLUE}=======================================================${NC}"
  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}The following unused assets would be moved:${NC}"
    
    if [ "$QUIET" = true ] && [ "$UNUSED_ASSETS" -gt 20 ]; then
      echo -e "${YELLOW}Found $UNUSED_ASSETS unused assets. Showing first 20:${NC}"
      head -20 "$TEMP_LIST" | while read -r asset; do
        BASENAME=$(basename "$asset")
        echo -e "  $BASENAME"
      done
      echo -e "  ${YELLOW}... and $((UNUSED_ASSETS - 20)) more${NC}"
    else
      while read -r asset; do
        BASENAME=$(basename "$asset")
        echo -e "  $BASENAME"
      done < "$TEMP_LIST"
    fi
  else
    echo -e "${GREEN}Moving unused assets to: ${YELLOW}$DEST_FOLDER${NC}"
    
    if [ "$QUIET" = true ]; then
      echo -e "${YELLOW}Moving $UNUSED_ASSETS assets...${NC}"
    fi
    
    while read -r asset; do
      BASENAME=$(basename "$asset")
      
      if [ "$QUIET" = false ]; then
        echo -e "Moving: $BASENAME"
      fi
      
      # Move the file to the destination folder
      mv "$asset" "$DEST_FOLDER/"
      
      if [ $? -eq 0 ]; then
        MOVED_ASSETS=$((MOVED_ASSETS + 1))
      else
        if [ "$QUIET" = false ]; then
          echo -e "${RED}Failed to move: $BASENAME${NC}"
        fi
        FAILED_ASSETS=$((FAILED_ASSETS + 1))
      fi
    done < "$TEMP_LIST"
  fi
fi

# Clean up
rm -f "$TEMP_LIST" "$ASSETS_LIST"

# Display summary
echo -e "\n${BLUE}=======================================================${NC}"
echo -e "${GREEN}Summary:${NC}"
if [ "$ASSET_MODE" = "directory" ]; then
  echo -e "  Total assets scanned: $TOTAL_ASSETS"
  echo -e "  Used assets: $USED_ASSETS"
  echo -e "  Unused assets: $UNUSED_ASSETS"
  if [ $FAILED_ASSETS -gt 0 ]; then
    echo -e "  ${RED}Failed to check: $FAILED_ASSETS${NC}"
  fi
else
  if [ "$UNUSED_ASSETS" -eq 1 ]; then
    echo -e "  Asset is unused"
  else
    echo -e "  Asset is used"
  fi
fi

if [ "$DRY_RUN" = false ]; then
  echo -e "  Successfully moved: $MOVED_ASSETS"
  if [ $FAILED_ASSETS -gt 0 ]; then
    echo -e "  ${RED}Failed to move: $FAILED_ASSETS${NC}"
  fi
fi
echo -e "${BLUE}=======================================================${NC}"

if [ "$DRY_RUN" = true ]; then
  if [ $UNUSED_ASSETS -gt 0 ]; then
    echo -e "${YELLOW}$UNUSED_ASSETS unused assets would be moved to: $DEST_FOLDER${NC}"
    echo -e "${YELLOW}Run without --dry-run to actually move the files.${NC}"
  else
    echo -e "${GREEN}All assets are being used. Nothing to move.${NC}"
  fi
elif [ $MOVED_ASSETS -gt 0 ]; then
  echo -e "${YELLOW}$MOVED_ASSETS unused assets have been moved to: $DEST_FOLDER${NC}"
  echo -e "${YELLOW}You can review and delete them if they're no longer needed.${NC}"
else
  echo -e "${GREEN}All assets are being used. Nothing to move.${NC}"
fi 