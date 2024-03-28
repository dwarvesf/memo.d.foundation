import os
import re
import urllib.parse
import sys
import frontmatter

obsidian_link_regex_compiled = re.compile(r"\[\[(.*?)\]\]")

def process_markdown_file(file_path, export_path):
    """Processes a Markdown file, moving local images to an 'assets' folder and updating links.

    Args:
            file_path (str): Path to the Markdown file.
    """

    linked_files = []
    with open(file_path, "r") as file:
        content = file.read()

    frontmatter_properties = frontmatter.loads(content)
    
    # check if frontmatter properties exist
    if not frontmatter_properties.keys():
        return content, linked_files

    title = frontmatter_properties.get("title", "")
    description = frontmatter_properties.get("description", "")
    tags = frontmatter_properties.get("tags", "")

    # make sure tags is a list
    if not isinstance(tags, list):
        return content, linked_files

    # if any of the frontmatter properties are empty, exit the function
    if not all([title, description, tags]):
        return content, linked_files

    file_dir = os.path.dirname(file_path)
    root_dir = file_path.split("/")[0]

    def replace_link(match):
        source_path = match.group(1)
        sources = re.split(r"[\\]?\|", source_path)

        source_note = sources[0]
        source_name = sources[1] if len(sources) > 1 else ''
        
        # Search for the note recursively
        note_path = ""
        for root, _, files in os.walk(root_dir):
            # get the path of the each file relative to the root directory, but don't include the root directory itself
            files = [os.path.relpath(os.path.join(root, f), root_dir) for f in files]
            
            # for each file, check if the source note name string is in the file
            for file in files:
                if source_note in file:
                    note_path = file
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
    content = re.sub(
        obsidian_link_regex_compiled, lambda x: replace_link(x), content
    )
    
    # move all linked files to the export path if they don't exist in the export path
    for linked_file in linked_files:
        linked_file_path = os.path.join(file_path.split("/")[0], linked_file)
        export_linked_file_path = linked_file_path.replace(
            file_path.split("/")[0], export_path
        )
        if not os.path.exists(export_linked_file_path):
            os.makedirs(os.path.dirname(export_linked_file_path), exist_ok=True)
            shutil.copy2(linked_file_path, export_linked_file_path)

    # create a new file matching the directory structure of the file_path to the export_path using the new content
    export_file_path = file_path.replace(file_path.split("/")[0], export_path)
    os.makedirs(os.path.dirname(export_file_path), exist_ok=True)
    with open(export_file_path, "w") as file:
        file.write(content)
    print(f"Exported '{file_path}' to '{export_file_path}'")


# Get the Markdown file path from the user (assuming it's the first argument)
if __name__ == "__main__":
    if len(sys.argv) > 2:
        markdown_file_path = sys.argv[1]
        export_path = sys.argv[2]
        process_markdown_file(markdown_file_path, export_path)
    else:
        print("Please provide the path to the Markdown file as an argument as well as an export path.")
