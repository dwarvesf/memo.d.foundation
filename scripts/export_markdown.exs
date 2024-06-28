#!/usr/bin/env elixir

Mix.install([
  {:flow, "~> 1.2"}
])

defmodule MarkdownExporter do
  @moduledoc """
  A module to export Obsidian markdown files and assets folders to standard markdown.
  """

  use Flow

  @doc """
  Entry point for the script.
  """
  def main(args) do
    {opts, _, _} = OptionParser.parse(args, strict: [vaultpath: :string, exportpath: :string])

    vaultpath = opts[:vaultpath] || "vault"
    exportpath = opts[:exportpath] || "content"

    {vault_dir, mode} =
      if File.dir?(vaultpath) do
        {vaultpath, :directory}
      else
        {Path.dirname(vaultpath), :file}
      end

    ignored_patterns = read_export_ignore_file(Path.join(vault_dir, ".export-ignore"))

    paths = list_files_and_assets_recursive(vault_dir)
    {all_files, all_assets} = Enum.split_with(paths, &File.regular?/1)

    all_valid_files =
      all_files
      |> Enum.filter(&(not ignored?(&1, ignored_patterns, vault_dir)))

    if mode == :file do
      if Enum.member?(all_valid_files, vaultpath) do
        if contains_required_frontmatter_keys?(vaultpath) do
          process_file(vaultpath, vault_dir, exportpath, all_valid_files)
        else
          IO.puts("File #{vaultpath} does not contain required frontmatter keys.")
        end
      else
        IO.puts("File #{vaultpath} does not exist or is ignored.")
      end
    else
      Flow.from_enumerable(all_valid_files)
      |> Flow.filter(&contains_required_frontmatter_keys?/1)
      |> Flow.map(&process_file(&1, vault_dir, exportpath, all_valid_files))
      |> Flow.run()

      Flow.from_enumerable(all_assets)
      |> Flow.map(&export_assets_folder(&1, vault_dir, exportpath))
      |> Flow.run()

      # Export the db directory
      export_db_directory("db", exportpath)
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

  defp export_assets_folder(asset_path, vaultpath, exportpath) do
    if Path.basename(asset_path) == "assets" do
      target_path = String.replace_prefix(asset_path, vaultpath, exportpath)
      File.mkdir_p!(target_path)

      File.cp_r!(asset_path, target_path)
      IO.puts("Exported assets: #{asset_path} -> #{target_path}")
    end
  end

  defp export_db_directory(dbpath, exportpath) do
    if File.dir?(dbpath) do
      export_db_path = Path.join(exportpath, "db")
      File.mkdir_p!(export_db_path)
      File.cp_r!(dbpath, export_db_path)
      IO.puts("Exported db folder: #{dbpath} -> #{export_db_path}")
    else
      IO.puts("db folder not found at #{dbpath}")
    end
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

  defp contains_required_frontmatter_keys?(file) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- parse_frontmatter(content) do
      Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")
    else
      _ -> false
    end
  end

  defp parse_frontmatter(content) do
    with [frontmatter_str] <- Regex.run(~r/^---\n(.*?)\n---/s, content, capture: :all_but_first) do
      frontmatter_str
      |> String.split("\n")
      |> Enum.map(&String.split(&1, ": ", parts: 2))
      |> Enum.filter(&match?([_, _], &1))
      |> Enum.into(%{}, fn [key, value] -> {key, String.trim(value)} end)
      |> (&{:ok, &1}).()
    else
      _ -> :error
    end
  end

  defp process_file(file, vaultpath, exportpath, all_files) do
    content = File.read!(file)
    links = extract_links(content)
    resolved_links = resolve_links(links, all_files, vaultpath)
    converted_content = convert_links(content, resolved_links)

    [vaultpath_prefix, exportpath_prefix] =
      [vaultpath, exportpath]
      |> Enum.map(&Path.split/1)
      |> Enum.map(&List.first/1)

    export_file = String.replace_prefix(file, vaultpath_prefix, exportpath_prefix)
    export_dir = Path.dirname(export_file)
    File.mkdir_p!(export_dir)

    File.write!(export_file, converted_content)
    IO.puts("Exported: #{file} -> #{export_file}")
  end

  defp extract_links(content) do
    pattern =
      ~r/!\[\[((?:[^\]]|\.mp4|\.webp|\.png|\.jpg|\.gif|\.svg)+)\]\]|\[\[([^\|\]]+\.md)\|([^\]]+)\]\]|\[\[([^\|\]]+)\|([^\]]+)\]\]|\[\[([^\|\]]+\.md)\]\]|\[\[([^\]]+)\]\]/

    Regex.scan(pattern, content)
    |> Enum.flat_map(fn
      [_, image] when not is_nil(image) -> [image]
      [_, _, pre, _] when not is_nil(pre) -> [pre]
      [_, _, _, _, file, _] when not is_nil(file) -> [file]
      [_, _, _, _, _, mdfile] when not is_nil(mdfile) -> [mdfile]
      [_, pre] when not is_nil(pre) -> [pre]
      _ -> []
    end)
  end

  defp resolve_links(links, all_files, vaultpath) do
    links
    |> Flow.from_enumerable()
    |> Flow.flat_map(&find_link_paths(&1, all_files, vaultpath))
    |> Enum.into(%{})
  end

  defp find_link_paths(link, all_files, vaultpath) do
    downcased_link = String.downcase(link)

    for path <- all_files,
        basename = Path.basename(path),
        downcased_basename = String.downcase(basename),
        String.contains?(basename, link) or String.contains?(downcased_basename, downcased_link),
        into: %{} do
      {link, Path.relative_to(path, vaultpath)}
    end
  end

  defp convert_links(content, resolved_links) do
    sanitized_resolved_links =
      Enum.reduce(resolved_links, %{}, fn {k, v}, acc ->
        sanitized_key = String.replace(k, ~r/\\\|/, "|")
        Map.put(acc, sanitized_key, String.replace(v, ~r/\\$/, ""))
      end)

    # First handle links with alt text
    content =
      Regex.replace(~r/\[\[([^\|\]]+)\|([^\]]+)\]\]/, content, fn _, link, alt_text ->
        resolved_path = Map.get(sanitized_resolved_links, link, link)
        resolved_path = String.replace(resolved_path, ~r/\\$/, "")
        "[#{alt_text}](#{resolved_path})"
      end)

    # Handle links without alt text
    content =
      Regex.replace(~r/\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(sanitized_resolved_links, link, "#{link}.md")
        resolved_path = String.replace(resolved_path, ~r/\\$/, "")
        alt_text = Path.basename(resolved_path, ".md")
        "[#{alt_text}](#{resolved_path})"
      end)

    # Handle embedded images
    content =
      Regex.replace(~r/!\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(sanitized_resolved_links, link, link)
        resolved_path = String.replace(resolved_path, ~r/\\$/, "")
        "![](#{resolved_path})"
      end)

    content
  end
end

MarkdownExporter.main(System.argv())
