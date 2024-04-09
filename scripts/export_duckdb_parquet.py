import os
import re
import duckdb
import argparse
import frontmatter


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
	for root, dirs, files in os.walk(directory):
		for file in files:
			if file.endswith(".md"):
				full_path = os.path.join(root, file)
				frontmatter, md_content = extract_frontmatter(full_path)
				if frontmatter:
					add_to_database(conn, full_path, frontmatter, md_content)


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("directory", help="the directory to scan")
	args = parser.parse_args()

	conn = duckdb.connect(":memory:")
	conn.execute(
		"CREATE TABLE IF NOT EXISTS vault (file_path TEXT, frontmatter TEXT, md_content TEXT)"
	)

	process_directory(conn, args.directory)

	conn.execute(f"EXPORT DATABASE '{args.directory}_export'")
	conn.close()


if __name__ == "__main__":
	main()
