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
  Checks if a file contains required frontmatter keys.
  """
  def contains_required_frontmatter_keys?(file) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- parse_frontmatter(content) do
      Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")
    else
      _ -> false
    end
  end

  @doc """
  Parses frontmatter from content.
  """
  def parse_frontmatter(content) do
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
end
