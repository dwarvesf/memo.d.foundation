defmodule Memo.Common.GitUtils do
  @moduledoc """
  Utility functions for Git operations.
  """

  @doc """
  Checks a Git config setting.
  """
  def check_git_config_setting(section, key) do
    case System.cmd("git", ["config", "--get-all", "#{section}.#{key}"]) do
      {result, 0} ->
        String.split(String.trim(result), "\n")

      # Setting does not exist
      {"", 1} ->
        []

      {error_message, _} ->
        IO.puts("Error checking git config: #{error_message}")
        []
    end
  end

  @doc """
  Adds a Git config setting.
  """
  def add_git_config_setting(section, key, value) do
    System.cmd("git", ["config", "--add", "#{section}.#{key}", value])
  end

  @doc """
  Handles updating a Git setting.
  """
  def handle_git_setting(section, key, value, message) do
    settings = check_git_config_setting(section, key)

    if value not in settings do
      IO.puts("#{message} Setting #{section}.#{key} to #{value}...")
      add_git_config_setting(section, key, value)
    else
      IO.puts("Setting already applied. Skipping #{message} for #{section}.#{key}")
    end
  end

  @doc """
  Gets modified files in a Git repository.
  """
  def get_modified_files(directory, commits_back \\ "HEAD^") do
    revision = if valid_revision?(directory, commits_back), do: commits_back, else: "HEAD"

    {output, _status} =
      System.cmd("git", ["diff", "--name-only", revision], cd: directory, stderr_to_stdout: true)

    output
    |> String.split("\n")
    |> Enum.filter(&String.ends_with?(&1, ".md"))
    |> Enum.reject(&String.contains?(&1, "fatal: Needed a single revision"))
  end

  @doc """
  Lists submodules in a Git repository.
  """
  def list_submodules(directory) do
    case System.cmd("git", [
           "config",
           "--file",
           Path.join(directory, ".gitmodules"),
           "--name-only",
           "--get-regexp",
           "submodule\\..*\\.path"
         ]) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.map(&get_submodule_path(directory, &1))

      _ ->
        []
    end
  end

  @doc """
  Gets modified files in a Git submodule.
  """
  def get_submodule_modified_files(base_directory, submodule, commits_back \\ "HEAD^") do
    submodule_dir = Path.join(base_directory, submodule)

    case get_modified_files(submodule_dir, commits_back) do
      [] -> []
      modified_files -> Enum.map(modified_files, &Path.join(submodule, &1))
    end
  end

  defp get_submodule_path(directory, line) do
    case System.cmd("git", [
           "config",
           "--file",
           Path.join(directory, ".gitmodules"),
           "--get",
           line
         ]) do
      {output, 0} ->
        output |> String.trim()

      _ ->
        nil
    end
  end

  defp valid_revision?(directory, revision) do
    case System.cmd("git", ["rev-parse", "--verify", revision],
           cd: directory,
           stderr_to_stdout: true
         ) do
      {_, 0} -> true
      _ -> false
    end
  end
end
