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
  Files with skip_frontmatter_check: true will bypass validation requirements.
  """
  def contains_required_frontmatter_keys?(file) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- parse_frontmatter(content) do
      cond do
        is_map(frontmatter) and Map.get(frontmatter, "skip_frontmatter_check") == true ->
          true

        is_map(frontmatter) ->
          has_required_fields?(frontmatter) and has_valid_optional_fields?(frontmatter)

        is_list(frontmatter) ->
          Enum.any?(frontmatter, fn item ->
            is_map(item) and
              (Map.get(item, "skip_frontmatter_check") == true or
                 (has_required_fields?(item) and has_valid_optional_fields?(item)))
          end)

        true ->
          false
      end
    else
      _ -> false
    end
  end

  def has_required_fields?(frontmatter) do
    Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")
  end

  def has_valid_optional_fields?(frontmatter) do
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

  @doc """
  Dumps frontmatter to YAML format.
  """
  def dump_frontmatter(frontmatter) do
    frontmatter
    |> remove_nil_and_empty_values()
    |> Enum.map(fn {key, value} -> format_yaml_line(key, value, 0) end)
    |> Enum.join("\n")
  end

  @doc """
  Recursively removes nil values and empty maps/lists from a map structure.
  """
  def remove_nil_and_empty_values(map) when is_map(map) do
    map
    |> Enum.map(fn {k, v} -> {k, remove_nil_and_empty_values(v)} end)
    |> Enum.filter(fn {_, v} -> v != nil and v != %{} and v != [] end)
    |> Enum.into(%{})
  end

  def remove_nil_and_empty_values(list) when is_list(list) do
    list
    |> Enum.map(&remove_nil_and_empty_values/1)
    |> Enum.filter(fn v -> v != nil and v != %{} and v != [] end)
  end

  def remove_nil_and_empty_values(value), do: value

  defp format_yaml_line(key, value, indent_level) when is_list(value) and value != [] do
    indent = String.duplicate("  ", indent_level)

    formatted_values =
      Enum.map_join(value, "\n", fn v ->
        "#{indent}- #{format_yaml_value(v, indent_level + 1)}"
      end)

    "#{indent}#{key}:\n#{formatted_values}"
  end

  defp format_yaml_line(key, value, indent_level) when is_map(value) and value != %{} do
    indent = String.duplicate("  ", indent_level)

    formatted_values =
      Enum.map_join(value, "\n", fn {k, v} -> format_yaml_line(k, v, indent_level + 1) end)

    "#{indent}#{key}:\n#{formatted_values}"
  end

  defp format_yaml_line(key, value, indent_level) when not is_nil(value) do
    indent = String.duplicate("  ", indent_level)
    "#{indent}#{key}: #{format_yaml_value(value, indent_level)}"
  end

  defp format_yaml_value(value, _indent_level) when is_binary(value) do
    if String.contains?(value, "\n") do
      "|\n  #{String.replace(value, "\n", "\n  ")}"
    else
      "\"#{String.replace(value, "\"", "\\\"")}\""
    end
  end

  defp format_yaml_value(value, _indent_level) when is_number(value) or is_boolean(value) do
    "#{value}"
  end

  defp format_yaml_value(value, _indent_level) do
    "\"#{inspect(value)}\""
  end
end
