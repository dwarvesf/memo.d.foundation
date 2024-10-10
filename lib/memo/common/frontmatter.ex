defmodule Memo.Common.Frontmatter do
  @moduledoc """
  Utility functions for handling frontmatter in markdown files.
  """

  @doc """
  Extracts frontmatter from content.
  """
  def extract_frontmatter(content) do
    with [frontmatter_content] <-
           Regex.run(~r/^---\n(.+?)\n---\n/s, content, capture: :all_but_first),
         {:ok, metadata} <- YamlElixir.read_from_string(frontmatter_content) do
      {metadata, strip_frontmatter(content)}
    else
      nil -> {:error, :no_frontmatter}
      {:error, _reason} -> {:error, :invalid_frontmatter}
    end
  end

  @doc """
  Strips frontmatter from content.
  """
  def strip_frontmatter(content) do
    [_, rest] = String.split(content, "---\n", parts: 2)
    String.split(rest, "\n---\n", parts: 2) |> List.last()
  end

  @doc """
  Checks if a file contains required frontmatter keys with correct types.
  """
  def contains_required_frontmatter_keys?(file) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- parse_frontmatter(content) do
      has_required_fields?(frontmatter) and
        has_valid_optional_fields?(frontmatter)
    else
      _ -> false
    end
  end

  defp has_required_fields?(frontmatter) do
    Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")
  end

  defp has_valid_optional_fields?(frontmatter) do
    authors = Map.get(frontmatter, "authors")
    tags = Map.get(frontmatter, "tags")

    (is_nil(authors) or is_list(authors)) and
      (is_nil(tags) or is_list(tags))
  end

  @doc """
  Parses frontmatter from content.
  """
  def parse_frontmatter(content) do
    case Regex.run(~r/^---\n(.*?)\n---/s, content, capture: :all_but_first) do
      [frontmatter_str] ->
        YamlElixir.read_from_string(frontmatter_str)

      _ ->
        {:error, :no_frontmatter}
    end
  end
end
