import os
import re
import urllib.parse
import sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from moviepy.editor import VideoFileClip
import requests
from io import BytesIO


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
        source_name = sources[1] if len(sources) > 1 else source_note

        # Get the trailing image name from source_image_path
        image_name = os.path.basename(urllib.parse.urlparse(source_image_path).path)

        # Check if the source_image_path is a URL
        parsed_url = urllib.parse.urlparse(source_image_path)
        if parsed_url.scheme in ["http", "https"]:
            # Download the image and save it to the assets directory
            try:
                with ThreadPoolExecutor(max_workers=os.cpu_count()) as executor:
                    future = executor.submit(requests.get, source_image_path)
                    response = future.result()
            except requests.exceptions.RequestException as e:
                return match.group(0)

            # Check if the image is downloaded successfully
            if not response.ok:
                return match.group(0)

            # Check if it's an image by trying to open it with PIL
            try:
                Image.open(BytesIO(response.content))
            except IOError:
                # If it's not an image, return the original match
                return match.group(0)

            # Get a unique image name from the parsed URL
            print(f"Downloading image '{source_image_path}'...")
            image_name = os.path.basename(parsed_url.path)

            # if the image_name does not have a file extension, add one based on the content-type
            if not os.path.splitext(image_name)[1]:
                image_name += "." + response.headers["Content-Type"].split("/")[1]
            # if the image_name does have a file extension, but it is not a valid image extension, add one based on the content-type
            elif os.path.splitext(image_name)[1] not in [".png", ".jpg", ".jpeg", ".webp"]:
                image_name = os.path.splitext(image_name)[0] + "." + response.headers["Content-Type"].split("/")[1]

            with open(os.path.join(assets_dir, image_name), "wb") as f:
                f.write(response.content)
            image_path = os.path.join(assets_dir, image_name)
        else:
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
        if image_path.lower().endswith((".png", ".jpg", ".jpeg")):
            img = Image.open(image_path)

            # remove image_path old extension and add .webp
            new_image_path = os.path.splitext(new_image_path)[0] + ".webp"
            new_filename = os.path.splitext(new_filename)[0] + ".webp"

            print(f"Compressing image '{new_image_path}'...")
            img.save(new_image_path, "WEBP", quality=75)
            os.remove(image_path)
        # If it's a video, compress it if it hasn't been compressed already
        elif image_path.lower().endswith((".mp4", ".avi", ".mov")):
            if "compressed" in image_path:
                return f"![{source_name}](assets/{new_filename})"
            else:
                clip = VideoFileClip(image_path)

                # remove image_path old extension and add _compressed.mp4
                new_image_path = os.path.splitext(new_image_path)[0] + "_compressed.mp4"
                new_filename = os.path.splitext(new_filename)[0] + "_compressed.mp4"

                print(f"Compressing video '{new_image_path}'...")
                clip.write_videofile(
                    new_image_path, codec="libx264", bitrate="700k", logger=None
                )
                os.remove(image_path)
        else:
            # Check if the image is not in the assets folder
            if image_path != new_image_path:
                os.rename(image_path, new_image_path)

        return f"![{source_name}](assets/{new_filename})"

    # Update image links (both Obsidian and standard Markdown syntax)
    content = re.sub(
        r"!\[\[(.*?)\]\]|\!\[.*?\]\((.*?)\)", lambda x: replace_image_link(x), content
    )

    with open(file_path, "w") as file:
        file.write(content)


# Get the Markdown file path from the user (assuming it's the first argument)
if __name__ == "__main__":
    if len(sys.argv) > 1:
        markdown_file_path = sys.argv[1]
        process_markdown_file(markdown_file_path)
    else:
        print("Please provide the path to the Markdown file as an argument.")
