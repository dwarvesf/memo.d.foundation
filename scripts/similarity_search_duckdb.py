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
		conn.execute("IMPORT DATABASE 'db'")
	except:
		pass

	query_embedding = embed(args.query)
	query_embedding = query_embedding.data[0].embedding

	query = conn.execute(f"""
		SELECT
			file_path,
			md_content,
			embeddings,
			array_cosine_similarity({query_embedding}::DOUBLE[1536], embeddings) as similarity
		FROM vault
		WHERE embeddings NOT NULL
		ORDER BY similarity DESC
		LIMIT 10
	""").fetchdf()

	print(query)


if __name__ == "__main__":
	main()
