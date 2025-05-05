defmodule Memo.Common.Slugify do
  @moduledoc """
  A module providing utility functions for slugifying strings, filenames, and paths.
  """

  def slugify(string) do
    string
    # Add replacements for common problematic Obsidian characters and ¶
    |> String.replace(~r/[\"#$%^&*:|\[\]{}()\*\\\/<>¶]/u, "")
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s_-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.replace(~r/-+/, "-")
    |> String.trim("-")
  end

  def slugify_filename(filename) do
    {name, ext} = Path.basename(filename) |> Path.rootname() |> (&{&1, Path.extname(filename)}).()
    slugify(name) <> ext
  end

  def slugify_path(path) do
    dirname = Path.dirname(path)
    basename = Path.basename(path)
    Path.join(slugify_directory(dirname), slugify_filename(basename))
  end

  def slugify_directory(path) do
    path
    |> Path.split()
    |> Enum.map(&slugify/1)
    |> Path.join()
  end

  def slugify_markdown_links(content) do
    split_content_and_code_blocks(content)
    |> Enum.map(fn
      {:code, block} -> block
      {:content, text} -> slugify_links_in_text(text)
    end)
    |> Enum.join("")
  end

  defp slugify_links_in_text(text) do
    regex = ~r/\[([^\]]+)\]\(([^)]+)\)/

    Regex.replace(regex, text, fn _, link_text, link ->
      slugified_link = slugify_link_path(link)
      "[#{link_text}](#{slugified_link})"
    end)
  end

  def slugify_link_path(link) do
    cond do
      String.starts_with?(link, ["http://", "https://", "#"]) ->
        link

      String.contains?(link, "#") ->
        [path, fragment] = String.split(link, "#", parts: 2)
        slugified_path = slugify_path_components(URI.decode(path))
        "#{slugified_path}##{fragment}"

      true ->
        slugify_path_components(URI.decode(link))
    end
  end

  def slugify_path_components(path) when is_binary(path) do
    path
    |> Path.split()
    |> slugify_path_components()
  end

  def slugify_path_components(components) when is_list(components) do
    components
    |> Enum.map(fn component ->
      case component do
        "." -> "."
        ".." -> ".."
        "/" -> "/"
        _ -> slugify_filename(component)
      end
    end)
    |> Path.join()
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
end
