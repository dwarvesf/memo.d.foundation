import os
import re
import urllib.parse
import sys
import shutil
import fnmatch
import pathspec
import asyncio
import aiofiles
import frontmatter

obsidian_link_regex_compiled = re.compile(r"\[\[(.*?)\]\]")


def has_frontmatter_properties(content):
    # check if markdown file has frontmatter properties, title, description, tags, and author
    frontmatter_properties = frontmatter.loads(content)

    # check if frontmatter properties exist
    if not frontmatter_properties.keys():
        return False

    title = frontmatter_properties.get("title", "")
    description = frontmatter_properties.get("description", "")
    tags = frontmatter_properties.get("tags", [])

    # return if tags is not a list
    if not isinstance(tags, list):
        return False

    # if any of the frontmatter properties are empty, exit the function
    if not all([title, description, tags]):
        return False

    return True


def process_markdown_file(file_path, export_path):
    """Processes a Markdown file, moving local images to an 'assets' folder and updating links.

    Args:
            file_path (str): Path to the Markdown file.
    """

    linked_files = []
    with open(file_path, "r") as file:
        content = file.read()

    # check if markdown file has frontmatter properties
    if not has_frontmatter_properties(content):
        return None, linked_files

    file_dir = os.path.dirname(file_path)
    root_dir = file_path.split("/")[0]

    def replace_link(match):
        source_path = match.group(1)
        sources = re.split(r"[\\]?\|", source_path)

        source_note = sources[0]
        source_name = sources[1] if len(sources) > 1 else source_note

        # Search for the note recursively
        note_path = ""
        for root, _, files in os.walk(root_dir):
            # get the path of the each file relative to the root directory, but don't include the root directory itself
            files = [os.path.relpath(os.path.join(root, f), root_dir) for f in files]

            # for each file, check if the source note name is in the file
            for file in files:
                if source_note in file:
                    note_path = file

                    # check if the file is a markdown file
                    if note_path.endswith(".md"):
                        # check if markdown file has frontmatter properties
                        if not has_frontmatter_properties(content):
                            break

                    linked_files.append(file)
                    break

            # if note_path is not empty
            if note_path:
                break
        else:  # If the note is not found
            return match.group(0)  # Return the original link

        # make the note_path url safe
        note_path = urllib.parse.quote(note_path)

        return f"[{source_name}]({note_path})"

    # Update Obsidian links to markdown
    content = re.sub(obsidian_link_regex_compiled, lambda x: replace_link(x), content)

    return content, linked_files


def read_ignore_patterns(root):
    """Read ignore patterns from .export-ignore file in the given directory, returns a pathspec object."""
    ignore_file_path = os.path.join(root, ".export-ignore")
    if os.path.exists(ignore_file_path):
        with open(ignore_file_path, "r") as file:
            spec = pathspec.PathSpec.from_lines("gitwildmatch", file)
        return spec
    return None


def is_ignored(filepath, ignore_spec, folder_path):
    """Check if the given path matches any of the ignore patterns using pathspec.

    Args:
        filepath (str): Absolute path of the file or directory to check.
        ignore_spec (pathspec.PathSpec): The compiled pathspec object.
        folder_path (str): The root directory to make paths relative.

    Returns:
        bool: True if the file or directory should be ignored, False otherwise.
    """
    if ignore_spec is None:
        return False

    # Make the path relative to the folder_path to correctly match .export-ignore rules
    if filepath.startswith(folder_path):
        rel_path = os.path.relpath(filepath, folder_path)
    else:
        rel_path = filepath

    # Match against pathspec
    return ignore_spec.match_file(rel_path)


def get_files(folder_path):
    """Yield all files in folder_path that are not ignored by a .export-ignore file."""
    ignore_spec = read_ignore_patterns(folder_path)
    for root, dirs, files in os.walk(folder_path, topdown=True):
        dirs[:] = [
            d
            for d in dirs
            if not is_ignored(os.path.join(root, d), ignore_spec, folder_path)
        ]
        for file in files:
            file_path = os.path.join(root, file)
            if not is_ignored(file_path, ignore_spec, folder_path):
                yield file_path


async def process_markdown_file_async(file_path, export_path):
    """Processes a Markdown file asynchronously, moving local images to an 'assets' folder."""
    async with aiofiles.open(file_path, "r") as file:
        content = await file.read()

    content, linked_files = process_markdown_file(file_path, export_path)

    # check if content is a string
    if not isinstance(content, str):
        return

    # move all linked files to the export path if they don't exist in the export path
    for linked_file in linked_files:
        linked_file_path = os.path.join(file_path.split("/")[0], linked_file)
        export_linked_file_path = linked_file_path.replace(
            file_path.split("/")[0], export_path
        )
        if not os.path.exists(export_linked_file_path):
            os.makedirs(os.path.dirname(export_linked_file_path), exist_ok=True)
            shutil.copy2(linked_file_path, export_linked_file_path)

    # Async file write
    export_file_path = file_path.replace(file_path.split("/")[0], export_path)
    os.makedirs(os.path.dirname(export_file_path), exist_ok=True)
    async with aiofiles.open(export_file_path, "w") as file:
        await file.write(content)

    print(f"Exported '{file_path}' to '{export_file_path}'")


def copy_directory(src, dst, ignore_pattern):
    """Copy a directory recursively, ignoring files that match the ignore_pattern in a case-insensitive manner."""
    if not os.path.exists(dst):
        os.makedirs(dst)
    for item in os.listdir(src):
        s = os.path.join(src, item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            copy_directory(s, d, ignore_pattern)
        elif not fnmatch.fnmatch(item.lower(), ignore_pattern.lower()):  # Ensure comparison is case-insensitive
            shutil.copy2(s, d)
            print(f"Copied '{s}' to '{d}'")


async def worker(semaphore, file_path, export_path):
    async with semaphore:
        await process_markdown_file_async(file_path, export_path)


async def process_markdown_folder_async(folder_path, export_path):
    """Processes all markdown files within a folder asynchronously."""
    if os.path.exists(export_path):
        shutil.rmtree(export_path)

    # copy all files from the folder_path to the export_path except the .md files
    copy_directory(folder_path, export_path, "*.md")

    # Map files to their export paths and process only markdown files
    markdown_files = [
        (file_path, export_path)
        for file_path in get_files(folder_path)
        if file_path.endswith(".md")
    ]

    # Create a Semaphore to limit concurrent tasks
    semaphore = asyncio.Semaphore(10)

    tasks = [
        worker(semaphore, file_path, export_path)
        for file_path, export_path in markdown_files
    ]

    # Use asyncio.gather() to run tasks concurrently with semaphores managing the concurrency limit
    await asyncio.gather(*tasks)


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
