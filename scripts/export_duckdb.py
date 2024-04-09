import os
import re
import duckdb
import argparse
import frontmatter
import gitignore_parser
import time
import subprocess
from dateutil import parser
from openai import OpenAI
from dotenv import load_dotenv
from datetime import timezone


load_dotenv()

embedding_model = "text-embedding-3-small"


def embed(text: str) -> list[float]:
	text = text.replace("\n", " ")
	client = OpenAI()

	try:
		if len(text) > 100:
			return client.embeddings.create(input=[text], model=embedding_model)
	except:
		pass

	return None


def extract_frontmatter(file_path):
	with open(file_path, "r") as file:
		post = frontmatter.load(file)
		return post.metadata, post.content


def add_to_database(conn, file_path, frontmatter, md_content):
	# Remove the root folder from file_path
	short_path = re.sub(r"^.*?/", "", file_path)

	# Set the frontmatter metadata to include path and content
	frontmatter["file_path"] = short_path
	frontmatter["md_content"] = md_content if md_content else None
	
	# Get the path to the submodule
	submodule_path = os.path.dirname(file_path)

	# Get the last updated date from Git
	last_updated = subprocess.check_output(
		["git", "log", "-1", "--pretty=format:%ai"], cwd=submodule_path
	)
	last_updated = last_updated.decode("utf-8").rstrip()

	# Convert from 'yyyy-mm-dd hh:mm:ss +zzzz' to 'yyyy-mm-ddThh:mm:ss+zzzz'
	last_updated_dt = parser.parse(last_updated)
	last_updated = last_updated_dt.isoformat()
	frontmatter["last_updated"] = last_updated

	# Check if the frontmatter key is a list represented  as a comma seperated string, convert it into a list
	if "tags" in frontmatter.keys() and isinstance(frontmatter["tags"], str):
		frontmatter["tags"] = frontmatter["tags"].split(",")

	if "authors" in frontmatter.keys() and isinstance(frontmatter["authors"], str):
		frontmatter["authors"] = frontmatter["authors"].split(",")

	# Check if the file_path already exists in the database
	existing_row = conn.execute(
		"SELECT * FROM vault WHERE file_path = ? LIMIT 1", [short_path]
	).fetchdf()

	if not existing_row.empty:
		del frontmatter["file_path"]

		git_last_updated = last_updated_dt.astimezone(timezone.utc).replace(tzinfo=None)
		row_last_updated = existing_row["last_updated"].iloc[0].to_pydatetime()

		# If the last updated date is the same than the existing row, skip
		if git_last_updated == row_last_updated:
			return

		# Check if the md_content has changed, and update the embeddings accordingly
		row_md_content = existing_row["md_content"].iloc[0]
		if row_md_content != md_content:
			# Generate embeddings for the md_content
			embeddings = embed(md_content)
			frontmatter["embeddings"] = (
				embeddings.data[0].embedding if embeddings else None
			)
			frontmatter["total_tokens"] = (
				embeddings.usage.total_tokens if embeddings else 0
			)

		conn.execute(
			f"UPDATE vault SET {', '.join(f'{key} = ?' for key in frontmatter.keys())} WHERE file_path = ?",
			list(frontmatter.values()) + [short_path],
		)

		return

	# Get estimated tokens from md_content
	estimated_tokens = len(md_content) // 4
	frontmatter["estimated_tokens"] = estimated_tokens

	# Generate embeddings for the md_content
	embeddings = embed(md_content)
	frontmatter["embeddings"] = embeddings.data[0].embedding if embeddings else None
	frontmatter["total_tokens"] = embeddings.usage.total_tokens if embeddings else 0

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
		elif "embeddings" in key:
			column_types[key] = "DOUBLE[1536]"
		elif "last_updated" in key:
			column_types[key] = "TIMESTAMP"
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

	try:
		conn.execute(
			f"INSERT INTO vault ({', '.join(frontmatter.keys())}) VALUES ({', '.join('?' for _ in frontmatter.keys())})",
			list(frontmatter.values()),
		)
	except duckdb.duckdb.ConstraintException:
		pass


def process_directory(conn, directory, limit):
	ignore_file_path = os.path.join(directory, ".export-ignore")
	if os.path.exists(ignore_file_path):
		spec = gitignore_parser.parse_gitignore(ignore_file_path)

	i = 0
	for root, dirs, files in os.walk(directory):
		for file in files:
			if file.endswith(".md"):
				full_path = os.path.join(root, file)
				abs_path = os.path.abspath(full_path)
				if not spec(abs_path):
					frontmatter, md_content = extract_frontmatter(full_path)
					if frontmatter:
						add_to_database(conn, full_path, frontmatter, md_content)
						print(f"Processed {full_path}")
						i += 1
						if limit and i >= limit:
							return


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("directory", help="the directory to scan")
	parser.add_argument(
		"--format", choices=["csv", "parquet"], default="csv", help="output format"
	)
	parser.add_argument("--limit", type=int, help="limit the number of files processed")
	args = parser.parse_args()

	conn = duckdb.connect(":memory:")
	try:
		conn.execute("IMPORT DATABASE 'db'")
	except:
		pass

	conn.execute("CREATE TABLE IF NOT EXISTS vault (file_path TEXT UNIQUE, md_content TEXT)")

	print(f"Processing {args.directory} to DuckDB...")
	process_directory(conn, args.directory, args.limit)

	match args.format:
		case "csv":
			conn.execute(f"EXPORT DATABASE 'db'")
		case "parquet":
			conn.execute(f"EXPORT DATABASE 'db' (FORMAT PARQUET)")

	conn.close()


if __name__ == "__main__":
	main()
