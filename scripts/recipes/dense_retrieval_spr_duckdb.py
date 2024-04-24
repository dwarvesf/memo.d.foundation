from openai import OpenAI
import duckdb
import argparse
from dotenv import load_dotenv
import os


load_dotenv()


def embed_custom(text):
	client = OpenAI(
		api_key=os.getenv("INFINITY_API_KEY"),
		base_url=os.getenv("INFINITY_OPENAI_BASE_URL"),
	)

	try:
		text = text.replace("\n", " ")
		return client.embeddings.create(
			input=[text], model="Snowflake/snowflake-arctic-embed-l"
		)
	except AttributeError:
		return None

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

	query_embedding = embed_custom(args.query)
	query_embedding = query_embedding.data[0].embedding

	query = conn.execute(
		f"""
		SELECT
			file_path,
			spr_content,
			array_cosine_similarity({query_embedding}::DOUBLE[1024], embeddings_spr_custom) AS similarity
		FROM vault
		WHERE embeddings_spr_custom NOT NULL
		ORDER BY similarity DESC
		LIMIT 10
	"""
	).fetchdf()

	print(query)


if __name__ == "__main__":
	main()
