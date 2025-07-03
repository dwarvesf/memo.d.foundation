defmodule Memo.Common.AIUtils do
  @moduledoc """
  Utility functions for AI-related operations such as text compression and embeddings.
  """


@config %{
  spr_compression_prompt: """
  You are a lesson extraction specialist, your task is to analyze the following text/script and identify the key "lessons learned" from it.

  **OUTPUT REQUIREMENTS:**
  - **Keywords section**: List 8-20 key terms from the content for easy searching, including proper nouns and names.
  - 4-5 thematic sections with bold headings
  - 2-4 concise bullet points per section
  - Present these lessons as a concise bulleted list
  - Each bullet point should be direct, actionable, and express a single, clear takeaway.
  - Section headings should be bold and descriptive, and should be in sentence case.
  - Aim for a similar length and succinctness as the bullet points in the provided JSON example, avoiding any verbose explanations or introductory phrases.
  - The tone should be objective and analytical.
  - Must fit on single A4 page when printed
  - **Output format: JSON with keywords array and summary string**

  Here's an example of the desired style and quality:
  - LLMs are akin to a new operating system, indicating a foundational shift.
  - Technology diffusion is inverted, with consumers leading adoption over corporations.

  **JSON FORMAT:**
  ```json
  {
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
    "summary": "**Theme heading**\n* Key insight\n* Key insight\n\n**Theme heading**\n* Key insight\n* Key insight"
  }
  ```

  Extract the essence, not explanations. Focus on what someone should remember and apply.

  **EXAMPLE OUTPUT:**
  ```json
  {
    "keywords": ["Software paradigms", "LLMs", "operating systems", "jagged intelligence", "anterograde amnesia", "Iron Man suits", "generation-verification", "autonomy sliders"],
    "summary": "**Three programming paradigms**\n* Software 1.0: Traditional code for computers\n* Software 2.0: Neural network weights from training\n* Software 3.0: English prompts that program LLMs\n* Be fluent in all three paradigms for different use cases\n\n**LLMs as operating systems**\n* Complex software ecosystems, not simple utilities\n* 1960s computing era - expensive, centralized, time-sharing\n* Context windows are memory for orchestrating compute\n\n**LLM psychology**\n* \"Stochastic simulations of people\" with emergent psychology\n* \"Jagged intelligence\" - superhuman yet basic mistakes\n* \"Anterograde amnesia\" - context wiped, no learning over time\n\n**Building AI products**\n* \"Iron Man suits\" not robots - augmentation over automation\n* Human-AI cooperation: AI generates, humans verify\n* Autonomy sliders for user control levels\n\n**Working with AI**\n* Keep AI \"on the leash\" - avoid large, hard-to-audit changes\n* Fast generation-verification loops\n* Small incremental chunks, not massive changes"
  }
  ```
  """,
  http_options: [recv_timeout: 60_000]
}

  def spr_compress(text) do
    text
    |> String.replace("\n", " ")
    |> (&if(String.length(&1) > 100, do: compress_text_gemini(&1), else: %{"keywords" => [], "summary" => ""})).()
  end

  def embed_custom(text) do
    if String.length(text) > 100 do
      fetch_jina_embeddings(text)
    else
      %{"embedding" => List.duplicate(0, 1024)}
    end
  end

  def embed_gemini(text) do
    if String.length(text) > 100 do
      fetch_gemini_embeddings(text)
    else
      %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}
    end
  end

  defp compress_text_gemini(text) do
    api_key = get_gemini_api_key()

    with true <- is_binary(api_key),
         headers = [{"Content-Type", "application/json"}, {"x-goog-api-key", api_key}],
         payload =
           Jason.encode!(%{
             "contents" => [
               %{
                 "parts" => [
                   %{"text" => "#{@config.spr_compression_prompt}\n\n#{text}"}
                 ]
               }
             ],
             "generationConfig" => %{
               "temperature" => 0.1,
               "maxOutputTokens" => 2048,
               "thinkingConfig" => %{ # Add this block for disabled thinking
                 "thinkingBudget" => 0,
                 "includeThoughts" => true
               },
             },
             "systemInstruction" => %{
               "parts" => [%{"text" => "You are a helpful assistant. Do not show your thinking process."}]
             }
           }),
         {:ok, %HTTPoison.Response{body: body}} <-
           HTTPoison.post(
             "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
             payload,
             headers,
             @config.http_options
           ),
         {:ok, decoded_body} <- Jason.decode(body),
         false <- Map.has_key?(decoded_body, "error"),
         %{"candidates" => [%{"content" => %{"parts" => [%{"text" => content}]}}]} <- decoded_body do
      # Try to parse the JSON response - handle nested JSON strings
      case Jason.decode(content) do
        {:ok, %{"keywords" => keywords, "summary" => summary}} when is_list(keywords) and is_binary(summary) ->
          %{"keywords" => keywords, "summary" => summary}
        {:ok, %{"summary" => summary}} when is_binary(summary) ->
          # Fallback if keywords are missing
          %{"keywords" => [], "summary" => summary}
        {:ok, _other} ->
          # Handle other JSON structures - treat as plain text
          %{"keywords" => [], "summary" => content}
        {:error, _json_error} ->
          # If JSON parsing fails, try to extract from markdown code blocks
          # Look for ```json...``` blocks
          case Regex.run(~r/```json\s*\n(.*?)\n```/s, content) do
            [_, json_content] ->
              case Jason.decode(json_content) do
                {:ok, %{"keywords" => keywords, "summary" => summary}} when is_list(keywords) and is_binary(summary) ->
                  %{"keywords" => keywords, "summary" => summary}
                {:ok, %{"summary" => summary}} when is_binary(summary) ->
                  %{"keywords" => [], "summary" => summary}
                {:ok, _other} ->
                  %{"keywords" => [], "summary" => content}
                {:error, _extract_error} ->
                  # Try manual extraction as fallback
                  case extract_keywords_manually(json_content) do
                    {keywords, summary} when is_list(keywords) and length(keywords) > 0 ->
                      %{"keywords" => keywords, "summary" => summary}
                    _ ->
                      # Final fallback - treat as plain text
                      %{"keywords" => [], "summary" => content}
                  end
              end
            nil ->
              # No JSON block found, treat as plain text
              %{"keywords" => [], "summary" => content}
          end
        _ ->
          # Other parsing issues - treat as plain text
          %{"keywords" => [], "summary" => content}
      end
    else
      _ -> %{"keywords" => [], "summary" => ""}
    end
  end

  defp fetch_gemini_embeddings(text) do
    api_key = get_gemini_api_key()

    with true <- is_binary(api_key) && api_key != "",
         headers = [{"Content-Type", "application/json"}, {"x-goog-api-key", api_key}],
         payload = %{
           "model" => "models/text-embedding-004",
           "content" => %{"parts" => [%{"text" => text}]}
         },
         {:ok, json_payload} <- Jason.encode(payload),
         {:ok, %HTTPoison.Response{status_code: status_code, body: body}} <-
           HTTPoison.post(
             "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
             json_payload,
             headers,
             @config.http_options
           ) do
      case status_code do
        200 ->
          with {:ok, data} <- Jason.decode(body),
               %{"embedding" => %{"values" => embedding}} <- data do
            # Gemini doesn't provide token usage for embeddings, so we estimate
            estimated_tokens = div(String.length(text), 4)
            %{"embedding" => embedding, "total_tokens" => estimated_tokens}
          else
            {:error, %Jason.DecodeError{}} ->
              %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}

            error ->
              IO.puts("Unexpected data structure from Gemini API: #{inspect(error)}")
              %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}
          end

        _ ->
          # Handle non-200 status codes
          if String.contains?(body, "quota") or String.contains?(body, "limit") do
            %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}
          else
            # For other errors, return zero embeddings as a fallback
            %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}
          end
      end
    else
      false ->
        %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}

      {:error, %Jason.EncodeError{}} ->
        %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}

      {:error, %HTTPoison.Error{reason: _reason}} ->
        %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}

      _error ->
        %{"embedding" => List.duplicate(0, 768), "total_tokens" => 0}
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

  # Manual extraction for malformed JSON with unescaped newlines
  defp extract_keywords_manually(json_content) do
    # Try to extract keywords array using regex
    keywords_match = Regex.run(~r/"keywords":\s*\[(.*?)\]/s, json_content)

    # Try to extract summary using regex (everything after "summary": until end of object)
    summary_match = Regex.run(~r/"summary":\s*"(.*?)"\s*\}/s, json_content)

    case {keywords_match, summary_match} do
      {[_, keywords_str], [_, summary_str]} ->
        # Parse keywords array
        keywords =
          keywords_str
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.map(&String.trim(&1, "\""))
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))

        # Clean up summary (unescape and clean)
        cleaned_summary =
          summary_str
          |> String.replace("\\n", "\n")
          |> String.replace("\\\"", "\"")
          |> String.trim()

        {keywords, cleaned_summary}

      {[_, keywords_str], _} ->
        # Only keywords found
        keywords =
          keywords_str
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.map(&String.trim(&1, "\""))
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))

        {keywords, ""}

      _ ->
        # No valid extraction possible
        {[], ""}
    end
  end

  # Retrieve GEMINI_API_KEY from HashiCorp Vault
  defp get_gemini_api_key() do
    # Use persistent cache in process dictionary for efficiency
    case Process.get(:gemini_api_key) do
      api_key when is_binary(api_key) and api_key != "" ->
        api_key
      _ ->
        # Try environment variable first as fallback
        case System.get_env("GEMINI_API_KEY") do
          api_key when is_binary(api_key) and api_key != "" ->
            Process.put(:gemini_api_key, api_key)
            api_key
          _ ->
            # Fetch from HashiCorp Vault and cache
            api_key = fetch_from_vault()
            if is_binary(api_key) and api_key != "" do
              Process.put(:gemini_api_key, api_key)
            end
            api_key
        end
    end
  end

  defp fetch_from_vault() do
    vault_addr = System.get_env("VAULT_ADDR")
    vault_path = System.get_env("VAULT_PATH")
    vault_token = System.get_env("VAULT_TOKEN")

    with true <- is_binary(vault_addr) and vault_addr != "",
         true <- is_binary(vault_path) and vault_path != "",
         true <- is_binary(vault_token) and vault_token != "",
         vault_url <- "#{vault_addr}/v1/#{vault_path}",
         headers <- [
           {"Content-Type", "application/json"},
           {"X-Vault-Token", vault_token}
         ],
         {:ok, %HTTPoison.Response{status_code: 200, body: body}} <-
           HTTPoison.get(vault_url, headers, @config.http_options),
         {:ok, %{"data" => %{"data" => vault_data}}} <- Jason.decode(body),
         %{"GEMINI_API_KEY" => api_key} <- vault_data,
         true <- is_binary(api_key) and api_key != "" do
      api_key
    else
      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        IO.puts("Vault request failed with status #{status_code}: #{body}")
        nil
      {:error, %HTTPoison.Error{reason: reason}} ->
        IO.puts("Vault HTTP request failed: #{inspect(reason)}")
        nil
      {:error, %Jason.DecodeError{}} ->
        IO.puts("Failed to parse Vault response JSON")
        nil
      error ->
        IO.puts("Vault integration error: #{inspect(error)}")
        nil
    end
  end
end
