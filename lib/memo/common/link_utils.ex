defmodule Memo.Common.LinkUtils do
  @moduledoc """
  Utility functions for handling links in markdown files.
  """

  alias Memo.Common.Slugify

  @doc """
  Extracts links from content.
  """
  def extract_links(content) do
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

  @doc """
  Resolves links to their corresponding file paths.
  """
  def resolve_links(links, all_files, vaultpath) do
    links
    |> Flow.from_enumerable()
    |> Flow.flat_map(&find_link_paths(&1, all_files, vaultpath))
    |> Enum.into(%{})
  end

  @doc """
  Converts links in content to their resolved paths.
  """
  def convert_links(content, resolved_links) do
    sanitized_resolved_links =
      Enum.reduce(resolved_links, %{}, fn {k, v}, acc ->
        sanitized_key = String.replace(k, ~r/\\\|/, "|")
        Map.put(acc, sanitized_key, String.replace(v, ~r/\\$/, ""))
      end)

    split_content_and_code_blocks(content)
    |> Enum.map(fn
      {:code, block} ->
        block
      {:content, text} ->
        text
        |> convert_links_with_alt_text(sanitized_resolved_links)
        |> convert_links_without_alt_text(sanitized_resolved_links)
        |> convert_embedded_images(sanitized_resolved_links)
        |> convert_markdown_links(sanitized_resolved_links)
    end)
    |> Enum.join("")
  end

  @doc """
  Checks if a given string is a URL.
  """
  def is_url?(link) when is_binary(link) do
    uri = URI.parse(link)
    uri.scheme != nil && uri.host != nil
  end

  def is_url?(_), do: false

  defp find_link_paths(link, all_files, vaultpath) do
    downcased_link = String.downcase(link)

    for path <- all_files,
        basename = Path.basename(path),
        downcased_basename = String.downcase(basename),
        String.contains?(basename, link) or String.contains?(downcased_basename, downcased_link),
        into: %{} do
      {link, Path.relative_to(path, vaultpath) |> String.downcase()}
    end
  end

  defp split_content_and_code_blocks(content) do
    regex = ~r/(```[\s\S]*?```)/m
    parts = Regex.split(regex, content, include_captures: true)

    parts
    |> Enum.map(fn part ->
      if String.starts_with?(part, "```") do
        {:code, part}
      else
        {:content, part}
      end
    end)
  end

  defp convert_links_with_alt_text(content, resolved_links) do
    Regex.replace(~r/(?<![`\w])\[\[([^\|\]]+)\|([^\]]+)\]\](?![`\w])/, content, fn _full_match, link, alt_text ->
      resolved_path =
        Map.get(resolved_links, link, link)
        |> String.replace(~r/\\$/, "")
        |> Slugify.slugify_link_path()

      if file_exists?(resolved_path) do
        "[#{alt_text}](#{resolved_path})"
      else
        "[#{alt_text}]()"
      end
    end)
  end

  defp convert_links_without_alt_text(content, resolved_links) do
    Regex.replace(~r/(?<![`\w])\[\[([^\]]+)\]\](?![`\w])/, content, fn _full_match, link ->
      resolved_path =
        Map.get(resolved_links, link, "#{link}.md")
        |> String.replace(~r/\\$/, "")
        |> Slugify.slugify_link_path()

      alt_text = Path.basename(resolved_path, ".md")

      if file_exists?(resolved_path) do
        "[#{alt_text}](#{resolved_path})"
      else
        "[#{alt_text}]()"
      end
    end)
  end

  defp convert_embedded_images(content, resolved_links) do
    Regex.replace(~r/!\[\[([^\]]+)\]\]/, content, fn _, link ->
      resolved_path =
        Map.get(resolved_links, link, link)
        |> String.replace(~r/\\$/, "")
        |> Slugify.slugify_link_path()

      "![](#{resolved_path})"
    end)
  end

  defp convert_markdown_links(content, resolved_links) do
    Regex.replace(~r/\[([^\]]+)\]\(([^\)]+\.md)\)/, content, fn _, alt_text, link ->
      resolved_path =
        Map.get(resolved_links, link, link)
        |> String.replace(~r/\\$/, "")
        |> Slugify.slugify_link_path()

      if file_exists?(resolved_path) do
        "[#{alt_text}](#{resolved_path})"
      else
        "[#{alt_text}]()"
      end
    end)
  end

  defp file_exists?(path) do
    File.exists?(path)
  end
end
