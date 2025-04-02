defmodule Memo.ExportMarkdown do
  @moduledoc """
  A module to export Obsidian markdown files and assets folders to standard markdown.
  Implements incremental processing to only export files that have changed.
  """

  use Flow
  alias Memo.Common.{FileUtils, Frontmatter, LinkUtils, DuckDBUtils, Slugify, KatexUtils}

  @cache_file ".memo_export_cache.json"

  def run(vaultpath, exportpath) do
    System.put_env("LC_ALL", "en_US.UTF-8")
    System.cmd("locale", [])

    vaultpath = vaultpath || "vault"
    exportpath = exportpath || "content"

    {vault_dir, mode} =
      if File.dir?(vaultpath) do
        {vaultpath, :directory}
      else
        {Path.dirname(vaultpath), :file}
      end

    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vault_dir, ".export-ignore"))

    paths = FileUtils.list_files_recursive(vault_dir)
    {all_files, all_assets} = Enum.split_with(paths, &File.regular?/1)

    all_valid_files =
      all_files
      |> Enum.filter(&(not FileUtils.ignored?(&1, ignored_patterns, vault_dir)))

    # Load the cache of previously processed files
    cache = load_cache(exportpath)

    if mode == :file do
      process_single_file(vaultpath, vault_dir, exportpath, all_valid_files, cache)
    else
      process_directory(
        all_valid_files,
        all_assets,
        vault_dir,
        exportpath,
        ignored_patterns,
        cache
      )
    end
  end

  defp process_single_file(vaultpath, vault_dir, exportpath, all_valid_files, cache) do
    normalized_vaultpath = FileUtils.normalize_path(vaultpath)

    if Enum.member?(all_valid_files, normalized_vaultpath) and
         Frontmatter.contains_required_frontmatter_keys?(normalized_vaultpath) do
      # Process the file and update the cache
      new_cache =
        process_file(normalized_vaultpath, vault_dir, exportpath, all_valid_files, cache)

      save_cache(new_cache, exportpath)
    else
      IO.puts(
        "File #{inspect(vaultpath)} does not exist, is ignored, or does not contain required frontmatter keys."
      )
    end
  end

  defp process_directory(
         all_valid_files,
         all_assets,
         vault_dir,
         exportpath,
         ignored_patterns,
         cache
       ) do
    # Find files that need processing (new or modified)
    {files_to_process, files_unchanged} = filter_changed_files(all_valid_files, cache)

    # Find files that were in the cache but no longer exist (deleted)
    deleted_files = find_deleted_files(all_valid_files, cache)

    # Process only changed files
    file_cache =
      if Enum.empty?(files_to_process) do
        IO.puts("No files have changed since last run.")
        cache
      else
        IO.puts("Processing #{Enum.count(files_to_process)} files...")

        # Process changed files - Using Enum instead of Flow to avoid protocol errors
        updated_entries =
          files_to_process
          |> Enum.filter(&Frontmatter.contains_required_frontmatter_keys?/1)
          |> Enum.map(fn file ->
            # process_file always returns a map, no need to check for :ok
            process_file(file, vault_dir, exportpath, all_valid_files, cache)
          end)
          |> Enum.reduce(%{}, fn entry, acc -> Map.merge(acc, entry) end)

        # Merge with unchanged entries
        unchanged_entries =
          files_unchanged
          |> Enum.reduce(%{}, fn file, acc ->
            Map.put(acc, file, Map.get(cache, file))
          end)

        Map.merge(unchanged_entries, updated_entries)
      end

    # Handle deleted files
    if not Enum.empty?(deleted_files) do
      IO.puts("Removing #{Enum.count(deleted_files)} deleted files...")
      remove_deleted_exports(deleted_files, vault_dir, exportpath)
    end

    # Process assets folders - Using Enum instead of Flow to avoid protocol errors
    # Collect cache entries for asset folders
    assets_cache =
      all_assets
      |> Enum.map(fn asset_path ->
        export_assets_folder(asset_path, vault_dir, exportpath, ignored_patterns, cache)
      end)
      |> Enum.reduce(%{}, fn entry, acc -> Map.merge(acc, entry) end)

    # Export the db directory with caching
    db_cache = export_db_directory("../../db", exportpath, cache)

    # Generate contributor files
    # generate_contributor_files(exportpath)

    # Create blank _index.md files in folders without them
    # generate_missing_index_files(exportpath)

    # Merge all cache entries: files, assets, and db
    new_cache = file_cache |> Map.merge(assets_cache) |> Map.merge(db_cache)

    # Save the updated cache
    save_cache(new_cache, exportpath)
  end

  defp export_assets_folder(asset_path, vaultpath, exportpath, ignored_patterns, cache) do
    if Path.basename(asset_path) == "assets" and
         Path.basename(Path.dirname(asset_path)) != "assets" and
         not FileUtils.ignored?(asset_path, ignored_patterns, vaultpath) do
      target_path = replace_path_prefix(asset_path, vaultpath, exportpath)
      slugified_target_path = preserve_relative_prefix_and_slugify(target_path)

      # Get the current mtime of the asset folder
      current_mtime = get_directory_mtime(asset_path)

      # Check if the asset folder is in the cache and if its mtime has changed
      cache_entry = Map.get(cache, asset_path)

      if cache_entry && cache_entry["type"] == "asset_folder" &&
           cache_entry["mtime"] == current_mtime do
        # Asset folder hasn't changed, skip copying
        %{asset_path => cache_entry}
      else
        # Asset folder has changed or is not in cache, copy it
        copy_directory(asset_path, slugified_target_path, ignored_patterns, vaultpath)
        IO.puts("Exported assets: #{asset_path} -> #{slugified_target_path}")

        # Create a new cache entry for the asset folder
        new_entry = %{
          "type" => "asset_folder",
          "mtime" => current_mtime,
          "export_path" => slugified_target_path
        }

        %{asset_path => new_entry}
      end
    else
      # Not an asset folder or ignored, return empty map
      %{}
    end
  end

  defp export_db_directory(dbpath, exportpath, cache) do
    if File.dir?(dbpath) do
      export_db_path = Path.join(exportpath, "../../db")
      # Use preserve_relative_prefix_and_slugify to keep the relative path prefix
      slugified_export_db_path = preserve_relative_prefix_and_slugify(export_db_path)

      # Get the current mtime of the db directory
      current_mtime = get_directory_mtime(dbpath)

      # Check if the db directory is in the cache and if its mtime has changed
      cache_entry = Map.get(cache, dbpath)

      if cache_entry && cache_entry["type"] == "db_directory" &&
           cache_entry["mtime"] == current_mtime do
        # DB directory hasn't changed, skip copying
        %{dbpath => cache_entry}
      else
        # DB directory has changed or is not in cache, copy it
        copy_directory(dbpath, slugified_export_db_path, [], dbpath)
        IO.puts("Exported db folder: #{dbpath} -> #{slugified_export_db_path}")

        # Create a new cache entry for the db directory
        new_entry = %{
          "type" => "db_directory",
          "mtime" => current_mtime,
          "export_path" => slugified_export_db_path
        }

        %{dbpath => new_entry}
      end
    else
      IO.puts("db folder not found at #{dbpath}")
      %{}
    end
  end

  defp copy_directory(source, destination, ignored_patterns, vaultpath) do
    # Use preserve_relative_prefix_and_slugify instead of Slugify.slugify_path to keep the relative path prefix
    slugified_destination = preserve_relative_prefix_and_slugify(destination)
    File.mkdir_p!(slugified_destination)

    case File.ls(source) do
      {:ok, files} ->
        Enum.each(files, fn item ->
          source_path = Path.join(source, item)
          dest_path = Path.join(slugified_destination, Slugify.slugify_filename(item))

          if not FileUtils.ignored?(source_path, ignored_patterns, vaultpath) do
            if File.dir?(source_path) do
              # Skip only if BOTH directories are named "assets"
              if not (Path.basename(source_path) == "assets" and Path.basename(source) == "assets") do
                copy_directory(source_path, dest_path, ignored_patterns, vaultpath)
              end
            else
              File.copy!(source_path, dest_path)
            end
          end
        end)

      {:error, reason} ->
        IO.puts("Error listing directory #{source}: #{reason}")
    end
  end

  defp process_file(file, vaultpath, exportpath, all_files, cache) do
    # Get file stats for cache comparison
    %{size: size, mtime: mtime} = File.stat!(file, time: :posix)
    file_hash = compute_file_hash(file)

    # Check if file has changed since last export
    cache_entry = Map.get(cache, file)

    if cache_entry &&
         cache_entry["size"] == size &&
         cache_entry["mtime"] == mtime &&
         cache_entry["hash"] == file_hash do
      # File hasn't changed, skip processing
      IO.puts("Unchanged (skipping): #{inspect(file)}")
      %{file => cache_entry}
    else
      # File has changed, process it

      # Calculate the export file path to check if it would become home.md or index.md at the root
      export_file = replace_path_prefix(file, vaultpath, exportpath)
      slugified_export_file = preserve_relative_prefix_and_slugify(export_file)
      dirname = Path.dirname(slugified_export_file)
      basename = Path.basename(slugified_export_file)

      # Skip only if it's home.md or index.md at the root level
      if basename in ["home.md", "index.md"] && dirname == exportpath do
        IO.puts("Skipping root file: #{inspect(file)} (would create #{basename} at root)")
        # Return an empty cache entry to prevent repeatedly checking this file
        %{file => %{
          "size" => size,
          "mtime" => mtime,
          "hash" => file_hash,
          "skipped" => true,
          "reason" => "Ignored root file: #{basename}"
        }}
      else
        content = File.read!(file)
        links = LinkUtils.extract_links(content)
        resolved_links = LinkUtils.resolve_links(links, all_files, vaultpath)
        converted_content = LinkUtils.convert_links(content, resolved_links, file)
        converted_content = process_duckdb_queries(converted_content)
        converted_content = Slugify.slugify_markdown_links(converted_content)
        converted_content = KatexUtils.wrap_multiline_katex(converted_content)

        export_dir = Path.dirname(slugified_export_file)
        File.mkdir_p!(export_dir)

        File.write!(slugified_export_file, converted_content)
        IO.puts("Exported: #{inspect(file)} -> #{inspect(slugified_export_file)}")

        # Update cache with new file information
        new_entry = %{
          "size" => size,
          "mtime" => mtime,
          "hash" => file_hash,
          "export_path" => slugified_export_file,
          "links" => links
        }

        %{file => new_entry}
      end
    end
  end

  # Cache management functions

  defp load_cache(exportpath) do
    cache_path = Path.join(exportpath, @cache_file)

    if File.exists?(cache_path) do
      case File.read(cache_path) do
        {:ok, content} ->
          case Jason.decode(content) do
            {:ok, cache} ->
              cache

            _ ->
              IO.puts("Warning: Could not parse cache file. Starting with empty cache.")
              %{}
          end

        _ ->
          IO.puts("Warning: Could not read cache file. Starting with empty cache.")
          %{}
      end
    else
      IO.puts("No cache file found. Starting with empty cache.")
      %{}
    end
  end

  defp save_cache(cache, exportpath) do
    cache_path = Path.join(exportpath, @cache_file)

    # Ensure export directory exists
    File.mkdir_p!(exportpath)

    case Jason.encode(cache, pretty: true) do
      {:ok, json} ->
        File.write!(cache_path, json)

      _ ->
        IO.puts("Warning: Failed to encode cache to JSON")
    end
  end

  defp compute_file_hash(file) do
    case File.read(file) do
      {:ok, content} ->
        :crypto.hash(:md5, content) |> Base.encode16(case: :lower)

      _ ->
        # If we can't read the file, generate a unique hash based on the path and current time
        # This ensures we'll process it next time
        :crypto.hash(:md5, "#{file}#{:os.system_time(:millisecond)}")
        |> Base.encode16(case: :lower)
    end
  end

  defp filter_changed_files(files, cache) do
    Enum.split_with(files, fn file ->
      # A file needs processing if:
      # 1. It's not in the cache, or
      # 2. Its stats have changed
      case Map.get(cache, file) do
        nil ->
          true

        entry ->
          case File.stat(file, time: :posix) do
            {:ok, %{size: size, mtime: mtime}} ->
              size != entry["size"] || mtime != entry["mtime"] ||
                compute_file_hash(file) != entry["hash"]

            _ ->
              true
          end
      end
    end)
  end

  defp find_deleted_files(current_files, cache) do
    # Files that were in the cache but are no longer in the current files list
    # Only consider regular files, not asset folders or db directories
    Map.keys(cache)
    |> Enum.filter(fn cached_file ->
      case Map.get(cache, cached_file) do
        # Skip asset folders and db directories
        %{"type" => type} when type in ["asset_folder", "db_directory"] -> false
        # Include regular files that are no longer in the current files list
        _ -> cached_file not in current_files
      end
    end)
  end

  defp remove_deleted_exports(deleted_files, _vault_dir, exportpath) do
    Enum.each(deleted_files, fn file ->
      case Map.get(load_cache(exportpath), file) do
        nil ->
          :ok

        entry ->
          export_path = entry["export_path"]

          if export_path && File.exists?(export_path) do
            # Check if this is a directory (asset folder) or a regular file
            is_directory =
              entry["type"] == "asset_folder" || entry["type"] == "db_directory" ||
                File.dir?(export_path)

            # Use appropriate removal function based on the type
            try do
              if is_directory do
                # For directories, use rm_rf which can remove directories recursively
                File.rm_rf!(export_path)
                IO.puts("Removed export for deleted directory: #{file} -> #{export_path}")
              else
                # For regular files, use rm
                File.rm!(export_path)
                IO.puts("Removed export for deleted file: #{file} -> #{export_path}")
              end
            rescue
              e in File.Error ->
                IO.puts(
                  "Warning: Could not remove #{if is_directory, do: "directory", else: "file"} #{export_path}: #{e.reason}"
                )
            end
          end
      end
    end)
  end

  defp process_duckdb_queries(content) do
    content
    |> process_dsql_tables()
    |> process_dsql_lists()
  end

  defp process_dsql_tables(content) do
    Regex.replace(~r/```dsql-table\n(.*?)```/s, content, fn _, query ->
      case DuckDBUtils.execute_query_temp(query) do
        {:ok, result} -> DuckDBUtils.result_to_markdown_table(result, query)
        {:error, error} -> "Error executing query: #{error}"
      end
    end)
  end

  defp process_dsql_lists(content) do
    Regex.replace(~r/```dsql-list\n(.*?)```/s, content, fn _, query ->
      case DuckDBUtils.execute_query_temp(query) do
        {:ok, result} -> DuckDBUtils.result_to_markdown_list(result, query)
        {:error, error} -> "Error executing query: #{error}"
      end
    end)
  end

  defp get_directory_mtime(dir_path) do
    # Get the modification time of the directory itself
    case File.stat(dir_path, time: :posix) do
      {:ok, %{mtime: mtime}} -> mtime
      # Default to 0 if we can't get the mtime
      _ -> 0
    end
  end

  defp preserve_relative_prefix_and_slugify(path) do
    # Extract and preserve any relative path prefix
    {relative_prefix, path_without_prefix} =
      if String.match?(path, ~r|^(\.\./)+|) do
        [prefix | _] = Regex.run(~r|^(\.\./)+|, path)
        {prefix, String.replace_prefix(path, prefix, "")}
      else
        {"", path}
      end

    # Slugify the path without the relative prefix
    slugified_path = Slugify.slugify_path(path_without_prefix)

    # Re-add the relative prefix
    relative_prefix <> slugified_path
  end

  defp replace_path_prefix(path, old_prefix, new_prefix) do
    # For relative paths, we need to handle the full path including the relative prefix
    # This ensures paths like "../../vault/file.md" become "../../public/content/file.md"

    # Normalize paths to ensure consistent handling
    normalized_path = Path.expand(path)
    normalized_old_prefix = Path.expand(old_prefix)

    # Get the relative part of the path after the old_prefix
    relative_part = Path.relative_to(normalized_path, normalized_old_prefix)

    # If the path starts with the old_prefix (i.e., relative_part is different from the original path)
    if relative_part != normalized_path do
      # Join the new_prefix with the relative part
      result = Path.join(new_prefix, relative_part)

      # If the original path was relative (started with "../"), preserve that style
      if String.starts_with?(path, "../") do
        result
      else
        # Otherwise, normalize the result
        Path.expand(result)
      end
    else
      # Fallback to the original method if the path doesn't start with old_prefix
      old_base = Path.basename(old_prefix)
      new_base = Path.basename(new_prefix)
      String.replace(path, ~r"(^|/)#{old_base}(/|$)", "\\1#{new_base}\\2")
    end
  end
end
