defmodule Memo.Common.FileUtils do
  @moduledoc """
  Utility functions for file operations.
  """

  @doc """
  Lists files recursively in a directory.
  """
  def list_files_recursive(path) do
    File.ls!(path)
    |> Enum.flat_map(fn file ->
      normalized_file = normalize_path(file)
      full_path = Path.join(path, normalized_file)

      if File.dir?(full_path) do
        [full_path | list_files_recursive(full_path)]
      else
        [full_path]
      end
    end)
  end

  @doc """
  Normalizes a file path.
  """
  def normalize_path(path) do
    path
    |> String.replace("Â§", "§")
    |> String.to_charlist()
    |> Enum.map(fn
      c when c < 128 -> c
      c -> c
    end)
    |> List.to_string()
  end

  @doc """
  Reads the .export-ignore file and returns a list of patterns.
  """
  def read_export_ignore_file(ignore_file) do
    if File.exists?(ignore_file) do
      File.read!(ignore_file)
      |> String.split("\n", trim: true)
      # Remove trailing CR if present
      |> Enum.map(&String.trim_trailing(&1, "\r"))
      |> Enum.filter(&(&1 != "" and not String.starts_with?(&1, "#")))
    else
      []
    end
  end

  @doc """
  Checks if a file should be ignored based on patterns.
  """
  def ignored?(file, patterns, vaultpath) do
    relative_path = Path.relative_to(file, vaultpath)
    normalized_path = normalize_path(relative_path)
    Enum.any?(patterns, &match_pattern?(normalized_path, &1))
  end

  defp match_pattern?(path, pattern) do
    cond do
      String.ends_with?(pattern, "/") ->
        String.starts_with?(path, pattern) or String.contains?(path, "/#{pattern}")

      String.starts_with?(pattern, "*") ->
        String.ends_with?(path, String.trim_leading(pattern, "*"))

      String.ends_with?(pattern, "*") ->
        String.starts_with?(path, String.trim_trailing(pattern, "*"))

      true ->
        path == pattern or String.contains?(path, pattern)
    end
  end
end
