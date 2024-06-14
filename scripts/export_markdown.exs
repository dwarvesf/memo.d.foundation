#!/usr/bin/env elixir

Mix.install([
  {:flow, "~> 1.2"}
])

defmodule MarkdownExporter do
  @moduledoc """
  A module to export Obsidian markdown files to standard markdown.
  """

  use Flow

  @doc """
  Entry point for the script.
  """
  def main(args) do
    {opts, _, _} = OptionParser.parse(args, strict: [vaultpath: :string, exportpath: :string])

    vaultpath = opts[:vaultpath] || "vault"
    exportpath = opts[:exportpath] || "content"

    ignored_patterns = read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))
    all_files = list_files_recursive(vaultpath)

    all_valid_files =
      all_files
      |> Enum.filter(&(not ignored?(&1, ignored_patterns, vaultpath)))

    all_valid_files
    |> Flow.from_enumerable()
    |> Flow.filter(&contains_required_frontmatter_keys?(&1))
    |> Flow.map(&process_file(&1, vaultpath, exportpath, all_valid_files))
    |> Flow.run()
  end

  defp list_files_recursive(path) do
    File.ls!(path)
    |> Enum.flat_map(fn file ->
      full_path = Path.join(path, file)

      if File.dir?(full_path) do
        list_files_recursive(full_path)
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

  defp contains_required_frontmatter_keys?(file) do
    content = File.read!(file)

    case parse_frontmatter(content) do
      {:ok, frontmatter} ->
        Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")

      _ ->
        false
    end
  end

  defp parse_frontmatter(content) do
    case Regex.run(~r/^---\n(.*?)\n---/s, content, capture: :all_but_first) do
      [frontmatter_str] ->
        frontmatter_str
        |> String.split("\n")
        |> Enum.reduce(%{}, fn line, acc ->
          case String.split(line, ": ", parts: 2) do
            [key, value] ->
              Map.put(acc, key, String.trim(value))

            _ ->
              acc
          end
        end)
        |> (&{:ok, &1}).()

      _ ->
        :error
    end
  end

  defp process_file(file, vaultpath, exportpath, all_files) do
    content = File.read!(file)
    links = extract_links(content)
    resolved_links = resolve_links(links, all_files, vaultpath)
    converted_content = convert_links(content, resolved_links)

    export_file = String.replace_prefix(file, vaultpath, exportpath)
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
    all_files
    |> Enum.reduce(%{}, fn path, acc ->
      if String.contains?(Path.basename(path), link) do
        relative_path = Path.relative_to(path, vaultpath)
        Map.put(acc, link, relative_path)
      else
        acc
      end
    end)
  end

  defp convert_links(content, resolved_links) do
    # First handle links with alt text
    content =
      Regex.replace(~r/\[\[([^\|\]]+)\|([^\]]+)\]\]/, content, fn _, link, alt_text ->
        resolved_path = Map.get(resolved_links, link, link)
        "[#{alt_text}](#{resolved_path})"
      end)

    # Handle links without alt text
    content =
      Regex.replace(~r/\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(resolved_links, link, "#{link}.md")
        alt_text = Path.basename(resolved_path, ".md")
        "[#{alt_text}](#{resolved_path})"
      end)

    # Handle embedded images
    content =
      Regex.replace(~r/!\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(resolved_links, link, link)
        "![](#{resolved_path})"
      end)

    content
  end
end

MarkdownExporter.main(System.argv())
