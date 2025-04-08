#!/bin/bash

# Directory where the files are located
DIR="vault/careers/life"

# Loop through all life-at-dwarves-*.md files
for file in "$DIR"/life-at-dwarves-*.md; do
  if [ -f "$file" ]; then
    # Extract the base name of the file
    base=$(basename "$file")
    
    # Create the new filename by replacing "life-at-dwarves-" with "life-at-df-"
    new_name="${base/life-at-dwarves-/life-at-df-}"
    
    # Create the full path for the new file
    new_file="$DIR/$new_name"
    
    # Copy the content of the old file to the new file
    cp "$file" "$new_file"
    
    # If the copy was successful, remove the old file
    if [ $? -eq 0 ]; then
      rm "$file"
      echo "Renamed: $base -> $new_name"
    else
      echo "Error copying $base to $new_name"
    fi
  fi
done

# Handle the special case for life-at-dwaves-24.md (note the typo in dwaves)
if [ -f "$DIR/life-at-dwaves-24.md" ]; then
  cp "$DIR/life-at-dwaves-24.md" "$DIR/life-at-df-24.md"
  if [ $? -eq 0 ]; then
    rm "$DIR/life-at-dwaves-24.md"
    echo "Renamed: life-at-dwaves-24.md -> life-at-df-24.md"
  else
    echo "Error copying life-at-dwaves-24.md to life-at-df-24.md"
  fi
fi

# Handle files without a dash after "life-at-dwarves"
for file in "$DIR"/life-at-dwarves*.md; do
  # Skip files that we've already processed (files with a dash after dwarves)
  if [[ "$file" == *"life-at-dwarves-"* ]]; then
    continue
  fi
  
  if [ -f "$file" ]; then
    # Extract the base name of the file
    base=$(basename "$file")
    
    # Create the new filename by replacing "life-at-dwarves" with "life-at-df"
    new_name="${base/life-at-dwarves/life-at-df}"
    
    # Create the full path for the new file
    new_file="$DIR/$new_name"
    
    # Copy the content of the old file to the new file
    cp "$file" "$new_file"
    
    # If the copy was successful, remove the old file
    if [ $? -eq 0 ]; then
      rm "$file"
      echo "Renamed: $base -> $new_name"
    else
      echo "Error copying $base to $new_name"
    fi
  fi
done

echo "File renaming complete!" 