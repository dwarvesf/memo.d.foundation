import os
import re
import duckdb
import argparse
import frontmatter
import gitignore_parser


def extract_frontmatter(file_path):
	with open(file_path, "r") as file:
		post = frontmatter.load(file)
		return post.metadata, post.content


def add_to_database(conn, file_path, frontmatter, md_content):
	# Check if the frontmatter key is a list represented as a comma seperated string, convert it into a list
	if "tags" in frontmatter.keys() and isinstance(frontmatter["tags"], str):
		frontmatter["tags"] = frontmatter["tags"].split(",")

	if "authors" in frontmatter.keys() and isinstance(frontmatter["authors"], str):
		frontmatter["authors"] = frontmatter["authors"].split(",")

	# Detect column types
	column_types = {}
	for key, value in frontmatter.items():
		if isinstance(value, list):
			column_types[key] = "TEXT[]"
		elif isinstance(value, int):
			column_types[key] = "BIGINT"
		elif isinstance(value, float):
			column_types[key] = "DOUBLE"
		elif isinstance(value, bool):
			column_types[key] = "BOOLEAN"
		elif "date" in key:
			column_types[key] = "DATE"
		else:
			column_types[key] = "TEXT"

	# Add new columns if they don't already exist
	for column, column_type in column_types.items():
		try:
			conn.execute(f"ALTER TABLE vault ADD COLUMN {column} {column_type}")
		except duckdb.ProgrammingError:
			pass

	# Remove the root folder from file_path
	file_path = re.sub(r"^.*?/", "", file_path)
	conn.execute(
		f"INSERT INTO vault (file_path, {', '.join(frontmatter.keys())}, md_content) VALUES (?, {', '.join('?' for _ in frontmatter.keys())}, ?)",
		[file_path] + list(frontmatter.values()) + [md_content],
	)


def process_directory(conn, directory):
	ignore_file_path = os.path.join(directory, ".export-ignore")
	if os.path.exists(ignore_file_path):
		spec = gitignore_parser.parse_gitignore(ignore_file_path)

	for root, dirs, files in os.walk(directory):
		for file in files:
			if file.endswith(".md"):
				full_path = os.path.join(root, file)
				abs_path = os.path.abspath(full_path)
				if not spec(abs_path):
					frontmatter, md_content = extract_frontmatter(full_path)
					if frontmatter:
						add_to_database(conn, full_path, frontmatter, md_content)


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("directory", help="the directory to scan")
	parser.add_argument(
		"--format", choices=["csv", "parquet"], default="csv", help="output format"
	)
	args = parser.parse_args()

	conn = duckdb.connect(":memory:")
	conn.execute("CREATE TABLE IF NOT EXISTS vault (file_path TEXT, md_content TEXT)")

	print(f"Processing {args.directory} to DuckDB...")
	process_directory(conn, args.directory)

	match args.format:
		case "csv":
			conn.execute(f"EXPORT DATABASE 'db'")
		case "parquet":
			conn.execute(f"EXPORT DATABASE 'db' (FORMAT PARQUET)")

	conn.close()


if __name__ == "__main__":
	main()
