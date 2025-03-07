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
      process_directory(all_valid_files, all_assets, vault_dir, exportpath, ignored_patterns, cache)
    end
  end

  defp process_single_file(vaultpath, vault_dir, exportpath, all_valid_files, cache) do
    normalized_vaultpath = FileUtils.normalize_path(vaultpath)

    if Enum.member?(all_valid_files, normalized_vaultpath) and
         Frontmatter.contains_required_frontmatter_keys?(normalized_vaultpath) do
      # Process the file and update the cache
      new_cache = process_file(normalized_vaultpath, vault_dir, exportpath, all_valid_files, cache)
      save_cache(new_cache, exportpath)
    else
      IO.puts(
        "File #{inspect(vaultpath)} does not exist, is ignored, or does not contain required frontmatter keys."
      )
    end
  end

  defp process_directory(all_valid_files, all_assets, vault_dir, exportpath, ignored_patterns, cache) do
    # Find files that need processing (new or modified)
    {files_to_process, files_unchanged} = filter_changed_files(all_valid_files, cache)

    # Find files that were in the cache but no longer exist (deleted)
    deleted_files = find_deleted_files(all_valid_files, cache)

    # Process only changed files
    new_cache =
      if Enum.empty?(files_to_process) do
        IO.puts("No files have changed since last run.")
        cache
      else
        IO.puts("Processing #{Enum.count(files_to_process)} changed files...")

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
    Enum.each(all_assets, &export_assets_folder(&1, vault_dir, exportpath, ignored_patterns))

    # Export the db directory
    export_db_directory("../../db", exportpath)

    # Save the updated cache
    save_cache(new_cache, exportpath)
  end

  defp export_assets_folder(asset_path, vaultpath, exportpath, ignored_patterns) do
    if Path.basename(asset_path) == "assets" and
         Path.basename(Path.dirname(asset_path)) != "assets" and
         not FileUtils.ignored?(asset_path, ignored_patterns, vaultpath) do
      target_path = replace_path_prefix(asset_path, vaultpath, exportpath)
      slugified_target_path = preserve_relative_prefix_and_slugify(target_path)
      copy_directory(asset_path, slugified_target_path, ignored_patterns, vaultpath)
      IO.puts("Exported assets: #{asset_path} -> #{slugified_target_path}")
    end

    # Always return an empty map to avoid Enumerable protocol errors
    %{}
  end

  defp export_db_directory(dbpath, exportpath) do
    if File.dir?(dbpath) do
      export_db_path = Path.join(exportpath, "../../db")
      # Use preserve_relative_prefix_and_slugify to keep the relative path prefix
      slugified_export_db_path = preserve_relative_prefix_and_slugify(export_db_path)
      copy_directory(dbpath, slugified_export_db_path, [], dbpath)
      IO.puts("Exported db folder: #{dbpath} -> #{slugified_export_db_path}")
    else
      IO.puts("db folder not found at #{dbpath}")
    end

    # Always return an empty map to avoid Enumerable protocol errors
    %{}
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
      content = File.read!(file)
      links = LinkUtils.extract_links(content)
      resolved_links = LinkUtils.resolve_links(links, all_files, vaultpath)
      converted_content = LinkUtils.convert_links(content, resolved_links, file)
      converted_content = process_duckdb_queries(converted_content)
      converted_content = Slugify.slugify_markdown_links(converted_content)
      converted_content = KatexUtils.wrap_multiline_katex(converted_content)

      export_file = replace_path_prefix(file, vaultpath, exportpath)
      slugified_export_file = preserve_relative_prefix_and_slugify(export_file)

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

  # Cache management functions

  defp load_cache(exportpath) do
    cache_path = Path.join(exportpath, @cache_file)

    if File.exists?(cache_path) do
      case File.read(cache_path) do
        {:ok, content} ->
          case Jason.decode(content) do
            {:ok, cache} -> cache
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
        IO.puts("Cache saved to #{cache_path}")
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
        :crypto.hash(:md5, "#{file}#{:os.system_time(:millisecond)}") |> Base.encode16(case: :lower)
    end
  end

  defp filter_changed_files(files, cache) do
    Enum.split_with(files, fn file ->
      # A file needs processing if:
      # 1. It's not in the cache, or
      # 2. Its stats have changed
      case Map.get(cache, file) do
        nil -> true
        entry ->
          case File.stat(file, time: :posix) do
            {:ok, %{size: size, mtime: mtime}} ->
              size != entry["size"] || mtime != entry["mtime"] ||
              compute_file_hash(file) != entry["hash"]
            _ -> true
          end
      end
    end)
  end

  defp find_deleted_files(current_files, cache) do
    # Files that were in the cache but are no longer in the current files list
    Map.keys(cache) |> Enum.filter(fn cached_file -> cached_file not in current_files end)
  end

  defp remove_deleted_exports(deleted_files, _vault_dir, exportpath) do
    Enum.each(deleted_files, fn file ->
      case Map.get(load_cache(exportpath), file) do
        nil -> :ok
        entry ->
          export_path = entry["export_path"]
          if export_path && File.exists?(export_path) do
            File.rm!(export_path)
            IO.puts("Removed export for deleted file: #{file} -> #{export_path}")
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
    # Extract the base names without any path components
    old_base = Path.basename(old_prefix)
    new_base = Path.basename(new_prefix)

    # Handle both relative and absolute paths
    # This works with paths like "../../vault" and "../../content"
    String.replace(path, ~r"(^|/)#{old_base}(/|$)", "\\1#{new_base}\\2")
  end
end
