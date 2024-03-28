import os
import re
import urllib.parse
import sys
from distutils.dir_util import copy_tree, remove_tree
import fnmatch
import asyncio
import aiofiles

obsidian_link_regex_compiled = re.compile(r"\[\[(.*?)\]\]")


def process_markdown_file(file_path, export_path):
    """Processes a Markdown file, moving local images to an 'assets' folder and updating links.

    Args:
            file_path (str): Path to the Markdown file.
    """

    with open(file_path, "r") as file:
        content = file.read()

    file_dir = os.path.dirname(file_path)
    root_dir = file_path.split("/")[0]

    def replace_link(match):
        source_path = match.group(1)
        sources = re.split(r"[\\]?\|", source_path)

        source_note = sources[0]
        source_name = sources[1] if len(sources) > 1 else ""

        # Search for the note recursively
        note_path = ""
        for root, _, files in os.walk(root_dir):
            # get the path of the each file relative to the root directory, but don't include the root directory itself
            files = [os.path.relpath(os.path.join(root, f), root_dir) for f in files]

            # process only markdown files
            files = [f for f in files if f.endswith(".md")]

            # for each file, check if the source note name is in the file
            for file in files:
                if source_note in file:
                    note_path = file
                    break

            # if note_path is not empty
            if note_path:
                break
        else:  # If the note is not found
            return match.group(0)  # Return the original link

        return f"[{source_name}]({note_path})"

    # Update Obsidian links to markdown
    content = re.sub(obsidian_link_regex_compiled, lambda x: replace_link(x), content)

    # create a new file matching the directory structure of the file_path to the export_path using the new content
    export_file_path = file_path.replace(file_path.split("/")[0], export_path)
    os.makedirs(os.path.dirname(export_file_path), exist_ok=True)
    with open(export_file_path, "w") as file:
        file.write(content)
    print(f"Exported '{file_path}' to '{export_file_path}'")


def read_ignore_patterns(root):
    """Read ignore patterns from .export-ignore file in the given directory."""
    ignore_patterns = []
    ignore_file = os.path.join(root, ".export-ignore")
    if os.path.exists(ignore_file):
        with open(ignore_file, "r") as file:
            ignore_patterns = file.read().splitlines()
    return ignore_patterns


def is_ignored(path, ignore_patterns):
    """Check if the given path matches any of the ignore patterns."""
    for pattern in ignore_patterns:
        if fnmatch.fnmatch(os.path.basename(path), pattern):
            return True
    return False


def get_files(folder_path):
    """Yield all files in folder_path that are not ignored by a .export-ignore file."""
    ignore_patterns = read_ignore_patterns(folder_path)
    for root, _, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)
            if not is_ignored(file_path, ignore_patterns):
                yield file_path


async def process_markdown_file_async(file_path, export_path):
    """Processes a Markdown file asynchronously, moving local images to an 'assets' folder."""
    async with aiofiles.open(file_path, "r") as file:
        content = await file.read()

    # Your existing synchronous processing logic here...
    # Since regex and path operations are CPU-bound and not IO-bound, they remain synchronous.

    # Async file write
    export_file_path = file_path.replace(file_path.split("/")[0], export_path)
    os.makedirs(os.path.dirname(export_file_path), exist_ok=True)
    async with aiofiles.open(export_file_path, "w") as file:
        await file.write(content)

    print(f"Exported '{file_path}' to '{export_file_path}'")


async def process_markdown_folder_async(folder_path, export_path):
    """Processes all markdown files within a folder asynchronously."""
    if os.path.exists(export_path):
        remove_tree(export_path)
    copy_tree(folder_path, export_path)

    # Replace get_files() with an async version if fetching files can be async
    markdown_files = [
        (file_path, export_path)
        for file_path in get_files(folder_path)
        if file_path.endswith(".md")
    ]

    # Process files asynchronously
    await asyncio.gather(
        *[
            process_markdown_file_async(file_path, export_path)
            for file_path, export_path in markdown_files
        ]
    )


# Get the Markdown file path from the user (assuming it's the first argument)
if __name__ == "__main__":
    if len(sys.argv) > 2:
        markdown_file_path = sys.argv[1]
        export_path = sys.argv[2]
        asyncio.run(process_markdown_folder_async(markdown_file_path, export_path))
    else:
        print(
            "Please provide the path to the Markdown file as an argument as well as an export path."
        )
