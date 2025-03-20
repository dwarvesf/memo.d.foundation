defmodule Memo.ExportMarkdown do
  @moduledoc """
  A module to export Obsidian markdown files and assets folders to standard markdown.
  """

  use Flow
  alias Memo.Common.{FileUtils, Frontmatter, LinkUtils, DuckDBUtils, Slugify, KatexUtils}

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

    if mode == :file do
      process_single_file(vaultpath, vault_dir, exportpath, all_valid_files)
    else
      process_directory(all_valid_files, all_assets, vault_dir, exportpath, ignored_patterns)
    end
  end

  defp process_single_file(vaultpath, vault_dir, exportpath, all_valid_files) do
    normalized_vaultpath = FileUtils.normalize_path(vaultpath)

    if Enum.member?(all_valid_files, normalized_vaultpath) and
         Frontmatter.contains_required_frontmatter_keys?(normalized_vaultpath) do
      process_file(normalized_vaultpath, vault_dir, exportpath, all_valid_files)
    else
      IO.puts(
        "File #{inspect(vaultpath)} does not exist, is ignored, or does not contain required frontmatter keys."
      )
    end
  end

  defp process_directory(all_valid_files, all_assets, vault_dir, exportpath, ignored_patterns) do
    Flow.from_enumerable(all_valid_files)
    |> Flow.filter(&Frontmatter.contains_required_frontmatter_keys?/1)
    |> Flow.map(&process_file(&1, vault_dir, exportpath, all_valid_files))
    |> Flow.run()

    Flow.from_enumerable(all_assets)
    |> Flow.map(&export_assets_folder(&1, vault_dir, exportpath, ignored_patterns))
    |> Flow.run()

    # Export the db directory
    export_db_directory("db", exportpath)

    # Generate contributor files
    generate_contributor_files(exportpath)

    # Create blank _index.md files in folders without them
    generate_missing_index_files(exportpath)
  end

  defp export_assets_folder(asset_path, vaultpath, exportpath, ignored_patterns) do
    if Path.basename(asset_path) == "assets" and
         Path.basename(Path.dirname(asset_path)) != "assets" and
         not FileUtils.ignored?(asset_path, ignored_patterns, vaultpath) do
      target_path = replace_path_prefix(asset_path, vaultpath, exportpath)
      slugified_target_path = Slugify.slugify_path(target_path)
      copy_directory(asset_path, slugified_target_path, ignored_patterns, vaultpath)
      IO.puts("Exported assets: #{asset_path} -> #{slugified_target_path}")
    end
  end

  defp export_db_directory(dbpath, exportpath) do
    if File.dir?(dbpath) do
      export_db_path = Path.join(exportpath, "db")
      slugified_export_db_path = Slugify.slugify_path(export_db_path)
      copy_directory(dbpath, slugified_export_db_path, [], dbpath)
      IO.puts("Exported db folder: #{dbpath} -> #{slugified_export_db_path}")
    else
      IO.puts("db folder not found at #{dbpath}")
    end
  end

  defp copy_directory(source, destination, ignored_patterns, vaultpath) do
    slugified_destination = Slugify.slugify_path(destination)
    File.mkdir_p!(slugified_destination)

    File.ls!(source)
    |> Enum.each(fn item ->
      source_path = Path.join(source, item)
      dest_path = Path.join(slugified_destination, Slugify.slugify_filename(item))

      if not FileUtils.ignored?(source_path, ignored_patterns, vaultpath) do
        if File.dir?(source_path) do
          if Path.basename(source_path) != "assets" or Path.basename(source) != "assets" do
            copy_directory(source_path, dest_path, ignored_patterns, vaultpath)
          end
        else
          File.copy!(source_path, dest_path)
        end
      end
    end)
  end

  defp process_file(file, vaultpath, exportpath, all_files) do
    content = File.read!(file)
    links = LinkUtils.extract_links(content)
    resolved_links = LinkUtils.resolve_links(links, all_files, vaultpath)
    converted_content = LinkUtils.convert_links(content, resolved_links, file)
    converted_content = process_duckdb_queries(converted_content)
    converted_content = Slugify.slugify_markdown_links(converted_content)
    converted_content = KatexUtils.wrap_multiline_katex(converted_content)

    export_file = replace_path_prefix(file, vaultpath, exportpath)

    slugified_export_file = Slugify.slugify_path(export_file)

    export_dir = Path.dirname(slugified_export_file)
    File.mkdir_p!(export_dir)

    File.write!(slugified_export_file, converted_content)
    IO.puts("Exported: #{inspect(file)} -> #{inspect(slugified_export_file)}")
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

  defp replace_path_prefix(path, old_prefix, new_prefix) do
    [old_prefix, new_prefix]
    |> Enum.map(&Path.split/1)
    |> Enum.map(&List.first/1)
    |> then(fn [old, new] -> String.replace_prefix(path, old, new) end)
  end

  defp generate_missing_index_files(exportpath) do
    # Get all directories in the export path
    directories = get_all_directories(exportpath)

    # For each directory, check if it has an _index.md and create one if not
    Enum.each(directories, fn dir_path ->
      index_file_path = Path.join(dir_path, "_index.md")

      if !File.exists?(index_file_path) do
        # Create a basic frontmatter with title based on the directory name
        dir_name = Path.basename(dir_path)
        content = """
        ---
        title: #{String.capitalize(dir_name)}
        ---
        """

        # Write the file
        File.write!(index_file_path, content)
        IO.puts("Generated blank _index.md in: #{dir_path}")
      end
    end)
  end

  defp get_all_directories(path) do
    if File.dir?(path) do
      # Skip if the current directory is named "assets"
      if Path.basename(path) == "assets" do
        []
      else
        subdirs =
          File.ls!(path)
          |> Enum.filter(fn item ->
            full_path = Path.join(path, item)
            # Filter directories, exclude hidden dirs and "assets" dirs
            File.dir?(full_path) &&
              !String.starts_with?(item, ".") &&
              item != "assets"
          end)
          |> Enum.flat_map(fn item ->
            full_path = Path.join(path, item)
            [full_path | get_all_directories(full_path)]
          end)

        [path | subdirs]
      end
    else
      []
    end
  end

  defp generate_contributor_files(exportpath) do
    # Create the contributor directory
    contributor_dir = Path.join(exportpath, "contributor")
    File.mkdir_p!(contributor_dir)

    # Create _index.md in the contributor directory
    index_content = """
    ---
    title: Contributors
    ---
    """
    index_path = Path.join(contributor_dir, "_index.md")
    File.write!(index_path, index_content)
    IO.puts("Generated contributor _index.md: #{index_path}")

    # Query DuckDB for unique authors
    query = """
    WITH unnested_authors AS (
      SELECT unnest(authors) AS author_name
      FROM vault
      WHERE 
        authors IS NOT NULL 
        AND title IS NOT NULL 
        AND title != ''
        AND description IS NOT NULL 
        AND description != ''
    )
    SELECT DISTINCT author_name
    FROM unnested_authors
    WHERE author_name IS NOT NULL AND author_name != ''
    ORDER BY author_name;
    """

    case DuckDBUtils.execute_query_temp(query) do
      {:ok, result} ->
        # Handle different result formats - could be a list of maps or a struct with rows
        authors = cond do
          is_list(result) && Enum.all?(result, &is_map/1) ->
            # Format is list of maps with author_name key
            result
            |> Enum.map(fn map -> Map.get(map, "author_name") end)
            |> Enum.filter(fn name -> name != nil && String.trim(name) != "" end)
            
          is_map(result) && Map.has_key?(result, :rows) ->
            # Format is struct with rows field
            result.rows
            |> Enum.map(fn [author_name] -> author_name end)
            |> Enum.filter(fn name -> name != nil && String.trim(name) != "" end)
            
          true ->
            IO.puts("Unexpected DuckDB result format: #{inspect(result)}")
            []
        end

        # Create a file for each author
        Enum.each(authors, fn author_name ->
          slug = Slugify.slugify(author_name)
          file_content = """
          ---
          title: #{author_name}
          ---
          """
          file_path = Path.join(contributor_dir, "#{slug}.md")
          File.write!(file_path, file_content)
          IO.puts("Generated contributor file: #{file_path}")
        end)

      {:error, error} ->
        IO.puts("Error fetching authors from DuckDB: #{error}")
    end
  end
end
