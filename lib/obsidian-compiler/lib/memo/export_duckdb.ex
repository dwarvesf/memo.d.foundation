defmodule Memo.ExportDuckDB do
  @moduledoc """
  A module to process markdown files and store their information in DuckDB.
  """

  use Flow
  alias Memo.Common.{FileUtils, Frontmatter, GitUtils, DuckDBUtils, AIUtils}

  @min_content_length 100
  @embed_ignore_frontmatter [
    "file_path",
    "md_content",
    "spr_content",
    "embeddings_openai",
    "embeddings_spr_custom",
    "estimated_tokens",
    "previous_paths",
    "has_redirects",
    "redirect"
  ]
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
    {"ai_generated_summary", "VARCHAR[]"},
    {"has_redirects", "BOOLEAN"},
    {"redirect", "VARCHAR[]"}
  ]

  def run(vaultpath, format, pattern \\ nil) do
    load_env()

    vaultpath = vaultpath || "vault"
    export_format = format || "parquet"
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

    case DuckDBUtils.execute_query("SELECT 1") do
      {:ok, _} ->
        with :ok <- install_and_load_extensions(),
             :ok <- setup_database(),
             {:ok, last_processed_timestamp} <- fetch_last_processed_timestamp() do
          filtered_files =
            get_files_to_process(
              vaultpath,
              all_files_to_process,
              pattern,
              last_processed_timestamp
            )

          processed_files = process_files(filtered_files, vaultpath, all_files_to_process)
          update_file_processing_metadata(processed_files)
          export(export_format)
        else
          :error -> IO.puts("Failed to set up DuckDB or process timestamps")
        end

      {:error, reason} ->
        IO.puts("Failed to connect to DuckDB: #{reason}")
    end
  end

  defp fetch_last_processed_timestamp() do
    # Get the earliest last_processed_at from all files to use as a fallback global timestamp
    # This maintains backward compatibility while transitioning to per-file tracking
    query = """
    SELECT MIN(last_processed_at) as global_last_processed_at
    FROM processing_metadata
    WHERE last_processed_at IS NOT NULL
    """

    case DuckDBUtils.execute_query(query) do
      {:ok, [%{"global_last_processed_at" => ts_str}]} when is_binary(ts_str) and ts_str != "" ->
        case DateTime.from_iso8601(ts_str) do
          {:ok, datetime, _offset} ->
            IO.puts("Fetched global last_processed_at (ISO8601): #{inspect(datetime)}")
            {:ok, datetime}

          {:error, _} ->
            # Fallback: try parsing "YYYY-MM-DD HH:MM:SS" format, assuming UTC
            try do
              naive_dt_str = String.replace(ts_str, " ", "T")
              naive_dt = NaiveDateTime.from_iso8601!(naive_dt_str)
              datetime = DateTime.from_naive!(naive_dt, "Etc/UTC")
              IO.puts("Fetched global last_processed_at (fallback parsed): #{inspect(datetime)}")
              {:ok, datetime}
            rescue
              _e ->
                IO.puts(
                  "Warning: Could not parse stored last_processed_at timestamp string (fallback failed): '#{ts_str}'. Processing all relevant files."
                )
                {:ok, nil}
            end
        end

      # No timestamp found, it's NULL, or not a string we can parse
      {:ok, _} ->
        IO.puts("No last_processed_at timestamp found. Processing all relevant files.")
        {:ok, nil}

      {:error, reason} ->
        IO.puts("Error fetching last_processed_at: #{reason}. Processing all relevant files.")
        {:ok, nil}
    end
  end

  defp fetch_file_processing_metadata(file_paths) do
    if Enum.empty?(file_paths) do
      %{}
    else
      escaped_paths = Enum.map(file_paths, &"'#{escape_string(&1)}'")

      query = """
      SELECT file_path, last_processed_at, git_commit_timestamp, processing_status
      FROM processing_metadata
      WHERE file_path IN (#{Enum.join(escaped_paths, ", ")})
      """

      case DuckDBUtils.execute_query(query) do
        {:ok, results} ->
          Enum.reduce(results, %{}, fn row, acc ->
            parsed_last_processed_at =
              case row["last_processed_at"] do
                ts_str when is_binary(ts_str) and ts_str != "" ->
                  case DateTime.from_iso8601(ts_str) do
                    {:ok, datetime, _offset} -> datetime
                    {:error, _} -> nil
                  end
                _ -> nil
              end

            parsed_git_commit_timestamp =
              case row["git_commit_timestamp"] do
                ts_str when is_binary(ts_str) and ts_str != "" ->
                  case DateTime.from_iso8601(ts_str) do
                    {:ok, datetime, _offset} -> datetime
                    {:error, _} -> nil
                  end
                _ -> nil
              end

            Map.put(acc, row["file_path"], %{
              last_processed_at: parsed_last_processed_at,
              git_commit_timestamp: parsed_git_commit_timestamp,
              processing_status: row["processing_status"]
            })
          end)

        {:error, error} ->
          IO.puts("Failed to fetch file processing metadata: #{error}")
          %{}
      end
    end
  end

  defp fetch_time_from_web() do
    case HTTPoison.get("https://www.timeapi.io/api/Time/current/zone?timeZone=Etc/UTC") do
      {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
        case Jason.decode(body) do
          # Changed "utc_datetime" to "dateTime"
          {:ok, %{"dateTime" => datetime_str}} ->
            case DateTime.from_iso8601(datetime_str) do
              {:ok, datetime, offset} ->
                # Ensure the datetime is in UTC
                # TimeAPI's /current/zone endpoint with Etc/UTC should already return it in UTC
                # but an explicit shift_zone is a good safeguard.
                dt_utc = DateTime.shift_zone!(datetime, "Etc/UTC")
                {:ok, dt_utc, offset}

              {:error, reason} ->
                IO.puts(
                  "Warning: Failed to parse dateTime string '#{datetime_str}': #{inspect(reason)}"
                )

                {:error, :datetime_parse_failed}
            end

          {:ok, other_json} ->
            IO.puts(
              "Warning: Unexpected JSON structure from time API. Missing 'dateTime'. Got: #{inspect(other_json)}"
            )

            {:error, :unexpected_json_structure}

          {:error, reason} ->
            IO.puts("Warning: Failed to parse JSON response from time API: #{inspect(reason)}")
            {:error, :json_parse_failed}
        end

      {:ok, %HTTPoison.Response{status_code: status_code, body: body}} ->
        IO.puts(
          "Warning: Time API request failed with status code: #{status_code}, body: #{inspect(body)}"
        )

        {:error, :http_request_failed}

      {:error, %HTTPoison.Error{reason: reason}} ->
        IO.puts("Warning: HTTP request to time API failed: #{inspect(reason)}")
        {:error, :http_request_error}
    end
  end

  defp update_last_processed_timestamp() do
    # This function is now a no-op since we update per-file metadata
    # during the batch processing instead of a global timestamp
    IO.puts("Skipping global timestamp update - using per-file processing metadata.")
  end

  defp update_file_processing_metadata(processed_files) do
    system_utc_time = DateTime.utc_now()

    current_utc_time =
      if system_utc_time.year == 1970 do
        IO.puts("System time year is 1970. Attempting to fetch current time from web...")

        case fetch_time_from_web() do
          {:ok, web_datetime, _offset} ->
            IO.puts("Successfully fetched time from web: #{inspect(web_datetime)}")
            web_datetime

          {:error, _reason} ->
            IO.puts(
              "Failed to fetch time from web. Falling back to system time: #{inspect(system_utc_time)}"
            )
            system_utc_time
        end
      else
        system_utc_time
      end

    truncated_time = DateTime.truncate(current_utc_time, :second)
    ts_string = DateTime.to_iso8601(truncated_time)

    if Enum.empty?(processed_files) do
      IO.puts("No files processed, skipping processing metadata update.")
    else
      # Update processing metadata for each processed file
      processed_files
      |> Enum.chunk_every(50) # Process in batches of 50
      |> Enum.each(fn file_batch ->
        update_batch_processing_metadata(file_batch, ts_string)
      end)

      IO.puts("Updated processing metadata for #{length(processed_files)} files.")
    end
  end

  defp update_batch_processing_metadata(file_paths, ts_string) do
    # Get Git commit timestamps for all files in this batch
    file_git_timestamps =
      Enum.reduce(file_paths, %{}, fn file_path, acc ->
        case get_file_last_commit_timestamp(file_path) do
          {:ok, git_timestamp} ->
            Map.put(acc, file_path, DateTime.to_iso8601(git_timestamp))
          {:error, _} ->
            Map.put(acc, file_path, ts_string) # Fallback to processing time
        end
      end)

    # Prepare batch upsert values
    values =
      Enum.map(file_paths, fn file_path ->
        vault_abs = Path.expand("vault")
        file_abs = Path.expand(file_path)
        relative_path = Path.relative_to(file_abs, vault_abs)
        git_timestamp = Map.get(file_git_timestamps, file_path, ts_string)

        "(
          '#{escape_string(relative_path)}',
          '#{ts_string}',
          '#{git_timestamp}',
          'processed',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )"
      end)
      |> Enum.join(", ")

    query = """
    INSERT INTO processing_metadata (
      file_path, last_processed_at, git_commit_timestamp,
      processing_status, created_at, updated_at
    )
    VALUES #{values}
    ON CONFLICT(file_path) DO UPDATE SET
      last_processed_at = EXCLUDED.last_processed_at,
      git_commit_timestamp = EXCLUDED.git_commit_timestamp,
      processing_status = EXCLUDED.processing_status,
      updated_at = CURRENT_TIMESTAMP;
    """

    case DuckDBUtils.execute_query(query) do
      {:ok, _} ->
        IO.puts("Updated processing metadata for batch of #{length(file_paths)} files")
      {:error, reason} ->
        IO.puts("Error updating processing metadata batch: #{reason}")
    end
  end

  defp load_env do
    if File.exists?(".env"), do: DotenvParser.load_file(".env")
  end

  defp install_and_load_extensions() do
    DuckDBUtils.execute_query("INSTALL parquet") |> handle_result()
    DuckDBUtils.execute_query("LOAD parquet") |> handle_result()
  end

  # Imports the database state from the '../../db' directory (parquet files and schema.sql).
  # This effectively loads the state saved by the previous EXPORT DATABASE.
  defp setup_database() do
    IO.puts("Importing database state from '../../db'...")

    case DuckDBUtils.execute_query("IMPORT DATABASE '../../db'") do
      {:ok, _} ->
        IO.puts("Database state imported successfully.")
        # Note: IMPORT DATABASE drops existing tables before loading.
        # Schema evolution based on @allowed_frontmatter relies on schema.sql being up-to-date
        # from a previous EXPORT DATABASE. Dynamic column merging after import might be needed
        # if schema.sql isn't always current before import.
        IO.puts("Merging columns to sync schema after successful import...")
        merge_columns()

        # Check and migrate processing metadata if needed
        case migrate_processing_metadata_if_needed() do
          :ok -> :ok
          :error ->
            IO.puts("Warning: Processing metadata migration failed, but continuing...")
            :ok
        end

      {:error, error} ->
        IO.puts("Failed to import database state: #{error}")
        # Attempt to create tables if import failed (e.g., first run or db dir empty)
        IO.puts("Attempting to create tables as fallback...")
        create_vault_result = create_vault_table()
        create_metadata_result = create_processing_metadata_table()

        if create_vault_result == :ok && create_metadata_result == :ok do
          IO.puts("Tables created as fallback.")
          # Merge columns even on fallback creation
          IO.puts("Merging columns to sync schema after fallback creation...")
          merge_columns()
          IO.puts("Tables created as fallback.")
          # Merge columns even on fallback creation
          IO.puts("Merging columns to sync schema after fallback creation...")
          merge_columns()
          # Log count after fallback
          count_rows_and_log()
          :ok
        else
          IO.puts("Fallback table creation failed.")
          :error
        end
    end

    # Log count after successful import
    count_rows_and_log()
  end

  defp count_rows_and_log() do
    count_query = "SELECT COUNT(*) as count FROM vault"

    case DuckDBUtils.execute_query(count_query) do
      {:ok, [%{"count" => count}]} ->
        IO.puts("Vault table row count after setup: #{count}")

      {:error, error} ->
        IO.puts("Failed to get vault table row count after setup: #{error}")
    end
  end

  defp migrate_processing_metadata_if_needed() do
    # Check if table exists and what schema it has
    check_table_query = """
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'processing_metadata'
    ORDER BY column_name;
    """

    case DuckDBUtils.execute_query(check_table_query) do
      {:ok, columns} ->
        column_names = Enum.map(columns, & &1["column_name"])

        cond do
          # Table doesn't exist - nothing to migrate
          Enum.empty?(columns) ->
            IO.puts("No processing_metadata table found - no migration needed.")
            :ok

          # Old schema detected (has 'id' column) - need to migrate
          "id" in column_names ->
            IO.puts("Detected old processing_metadata schema. Migrating to per-file tracking...")
            migrate_from_old_schema()

          # New schema already exists (has 'file_path' column) - no migration needed
          "file_path" in column_names ->
            IO.puts("Processing metadata table already uses per-file schema - no migration needed.")
            :ok

          # Unknown schema - create backup and recreate
          true ->
            IO.puts("Warning: Unknown processing_metadata schema detected. Creating backup and recreating...")
            backup_and_recreate_processing_metadata()
        end

      {:error, error} ->
        IO.puts("Failed to check processing_metadata schema for migration: #{error}")
        :error
    end
  end

  defp create_processing_metadata_table() do
    # First, check if the old schema exists and migrate if needed
    case migrate_processing_metadata_schema() do
      :ok ->
        IO.puts("Processing metadata schema migration completed successfully.")
        :ok

      :error ->
        IO.puts("Failed to migrate processing metadata schema.")
        :error
    end
  end

  defp migrate_processing_metadata_schema() do
    # Check if table exists and what schema it has
    check_table_query = """
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'processing_metadata'
    ORDER BY column_name;
    """

    case DuckDBUtils.execute_query(check_table_query) do
      {:ok, columns} ->
        column_names = Enum.map(columns, & &1["column_name"])

        cond do
          # Table doesn't exist - create new schema
          Enum.empty?(columns) ->
            create_new_processing_metadata_table()

          # Old schema detected (has 'id' column)
          "id" in column_names ->
            IO.puts("Detected old processing_metadata schema. Migrating to per-file tracking...")
            migrate_from_old_schema()

          # New schema already exists (has 'file_path' column)
          "file_path" in column_names ->
            IO.puts("Processing metadata table already uses per-file schema.")
            ensure_processing_metadata_index()

          # Unknown schema
          true ->
            IO.puts("Warning: Unknown processing_metadata schema detected. Creating backup and recreating...")
            backup_and_recreate_processing_metadata()
        end

      {:error, _error} ->
        # Table doesn't exist, create new one
        create_new_processing_metadata_table()
    end
  end

  defp create_new_processing_metadata_table() do
    query = """
    CREATE TABLE processing_metadata (
      file_path TEXT PRIMARY KEY,
      last_processed_at TIMESTAMP,
      git_commit_timestamp TIMESTAMP,
      processing_status VARCHAR DEFAULT 'processed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """

    case DuckDBUtils.execute_query(query) do
      {:ok, _} ->
        IO.puts("Created new processing_metadata table with per-file tracking.")
        ensure_processing_metadata_index()

      {:error, error} ->
        IO.puts("Failed to create processing_metadata table: #{error}")
        :error
    end
  end

  defp migrate_from_old_schema() do
    # Step 1: Extract the old global timestamp
    old_timestamp_query = "SELECT last_processed_at FROM processing_metadata WHERE id = 1"

    old_timestamp = case DuckDBUtils.execute_query(old_timestamp_query) do
      {:ok, [%{"last_processed_at" => ts}]} when not is_nil(ts) ->
        case DateTime.from_iso8601(ts) do
          {:ok, datetime, _} -> datetime
          {:error, _} ->
            # Try parsing as naive datetime
            try do
              naive_dt = NaiveDateTime.from_iso8601!(String.replace(ts, " ", "T"))
              DateTime.from_naive!(naive_dt, "Etc/UTC")
            rescue
              _ -> nil
            end
        end

      _ -> nil
    end

    # Step 2: Create backup of old table
    backup_query = "CREATE TABLE processing_metadata_backup AS SELECT * FROM processing_metadata"

    case DuckDBUtils.execute_query(backup_query) do
      {:ok, _} ->
        IO.puts("Created backup of old processing_metadata table.")

        # Step 3: Drop old table
        drop_query = "DROP TABLE processing_metadata"
        case DuckDBUtils.execute_query(drop_query) do
          {:ok, _} ->
            # Step 4: Create new table
            case create_new_processing_metadata_table() do
              :ok ->
                # Step 5: Migrate data if we have an old timestamp
                if old_timestamp do
                  migrate_existing_files_with_timestamp(old_timestamp)
                else
                  IO.puts("No valid old timestamp found. New table created without migration data.")
                  :ok
                end

              :error -> :error
            end

          {:error, error} ->
            IO.puts("Failed to drop old processing_metadata table: #{error}")
            :error
        end

      {:error, error} ->
        IO.puts("Failed to create backup of old processing_metadata table: #{error}")
        :error
    end
  end

  defp migrate_existing_files_with_timestamp(old_timestamp) do
    IO.puts("Migrating existing files using old timestamp: #{DateTime.to_iso8601(old_timestamp)}")

    # Get all files from vault table to populate with old timestamp
    files_query = "SELECT DISTINCT file_path FROM vault WHERE file_path IS NOT NULL"

    case DuckDBUtils.execute_query(files_query) do
      {:ok, results} ->
        file_paths = Enum.map(results, & &1["file_path"])

        if Enum.empty?(file_paths) do
          IO.puts("No files found in vault table to migrate.")
          :ok
        else
          # Populate new table with existing files using old timestamp
          ts_string = DateTime.to_iso8601(old_timestamp)

          values =
            Enum.map(file_paths, fn file_path ->
              "(
                '#{escape_string(file_path)}',
                '#{ts_string}',
                '#{ts_string}',
                'migrated',
                '#{ts_string}',
                '#{ts_string}'
              )"
            end)
            |> Enum.join(", ")

          migration_query = """
          INSERT INTO processing_metadata (
            file_path, last_processed_at, git_commit_timestamp,
            processing_status, created_at, updated_at
          )
          VALUES #{values};
          """

          case DuckDBUtils.execute_query(migration_query) do
            {:ok, _} ->
              IO.puts("Successfully migrated #{length(file_paths)} files to new processing_metadata schema.")
              :ok

            {:error, error} ->
              IO.puts("Failed to migrate existing files: #{error}")
              :error
          end
        end

      {:error, error} ->
        IO.puts("Failed to fetch existing files for migration: #{error}")
        :error
    end
  end

  defp backup_and_recreate_processing_metadata() do
    timestamp = DateTime.utc_now() |> DateTime.to_iso8601() |> String.replace(":", "_")
    backup_table_name = "processing_metadata_backup_#{timestamp}"

    backup_query = "CREATE TABLE #{backup_table_name} AS SELECT * FROM processing_metadata"

    case DuckDBUtils.execute_query(backup_query) do
      {:ok, _} ->
        IO.puts("Created backup table: #{backup_table_name}")

        drop_query = "DROP TABLE processing_metadata"
        case DuckDBUtils.execute_query(drop_query) do
          {:ok, _} ->
            create_new_processing_metadata_table()

          {:error, error} ->
            IO.puts("Failed to drop processing_metadata table: #{error}")
            :error
        end

      {:error, error} ->
        IO.puts("Failed to create backup table: #{error}")
        :error
    end
  end

  defp ensure_processing_metadata_index() do
    index_query = """
    CREATE INDEX IF NOT EXISTS idx_processing_metadata_last_processed_at
    ON processing_metadata(last_processed_at);
    """

    case DuckDBUtils.execute_query(index_query) do
      {:ok, _} ->
        :ok

      {:error, error} ->
        IO.puts("Warning: Failed to create index on processing_metadata: #{error}")
        :ok  # Don't fail the entire operation for index creation
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
      all_column_names = Enum.map(@allowed_frontmatter, &elem(&1, 0)) |> Enum.join(", ")
      # Select all allowed columns
      query = "SELECT #{all_column_names} FROM vault"

      case DuckDBUtils.execute_query(query) do
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
            # Normalize DB file_path to match relative paths (trim vault prefix)
            # This normalization is already done in the Enum.filter above,
            # but we need the normalized path as the key for the map.
            norm_path =
              row["file_path"]
              |> String.trim_leading("vault/")
              |> String.trim_leading("/")

            # Ensure all allowed keys are present in the row map, defaulting to nil if not returned by DB
            complete_row =
              Enum.reduce(@allowed_frontmatter, %{}, fn {key, _type}, row_acc ->
                Map.put(row_acc, key, Map.get(row, key))
              end)

            Map.put(acc, norm_path, complete_row)
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
                too_short = String.length(md_content) < @min_content_length

                embeddings_updated =
                  not too_short and needs_embeddings_update(existing_data, md_content)

                {new_spr_content, new_embeddings_openai, new_embeddings_spr_custom,
                 updated_frontmatter} =
                  if embeddings_updated do
                    regenerated =
                      regenerate_embeddings(relative_path, md_content, normalized_frontmatter)

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

                # Determine if frontmatter (excluding content/embeddings) has changed
                current_fm_for_comparison =
                  @allowed_frontmatter
                  |> Enum.map(&elem(&1, 0))
                  |> Enum.reduce(%{}, fn key, acc ->
                    Map.put(acc, key, Map.get(normalized_frontmatter, key))
                  end)
                  # Exclude derived/dynamic fields
                  |> Map.drop(@embed_ignore_frontmatter)

                existing_fm_for_comparison =
                  @allowed_frontmatter
                  |> Enum.map(&elem(&1, 0))
                  |> Enum.reduce(%{}, fn key, acc ->
                    Map.put(acc, key, Map.get(existing_data, key))
                  end)
                  |> Map.drop(@embed_ignore_frontmatter)

                # Normalize values for consistent comparison (handles dates, arrays, numbers vs strings)
                current_fm_normalized_for_compare =
                  Enum.reduce(
                    Map.keys(current_fm_for_comparison),
                    current_fm_for_comparison,
                    fn key, acc ->
                      current_value = Map.get(acc, key)
                      normalized_value = normalize_value_for_comparison(current_value, key)
                      Map.put(acc, key, normalized_value)
                    end
                  )

                existing_fm_normalized_for_compare =
                  Enum.reduce(
                    Map.keys(existing_fm_for_comparison),
                    existing_fm_for_comparison,
                    fn key, acc ->
                      current_value = Map.get(acc, key)
                      normalized_value = normalize_value_for_comparison(current_value, key)
                      Map.put(acc, key, normalized_value)
                    end
                  )

                frontmatter_changed =
                  current_fm_normalized_for_compare != existing_fm_normalized_for_compare

                %{
                  file_path: relative_path,
                  md_content: md_content,
                  # This now contains either new or old embeddings/spr_content
                  frontmatter: updated_frontmatter,
                  embeddings_updated: embeddings_updated,
                  # New flag
                  frontmatter_changed: frontmatter_changed,
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
      Enum.map(processed_data, fn %{
                                    file_path: file_path,
                                    md_content: md_content,
                                    frontmatter: frontmatter,
                                    embeddings_updated: embeddings_updated,
                                    frontmatter_changed: frontmatter_changed,
                                    new_spr_content: new_spr_content,
                                    new_embeddings_openai: new_embeddings_openai,
                                    new_embeddings_spr_custom: new_embeddings_spr_custom
                                  } ->
        merged_frontmatter =
          transform_frontmatter_no_db(md_content, frontmatter, file_path, previous_paths_map)

        %{
          file_path: file_path,
          md_content: md_content,
          frontmatter: merged_frontmatter,
          embeddings_updated: embeddings_updated,
          # Pass the flag along
          frontmatter_changed: frontmatter_changed,
          new_spr_content: new_spr_content,
          new_embeddings_openai: new_embeddings_openai,
          new_embeddings_spr_custom: new_embeddings_spr_custom
        }
      end)

    # Step 4: Batch upsert all records
    batch_upsert_into_duckdb(final_data)

    paths = Enum.map(all_files_to_process, &Path.relative_to(&1, vaultpath))
    remove_old_files(paths)

    # Return the list of processed files for metadata tracking
    files
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
            # Pass key
            Map.put(
              acc,
              row["file_path"],
              normalize_array_value(row["previous_paths"], "previous_paths")
            )
          end)

        {:error, _} ->
          %{}
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
          # Pass key
          Map.update(acc, key, [], &normalize_array_value(&1, key))
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
    batch_size = 15
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
          |> Enum.map(&"#{&1} = EXCLUDED.#{&1}")
          |> Enum.join(", ")

        upsert_query_with_embeddings = """
        INSERT INTO vault (#{Enum.join(keys_with_embeddings, ", ")})
        VALUES #{values_str_with_embeddings}
        ON CONFLICT (file_path)
        DO UPDATE SET #{update_clause_with_embeddings}
        """

        case DuckDBUtils.execute_query(upsert_query_with_embeddings) do
          {:ok, _} ->
            IO.puts(
              "Batch upsert successful for #{length(batch_with_embeddings)} records with embeddings update"
            )

          {:error, error} ->
            IO.puts("Batch upsert failed for records with embeddings update: #{inspect(error)}")
        end
      end

      # Process batch without embeddings updates (NEW APPROACH)
      # Further filter this batch: only include records where frontmatter actually changed
      batch_without_embeddings_fm_changed =
        Enum.filter(batch_without_embeddings, fn data -> data.frontmatter_changed end)

      if Enum.count(batch_without_embeddings_fm_changed) > 0 do
        file_paths_to_check = Enum.map(batch_without_embeddings_fm_changed, & &1.file_path)

        # Query database to check which files already exist
        existing_files_query = """
        SELECT file_path FROM vault WHERE file_path IN (#{Enum.join(Enum.map(file_paths_to_check, &"'#{escape_string(&1)}'"), ", ")})
        """

        case DuckDBUtils.execute_query(existing_files_query) do
          {:ok, existing_results} ->
            existing_file_paths = Enum.map(existing_results, & &1["file_path"])
            existing_file_paths_set = MapSet.new(existing_file_paths)

            # Split batch_without_embeddings_fm_changed into existing and new
            {batch_existing_fm_changed, batch_new_fm_changed} =
              Enum.split_with(batch_without_embeddings_fm_changed, fn data ->
                MapSet.member?(existing_file_paths_set, data.file_path)
              end)

            # For batch_new_fm_changed, use a simple INSERT (these are new files or files whose frontmatter changed but content didn't trigger embedding)
            if Enum.count(batch_new_fm_changed) > 0 do
              # Use all keys for new inserts
              keys_for_insert_new = keys

              values_str_new =
                batch_new_fm_changed
                |> Enum.map(fn data ->
                  # data.frontmatter has nil embeddings here
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
                  IO.puts(
                    "Batch insert successful for #{length(batch_new_fm_changed)} new records (embeddings not updated, frontmatter changed)"
                  )

                {:error, error} ->
                  IO.puts(
                    "Batch insert failed for new records (embeddings not updated, frontmatter changed): #{inspect(error)}"
                  )
              end
            end

            # For batch_existing_fm_changed (embeddings not updated, but frontmatter changed for existing files)
            if Enum.count(batch_existing_fm_changed) > 0 do
              # All keys for the INSERT part of UPSERT
              keys_for_fm_update = keys

              update_keys_fm_only =
                keys
                |> Enum.filter(
                  # Exclude embeddings, spr_content, and file_path (conflict target) from the SET clause.
                  # This ensures that for existing records where only frontmatter (not content) changed,
                  # we only update the metadata fields, preserving existing embeddings and spr_content.
                  &(&1 != "file_path" and
                      &1 != "embeddings_openai" and
                      &1 != "embeddings_spr_custom" and
                      &1 != "spr_content")
                )

              update_clause_fm_only =
                update_keys_fm_only
                |> Enum.map(&"#{&1} = EXCLUDED.#{&1}")
                |> Enum.join(", ")

              values_str_fm_update =
                batch_existing_fm_changed
                |> Enum.map(fn data ->
                  # data.frontmatter contains new frontmatter values AND old (preserved) embedding values
                  frontmatter = ensure_all_columns(data.frontmatter)
                  prepared_values = prepare_data(keys_for_fm_update, frontmatter)
                  "(" <> Enum.join(prepared_values, ", ") <> ")"
                end)
                |> Enum.join(", ")

              upsert_query_fm_only = """
              INSERT INTO vault (#{Enum.join(keys_for_fm_update, ", ")})
              VALUES #{values_str_fm_update}
              ON CONFLICT (file_path)
              DO UPDATE SET #{update_clause_fm_only}
              """

              case DuckDBUtils.execute_query(upsert_query_fm_only) do
                {:ok, _} ->
                  IO.puts(
                    "Batch upsert successful for #{length(batch_existing_fm_changed)} existing records (frontmatter update only, embeddings preserved)"
                  )

                {:error, error} ->
                  IO.puts(
                    "Batch upsert failed for existing records (frontmatter update only): #{inspect(error)}"
                  )
              end
            end

          {:error, error} ->
            IO.puts(
              "Failed to check for existing files in batch_without_embeddings_fm_changed: #{inspect(error)}"
            )

            # Fallback logic if checking existing files fails for batch_without_embeddings_fm_changed
            # This fallback should still only update non-embedding fields for safety.
            keys_for_fallback_insert = keys

            # Use the filtered list
            values_str_fallback =
              batch_without_embeddings_fm_changed
              |> Enum.map(fn data ->
                frontmatter = ensure_all_columns(data.frontmatter)
                prepared_values = prepare_data(keys_for_fallback_insert, frontmatter)
                "(" <> Enum.join(prepared_values, ", ") <> ")"
              end)
              |> Enum.join(", ")

            update_keys_fallback =
              keys
              |> Enum.filter(
                # Fallback: Exclude embeddings, spr_content, and file_path from the SET clause.
                &(&1 != "file_path" and
                    &1 != "embeddings_openai" and
                    &1 != "embeddings_spr_custom" and
                    &1 != "spr_content")
              )

            update_clause_fallback =
              update_keys_fallback
              |> Enum.map(&"#{&1} = EXCLUDED.#{&1}")
              |> Enum.join(", ")

            upsert_query_fallback = """
            INSERT INTO vault (#{Enum.join(keys_for_fallback_insert, ", ")})
            VALUES #{values_str_fallback}
            ON CONFLICT (file_path)
            DO UPDATE SET #{update_clause_fallback}
            """

            case DuckDBUtils.execute_query(upsert_query_fallback) do
              {:ok, _} ->
                IO.puts(
                  "Batch upsert successful (fallback) for #{length(batch_without_embeddings_fm_changed)} records (frontmatter update only)"
                )

              {:error, error_fallback} ->
                IO.puts(
                  "Batch upsert failed (fallback) for records (frontmatter update only): #{inspect(error_fallback)}"
                )
            end
        end
      else
        # This case means batch_without_embeddings was not empty, but after filtering by frontmatter_changed, it became empty.
        # So, there were files whose embeddings didn't change AND whose frontmatter also didn't change.
        # We can log this for clarity if needed, or just do nothing.
        # IO.puts("Skipping upsert for #{length(batch_without_embeddings)} records: embeddings and frontmatter unchanged.")
      end
    end)
  end

  defp needs_embeddings_update(existing_data, md_content) do
    # Use fuzzy matching for md_content and spr_content similarity threshold 80%
    # Use String.jaro_distance for similarity check

    embeddings_openai =
      case existing_data["embeddings_openai"] do
        nil ->
          nil

        val when is_binary(val) ->
          case Jason.decode(val) do
            {:ok, decoded} -> decoded
            _ -> nil
          end

        val ->
          val
      end

    embeddings_spr_custom =
      case existing_data["embeddings_spr_custom"] do
        nil ->
          nil

        val when is_binary(val) ->
          case Jason.decode(val) do
            {:ok, decoded} -> decoded
            _ -> nil
          end

        val ->
          val
      end

    spr_content_exists =
      not is_nil(existing_data["spr_content"]) and existing_data["spr_content"] != ""

    md_content_existing = Map.get(existing_data, "md_content", "") |> String.trim()
    md_content_new = String.trim(md_content)

    similarity = String.jaro_distance(md_content_existing, md_content_new)

    # Threshold for similarity
    similarity_threshold = 0.7

    content_changed = similarity < similarity_threshold
    embeddings_exist = not is_nil(embeddings_openai) and not is_nil(embeddings_spr_custom)

    # Re-embed if content changed or if embeddings don't exist (for new files or if lost)
    needs_update = content_changed or not embeddings_exist or not spr_content_exists

    needs_update
  end

  defp get_file_last_commit_timestamp(file_path) do
    vault_abs = Path.expand("vault")
    file_abs = Path.expand(file_path)
    file_relative_to_vault = Path.relative_to(file_abs, vault_abs)

    # Find the git root for this file (could be main vault or submodule)
    containing_dir_abs = Path.dirname(file_abs)
    git_root = find_git_root_for_file(containing_dir_abs)

    # Calculate file path relative to its git repository
    file_relative_to_git_root = Path.relative_to(file_abs, git_root)

    case System.cmd("git", [
      "log",
      "-1",
      "--format=%cI",
      "--",
      file_relative_to_git_root
    ], cd: git_root, stderr_to_stdout: true) do
      {timestamp_str, 0} ->
        case DateTime.from_iso8601(String.trim(timestamp_str)) do
          {:ok, datetime, _offset} ->
            {:ok, datetime}
          {:error, reason} ->
            {:error, "Failed to parse Git timestamp '#{timestamp_str}': #{inspect(reason)}"}
        end

      {error_output, _status} ->
        # If git log fails, try to get the file's first commit (for new files)
        case System.cmd("git", [
          "log",
          "--reverse",
          "-1",
          "--format=%cI",
          "--",
          file_relative_to_git_root
        ], cd: git_root, stderr_to_stdout: true) do
          {timestamp_str, 0} ->
            case DateTime.from_iso8601(String.trim(timestamp_str)) do
              {:ok, datetime, _offset} ->
                {:ok, datetime}
              {:error, reason} ->
                {:error, "Failed to parse Git timestamp '#{timestamp_str}': #{inspect(reason)}"}
            end
          {_, _} ->
            {:error, "Git log failed for #{file_path}: #{error_output}"}
        end
    end
  end

  defp find_git_root_for_file(start_dir) do
    case System.cmd("git", ["rev-parse", "--show-toplevel"], cd: start_dir) do
      {path, 0} ->
        String.trim(path)
      _ ->
        # Fallback to current directory if git command fails
        case System.cmd("git", ["rev-parse", "--show-toplevel"], cd: ".") do
          {path, 0} ->
            String.trim(path)
          _ ->
            IO.puts("Warning: Could not determine git root directory. Defaulting to '.'")
            "."
        end
    end
  end

  defp get_files_to_process(directory, all_files, pattern, last_processed_timestamp) do
    # Step 1: Pattern-based filtering
    pattern_matched_files =
      if pattern do
        # Ensure pattern is joined with directory to match full paths from all_files
        full_pattern_path = Path.join(directory, pattern)

        matching_wildcard_paths_set =
          Path.wildcard(full_pattern_path)
          |> MapSet.new()

        Enum.filter(all_files, &MapSet.member?(matching_wildcard_paths_set, &1))
      else
        # No pattern, use all files
        all_files
      end

    vault_abs = Path.expand(directory)

    # Convert file paths to relative paths for processing metadata lookup
    relative_file_paths =
      Enum.map(pattern_matched_files, fn file_path ->
        file_abs = Path.expand(file_path)
        Path.relative_to(file_abs, vault_abs)
      end)

    # Step 2: Fetch per-file processing metadata
    processing_metadata = fetch_file_processing_metadata(relative_file_paths)

    # Step 3: Smart filtering using per-file metadata + Git timestamps
    if is_nil(last_processed_timestamp) do
      IO.puts("No global last_processed_timestamp, using per-file processing metadata for filtering.")
    else
      IO.puts("Using per-file processing metadata with fallback to global timestamp: #{inspect(last_processed_timestamp)}")
    end

    files_to_process =
      Enum.filter(pattern_matched_files, fn file_path ->
        file_abs = Path.expand(file_path)
        relative_path = Path.relative_to(file_abs, vault_abs)

        # Get file's processing metadata
        file_metadata = Map.get(processing_metadata, relative_path)

        case file_metadata do
          nil ->
            # File has never been processed - include it
            IO.puts("Including unprocessed file: #{relative_path}")
            true

          %{last_processed_at: nil} ->
            # File exists in metadata but never processed - include it
            IO.puts("Including file with no processing timestamp: #{relative_path}")
            true

          %{last_processed_at: file_processed_at, git_commit_timestamp: git_timestamp} ->
            # File has been processed - check if it needs reprocessing
            case get_file_last_commit_timestamp(file_path) do
              {:ok, current_git_timestamp} ->
                # Compare current Git timestamp with stored Git timestamp and processing timestamp
                git_changed = is_nil(git_timestamp) or
                             DateTime.compare(current_git_timestamp, git_timestamp) == :gt

                # Also check against file's last processed time
                processed_recently = not is_nil(file_processed_at) and
                                   DateTime.compare(current_git_timestamp, file_processed_at) != :gt

                if git_changed and not processed_recently do
                  IO.puts("Including file with Git changes: #{relative_path} (Git: #{DateTime.to_iso8601(current_git_timestamp)} > Processed: #{if file_processed_at, do: DateTime.to_iso8601(file_processed_at), else: "never"})")
                  true
                else
                  if processed_recently do
                    IO.puts("Skipping recently processed file: #{relative_path}")
                  else
                    IO.puts("Skipping unchanged file: #{relative_path}")
                  end
                  false
                end

              {:error, reason} ->
                # Can't get Git timestamp - check against global timestamp as fallback
                if is_nil(last_processed_timestamp) or is_nil(file_processed_at) or
                   DateTime.compare(last_processed_timestamp, file_processed_at) == :gt do
                  IO.puts("Including file (Git timestamp unavailable, using fallback): #{relative_path} - #{inspect(reason)}")
                  true
                else
                  IO.puts("Skipping file (processed after global timestamp): #{relative_path}")
                  false
                end
            end
        end
      end)

    IO.puts("Filtered #{length(pattern_matched_files)} files to #{length(files_to_process)} files for processing.")
    files_to_process
  end

  defp regenerate_embeddings(file_path, md_content, frontmatter) do
    IO.puts("Embedding file: #{file_path}")
    spr_content = AIUtils.spr_compress(md_content)
    estimated_tokens = div(String.length(md_content), 4)

    custom_embedding = AIUtils.embed_custom(spr_content)

    openai_embedding = AIUtils.embed_openai(md_content)

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
      "spr_content" -> escape_multiline_text(value)
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

  defp serialize_array(nil), do: "NULL"

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

  defp normalize_array_value(value, key) do
    # Step 1: Convert input `value` to a flat list of strings
    string_list =
      case value do
        nil ->
          []

        val when is_list(val) ->
          val
          # Ensure all elements are strings
          |> Enum.map(&to_string/1)
          |> Enum.reject(&(&1 in ["", nil]))

        # Logic to parse string representations of arrays
        val when is_binary(val) ->
          cond do
            String.starts_with?(val, "[") && String.ends_with?(val, "]") ->
              val
              |> String.slice(1..-2//1)
              |> String.split(",")
              |> Enum.map(&String.trim/1)
              |> Enum.map(fn s -> s |> String.trim("'") |> String.trim("\"") end)
              |> Enum.reject(&(&1 in ["", nil]))

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

    # Step 2: Apply key-specific normalization if needed
    if key == "ai_generated_summary" do
      combined_text = Enum.join(string_list, " ")

      normalized_text =
        combined_text
        |> String.downcase()
        # Keep alphanumeric, whitespace, hyphens
        |> String.replace(~r/[^\w\s-]/u, "")
        # Normalize multiple spaces to one
        |> String.replace(~r/\s+/u, " ")
        |> String.trim()

      if normalized_text == "" do
        []
      else
        # Split into words, sort, and this becomes the canonical list for comparison.
        String.split(normalized_text, " ") |> Enum.sort()
      end
    else
      # For other arrays, just sort the list of strings.
      Enum.sort(string_list)
    end
  end

  # Normalizes a single value for the purpose of comparing frontmatter.
  # - Keeps nil and booleans as is.
  # - Normalizes dates to "YYYY-MM-DD" strings.
  # - Normalizes arrays by sorting elements (with special handling for ai_generated_summary).
  # - Converts all other types (numbers, strings) to strings.
  defp normalize_value_for_comparison(value, key) do
    cond do
      # Handle specific types/keys first
      # Keep booleans as is
      is_boolean(value) ->
        value

      # Use helper for DATE types
      is_date_key?(key) ->
        normalize_date_value(value)

      # Normalize arrays (handles nil internally, returns [])
      is_array_key?(key) ->
        normalize_array_value(value, key)

      # Handle nil for non-date, non-array keys AFTER specific handlers
      is_nil(value) ->
        nil

      # Handle numeric normalization for remaining types (numbers, strings)
      true ->
        value_str = to_string(value)

        case Float.parse(value_str) do
          {float_val, ""} ->
            if float_val == :math.floor(float_val) do
              to_string(:math.floor(float_val))
            else
              Float.to_string(float_val)
            end

          # Non-numeric string: normalize escaped single quotes
          _ ->
            String.replace(value_str, "''", "'")
        end
    end
  end

  defp normalize_date_value(nil), do: nil

  defp normalize_date_value(date_input) when is_binary(date_input) do
    # Try parsing ISO8601 DateTime first (e.g., "2023-10-26T10:00:00Z")
    case DateTime.from_iso8601(date_input) do
      {:ok, datetime, _offset} ->
        Date.to_string(DateTime.to_date(datetime))

      {:error, _} ->
        # If ISO8601 DateTime fails, try parsing as ISO8601 Date (e.g., "2023-10-26")
        # This handles "YYYY-MM-DD"
        case Date.from_iso8601(date_input) do
          {:ok, date} ->
            Date.to_string(date)

          {:error, _} ->
            IO.puts("Warning: Could not parse date string: #{inspect(date_input)}")
            # Return original if unparseable
            date_input
        end
    end
  end

  defp normalize_date_value(%Date{} = date_obj) do
    Date.to_string(date_obj)
  end

  defp normalize_date_value(%DateTime{} = datetime_obj) do
    Date.to_string(DateTime.to_date(datetime_obj))
  end

  # Catch-all for any other types
  defp normalize_date_value(other_input) do
    IO.puts("Warning: Unexpected data type for date normalization: #{inspect(other_input)}")
    # Return original or nil, depending on desired strictness for comparison
    other_input
  end

  defp is_array_key?(key) do
    field_def = Enum.find(@allowed_frontmatter, fn {k, _} -> k == key end)
    field_def && is_array_type?(elem(field_def, 1))
  end

  defp is_array_type?(type), do: String.contains?(type, "[]") or String.contains?(type, "ARRAY")

  defp is_date_key?(key) do
    field_def = Enum.find(@allowed_frontmatter, fn {k, _} -> k == key end)
    # Check if type is exactly "DATE"
    field_def && elem(field_def, 1) == "DATE"
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
end
