#!/usr/bin/env elixir

Mix.install([
  {:flow, "~> 1.2"},
  {:duckdbex, "~> 0.3"},
  {:jason, "~> 1.4"},
  {:yaml_elixir, "~> 2.9"},
  {:dotenv_parser, "~> 2.0"},
  {:httpoison, "~> 2.2"}
])

defmodule MarkdownExportDuckDB do
  @moduledoc """
  A module to process markdown files and store their information in DuckDB.
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

  @allowed_frontmatter [
    {"file_path", "TEXT UNIQUE"},
    {"md_content", "TEXT"},
    {"embeddings_openai", "FLOAT[1536]"},
    {"embeddings_spr_custom", "FLOAT[1024]"},
    {"title", "VARCHAR"},
    {"description", "VARCHAR"},
    {"tags", "VARCHAR[]"},
    {"authors", "VARCHAR[]"},
    {"date", "DATE"},
    {"pinned", "BOOLEAN"},
    {"hide_frontmatter", "BOOLEAN"},
    {"hide_title", "BOOLEAN"},
    {"draft", "BOOLEAN"},
    {"social", "VARCHAR"},
    {"github", "VARCHAR"},
    {"website", "VARCHAR"},
    {"avatar", "VARCHAR"},
    {"discord_id", "VARCHAR"},
    {"aliases", "VARCHAR[]"}
  ]

  use Flow

  def main(args) do
    DotenvParser.load_file(".env")

    {opts, _, _} =
      OptionParser.parse(args,
        strict: [
          vaultpath: :string,
          format: :string,
          all: :boolean,
          limit: :integer
        ]
      )

    vaultpath = opts[:vaultpath] || "vault"
    export_format = opts[:format] || "parquet"
    process_all = opts[:all] || false
    limit = opts[:limit] || :infinity

    ignored_patterns = read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))

    paths = list_files_and_assets_recursive(vaultpath)
    {all_files, _all_assets} = Enum.split_with(paths, &File.regular?/1)

    # Filter only markdown files
    all_files = Enum.filter(all_files, &String.ends_with?(&1, ".md"))

    all_files_to_process =
      all_files
      |> Enum.filter(&(not ignored?(&1, ignored_patterns, vaultpath)))

    filtered_files =
      if process_all do
        all_files_to_process
      else
        get_files_to_process(vaultpath, process_all, all_files_to_process)
      end

    IO.inspect(filtered_files)
    selected_files = if limit == :infinity, do: filtered_files, else: Enum.take(filtered_files, limit)

    case duckdb_cmd("SELECT 1") do
      {:ok, _} ->
        install_and_load_extensions()
        setup_database()
        process_files(selected_files, vaultpath, all_files_to_process)
        export(export_format)
      {:error, _reason} ->
        IO.puts("Failed to connect to DuckDB")
    end
  end

  defp duckdb_cmd(query) do
    case System.cmd("duckdb", ["vault.duckdb", "-json", "-c", query]) do
      {result, 0} ->
        if result == "" do
          {:ok, []}
        else
          case Jason.decode(result) do
            {:ok, json} -> {:ok, json}
            {:error, _} -> {:ok, result}  # For queries that don't return JSON
          end
        end

      {error_message, _} -> {:error, error_message}
    end
  end

  defp install_and_load_extensions() do
    duckdb_cmd("INSTALL parquet") |> handle_result()
    duckdb_cmd("LOAD parquet") |> handle_result()
  end

  defp setup_database() do
    columns =
      @allowed_frontmatter
      |> Enum.map(fn {name, type} -> "#{name} #{type}" end)
      |> Enum.join(", ")

    query = """
      CREATE TABLE IF NOT EXISTS vault (
        #{columns}
      )
    """

    duckdb_cmd(query) |> handle_result()
  end

  defp export(format) do
    case format do
      "csv" ->
        response = duckdb_cmd("EXPORT DATABASE 'db'")
        clean_exported_schema("db/schema.sql")
        response

      "parquet" ->
        response = duckdb_cmd("EXPORT DATABASE 'db' (FORMAT PARQUET)")
        clean_exported_schema("db/schema.sql")
        response

      _ ->
        IO.puts("Unsupported export format: #{format}")
    end
  end

  defp clean_exported_schema(file_path) do
    if File.exists?(file_path) do
      content = File.read!(file_path)

      cleaned_content =
        content
        |> String.split("\n")
        |> Enum.reject(&(&1 in ["CREATE SCHEMA information_schema;", "CREATE SCHEMA pg_catalog;"]))
        |> Enum.join("\n")

      File.write!(file_path, cleaned_content)
      IO.puts("Cleaned schema file: #{file_path}")
    else
      IO.puts("Schema file not found: #{file_path}")
    end
  end

  defp process_files(files, vaultpath, all_files_to_process) do
    files
    |> Enum.each(fn file_path ->
      relative_path = Path.relative_to(file_path, vaultpath)
      case File.read(file_path) do
        {:ok, content} ->
          case extract_frontmatter(content) do
            {:error, :no_frontmatter} -> nil
            {frontmatter, md_content} ->
              process_and_store(relative_path, frontmatter, md_content)
          end

        {:error, reason} ->
          IO.puts("Failed to read file: #{relative_path}, Reason: #{reason}")
      end
    end)

    paths = Enum.map(all_files_to_process, &Path.relative_to(&1, vaultpath))
    remove_old_files(paths)
  end

  defp process_and_store(file_path, frontmatter, md_content) do
    escaped_file_path = escape_string(file_path)
    query = "SELECT md_content, embeddings_openai, embeddings_spr_custom FROM vault WHERE file_path = '#{escaped_file_path}'"

    case duckdb_cmd(query) do
      {:ok, [existing_data]} ->
        if existing_data["md_content"] != escape_multiline_text(md_content) do
          # Regenerate embeddings if md_content has changed
          frontmatter = transform_frontmatter(md_content, frontmatter, escaped_file_path)
          updated_frontmatter = regenerate_embeddings(md_content, frontmatter)
          add_to_database(updated_frontmatter)
        else
          # Use existing embeddings if md_content hasn't changed
          frontmatter = transform_frontmatter(md_content, frontmatter, escaped_file_path)
          existing_data_with_current_frontmatter = Map.merge(frontmatter, %{
            "embeddings_openai" => existing_data["embeddings_openai"],
            "embeddings_spr_custom" => existing_data["embeddings_spr_custom"]
          })

          add_to_database(existing_data_with_current_frontmatter)
        end

      {:ok, []} ->
        # If no existing data is retrieved, proceed with the transformation, regeneration, and insertion
        frontmatter = transform_frontmatter(md_content, frontmatter, escaped_file_path)
        updated_frontmatter = regenerate_embeddings(md_content, frontmatter)
        add_to_database(updated_frontmatter)

      {:ok, result} when is_binary(result) ->
        IO.puts("Unexpected result: #{result}")

      {:error, error_message} ->
        IO.puts("Failed to fetch existing entry for file: #{escaped_file_path}")
        IO.puts("Error: #{inspect(error_message)}")
    end
  end

  defp get_files_to_process(directory, process_all, all_files) do
    if process_all == :false do
      # Get modified files in the main repository
      git_files = get_modified_files(directory)

      # Collect modified files from submodules
      submodule_files =
        list_submodules(directory)
        |> Enum.flat_map(&get_submodule_modified_files(directory, &1))

      all_git_files = git_files ++ submodule_files

      Enum.map(all_git_files, fn file -> Path.join(directory, file) end)
    else
      all_files
    end
  end

  defp get_modified_files(directory) do
    revision = if valid_revision?(directory, "HEAD^"), do: "HEAD^", else: "HEAD"
    {output, _status} = System.cmd("git", ["diff", "--name-only", revision], cd: directory, stderr_to_stdout: true)

    output
    |> String.split("\n")
    |> Enum.filter(&String.ends_with?(&1, ".md"))
    |> Enum.reject(&String.contains?(&1, "fatal: Needed a single revision"))
  end

  defp list_submodules(directory) do
    case System.cmd("git", ["config", "--file", Path.join(directory, ".gitmodules"), "--name-only", "--get-regexp", "submodule\\..*\\.path"]) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(&get_submodule_path(directory, &1))

      _ -> []
    end
  end

  defp get_submodule_path(directory, line) do
    case System.cmd("git", ["config", "--file", Path.join(directory, ".gitmodules"), "--get", line]) do
      {output, 0} ->
        output |> String.trim()

      _ ->
        nil
    end
  end

  defp get_submodule_modified_files(base_directory, submodule) do
    submodule_dir = Path.join(base_directory, submodule)
    case get_modified_files(submodule_dir) do
      [] -> []
      modified_files -> Enum.map(modified_files, &Path.join(submodule, &1))
    end
  end

  defp valid_revision?(directory, revision) do
    case System.cmd("git", ["rev-parse", "--verify", revision], cd: directory, stderr_to_stdout: true) do
      {_, 0} -> true
      _ -> false
    end
  end

  defp list_files_and_assets_recursive(path) do
    File.ls!(path)
    |> Enum.flat_map(fn file ->
      full_path = Path.join(path, file)

      if File.dir?(full_path) do
        [full_path | list_files_and_assets_recursive(full_path)]
      else
        [full_path]
      end
    end)
  end

  defp read_export_ignore_file(ignore_file) do
    if File.exists?(ignore_file) do
      File.read!(ignore_file)
      |> String.split("\n", trim: true)
      |> Enum.filter(&(&1 != "" and not String.starts_with?(&1, "#")))
    else
      []
    end
  end

  defp ignored?(file, patterns, vaultpath) do
    relative_path = Path.relative_to(file, vaultpath)
    Enum.any?(patterns, &match_pattern?(relative_path, &1))
  end

  defp match_pattern?(path, pattern) do
    cond do
      String.ends_with?(pattern, "/") ->
        # Check if the path starts with the directory pattern
        String.starts_with?(path, pattern) or String.contains?(path, "/#{pattern}")

      String.starts_with?(pattern, "*") ->
        String.ends_with?(path, String.trim_leading(pattern, "*"))

      String.ends_with?(pattern, "*") ->
        String.starts_with?(path, String.trim_trailing(pattern, "*"))

      true ->
        path == pattern or String.contains?(path, pattern)
    end
  end

  defp extract_frontmatter(content) do
    case Regex.run(~r/^---\n(.+?)\n---\n/s, content, capture: :all_but_first) do
      [frontmatter_content] ->
        case YamlElixir.read_from_string(frontmatter_content) do
          {:ok, metadata} -> {metadata, strip_frontmatter(content)}
          {:error, _reason} -> {:error, :invalid_frontmatter}
        end

      _ ->
        {:error, :no_frontmatter}
    end
  end

  defp strip_frontmatter(content) do
    [_, rest] = String.split(content, "---\n", parts: 2)
    String.split(rest, "\n---\n", parts: 2) |> List.last()
  end

  defp transform_frontmatter(md_content, frontmatter, file_path) do
    frontmatter
    |> Map.take(@allowed_frontmatter |> Enum.map(&elem(&1, 0)))
    |> Map.new(fn {k, v} -> {k, normalize_value(k, v)} end)
    |> Map.merge(%{"file_path" => file_path, "md_content" => md_content})
  end

  defp normalize_value(key, value) when key in ["tags", "authors", "aliases"] do
    normalize_list_value(value)
  end

  defp normalize_value(_key, value), do: value

  defp normalize_list_value(value) when is_binary(value) do
    if String.contains?(value, ",") do
      value
      |> String.split(",")
      |> Enum.map(&String.trim/1)
    else
      [String.trim(value)]
    end
  end

  defp normalize_list_value(value), do: value

  defp regenerate_embeddings(md_content, frontmatter) do
    spr_content = spr_compress(md_content)
    frontmatter = Map.put(frontmatter, "spr_content", spr_content)

    custom_embedding = embed_custom(spr_content)
    frontmatter = Map.put(frontmatter, "embeddings_spr_custom", custom_embedding["embedding"])

    openai_embedding = embed_openai(md_content)
    frontmatter = Map.put(frontmatter, "embeddings_openai", openai_embedding["embedding"])

    frontmatter
  end

  defp spr_compress(text) do
    text |> String.replace("\n", " ")
    if String.length(text) <= 100 do
      ""
    else
      spr_text = compress_text_openai(text)
      if String.length(spr_text) > 100, do: IO.puts("SPR: #{spr_text}")
      spr_text
    end
  end

  defp compress_text_openai(text) do
    api_key = System.get_env("OPENAI_API_KEY")

    if api_key do
      headers = [{"Authorization", "Bearer #{api_key}"}, {"Content-Type", "application/json"}]

      payload = %{
        "model" => "gpt-3.5-turbo-0125",
        "messages" => [
          %{"role" => "system", "content" => @config.spr_compression_prompt},
          %{"role" => "user", "content" => text}
        ]
      }

      json_payload = Jason.encode!(payload)

      case HTTPoison.post(
             "https://api.openai.com/v1/chat/completions",
             json_payload,
             headers,
             @config.http_options
           ) do
        {:ok, %HTTPoison.Response{body: body}} ->
          case Jason.decode(body) do
            {:ok, decoded_body} ->
              if Map.has_key?(decoded_body, "error"),
                do: "",
                else:
                  decoded_body["choices"]
                  |> List.first()
                  |> Map.get("message")
                  |> Map.get("content", text)

            {:error, _} ->
              ""
          end

        {:error, _} ->
          ""
      end
    else
      ""
    end
  end

  defp embed_custom(text) do
    if String.length(text) > 100 do
      embeddings = get_ollama_embeddings(text)
      IO.inspect(embeddings)
      embeddings
    else
      %{"embedding" => List.duplicate(0, 1024)}
    end
  end

  defp embed_openai(text) do
    if String.length(text) > 100 do
      embeddings = fetch_openai_embedding(text)
      IO.inspect(embeddings)
      embeddings
    else
      %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
    end
  end

  defp fetch_openai_embedding(text) do
    api_key = System.get_env("OPENAI_API_KEY")

    if api_key do
      headers = [{"Authorization", "Bearer #{api_key}"}, {"Content-Type", "application/json"}]
      payload = %{"input" => text, "model" => "text-embedding-ada-002"}
      json_payload = Jason.encode!(payload)

      case HTTPoison.post(
             "https://api.openai.com/v1/embeddings",
             json_payload,
             headers,
             @config.http_options
           ) do
        {:ok, %HTTPoison.Response{body: body}} ->
          case Jason.decode(body) do
            {:ok, data} ->
              items = data["data"] || []
              item = List.first(items) || %{}
              embedding = Map.get(item, "embedding", [])
              total_tokens = Map.get(data["usage"], "total_tokens", 0)
              %{"embedding" => embedding, "total_tokens" => total_tokens}

            {:error, _} ->
              %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
          end

        {:error, _} ->
          %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
      end
    else
      %{"embedding" => List.duplicate(0, 1536), "total_tokens" => 0}
    end
  end

  defp get_ollama_embeddings(prompt) do
    url = System.get_env("OLLAMA_BASE_URL")
    api_key = System.get_env("OLLAMA_API_KEY")

    headers = [{"Content-Type", "application/json"}, {"Authorization", "Bearer #{api_key}"}]
    body = Jason.encode!(%{model: "snowflake-arctic-embed:335m", prompt: prompt})

    case HTTPoison.post("#{url}/api/embeddings", body, headers, @config.http_options) do
      {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
        Jason.decode!(response_body)

      {:ok, %HTTPoison.Response{status_code: _status_code, body: _response_body}} ->
        %{}

      {:error, _} ->
        %{}
    end
  end

  defp ensure_all_columns(frontmatter) do
    Map.merge(Enum.into(@allowed_frontmatter, %{}, fn {key, _} -> {key, nil} end), frontmatter)
  end

  defp transform_value(nil, _key), do: "NULL"

  defp transform_value(value, key) do
    case key do
      "embeddings_openai" -> serialize_array(value)
      "embeddings_spr_custom" -> serialize_array(value)
      "tags" -> serialize_list(value)
      "authors" -> serialize_list(value)
      "aliases" -> serialize_list(value)
      "md_content" -> escape_multiline_text(value)
      _ -> default_transform_value(value)
    end
  end

  defp default_transform_value({a, b}), do: "'{#{to_string(a)},#{to_string(b)}}'"

  defp default_transform_value(value) when is_list(value),
    do: "'#{Jason.encode!(Enum.reject(value, &(&1 == "" or &1 == nil)))}'"

  defp default_transform_value(value) when is_binary(value),
    do: "'#{String.replace(value, "'", "''")}'"

  defp default_transform_value(value) when is_boolean(value),
    do: if(value, do: "true", else: "false")

  defp default_transform_value(value) when is_number(value), do: to_string(value)
  defp default_transform_value(value) when is_map(value), do: "'#{Jason.encode!(value)}'"
  defp default_transform_value(_value), do: "NULL"

  defp serialize_array(array) when is_list(array), do: "[#{Enum.join(array, ", ")}]"

  defp serialize_list(list) do
    cleaned_list = Enum.reject(list, &(&1 == "" or &1 == nil))

    if cleaned_list == [],
      do: "NULL",
      else:
        Enum.map(cleaned_list, &"'#{String.replace(&1, "'", "''")}'")
        |> Enum.join(", ")
        |> (&"[#{&1}]").()
  end

  defp escape_string(value) when is_binary(value) do
    String.replace(value, "'", "''")
  end

  defp escape_multiline_text(text) do
    text
    # Escape single quotes
    |> String.replace("'", "''")
    # Escape newline characters
    |> String.replace("\n", "\\n")
    # Wrap in single quotes
    |> (&"'#{&1}'").()
  end

  defp prepare_data(keys, frontmatter) do
    Enum.map(keys, fn key -> transform_value(Map.get(frontmatter, key), key) end)
  end

  defp add_to_database(frontmatter) do
    keys = @allowed_frontmatter |> Enum.map(&elem(&1, 0))

    frontmatter = ensure_all_columns(frontmatter)
    prepared_values = prepare_data(keys, frontmatter)

    file_path = Map.get(frontmatter, "file_path")
    escaped_file_path = escape_string(file_path)

    # Fetch existing data
    select_query = "SELECT * FROM vault WHERE file_path = '#{escaped_file_path}'"
    case duckdb_cmd(select_query) do
      {:ok, [existing_data]} ->
        if data_changed?(existing_data, frontmatter) do
          perform_upsert(escaped_file_path, keys, prepared_values, frontmatter)
        else
          IO.puts("No changes detected for file: #{escaped_file_path}")
        end

      {:ok, []} ->
        # If no existing data is retrieved, proceed with the insert
        perform_upsert(escaped_file_path, keys, prepared_values, frontmatter)

      {:error, error_message} ->
        IO.puts("Failed to fetch existing entry for file: #{escaped_file_path}")
        IO.puts("Error: #{inspect(error_message)}")
    end
  end

  defp data_changed?(existing_data, frontmatter) do
    Enum.any?(@allowed_frontmatter, fn {key, _} ->
      Map.get(existing_data, key) != Map.get(frontmatter, key)
    end)
  end

  defp perform_upsert(file_path, keys, prepared_values, frontmatter) do
    delete_query = "DELETE FROM vault WHERE file_path = '#{file_path}'"
    insert_query = """
    INSERT INTO vault (#{Enum.join(keys, ", ")}) VALUES (#{Enum.join(prepared_values, ", ")})
    """

    # Execute the delete query first
    case duckdb_cmd(delete_query) do
      {:ok, _result} ->
        # Execute the insert query next
        case duckdb_cmd(insert_query) do
          {:ok, _result} ->
            IO.puts("Upsert succeeded for file: #{frontmatter["file_path"]}")

          {:error, error_message} ->
            IO.puts("Upsert failed for file: #{frontmatter["file_path"]}")
            IO.puts("Error: #{inspect(error_message)}")
        end

      {:error, error_message} ->
        IO.puts("Failed to delete existing entry for file: #{frontmatter["file_path"]}")
        IO.puts("Error: #{inspect(error_message)}")
    end
  end

  defp remove_old_files(paths) do
    if paths != [] do
      query =
        "DELETE FROM vault WHERE file_path NOT IN (#{Enum.join(Enum.map(paths, fn _ -> "?" end), ", ")})"

      duckdb_cmd(query) |> handle_result()
    end
  end

  defp handle_result({:ok, _result}), do: :ok
  defp handle_result({:error, _error}), do: :error
end

MarkdownExportDuckDB.main(System.argv())
