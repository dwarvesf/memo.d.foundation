import os
import re
import urllib.parse
import sys


def process_markdown_file(file_path):
	"""Processes a Markdown file, moving local images to an 'assets' folder and updating links.

	Args:
		file_path (str): Path to the Markdown file.
	"""

	with open(file_path, 'r') as file:
		content = file.read()

	file_dir = os.path.dirname(file_path)
	assets_dir = os.path.join(file_dir, 'assets')
	os.makedirs(assets_dir, exist_ok=True)

	def replace_image_link(match):
		image_name = match.group(1)

		# Search for the image recursively
		for root, _, files in os.walk(file_dir):
			if image_name in files:
				image_path = os.path.join(root, image_name)
				break  # Stop if we find the image        
		else:  # If the image is not found
			return match.group(0)  # Return the original link

		image_filename = os.path.basename(image_path)
		new_filename = os.path.splitext(os.path.basename(file_path))[0] + "_" + image_filename
		new_image_path = os.path.join(assets_dir, new_filename)

		os.rename(image_path, new_image_path)
		return "![](assets/" + new_filename + ")"

	# Update image links (both Obsidian and standard Markdown syntax)
	content = re.sub(r"!\[\[(.*?)\]\]", replace_image_link, content)
	content = re.sub(r"!\[.*?\]\((.*?)\)", replace_image_link, content)

	with open(file_path, 'w') as file:
		file.write(content)

def process_markdown_folder(folder_path):
  """Processes all markdown files within a folder.

  Args:
      folder_path (str): Path to the folder containing Markdown files.
  """
  for filename in os.listdir(folder_path):
    if filename.endswith(".md"):
      file_path = os.path.join(folder_path, filename)
      process_markdown_file(file_path)

# Get the folder path from the user (assuming it's the first argument)
if __name__ == "__main__":
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
        process_markdown_folder(folder_path)
    else:
        print("Please provide the path to the folder containing Markdown files as an argument.")