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
    # Determine the reference commit. If commits_back is invalid, default to "HEAD".
    # If commits_back is "HEAD", it implies we want changes relative to the last commit (i.e., uncommitted changes).
    # Otherwise, commits_back is an older commit (e.g., "HEAD~15", or a specific SHA).
    reference_commit =
      if valid_revision?(directory, commits_back) do
        commits_back
      else
        # Default to HEAD if commits_back is not a valid revision string
        "HEAD"
      end

    # Construct the git diff command arguments
    diff_args =
      cond do
        # Case 1: We want to see uncommitted changes (working directory vs. HEAD)
        # This happens if commits_back was explicitly "HEAD" or an invalid revision.
        reference_commit == "HEAD" ->
          ["diff", "--name-only", "HEAD"]

        # Case 2: We want to see changes between an older commit (reference_commit) and HEAD.
        # This covers commits_back like "HEAD~N" or a specific SHA.
        true ->
          ["diff", "--name-only", reference_commit, "HEAD"]
      end

    {output, _status} =
      System.cmd("git", diff_args, cd: directory, stderr_to_stdout: true)

    output
    |> String.split("\n")
    |> Enum.filter(&String.ends_with?(&1, ".md"))
    |> Enum.reject(&String.contains?(&1, "fatal: Needed a single revision"))
    # Safeguard for empty string results from String.split if output is empty
    |> Enum.reject(&(&1 == ""))
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

  # No @doc needed for private function
  def get_previous_paths(file_path_from_vault_root) do
    # Find the main project's git root
    main_git_root = find_git_root()
    # Absolute path to the file (nested join)
    absolute_file_path = Path.join(main_git_root, Path.join("vault", file_path_from_vault_root))
    # Absolute path to the directory containing the file
    containing_dir_abs = Path.dirname(absolute_file_path)

    # Find the git root specific to the file's location (could be main root or submodule root)
    specific_git_root = find_git_root(containing_dir_abs)

    # Calculate the path prefix (submodule path relative to main root, or "" if not in submodule)
    path_prefix =
      if specific_git_root != main_git_root do
        # Get the path of the submodule root relative to the main root
        Path.relative_to(specific_git_root, main_git_root)
        # Remove the leading "vault/" if present, as we only want the submodule name part
        |> String.replace_leading("vault/", "")
      else
        # Not inside a submodule relative to the main vault
        ""
      end

    # Calculate the file path relative to its specific git root (for the git log command)
    file_path_relative_to_specific_root = Path.relative_to(absolute_file_path, specific_git_root)

    case System.cmd(
           "git",
           [
             "log",
             # Track renames
             "--follow",
             # Show status (R for rename)
             "--name-status",
             # Suppress commit info
             "--pretty=format:\"\"",
             "--",
             # Path relative to the repo we're running in
             file_path_relative_to_specific_root
           ],
           # Execute in the correct git repository (main or submodule)
           cd: specific_git_root,
           stderr_to_stdout: true
         ) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.reduce([], fn line, acc ->
          # Match lines starting with R<numbers>\t<old_path>\t<new_path>
          case Regex.run(~r/^R\d*\t([^\t]+)\t([^\t]+)/, line) do
            [_, old_path_relative_to_specific_root, _new_path_relative_to_specific_root] ->
              # Reconstruct the full path relative to the main vault root
              full_old_path_relative_to_main_vault =
                if path_prefix == "" do
                  # File was in the main vault repo
                  old_path_relative_to_specific_root
                else
                  # File was in a submodule, prepend the submodule path
                  Path.join(path_prefix, old_path_relative_to_specific_root)
                end

              # Ensure the path is relative to the vault root (remove leading "vault/" if present)
              path_relative_to_vault =
                if String.starts_with?(full_old_path_relative_to_main_vault, "vault/") do
                  String.trim_leading(full_old_path_relative_to_main_vault, "vault/")
                else
                  full_old_path_relative_to_main_vault
                end

              # Ensure the final path starts with a leading slash for URL consistency
              final_path = "/" <> path_relative_to_vault

              # Add the final path with leading slash
              [final_path | acc]

            _ ->
              # Ignore other lines (M, A, D, etc.)
              acc
          end
        end)

      # The list is built with the most recent rename first

      {error_output, status} ->
        IO.puts(
          "Warning: 'git log --follow' failed for '#{file_path_relative_to_specific_root}' in directory '#{specific_git_root}' (status: #{status}): #{error_output}"
        )

        # Return empty list on error
        []
    end
  end

  # No @doc needed for private function
  defp find_git_root(start_dir \\ nil) do
    effective_start_dir =
      cond do
        is_binary(start_dir) and File.dir?(start_dir) -> start_dir
        # Default to current directory if start_dir is nil or not a directory
        true -> "."
      end

    case System.cmd("git", ["rev-parse", "--show-toplevel"], cd: effective_start_dir) do
      {path, 0} ->
        String.trim(path)

      _ ->
        # Fallback if git command fails in start_dir, try from "."
        case System.cmd("git", ["rev-parse", "--show-toplevel"], cd: ".") do
          {path, 0} ->
            String.trim(path)

          _ ->
            IO.puts("Warning: Could not determine git root directory. Defaulting to '.'")
            "."
        end
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
