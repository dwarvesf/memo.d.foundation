from openai import OpenAI
import duckdb
import argparse
from dotenv import load_dotenv


load_dotenv()


def embed_openai(text):
	client = OpenAI()

	try:
		text = text.replace("\n", " ")
		return client.embeddings.create(
			input=[text], model="text-embedding-3-small"
		)
	except openai.BadRequestError:
		spr_content = spr_compress(text)
		spr_content_text = (
			spr_content.choices[0].message.content if spr_content else None
		)
		return client.embeddings.create(
			input=[spr_content_text], model="text-embedding-3-small"
		)
	except AttributeError:
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

	query_embedding = embed_openai(args.query)
	query_embedding = query_embedding.data[0].embedding

	query = conn.execute(
		f"""
		SELECT
			file_path,
			md_content,
			embeddings_openai,
			array_cosine_similarity({query_embedding}::DOUBLE[1536], embeddings_openai) AS similarity
		FROM vault
		WHERE embeddings_openai NOT NULL
		ORDER BY similarity DESC
		LIMIT 10
	"""
	).fetchdf()

	print(query)


if __name__ == "__main__":
	main()
