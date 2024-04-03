import frontmatter
import argparse
import json
import os
import commonmark
import pandas as pd
import duckdb
import io
from gitignore_parser import parse_gitignore

def markdown_folder_to_json(markdown_folder, gitignore):
    metadata_list = []
    parser = commonmark.Parser()

    for root, dirs, files in os.walk(markdown_folder):
        dirs[:] = [d for d in dirs if not gitignore(os.path.join(root, d))]
        for file in files:
            if gitignore(os.path.join(root, file)):
                continue
            path = os.path.join(root, file)
            directory = path.split("/")[1]
            if file.endswith(".md") and not directory.startswith("_templates") and not directory.startswith("members"):
              post = frontmatter.load(path)
              post_data = post.to_dict()
              prefix = "vault/"
              post_data["_file"] = file.split(".md")[0]
              post_data["_path"] = path[path.startswith(prefix) and len(prefix):]
              metadata_list.append(post_data)
              ast = parser.parse(post.content)

    metadata = json.dumps(metadata_list, indent=2, sort_keys=True, default=str)
    return metadata

def export_markdown_folder_to_parquet(markdown_folder, gitignore):
    json = markdown_folder_to_json(markdown_folder, gitignore)
    # create vault.json temporary file
    with open('vault.json', 'w+') as f:
        f.write(json)
    filename = os.path.basename(os.path.normpath(markdown_folder))

    conn = duckdb.connect(database='my_db.duckdb')
    table_name = filename.replace(" ", "_")

    # load json
    conn.execute("INSTALL json")
    conn.execute("LOAD json")

    conn.execute(f"CREATE TABLE {table_name} AS SELECT * FROM 'vault.json'")
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Exports a folder of Markdown files to JSON.")
    parser.add_argument("markdown_folder", type=str, help="The path to the folder containing the Markdown files.")
    args = parser.parse_args()

    gitignore_file = os.path.join(args.markdown_folder, ".export-ignore")
    with open(gitignore_file, 'r') as f:
        gitignore = parse_gitignore(f.read())

    export_markdown_folder_to_parquet(args.markdown_folder, gitignore)