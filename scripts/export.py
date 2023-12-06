import frontmatter
import argparse
import json
import os
import commonmark
import pandas as pd
import io


def markdown_folder_to_json(markdown_folder):
  metadata_list = []
  parser = commonmark.Parser()

  for root, dirs, files in os.walk(markdown_folder):
    for file in files:
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

def export_markdown_folder_to_parquet(markdown_folder):
  json = markdown_folder_to_json(markdown_folder)
  vault = pd.read_json(io.StringIO(json))
  filename = os.path.basename(os.path.normpath(markdown_folder))
  if not os.path.exists("db"):
    os.makedirs("db")

  parquet = vault.to_parquet(f"db/{filename}.parquet")

if __name__ == "__main__":
  parser = argparse.ArgumentParser(description="Exports a folder of Markdown files to JSON.")
  parser.add_argument("markdown_folder", type=str, help="The path to the folder containing the Markdown files.")
  args = parser.parse_args()

  export_markdown_folder_to_parquet(args.markdown_folder)
