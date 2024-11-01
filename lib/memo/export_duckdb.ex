defmodule Memo.ExportDuckDB do
  @moduledoc """
  A module to process markdown files and store their information in DuckDB.
  """

  use Flow
  alias Memo.Common.{FileUtils, Frontmatter, GitUtils, DuckDBUtils, AIUtils}

  @allowed_frontmatter [
    {"file_path", "TEXT UNIQUE"},
    {"md_content", "TEXT"},
    {"spr_content", "TEXT"},
    {"embeddings_openai", "FLOAT[1536]"},
    {"embeddings_spr_custom", "FLOAT[1024]"},
    {"title", "VARCHAR"},
    {"short_title", "VARCHAR"},
    {"description", "VARCHAR"},
    {"tags", "VARCHAR[]"},
    {"authors", "VARCHAR[]"},
    {"date", "DATE"},
    {"pinned", "BOOLEAN"},
    {"hide_frontmatter", "BOOLEAN"},
    {"hide_title", "BOOLEAN"},
    {"hide_on_sidebar", "BOOLEAN"},
    {"hiring", "BOOLEAN"},
    {"featured", "BOOLEAN"},
    {"draft", "BOOLEAN"},
    {"social", "TEXT[]"},
    {"github", "VARCHAR"},
    {"website", "VARCHAR"},
    {"avatar", "VARCHAR"},
    {"discord_id", "VARCHAR"},
    {"aliases", "VARCHAR[]"},
    {"icy", "DOUBLE"},
    {"bounty", "DOUBLE"},
    {"PICs", "TEXT[]"},
    {"status", "TEXT"},
    {"function", "TEXT"},
    {"estimated_tokens", "BIGINT"},
    {"total_tokens", "BIGINT"}
  ]

  def run(vaultpath, format, commits_back) do
    load_env()

    vaultpath = vaultpath || "vault"
    export_format = format || "parquet"
    commits_back = parse_commits_back(commits_back)

    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))

    paths = FileUtils.list_files_recursive(vaultpath)

    all_files =
      Enum.filter(
        Enum.split_with(paths, &File.regular?/1) |> elem(0),
        &String.ends_with?(&1, ".md")
      )

    all_files_to_process =
      Enum.filter(all_files, &(not FileUtils.ignored?(&1, ignored_patterns, vaultpath)))

    filtered_files = get_files_to_process(vaultpath, commits_back, all_files_to_process)

    IO.inspect(filtered_files)

    case DuckDBUtils.execute_query("SELECT 1") do
      {:ok, _} ->
        with :ok <- install_and_load_extensions(),
             :ok <- setup_database() do
          process_files(filtered_files, vaultpath, all_files_to_process)
          export(export_format)
        else
          :error -> IO.puts("Failed to set up DuckDB")
        end

      {:error, reason} ->
        IO.puts("Failed to connect to DuckDB: #{reason}")
    end
  end

  defp parse_commits_back(:all), do: :all
  defp parse_commits_back("HEAD~" <> n), do: "HEAD~#{n}"
  defp parse_commits_back(_), do: "HEAD^"

  defp load_env do
    if File.exists?(".env"), do: DotenvParser.load_file(".env")
  end

  defp install_and_load_extensions() do
    DuckDBUtils.execute_query("INSTALL parquet") |> handle_result()
    DuckDBUtils.execute_query("LOAD parquet") |> handle_result()
  end

  defp setup_database() do
    check_query = "SELECT table_name FROM information_schema.tables WHERE table_name = 'vault'"

    case DuckDBUtils.execute_query(check_query) do
      {:ok, []} ->
        case DuckDBUtils.execute_query("IMPORT DATABASE 'db'") do
          {:ok, _} ->
            IO.puts("Successfully imported database from 'db' directory.")
            merge_columns()

          {:error, error} ->
            IO.puts("Failed to import database: #{error}")
            create_vault_table()
        end

      {:ok, _} ->
        merge_columns()

      {:error, error} ->
        IO.puts("Error checking for vault table: #{error}")
        create_vault_table()
    end
  end

  defp create_vault_table() do
    columns =
      @allowed_frontmatter
      |> Enum.map(fn {name, type} -> "#{name} #{type}" end)
      |> Enum.join(", ")

    query = """
      CREATE TABLE IF NOT EXISTS vault (
        #{columns}
      )
    """

    case DuckDBUtils.execute_query(query) do
      {:ok, _} ->
        IO.puts("Created vault table.")
        :ok

      {:error, error} ->
        IO.puts("Failed to create vault table: #{error}")
        :error
    end
  end

  defp merge_columns() do
    existing_columns_query = """
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'vault'
    """

    case DuckDBUtils.execute_query(existing_columns_query) do
      {:ok, existing_columns} ->
        existing_column_names =
          Enum.map(existing_columns, fn %{"column_name" => name} -> String.downcase(name) end)

        allowed_column_names =
          Enum.map(@allowed_frontmatter, fn {name, _} -> String.downcase(name) end)

        columns_to_add =
          Enum.filter(@allowed_frontmatter, fn {name, _} ->
            String.downcase(name) not in existing_column_names
          end)

        columns_to_remove =
          Enum.filter(existing_column_names, fn name ->
            name not in allowed_column_names
          end)

        # Add new columns
        Enum.each(columns_to_add, fn {name, type} ->
          add_column_query = "ALTER TABLE vault ADD COLUMN #{name} #{type}"

          case DuckDBUtils.execute_query(add_column_query) do
            {:ok, _} -> IO.puts("Added new column: #{name}")
            {:error, error} -> IO.puts("Failed to add column #{name}: #{error}")
          end
        end)

        # Remove old columns
        Enum.each(columns_to_remove, fn name ->
          remove_column_query = "ALTER TABLE vault DROP COLUMN #{name}"

          case DuckDBUtils.execute_query(remove_column_query) do
            {:ok, _} -> IO.puts("Removed column: #{name}")
            {:error, error} -> IO.puts("Failed to remove column #{name}: #{error}")
          end
        end)

      {:error, error} ->
        IO.puts("Failed to fetch existing columns: #{error}")
    end
  end

  defp export(format) do
    case format do
      "csv" ->
        response = DuckDBUtils.execute_query("EXPORT DATABASE 'db'")
        clean_exported_schema("db/schema.sql")
        response

      "parquet" ->
        response = DuckDBUtils.execute_query("EXPORT DATABASE 'db' (FORMAT PARQUET)")
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
        |> Enum.reject(
          &(&1 in ["CREATE SCHEMA information_schema;", "CREATE SCHEMA pg_catalog;"])
        )
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
          case Frontmatter.extract_frontmatter(content) do
            {:error, :no_frontmatter} ->
              nil

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

    normalized_frontmatter = frontmatter
    |> Map.update("tags", [], fn tags ->
      case tags do
        tags when is_binary(tags) ->
          if String.contains?(tags, ",") do
            tags
            |> String.split(",")
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&(&1 in ["", nil]))
          else
            [tags]
          end
        list when is_list(list) -> list
        _ -> []
      end
    end)

    query = "SELECT spr_content, md_content, embeddings_openai, embeddings_spr_custom FROM vault WHERE file_path = '#{escaped_file_path}'"

    case DuckDBUtils.execute_query(query) do
      {:ok, result} ->
        existing_data = List.first(result) || []
        transformed_frontmatter = transform_frontmatter(md_content, normalized_frontmatter, escaped_file_path)
        maybe_update_database(existing_data, transformed_frontmatter, md_content)

      {:error, error_message} ->
        IO.puts("Query failed: #{inspect(error_message)}")
    end
  end

  defp maybe_update_database(existing_data, frontmatter, md_content) do
    case existing_data do
      [] ->
        insert_or_update_new_document(frontmatter, md_content)

      _ ->
        if escape_multiline_text(existing_data["md_content"]) != escape_multiline_text(md_content) or
             is_nil(existing_data["spr_content"]) or
             is_nil(existing_data["embeddings_openai"]) or
             is_nil(existing_data["embeddings_spr_custom"]) do
          insert_or_update_new_document(frontmatter, md_content)
        else
          use_existing_embeddings(existing_data, frontmatter)
        end
    end
  end

  defp insert_or_update_new_document(frontmatter, md_content) do
    updated_frontmatter = regenerate_embeddings(md_content, frontmatter)
    add_to_database(updated_frontmatter)
  end

  defp use_existing_embeddings(existing_data, frontmatter) do
    updated_frontmatter =
      Map.merge(frontmatter, %{
        "spr_content" => existing_data["spr_content"],
        "embeddings_openai" => existing_data["embeddings_openai"],
        "embeddings_spr_custom" => existing_data["embeddings_spr_custom"]
      })

    add_to_database(updated_frontmatter)
  end

  defp get_files_to_process(directory, commits_back, all_files) do
    case commits_back do
      :all ->
        all_files

      _ ->
        git_files = GitUtils.get_modified_files(directory, commits_back)

        submodule_files =
          GitUtils.list_submodules(directory)
          |> Enum.flat_map(&GitUtils.get_submodule_modified_files(directory, &1, commits_back))

        all_git_files = git_files ++ submodule_files

        Enum.map(all_git_files, fn file -> Path.join(directory, file) end)
    end
  end

  defp regenerate_embeddings(md_content, frontmatter) do
    spr_content = AIUtils.spr_compress(md_content)
    estimated_tokens = div(String.length(md_content), 4)

    custom_embedding = AIUtils.embed_custom(spr_content)

    openai_embedding =
      if estimated_tokens <= 7500 do
        AIUtils.embed_openai(md_content)
      else
        %{"embedding" => List.duplicate(0, 1536)}
      end

    frontmatter
    |> Map.put("spr_content", spr_content)
    |> Map.put("embeddings_spr_custom", custom_embedding["embedding"])
    |> Map.put("embeddings_openai", openai_embedding["embedding"])
    |> Map.put("estimated_tokens", estimated_tokens)
    |> (fn fm ->
          IO.inspect(custom_embedding)
          IO.inspect(openai_embedding)
          fm
        end).()
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
      "estimated_tokens" -> to_string(value)
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

  defp serialize_array(array) when is_list(array) do
    "[#{Enum.join(array, ", ")}]"
  end

  defp serialize_array(array) when is_binary(array) do
    case Jason.decode(array) do
      {:ok, decoded} when is_list(decoded) -> serialize_array(decoded)
      _ -> "[]"
    end
  end

  defp serialize_list(list) do
    normalized = case list do
      val when is_binary(val) -> [val]  # Handle single string value
      list when is_list(list) ->
        Enum.reject(list, &(&1 in ["", nil]))
      _ -> []
    end

    case normalized do
      [] ->
        "NULL"
      cleaned_list ->
        cleaned_list
        |> Enum.map(&"'#{String.replace(&1, "'", "''")}'")
        |> Enum.join(", ")
        |> (&"[#{&1}]").()
    end
  end

  defp escape_string(value) when is_binary(value) do
    String.replace(value, "'", "''")
  end

  defp escape_multiline_text(nil), do: "NULL"

  defp escape_multiline_text(text) when is_binary(text) do
    text
    |> String.trim()
    |> String.replace("'", "''")
    |> String.replace("\n", "\\n")
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

    with {:ok, [existing_data]} <-
           DuckDBUtils.execute_query(
             "SELECT * FROM vault WHERE file_path = '#{file_path}'"
           ),
         true <- data_changed?(existing_data, frontmatter) do
      perform_upsert(file_path, keys, prepared_values, frontmatter)
    else
      {:ok, []} ->
        perform_upsert(file_path, keys, prepared_values, frontmatter)

      false ->
        IO.puts("No changes detected for file: #{file_path}")

      {:error, error_message} ->
        IO.puts("Failed to fetch existing entry for file: #{file_path}")
        IO.puts("Error: #{inspect(error_message)}")
    end
  end

  defp data_changed?(existing_data, frontmatter) do
    Enum.any?(@allowed_frontmatter, fn {key, _type} ->
      existing_value = Map.get(existing_data, key)
      new_value = Map.get(frontmatter, key)

      # Normalize both values for comparison
      normalized_existing = normalize_for_comparison(existing_value, key)
      normalized_new = normalize_for_comparison(new_value, key)

      if normalized_existing != normalized_new do
        # For debugging, show the normalized values
        IO.puts("Change detected in #{key}:")
        IO.puts("  Existing (normalized): #{inspect(normalized_existing)}")
        IO.puts("  New (normalized): #{inspect(normalized_new)}")
        true
      else
        false
      end
    end)
  end

  defp normalize_for_comparison(nil, key) do
    type = Enum.find(@allowed_frontmatter, fn {k, _} -> k == key end) |> elem(1)
    if is_array_type?(type), do: [], else: nil
  end

  defp normalize_for_comparison(value, key) do
    type = Enum.find(@allowed_frontmatter, fn {k, _} -> k == key end) |> elem(1)

    cond do
      is_array_type?(type) -> normalize_array_value(value)
      String.contains?(type, "BOOLEAN") -> normalize_boolean(value)
      String.contains?(type, ["DOUBLE", "FLOAT", "INT", "BIGINT"]) -> normalize_number(value)
      true -> normalize_text(value)
    end
  end

  defp normalize_boolean(value) do
    case value do
      val when is_boolean(val) -> val
      "true" -> true
      "TRUE" -> true
      "True" -> true
      "false" -> false
      "FALSE" -> false
      "False" -> false
      _ -> false
    end
  end

  defp normalize_number(value) do
    case value do
      val when is_number(val) -> val
      val when is_binary(val) ->
        case Float.parse(val) do
          {num, ""} -> num
          _ -> nil
        end
      _ -> nil
    end
  end

  defp normalize_array_value(value) do
    case value do
      nil -> []
      val when is_list(val) ->
        val
        |> Enum.reject(&(&1 in ["", nil]))
        |> Enum.sort()
      val when is_binary(val) ->
        cond do
          # Handle DuckDB array format
          String.starts_with?(val, "[") && String.ends_with?(val, "]") ->
            val
            |> String.slice(1..-2//1)
            |> String.split(",")
            |> Enum.map(&String.trim/1)
            |> Enum.map(fn x ->
              x |> String.trim("'") |> String.trim("\"")
            end)
            |> Enum.reject(&(&1 in ["", nil]))
          # Handle comma-separated string format
          String.contains?(val, ",") ->
            val
            |> String.split(",")
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&(&1 in ["", nil]))
          String.trim(val) == "" -> []
          true -> [val]
        end
      _ -> []
    end |> Enum.sort()
  end

  defp is_array_type?(type), do: String.contains?(type, "[]") or String.contains?(type, "ARRAY")

  defp normalize_text(value) when is_binary(value) do
    value
    |> String.trim()
    # Normalize Windows line endings
    |> String.replace(~r/\r\n/, "\n")
    # Convert escaped newlines
    |> String.replace(~r/\\n/, "\n")
    # Collapse multiple blank lines
    |> String.replace(~r/\n{3,}/, "\n\n")
    # Collapse multiple spaces
    |> String.replace(~r/ +/, " ")
    # Unescape pipes in markdown tables/images
    |> String.replace(~r/\\\|/, "|")
    # Unescape markdown special chars
    |> String.replace(~r/\\([\\`*_{}[\]()#+\-.!])/, "\\1")
  end

  defp normalize_text(_), do: ""

  defp normalize_default(value) when is_binary(value) do
    trimmed = String.trim(value)
    # Unescape single quotes before comparison
    unescaped = String.replace(trimmed, "''", "'")
    cond do
      unescaped in ["true", "TRUE", "True"] -> true
      unescaped in ["false", "FALSE", "False"] -> false
      match?({_num, ""}, Float.parse(unescaped)) ->
        {num, _} = Float.parse(unescaped)
        if floor(num) == num, do: floor(num), else: num
      true -> unescaped
    end
  end
  defp normalize_default(value) when is_boolean(value), do: value
  defp normalize_default(value) when is_number(value), do: value
  defp normalize_default(value) when is_map(value), do: Jason.encode!(value)
  defp normalize_default(_), do: nil

  defp perform_upsert(escaped_file_path, keys, prepared_values, frontmatter) do
    delete_query = "DELETE FROM vault WHERE file_path = '#{escaped_file_path}'"

    insert_query = """
    INSERT INTO vault (#{Enum.join(keys, ", ")}) VALUES (#{Enum.join(prepared_values, ", ")})
    """

    with {:ok, _} <- DuckDBUtils.execute_query(delete_query),
         {:ok, _} <- DuckDBUtils.execute_query(insert_query) do
      IO.puts("Upsert succeeded for file: #{frontmatter["file_path"]}")
    else
      {:error, error_message} ->
        IO.puts("Upsert failed for file: #{frontmatter["file_path"]}")
        IO.puts("Error: #{inspect(error_message)}")
    end
  end

  defp remove_old_files(paths) do
    if paths != [] do
      escaped_paths = Enum.map(paths, &"'#{escape_string(&1)}'")
      query = "DELETE FROM vault WHERE file_path NOT IN (#{Enum.join(escaped_paths, ", ")})"

      DuckDBUtils.execute_query(query) |> handle_result()
    end
  end

  defp handle_result({:ok, _result}), do: :ok
  defp handle_result({:error, _error}), do: :error

  defp transform_frontmatter(md_content, frontmatter, file_path) when is_map(frontmatter) do
    estimated_tokens = div(String.length(md_content), 4)

    # Get all array columns from @allowed_frontmatter
    array_columns = @allowed_frontmatter
    |> Enum.filter(fn {_key, type} -> is_array_type?(type) end)
    |> Enum.map(&elem(&1, 0))

    # Pre-normalize certain fields before taking, with safe access
    normalized_frontmatter = frontmatter
    |> Map.put("estimated_tokens", estimated_tokens)
    |> then(fn map ->
      Enum.reduce(array_columns, map, fn key, acc ->
        Map.update(acc, key, [], &normalize_array_value/1)
      end)
    end)

    allowed_keys = @allowed_frontmatter |> Enum.map(&elem(&1, 0))

    normalized_frontmatter
    |> Map.take(allowed_keys)
    |> Map.merge(%{"file_path" => file_path, "md_content" => md_content})
  end

  defp normalize_value(key, value) do
    type = Enum.find(@allowed_frontmatter, fn {k, _} -> k == key end) |> elem(1)
    if is_array_type?(type), do: normalize_array_value(value), else: value
  end
end
