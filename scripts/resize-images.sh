#!/bin/bash

# This script resizes images that are larger than 1876 × 1251 pixels to fit within these dimensions.
# It preserves the aspect ratio by scaling down proportionally to fit within the target size.
# It converts compatible images to WebP format for better compression.
# It skips video files and GIF animations.
# It also updates markdown files to reference the new WebP images.
#
# Usage:
#   ./scripts/resize-images.sh <directory_or_file>
#
# Examples:
#   ./scripts/resize-images.sh public/images
#   ./scripts/resize-images.sh public/uploads/image.jpg

# Constants
TARGET_WIDTH=1876
TARGET_HEIGHT=1251
WEBP_QUALITY=90

# Get the input path from command line arguments or use default
INPUT_PATH="${1:-public/images}"
ABSOLUTE_PATH=$(realpath "$INPUT_PATH")

# Supported image formats for input (excluding gif which will be filtered separately)
IMAGE_EXTENSIONS=("jpg" "jpeg" "png" "webp" "avif")

# Video extensions to skip
VIDEO_EXTENSIONS=("mp4" "mov" "avi" "mkv" "webm" "wmv" "flv" "m4v")

# Track processed images for markdown updates
# We'll use a temporary file to store converted images info to avoid subshell issues
TEMP_CONVERTED_LIST=$(mktemp)

# Display script info
echo "Starting image resize process for $ABSOLUTE_PATH"
echo "Target dimensions: ${TARGET_WIDTH}x${TARGET_HEIGHT}"
echo "Images will be converted to WebP format when possible"
echo "GIF animations and video files will be skipped"
echo "Markdown files will be updated to reference WebP images"

# Check if path exists
if [ ! -e "$ABSOLUTE_PATH" ]; then
  echo "Path not found: $ABSOLUTE_PATH"
  exit 1
fi

# Check if ImageMagick is installed and determine the appropriate command to use
if command -v magick &> /dev/null; then
  # ImageMagick v7 uses 'magick'
  CONVERT_CMD="magick"
  IDENTIFY_CMD="magick identify"
  echo "Using ImageMagick v7 with 'magick' command"
elif command -v convert &> /dev/null && command -v identify &> /dev/null; then
  # ImageMagick v6 uses 'convert' and 'identify'
  CONVERT_CMD="convert"
  IDENTIFY_CMD="identify"
  echo "Using ImageMagick v6 with 'convert' command"
else
  echo "Error: ImageMagick is required but not installed. Please install it first."
  echo "Mac: brew install imagemagick"
  echo "Ubuntu/Debian: sudo apt-get install imagemagick"
  exit 1
fi

# Check if file is an image by extension (excluding videos)
is_image_file() {
  local file="$1"
  local extension=$(echo "${file##*.}" | tr '[:upper:]' '[:lower:]')
  
  # Check if it's a video file
  for video_ext in "${VIDEO_EXTENSIONS[@]}"; do
    if [ "$extension" = "$video_ext" ]; then
      return 1 # False - it's a video
    fi
  done
  
  # Check if it's a GIF file
  if [ "$extension" = "gif" ]; then
    # Check if it's an animated GIF
    local frames=$($IDENTIFY_CMD -format "%n" "$file" 2>/dev/null)
    if [ -z "$frames" ] || [ "$frames" -gt 1 ]; then
      # Either we couldn't determine frame count or it has multiple frames
      echo "Skipping animated GIF: $(basename "$file")"
      return 1 # False - it's likely an animated GIF
    fi
  fi
  
  # Check if it's a supported image format
  for valid_ext in "${IMAGE_EXTENSIONS[@]}"; do
    if [ "$extension" = "$valid_ext" ]; then
      return 0 # True - it's a supported image
    fi
  done
  
  # If we got here, it's not a supported image
  return 1 # False
}

# Process all images in a directory recursively
process_directory() {
  local dir_path="$1"
  
  # Use find to locate all files, but process them directly instead of in a subshell pipe
  local files=()
  while IFS= read -r -d '' file; do
    files+=("$file")
  done < <(find "$dir_path" -type f -print0)
  
  # Process each file
  for file in "${files[@]}"; do
    if is_image_file "$file"; then
      process_image "$file"
    else
      # Get the file extension
      local extension=$(echo "${file##*.}" | tr '[:upper:]' '[:lower:]')
      
      # Only log for known media files, not for all other files
      for valid_ext in "${IMAGE_EXTENSIONS[@]}" "${VIDEO_EXTENSIONS[@]}" "gif"; do
        if [ "$extension" = "$valid_ext" ]; then
          echo "Skipping non-image file: $(basename "$file")"
          break
        fi
      done
    fi
  done
}

# Process an image: resize if needed, then convert to WebP
process_image() {
  local image_path="$1"
  local filename=$(basename "$image_path")
  local dir_path=$(dirname "$image_path")
  local name_without_ext="${filename%.*}"
  local extension=$(echo "${filename##*.}" | tr '[:upper:]' '[:lower:]')
  
  # Get image dimensions
  local dimensions=$($IDENTIFY_CMD -format "%w %h" "$image_path" 2>/dev/null)
  
  if [ -z "$dimensions" ]; then
    echo "Could not determine dimensions for $image_path"
    return
  fi
  
  # Extract width and height
  read -r width height <<< "$dimensions"
  
  # Create a backup of the original image if not already done
  local backup_path="${image_path}.original"
  if [ ! -f "$backup_path" ]; then
    cp "$image_path" "$backup_path"
  fi
  
  # Resize the image if needed
  if [ "$width" -gt "$TARGET_WIDTH" ] || [ "$height" -gt "$TARGET_HEIGHT" ]; then
    echo "Resizing $image_path from ${width}x${height} to fit within ${TARGET_WIDTH}x${TARGET_HEIGHT}"
    
    # Calculate the resize dimensions to maintain aspect ratio
    local resize_option="${TARGET_WIDTH}x${TARGET_HEIGHT}>"
    
    # Resize the image with ImageMagick
    local temp_resized="${image_path}.resized"
    $CONVERT_CMD "$image_path" -resize "$resize_option" "$temp_resized"
    
    # Get new dimensions for logging
    local new_dimensions=$($IDENTIFY_CMD -format "%w %h" "$temp_resized" 2>/dev/null)
    read -r new_width new_height <<< "$new_dimensions"
    echo "Image resized to ${new_width}x${new_height}"
    
    # Replace the original with the resized version
    mv "$temp_resized" "$image_path"
  else
    echo "No resizing needed for $filename - already ${width}x${height}"
  fi
  
  # Skip further processing if it's already a WebP file
  if [ "$extension" = "webp" ]; then
    echo "Image is already in WebP format: $filename"
    return
  fi
  
  # Convert to WebP
  local webp_path="${dir_path}/${name_without_ext}.webp"
  echo "Converting $filename to WebP format..."
  $CONVERT_CMD "$image_path" -quality $WEBP_QUALITY "$webp_path"
  
  # Get file sizes for logging
  local original_size=$(stat -f%z "$image_path")
  local webp_size=$(stat -f%z "$webp_path")
  local size_diff=$((original_size - webp_size))
  local percent_saved=$(awk "BEGIN {printf \"%.1f\", ($size_diff / $original_size) * 100}")
  
  echo "✅ Converted to WebP:"
  echo "   - Original: $filename (${original_size} bytes)"
  echo "   - WebP: $(basename "$webp_path") (${webp_size} bytes)"
  echo "   - Saved: ${size_diff} bytes (${percent_saved}%)"
  
  # Track the image conversion in the temporary file
  # Format: name_without_ext|original_extension
  echo "${name_without_ext}|${extension}" >> "$TEMP_CONVERTED_LIST"
  
  # Remove the original if it's different from the WebP version
  if [ "$image_path" != "$webp_path" ]; then
    rm -f "$image_path"
  fi
}

# Update markdown files to reference the new WebP images
update_markdown_files() {
  echo ""
  echo "Looking for markdown files to update..."
  
  # Check if we have any converted images by looking at the temp file
  if [ ! -s "$TEMP_CONVERTED_LIST" ]; then
    echo "No images were converted, skipping markdown updates."
    return
  fi
  
  # Load the converted images info from the temp file
  CONVERTED_IMAGES=()
  ORIGINAL_EXTENSIONS=()
  
  while IFS='|' read -r name ext; do
    CONVERTED_IMAGES+=("$name")
    ORIGINAL_EXTENSIONS+=("$ext")
  done < "$TEMP_CONVERTED_LIST"
  
  echo "Found ${#CONVERTED_IMAGES[@]} converted images to update in markdown files."
  
  # Determine search locations
  local search_paths=()
  
  if [ -d "$ABSOLUTE_PATH" ]; then
    # For a directory, search in the directory itself
    search_paths+=("$ABSOLUTE_PATH")
    
    # Also check one level up if it might be an assets directory
    local parent_dir=$(dirname "$ABSOLUTE_PATH")
    search_paths+=("$parent_dir")
  else
    # For a file, search in its directory
    local dir_path=$(dirname "$ABSOLUTE_PATH")
    search_paths+=("$dir_path")
    
    # Also check one level up if it might be in an assets directory
    local parent_dir=$(dirname "$dir_path")
    search_paths+=("$parent_dir")
  fi
  
  # Find all markdown files in the search paths
  local md_files=()
  for search_path in "${search_paths[@]}"; do
    echo "Searching for markdown files in $search_path"
    while IFS= read -r -d '' file; do
      md_files+=("$file")
    done < <(find "$search_path" -name "*.md" -type f -print0)
  done
  
  # Skip if no markdown files found
  if [ ${#md_files[@]} -eq 0 ]; then
    echo "No markdown files found in search paths."
    return
  fi
  
  echo "Found ${#md_files[@]} markdown files."
  
  # Process each markdown file
  local updated_files=0
  
  for md_file in "${md_files[@]}"; do
    local was_updated=false
    local md_content=$(cat "$md_file")
    local new_content="$md_content"
    
    # Try all image replacements
    for i in "${!CONVERTED_IMAGES[@]}"; do
      local image_name="${CONVERTED_IMAGES[$i]}"
      local orig_ext="${ORIGINAL_EXTENSIONS[$i]}"
      
      # Match various markdown image syntaxes
      # ![...](image.ext) - Standard markdown
      # <img src="image.ext" ... /> - HTML in markdown
      # And variations with paths
      
      # Standard markdown image syntax with just filename
      new_content=$(echo "$new_content" | sed -E "s/\!\[([^]]*)\]\(([^)]*\/)?${image_name}\.${orig_ext}([^)]*)\)/\!\[\1\]\(\2${image_name}\.webp\3\)/g")
      
      # HTML image syntax with just filename
      new_content=$(echo "$new_content" | sed -E "s/<img([^>]*)src=[\"']([^\"']*\/)?${image_name}\.${orig_ext}([\"'][^>]*)>/<img\1src=\"\2${image_name}\.webp\3>/g")
      
      # Also handle cases where the extension might be uppercase
      orig_ext_upper=$(echo "$orig_ext" | tr '[:lower:]' '[:upper:]')
      new_content=$(echo "$new_content" | sed -E "s/\!\[([^]]*)\]\(([^)]*\/)?${image_name}\.${orig_ext_upper}([^)]*)\)/\!\[\1\]\(\2${image_name}\.webp\3\)/g")
      new_content=$(echo "$new_content" | sed -E "s/<img([^>]*)src=[\"']([^\"']*\/)?${image_name}\.${orig_ext_upper}([\"'][^>]*)>/<img\1src=\"\2${image_name}\.webp\3>/g")
    done
    
    # Check if file was updated
    if [ "$new_content" != "$md_content" ]; then
      echo "$md_file: Updating references to WebP images"
      echo "$new_content" > "$md_file"
      updated_files=$((updated_files + 1))
      was_updated=true
    fi
    
    if [ "$was_updated" = false ]; then
      echo "$md_file: No references to update"
    fi
  done
  
  echo "Updated $updated_files markdown files to reference WebP images."
  
  # Clean up the temp file
  rm -f "$TEMP_CONVERTED_LIST"
}

# Main process: determine if input is a file or directory and process accordingly
if [ -d "$ABSOLUTE_PATH" ]; then
  # Process directory
  process_directory "$ABSOLUTE_PATH"
  echo "Directory processing completed"
  echo "All suitable images have been resized and converted to WebP format"
elif [ -f "$ABSOLUTE_PATH" ]; then
  # Process single file
  if is_image_file "$ABSOLUTE_PATH"; then
    process_image "$ABSOLUTE_PATH"
    echo "Single image processing completed"
  else
    echo "Error: File is not a supported image format or is a video/GIF animation: $ABSOLUTE_PATH"
    exit 1
  fi
else
  echo "Error: Input path is neither a file nor a directory: $ABSOLUTE_PATH"
  exit 1
fi

# Update markdown files with new WebP references
update_markdown_files 