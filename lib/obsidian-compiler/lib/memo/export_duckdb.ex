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
    {"total_tokens", "BIGINT"},
    {"should_deploy_perma_storage", "BOOLEAN"},
    {"perma_storage_id", "VARCHAR"},
    {"should_mint", "BOOLEAN"},
    {"minted_at", "DATE"},
    {"token_id", "VARCHAR"},
    {"previous_paths", "VARCHAR[]"},
    {"ai_summary", "BOOLEAN"},
    {"ai_generated_summary", "VARCHAR[]"}
  ]

  def run(vaultpath, format, commits_back, pattern \\ nil) do
    load_env()

    vaultpath = vaultpath || "vault"
    export_format = format || "parquet"
    commits_back = parse_commits_back(commits_back)
    pattern = pattern || "**/*.md"

    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))

    paths = FileUtils.list_files_recursive(vaultpath)

    all_files =
      Enum.filter(
        Enum.split_with(paths, &File.regular?/1) |> elem(0),
        &String.ends_with?(&1, ".md")
      )

    all_files_to_process =
      all_files
      |> Enum.filter(&(not FileUtils.ignored?(&1, ignored_patterns, vaultpath)))

    filtered_files = get_files_to_process(vaultpath, commits_back, all_files_to_process, pattern)

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

  # Ensures the vault table is dropped, created, and loaded from Parquet.
  defp setup_database() do
    IO.puts("Ensuring clean 'vault' table state...")

    # 1. Attempt to drop the table (ignore errors if it doesn't exist)
    drop_query = "DROP TABLE IF EXISTS vault"
    case DuckDBUtils.execute_query(drop_query) do
      {:ok, _} -> IO.puts("Existing 'vault' table dropped (or did not exist).")
      {:error, drop_error} ->
        IO.puts("Warning: Failed to drop 'vault' table: #{drop_error}. Proceeding...")
        # Don't stop here, still try to create and load
    end

    # 2. Create the table using the schema definition
    IO.puts("Creating 'vault' table...")
    create_result = create_vault_table() # Use the existing helper function

    if create_result == :ok do
      # 2.5 Merge columns to sync schema with allowed frontmatter
      IO.puts("Merging columns to sync schema...")
      merge_columns()

      # 3. Load data directly from the Parquet file using explicit column mapping
      # This avoids column count mismatch errors by selecting only matching columns
      # Dynamically generate column list from @allowed_frontmatter
      columns = @allowed_frontmatter |> Enum.map(&elem(&1, 0)) |> Enum.join(", ")

      load_query = """
      INSERT INTO vault (#{columns})
      SELECT #{columns}
      FROM read_parquet('../../db/vault.parquet')
      """
      IO.puts("Loading data from '../../db/vault.parquet' with programmatic column mapping...")
      case DuckDBUtils.execute_query(load_query) do
        {:ok, _} ->
          IO.puts("Data loaded successfully from Parquet file with programmatic column mapping.")
          # 4. Verify row count after programmatic load
          count_query = "SELECT COUNT(*) as count FROM vault"
          case DuckDBUtils.execute_query(count_query) do
             {:ok, [%{"count" => count}]} when count > 0 ->
               IO.puts("Verification successful: Found #{count} rows after explicit insert.")
               :ok # Signal success for the `with` statement in run/4
             {:ok, [%{"count" => count}]} ->
               IO.puts("Error: Insert succeeded but table has #{count} rows. Data load failed.")
               :error
             {:ok, other_result} ->
               IO.puts("Error: Unexpected count query result after insert: #{inspect(other_result)}.")
               :error
             {:error, count_error} ->
               IO.puts("Error: Failed to count rows after insert: #{count_error}.")
               :error
          end
        {:error, load_error} ->
          IO.puts("Error: Failed to load data using explicit insert: #{load_error}.")
          :error
      end
    else
      # create_vault_table already logged the error
      IO.puts("setup_database failed because table creation failed.")
      :error
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
        response = DuckDBUtils.execute_query("EXPORT DATABASE '../../db'")
        clean_exported_schema("../../db/schema.sql")
        response

      "parquet" ->
        response = DuckDBUtils.execute_query("EXPORT DATABASE '../../db' (FORMAT PARQUET)")
        clean_exported_schema("../../db/schema.sql")
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

  defp pre_fetch_existing_data(file_paths) do
    if Enum.empty?(file_paths) do
      %{}
    else
      case DuckDBUtils.execute_query("SELECT file_path, spr_content, md_content, embeddings_openai, embeddings_spr_custom FROM vault") do
        {:ok, results} ->
          # Convert file_paths list to MapSet for efficient lookup
          file_paths_set = MapSet.new(file_paths)
          filtered_results =
            Enum.filter(results, fn row ->
              # Normalize DB file_path to match relative paths (trim vault prefix)
              norm_path =
                row["file_path"]
                |> String.trim_leading("vault/")
                |> String.trim_leading("/")
              MapSet.member?(file_paths_set, norm_path)
            end)
          Enum.reduce(filtered_results, %{}, fn row, acc ->
            norm_path =
              row["file_path"]
              |> String.trim_leading("vault/")
              |> String.trim_leading("/")
            Map.put(acc, norm_path, row)
          end)
        {:error, error} ->
          IO.puts("Failed to pre-fetch existing data: #{error}")
          %{}
      end
    end
  end

  defp process_files(files, vaultpath, all_files_to_process) do
    vault_abs = Path.expand(vaultpath)
    relative_paths =
      files
      |> Enum.map(&Path.expand/1)
      |> Enum.map(&Path.relative_to(&1, vault_abs))

    existing_data_map = pre_fetch_existing_data(relative_paths)

    # Step 1: Parallel file reading, parsing, and embedding generation (NO DB access)
    processed_data =
      files
      |> Flow.from_enumerable()
      |> Flow.partition()
      |> Flow.map(fn file_path ->
        file_abs = Path.expand(file_path)
        relative_path = Path.relative_to(file_abs, vault_abs)
        case File.read(file_path) do
          {:ok, content} ->
            case Frontmatter.extract_frontmatter(content) do
              {:error, :no_frontmatter} ->
                nil
              {frontmatter, md_content} when is_map(frontmatter) ->
                # Only normalize and embed, do not call transform_frontmatter or any DB code
                normalized_frontmatter =
                  frontmatter
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

                      list when is_list(list) ->
                        list

                      _ ->
                        []
                    end
                  end)

                existing_data = Map.get(existing_data_map, relative_path, %{})

                embeddings_updated = needs_embeddings_update(existing_data, md_content)
                {new_spr_content, new_embeddings_openai, new_embeddings_spr_custom, updated_frontmatter} =
                  if embeddings_updated do
                    regenerated = regenerate_embeddings(relative_path, md_content, normalized_frontmatter)
                    {
                      Map.get(regenerated, "spr_content"),
                      Map.get(regenerated, "embeddings_openai"),
                      Map.get(regenerated, "embeddings_spr_custom"),
                      regenerated
                    }
                  else
                    # When embeddings are NOT updated, use existing data for embeddings and spr_content
                    existing_embeddings_and_spr = %{
                       "spr_content" => existing_data["spr_content"],
                       "embeddings_openai" => existing_data["embeddings_openai"],
                       "embeddings_spr_custom" => existing_data["embeddings_spr_custom"]
                    }
                    {
                      existing_data["spr_content"],
                      existing_data["embeddings_openai"],
                      existing_data["embeddings_spr_custom"],
                      # Merge existing embeddings and spr_content into the normalized frontmatter
                      Map.merge(normalized_frontmatter, existing_embeddings_and_spr)
                    }
                  end
                %{
                  file_path: relative_path,
                  md_content: md_content,
                  frontmatter: updated_frontmatter, # This now contains either new or old embeddings/spr_content
                  embeddings_updated: embeddings_updated,
                  new_spr_content: new_spr_content,
                  new_embeddings_openai: new_embeddings_openai,
                  new_embeddings_spr_custom: new_embeddings_spr_custom
                }
              {frontmatter, _md_content} ->
                IO.puts(
                  "Error: Expected frontmatter to be a map for file: #{relative_path}, but got: #{inspect(frontmatter)}"
                )
                nil
            end
          {:error, reason} ->
            IO.puts("Failed to read file: #{relative_path}, Reason: #{reason}")
            nil
        end
      end)
      |> Enum.to_list()
      |> Enum.filter(& &1)

    # Step 2: After parallel processing, open a single DB connection for all DB work
    # Fetch all previous_paths for all files in a single query
    file_paths = Enum.map(processed_data, & &1.file_path)
    previous_paths_map = fetch_all_previous_paths(file_paths)

    # Step 3: Merge previous_paths and prepare final records, keeping the original structure and flags
    final_data =
      Enum.map(processed_data, fn %{file_path: file_path, md_content: md_content, frontmatter: frontmatter, embeddings_updated: embeddings_updated, new_spr_content: new_spr_content, new_embeddings_openai: new_embeddings_openai, new_embeddings_spr_custom: new_embeddings_spr_custom} ->
        merged_frontmatter =
          transform_frontmatter_no_db(md_content, frontmatter, file_path, previous_paths_map)
        %{
          file_path: file_path,
          md_content: md_content,
          frontmatter: merged_frontmatter,
          embeddings_updated: embeddings_updated,
          new_spr_content: new_spr_content,
          new_embeddings_openai: new_embeddings_openai,
          new_embeddings_spr_custom: new_embeddings_spr_custom
        }
      end)

    # Step 4: Batch upsert all records
    batch_upsert_into_duckdb(final_data)

    paths = Enum.map(all_files_to_process, &Path.relative_to(&1, vaultpath))
    remove_old_files(paths)
  end
  defp fetch_all_previous_paths(file_paths) do
    if Enum.empty?(file_paths) do
      %{}
    else
      escaped_paths = Enum.map(file_paths, &"'#{escape_string(&1)}'")
      query = """
      SELECT file_path, previous_paths FROM vault
      WHERE file_path IN (#{Enum.join(escaped_paths, ", ")})
      """
      case DuckDBUtils.execute_query(query) do
        {:ok, results} ->
          Enum.reduce(results, %{}, fn row, acc ->
            Map.put(acc, row["file_path"], normalize_array_value(row["previous_paths"]))
          end)
        {:error, _} -> %{}
      end
    end
  end

  defp transform_frontmatter_no_db(md_content, frontmatter, file_path, previous_paths_map) do
    estimated_tokens = div(String.length(md_content), 4)

    array_columns =
      @allowed_frontmatter
      |> Enum.filter(fn {_key, type} -> is_array_type?(type) end)
      |> Enum.map(&elem(&1, 0))

    normalized_frontmatter =
      frontmatter
      |> Map.put("estimated_tokens", estimated_tokens)
      |> then(fn map ->
        Enum.reduce(array_columns, map, fn key, acc ->
          Map.update(acc, key, [], &normalize_array_value/1)
        end)
      end)

    new_previous_paths = GitUtils.get_previous_paths(file_path)
    existing_paths_list = Map.get(previous_paths_map, file_path, [])

    merged_paths = Enum.uniq(existing_paths_list ++ new_previous_paths)
    frontmatter_with_history = Map.put(normalized_frontmatter, "previous_paths", merged_paths)

    allowed_keys = @allowed_frontmatter |> Enum.map(&elem(&1, 0))

    frontmatter_with_history
    |> Map.take(allowed_keys)
    |> Map.merge(%{"file_path" => file_path, "md_content" => md_content})
  end

  defp batch_upsert_into_duckdb(processed_data) do
    batch_size = 100
    keys = @allowed_frontmatter |> Enum.map(&elem(&1, 0))

    processed_data
    |> Enum.chunk_every(batch_size)
    |> Enum.each(fn batch ->
      # Split batch based on the embeddings_updated flag determined in process_files
      {batch_with_embeddings, batch_without_embeddings} =
        Enum.split_with(batch, fn data ->
          data.embeddings_updated
        end)

      # Define keys for each batch type
      keys_with_embeddings = keys

      # Process batch with embeddings updates
      if Enum.count(batch_with_embeddings) > 0 do
        values_str_with_embeddings =
          batch_with_embeddings
          |> Enum.map(fn data ->
            frontmatter = ensure_all_columns(data.frontmatter)
            prepared_values = prepare_data(keys_with_embeddings, frontmatter)
            "(" <> Enum.join(prepared_values, ", ") <> ")"
          end)
          |> Enum.join(", ")

        update_clause_with_embeddings =
          keys_with_embeddings
          |> Enum.filter(&(&1 != "file_path"))
          |> Enum.map(&("#{&1} = EXCLUDED.#{&1}"))
          |> Enum.join(", ")

        upsert_query_with_embeddings = """
        INSERT INTO vault (#{Enum.join(keys_with_embeddings, ", ")})
        VALUES #{values_str_with_embeddings}
        ON CONFLICT (file_path)
        DO UPDATE SET #{update_clause_with_embeddings}
        """

        case DuckDBUtils.execute_query(upsert_query_with_embeddings) do
          {:ok, _} ->
            IO.puts("Batch upsert successful for #{length(batch_with_embeddings)} records with embeddings update")
          {:error, error} ->
            IO.puts("Batch upsert failed for records with embeddings update: #{inspect(error)}")
        end
      end

      # Process batch without embeddings updates (NEW APPROACH)
      if Enum.count(batch_without_embeddings) > 0 do
        file_paths_without_embeddings = Enum.map(batch_without_embeddings, & &1.file_path)

        # Query database to check which files already exist
        existing_files_query = """
        SELECT file_path FROM vault WHERE file_path IN (#{Enum.join(Enum.map(file_paths_without_embeddings, &"'#{escape_string(&1)}'"), ", ")})
        """
        case DuckDBUtils.execute_query(existing_files_query) do
          {:ok, existing_results} ->
            existing_file_paths = Enum.map(existing_results, & &1["file_path"])
            existing_file_paths_set = MapSet.new(existing_file_paths)

            # Split batch_without_embeddings into existing and new
            {batch_existing, batch_new} =
              Enum.split_with(batch_without_embeddings, fn data ->
                MapSet.member?(existing_file_paths_set, data.file_path)
              end)

            # For batch_new, use a simple INSERT
            if Enum.count(batch_new) > 0 do
              keys_for_insert_new = keys # Use all keys for new inserts

              values_str_new =
                batch_new
                |> Enum.map(fn data ->
                  frontmatter = ensure_all_columns(data.frontmatter)
                  prepared_values = prepare_data(keys_for_insert_new, frontmatter)
                  "(" <> Enum.join(prepared_values, ", ") <> ")"
                end)
                |> Enum.join(", ")

              insert_query_new = """
              INSERT INTO vault (#{Enum.join(keys_for_insert_new, ", ")})
              VALUES #{values_str_new}
              """
              case DuckDBUtils.execute_query(insert_query_new) do
                {:ok, _} ->
                  IO.puts("Batch insert successful for #{length(batch_new)} new records without embeddings update")
                {:error, error} ->
                  IO.puts("Batch insert failed for new records without embeddings update: #{inspect(error)}")
              end
            end

            # For batch_existing, do nothing (embeddings are preserved)
            if Enum.count(batch_existing) > 0 do
              IO.puts("Skipping upsert for #{length(batch_existing)} existing records without embeddings update (preserving existing data)")
            end

          {:error, error} ->
            IO.puts("Failed to check for existing files in batch without embeddings update: #{inspect(error)}")
            # Fallback: if we can't check for existing, use the original upsert logic as a safeguard
             # Define keys for the fallback insert
            keys_for_fallback_insert = keys # Use all keys for fallback insert

            values_str_fallback =
              batch_without_embeddings
              |> Enum.map(fn data ->
                frontmatter = ensure_all_columns(data.frontmatter)
                # Prepare data using all keys
                prepared_values = prepare_data(keys_for_fallback_insert, frontmatter)
                "(" <> Enum.join(prepared_values, ", ") <> ")"
              end)
              |> Enum.join(", ")

            # Exclude embeddings fields ONLY from the update clause for fallback
            update_keys_fallback =
        keys
        |> Enum.filter(&(&1 != "file_path" and &1 != "embeddings_openai" and &1 != "embeddings_spr_custom"))

            update_clause_fallback =
              update_keys_fallback
              |> Enum.map(&("#{&1} = EXCLUDED.#{&1}"))
              |> Enum.join(", ")

            # Construct the fallback upsert query
            upsert_query_fallback = """
            INSERT INTO vault (#{Enum.join(keys_for_fallback_insert, ", ")})
            VALUES #{values_str_fallback}
            ON CONFLICT (file_path)
            DO UPDATE SET #{update_clause_fallback}
            """

            case DuckDBUtils.execute_query(upsert_query_fallback) do
              {:ok, _} ->
                IO.puts("Batch upsert successful (fallback) for #{length(batch_without_embeddings)} records without embeddings update")
              {:error, error} ->
                IO.puts("Batch upsert failed (fallback) for records without embeddings update: #{inspect(error)}")
            end
        end
      end
    end)
  end


  defp needs_embeddings_update(existing_data, md_content) do
    trimmed = String.trim(md_content)
      # Use fuzzy matching for md_content and spr_content similarity threshold 80%
      # Use String.jaro_distance for similarity check

      embeddings_openai =
        case existing_data["embeddings_openai"] do
          nil -> nil
          val when is_binary(val) ->
            case Jason.decode(val) do
              {:ok, decoded} -> decoded
              _ -> nil
            end
          val -> val
        end

      embeddings_spr_custom =
        case existing_data["embeddings_spr_custom"] do
          nil -> nil
          val when is_binary(val) ->
            case Jason.decode(val) do
              {:ok, decoded} -> decoded
              _ -> nil
            end
          val -> val
        end

      spr_content_exists = not is_nil(existing_data["spr_content"]) and existing_data["spr_content"] != ""

      md_content_existing = Map.get(existing_data, "md_content", "") |> String.trim()
      md_content_new = String.trim(md_content)

      similarity = String.jaro_distance(md_content_existing, md_content_new)

      # Threshold for similarity
      similarity_threshold = 0.8

      _embeddings_ok = # Prefix with underscore
        String.length(trimmed) > 100 and
        (
          not is_nil(embeddings_openai) and
          not is_nil(embeddings_spr_custom) and
          not all_zeros?(embeddings_openai) and
          not all_zeros?(embeddings_spr_custom)
        )

      _spr_content_ok = spr_content_exists # Prefix with underscore

      # IO.puts("similarity: #{similarity}")
      # IO.puts("embeddings_ok: #{_embeddings_ok}") # Use _embeddings_ok in comments too
      # IO.puts("String.length(trimmed): #{String.length(trimmed)}")
      # IO.puts("not is_nil(embeddings_openai): #{not is_nil(embeddings_openai)}")
      # IO.puts("not is_nil(embeddings_spr_custom): #{not is_nil(embeddings_spr_custom)}")
      # IO.puts("not all_zeros?(embeddings_openai): #{not all_zeros?(embeddings_openai)}")
      # IO.puts("not all_zeros?(embeddings_spr_custom): #{not all_zeros?(embeddings_spr_custom)}")
      # IO.puts("spr_content_ok #{_spr_content_ok}") # Use _spr_content_ok in comments too

      content_changed = similarity < similarity_threshold
      embeddings_exist = not is_nil(embeddings_openai) and not is_nil(embeddings_spr_custom)

      # Re-embed if content changed or if embeddings don't exist (for new files or if lost)
      needs_update = content_changed or not embeddings_exist

      needs_update
  end



  defp get_files_to_process(directory, commits_back, all_files, pattern) do
    files =
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

    if pattern do
      pattern_files = Path.wildcard(Path.join(directory, pattern))
      Enum.filter(files, &(&1 in pattern_files))
    else
      files
    end
  end

  defp regenerate_embeddings(file_path, md_content, frontmatter) do
    IO.puts("Embedding file: #{file_path}")
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
      "previous_paths" -> serialize_list(value)
      "md_content" -> escape_multiline_text(value)
      "spr_content" -> escape_multiline_text(value) # Add this line
      "estimated_tokens" -> to_string(value)
      _ -> default_transform_value(value)
    end
  end

  defp default_transform_value({a, b}), do: "'{#{to_string(a)},#{to_string(b)}}'"

  defp default_transform_value(value) when is_list(value),
    do: "'#{Jason.encode!(Enum.reject(value, &(&1 == "" or &1 == nil)))}'"

  defp default_transform_value(value) when is_binary(value) do
    "'#{escape_string(value)}'"
  end

  defp default_transform_value(value) when is_boolean(value),
    do: if(value, do: "true", else: "false")

  defp default_transform_value(value) when is_number(value), do: to_string(value)
  defp default_transform_value(value) when is_map(value), do: "'#{Jason.encode!(value)}'"
  defp default_transform_value(_value), do: "NULL"

  defp serialize_array(array) when is_list(array) do
    if Enum.empty?(array) do
      # If the array is empty, determine if it should be OpenAI (1536) or custom (1024) embeddings
      column_type =
        cond do
          # Use the call stack to determine which type of array this is
          Process.info(self(), :current_stacktrace)
          |> elem(1)
          |> Enum.any?(fn {_m, _f, _a, kw} ->
            Keyword.get(kw, :line) != nil &&
                Enum.at(kw, 1) == {:key, "embeddings_openai"}
          end) ->
            # For OpenAI embeddings, use 1536 zeros
            "[#{Enum.join(List.duplicate("0", 1536), ", ")}]"

          # For custom embeddings or any other array
          true ->
            # For JINA/SPR embeddings, use 1024 zeros
            "[#{Enum.join(List.duplicate("0", 1024), ", ")}]"
        end

      column_type
    else
      # Format as 'ARRAY[value1::FLOAT, value2::FLOAT, ...]' for explicit casting
      values_with_casts = Enum.map(array, &"#{&1}::FLOAT")
      # Remove the outer single quotes here
      "ARRAY[#{Enum.join(values_with_casts, ", ")}]"
    end
  end

  defp serialize_array(array) when is_binary(array) do
    # If the input is already a binary (likely from the DB), explicitly cast it to FLOAT[]
    "CAST(#{array} AS FLOAT[])"
  end

  defp serialize_array(nil) do
    "NULL"
  end

  defp serialize_list(list) do
    normalized =
      case list do
        # Handle single string value
        val when is_binary(val) ->
          [val]

        list when is_list(list) ->
          Enum.reject(list, &(&1 in ["", nil]))

        _ ->
          []
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
    value
    # First normalize any existing double quotes to single
    |> String.replace("''", "'")
    # Then replace single quotes with doubles
    |> String.replace("'", "''")
  end

  defp escape_multiline_text(nil), do: "NULL"

  defp escape_multiline_text(text) when is_binary(text) do
    text
    |> String.trim()
    |> String.replace("'", "''")
    |> String.replace("\n", "\\n")
    |> (&"'#{&1}'").()
  end

  defp prepare_data(keys_to_include, frontmatter) do
    Enum.map(keys_to_include, fn key -> transform_value(Map.get(frontmatter, key), key) end)
  end


  defp all_zeros?(nil), do: false
  defp all_zeros?(embeddings) when is_list(embeddings), do: Enum.all?(embeddings, &(&1 == 0))

  defp all_zeros?(embeddings) when is_binary(embeddings) do
    case Jason.decode(embeddings) do
      {:ok, decoded} when is_list(decoded) -> all_zeros?(decoded)
      _ -> false
    end
  end

  defp all_zeros?(_), do: false

  defp normalize_array_value(value) do
    case value do
      nil ->
        []

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
            # Trim whitespace first
            |> Enum.map(&String.trim/1)
            |> Enum.map(fn path_str ->
              # More robustly remove leading/trailing quotes (' or ")
              path_str
              |> String.trim("'")
              |> String.trim("\"")
              # Repeat in case of mixed quotes like '"path"'
              |> String.trim("'")
              |> String.trim("\"")
            end)
            # Remove empty strings after cleaning
            |> Enum.reject(&(&1 in ["", nil]))

          # Handle comma-separated string format
          String.contains?(val, ",") ->
            val
            |> String.split(",")
            |> Enum.map(&String.trim/1)
            |> Enum.reject(&(&1 in ["", nil]))

          String.trim(val) == "" ->
            []

          true ->
            [val]
        end

      _ ->
        []
    end
    |> Enum.sort()
  end

  defp is_array_type?(type), do: String.contains?(type, "[]") or String.contains?(type, "ARRAY")

  defp remove_old_files(paths) do
    if paths != [] do
      escaped_paths = Enum.map(paths, &"'#{escape_string(&1)}'")
      query = "DELETE FROM vault WHERE file_path NOT IN (#{Enum.join(escaped_paths, ", ")})"

      DuckDBUtils.execute_query(query) |> handle_result()
    end
  end

  defp handle_result({:ok, _result}), do: :ok
  defp handle_result({:error, _error}), do: :error

end
