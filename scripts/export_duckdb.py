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
	columns = ", ".join(frontmatter.keys())
	values = ", ".join(["?" for _ in frontmatter.keys()])

	# Add new columns if they don't already exist
	for column in frontmatter.keys():
		try:
			conn.execute(f"ALTER TABLE vault ADD COLUMN {column} TEXT")
		except duckdb.ProgrammingError:
			pass

	# Remove the root folder from file_path
	file_path = re.sub(r"^.*?/", "", file_path)
	conn.execute(
		f"INSERT INTO vault (file_path, {columns}, md_content) VALUES (?, {values}, ?)",
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
	parser.add_argument("--format", choices=["csv", "parquet"], default="csv", help="output format")
	args = parser.parse_args()

	conn = duckdb.connect(":memory:")
	conn.execute(
		"CREATE TABLE IF NOT EXISTS vault (file_path TEXT, frontmatter TEXT, md_content TEXT)"
	)

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
