from openai import OpenAI
import duckdb
import argparse
from dotenv import load_dotenv


load_dotenv()

embedding_model = "text-embedding-3-small"


def embed(text: str) -> list[float]:
	text = text.replace("\n", " ")
	client = OpenAI()

	try:
		return client.embeddings.create(input=[text], model=embedding_model)
	except:
		pass

	return None


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument(
		"--query",
		type=str,
		help="semantic query to search for in the database",
		required=True,
	)
	args = parser.parse_args()

	conn = duckdb.connect(":memory:")
	try:
		conn.execute("INSTALL fts")
		conn.execute("LOAD fts")
		conn.execute("IMPORT DATABASE 'db'")
		conn.execute("PRAGMA create_fts_index('vault', 'file_path', 'md_content')")
	except:
		pass

	query_embedding = embed(args.query)
	query_embedding = query_embedding.data[0].embedding

	query = conn.execute(f"""
		SELECT
			file_path,
			md_content,
			embeddings,
			full_text_score,
			similarity,
			(full_text_score * similarity) / 2 AS score
		FROM (
			SELECT
				file_path,
				md_content,
				embeddings,
				fts_main_vault.match_bm25(file_path, ?) AS full_text_score,
				array_cosine_similarity(?::DOUBLE[1536], embeddings) AS similarity
			FROM vault
			WHERE 
				embeddings IS NOT NULL
				AND full_text_score IS NOT NULL
			ORDER BY similarity DESC
		)
		ORDER BY score DESC
		LIMIT 10;
	""", [args.query, query_embedding]).fetchdf()

	print(query)


if __name__ == "__main__":
	main()
