import os
import re
import urllib.parse
import sys
import concurrent.futures
from PIL import Image
from moviepy.editor import VideoFileClip

obsidian_image_link_regex_compiled = re.compile(r"!\[\[(.*?)\]\]|\!\[.*?\]\((.*?)\)")


def process_markdown_file(file_path):
    """Processes a Markdown file, moving local images to an 'assets' folder and updating links.

    Args:
            file_path (str): Path to the Markdown file.
    """

    with open(file_path, "r") as file:
        content = file.read()

    file_dir = os.path.dirname(file_path)
    root_dir = file_path.split("/")[0]
    assets_dir = os.path.join(file_dir, "assets")
    os.makedirs(assets_dir, exist_ok=True)

    def replace_image_link(match):
        source_image_path = match.group(1) if match.group(1) else match.group(2)
        sources = re.split(r"[\\]?\|", source_image_path)

        source_note = sources[0] if len(sources) > 0 else match.group(1)
        source_name = sources[1] if len(sources) > 1 else ""
        
        # Get the trailing image name from source_image_path
        image_name = os.path.basename(urllib.parse.urlparse(source_image_path).path)

        # Search for the image recursively
        for root, _, files in os.walk(root_dir):
            if image_name in files:
                image_path = os.path.join(root, image_name)
                break  # Stop if we find the image
        else:  # If the image is not found
            return match.group(0)  # Return the original link

        # Convert image_filename to lower kebab-case
        image_filename = os.path.basename(image_path)
        image_filename = image_filename.lower().replace(" ", "-")

        # Get the note filename
        note_filename = os.path.splitext(os.path.basename(file_path))[0]
        note_filename = note_filename.lower().replace(" ", "-")

        # Check if the image_filename already starts with the note_filename
        if image_filename.startswith(note_filename):
            new_filename = image_filename
        else:
            new_filename = note_filename + "_" + image_filename

        new_image_path = os.path.join(assets_dir, new_filename)

        # If it's an image, compress and convert to .webp
        if image_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            print(f"Compressing image '{image_path}'...")
            img = Image.open(image_path)

            # remove image_path old extension and add .webp
            new_image_path = os.path.splitext(new_image_path)[0] + '.webp'
            img.save(new_image_path, 'WEBP', quality=75)
        # If it's a video, compress it if it hasn't been compressed already
        elif image_path.lower().endswith(('.mp4', '.avi', '.mov')):
            if 'compressed' in image_path:
                print(f"Video '{image_path}' has already been compressed.")
                return f"![{source_name}](assets/{new_filename})"
            else:
                print(f"Compressing video '{image_path}'...")
                clip = VideoFileClip(image_path)
                
                # remove image_path old extension and add _compressed.mp4
                new_image_path = os.path.splitext(new_image_path)[0] + '_compressed.mp4'
                clip.write_videofile(new_image_path, codec='libx264', bitrate='700k', logger=None)

        # Check if the image is not in the assets folder
        if image_path != new_image_path:
            os.rename(image_path, new_image_path)

        return f"![{source_name}](assets/{new_filename})"

    # Update image links (both Obsidian and standard Markdown syntax)
    content = re.sub(
        obsidian_image_link_regex_compiled, lambda x: replace_image_link(x), content
    )

    with open(file_path, "w", encoding="utf-8") as file:
        file.write(content)


def process_markdown_folder_parallel(folder_path, max_workers=4):
    """Processes all markdown files within a folder in parallel.

    Args:
        folder_path (str): Path to the folder containing Markdown files.
        max_workers (int): Maximum number of worker processes.
    """
    markdown_files = []  # List to keep track of all markdown file paths

    # Walk through the directory to find all markdown files
    for root, _, files in os.walk(folder_path):
        for filename in files:
            if filename.endswith(".md"):
                file_path = os.path.join(root, filename)
                markdown_files.append(file_path)

    # Use ProcessPoolExecutor to process files in parallel
    with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_markdown_file, file_path)
            for file_path in markdown_files
        ]

        # Optional: You can monitor the completion of tasks as follows
        for future in concurrent.futures.as_completed(futures):
            try:
                future.result()  # If needed, handle result or catch exceptions
            except Exception as exc:
                print(f"File processing generated an exception: {exc}")


# Get the folder path from the user (assuming it's the first argument)
if __name__ == "__main__":
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
        print(f"Processing images in folder: {folder_path}")
        process_markdown_folder_parallel(folder_path)
    else:
        print(
            "Please provide the path to the folder containing Markdown files as an argument."
        )
