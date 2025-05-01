defmodule Memo.Common.AIUtils do
  @moduledoc """
  Utility functions for AI-related operations such as text compression and embeddings.
  """

  @config %{
    spr_compression_prompt: """
    # MISSION
    You are a Sparse Priming Representation (SPR) writer. An SPR is a particular kind of use of language for advanced NLP, NLU, and NLG tasks, particularly useful for the latest generation of Large Language Models (LLMs). You will be given information by the USER which you are to render as an SPR.

    # THEORY
    LLMs are a kind of deep neural network. They have been demonstrated to embed knowledge, abilities, and concepts, ranging from reasoning to planning, and even to theory of mind. These are called latent abilities and latent content, collectively referred to as latent space. The latent space of an LLM can be activated with the correct series of words as inputs, which will create a useful internal state of the neural network. This is not unlike how the right shorthand cues can prime a human mind to think in a certain way. Like human minds, LLMs are associative, meaning you only need to use the correct associations to "prime" another model to think in the same way.

    # METHODOLOGY
    Render the input as a distilled list of succinct statements, assertions, associations, concepts, analogies, and metaphors. The idea is to capture as much, conceptually, as possible but with as few words as possible. Write it in a way that makes sense to you, as the future audience will be another language model, not a human. Use complete sentences.
    """,
    http_options: [recv_timeout: 60_000]
  }

  def spr_compress(text) do
    text
    |> String.replace("\n", " ")
    |> (&if(String.length(&1) > 100, do: compress_text_openai(&1), else: "")).()
  end

  def embed_custom(text) do
    if String.length(text) > 100 do
      fetch_jina_embeddings(text)
    else
      %{"embedding" => List.duplicate(0, 1024)}
    end
  end

  def embed_openai(text) do
    if String.length(text) > 100 do
      fetch_openai_embeddings(text)
    else
      %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
    end
  end

  defp compress_text_openai(text) do
    api_key = System.get_env("OPENAI_API_KEY")

    with true <- is_binary(api_key),
         headers = [{"Authorization", "Bearer #{api_key}"}, {"Content-Type", "application/json"}],
         payload =
           Jason.encode!(%{
             "model" => "gpt-4.1-nano-2025-04-14",
             "messages" => [
               %{"role" => "system", "content" => @config.spr_compression_prompt},
               %{"role" => "user", "content" => text}
             ]
           }),
         {:ok, %HTTPoison.Response{body: body}} <-
           HTTPoison.post(
             "https://api.openai.com/v1/chat/completions",
             payload,
             headers,
             @config.http_options
           ),
         {:ok, decoded_body} <- Jason.decode(body),
         false <- Map.has_key?(decoded_body, "error"),
         %{"choices" => [%{"message" => %{"content" => content}}]} <- decoded_body do
      content
    else
      _ -> ""
    end
  end

  defp fetch_openai_embeddings(text) do
    api_key = System.get_env("OPENAI_API_KEY")

    with true <- is_binary(api_key) && api_key != "",
         headers = [{"Authorization", "Bearer #{api_key}"}, {"Content-Type", "application/json"}],
         payload = %{"input" => text, "model" => "text-embedding-3-small"},
         {:ok, json_payload} <- Jason.encode(payload),
         {:ok, %HTTPoison.Response{status_code: status_code, body: body}} <-
           HTTPoison.post(
             "https://api.openai.com/v1/embeddings",
             json_payload,
             headers,
             @config.http_options
           ) do
      case status_code do
        200 ->
          with {:ok, data} <- Jason.decode(body),
               %{"data" => [%{"embedding" => embedding}], "usage" => %{"total_tokens" => total_tokens}} <-
                 data do
            %{"embedding" => embedding, "total_tokens" => total_tokens}
          else
            {:error, %Jason.DecodeError{}} ->
              %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}

            error ->
              IO.puts("Unexpected data structure from OpenAI API: #{inspect(error)}")
              %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
          end

        _ ->
          # Handle non-200 status codes

          # Check if the body contains the context length error message
          if String.contains?(body, "maximum context length") do
            %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
          else
            # For other errors, return zero embeddings as a fallback
            %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
          end
      end
    else
      false ->
        %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}

      {:error, %Jason.EncodeError{}} ->
        %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}

      {:error, %HTTPoison.Error{reason: _reason}} ->
        %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}

      _error ->
        %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
    end
  end

  defp fetch_jina_embeddings(prompts) when is_list(prompts) do
    with url when not is_nil(url) <- System.get_env("JINA_BASE_URL"),
         api_key when not is_nil(api_key) <- System.get_env("JINA_API_KEY"),
         headers <- [{"Content-Type", "application/json"}, {"Authorization", "Bearer #{api_key}"}],
         body <-
           Jason.encode!(%{
             model: "jina-embeddings-v3",
             task: "text-matching",
             dimensions: 1024,
             late_chunking: false,
             embedding_type: "float",
             input: prompts
           }),
         {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} <-
           HTTPoison.post("#{url}/embeddings", body, headers, @config.http_options),
         {:ok, parsed_response} <- Jason.decode(response_body),
         %{
           "model" => _model,
           "object" => "list",
           "usage" => %{"total_tokens" => total_tokens, "prompt_tokens" => _prompt},
           "data" => embeddings_data
         } <- parsed_response do
      embeddings_data
      |> Enum.map(fn %{"object" => "embedding", "index" => _index, "embedding" => embedding} ->
        %{"embedding" => embedding, "total_tokens" => total_tokens}
      end)
    else
      error ->
        IO.puts("Error fetching Jina embeddings: #{inspect(error)}")
        [%{"embedding" => List.duplicate(0, 1024), "total_tokens" => 0}]
    end
  end

  defp fetch_jina_embeddings(prompt) when is_binary(prompt) do
    case fetch_jina_embeddings([prompt]) do
      [embedding_map] -> embedding_map
      _ -> %{"embedding" => List.duplicate(0, 1024), "total_tokens" => 0}
    end
  end
end
