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

  @doc """
  Gets the previous paths of a file based on Git rename history.
  Returns a list of paths relative to the git root, starting with the most recent previous path.
  """
  def get_previous_paths(file_path_from_root) do
    main_git_root = find_git_root()

    # Absolute path to the file within the main git root
    absolute_file_path = Path.join(main_git_root, file_path_from_root)
    # Absolute path to the directory containing the file
    containing_dir_abs = Path.dirname(absolute_file_path)
    # Filename itself
    filename = Path.basename(file_path_from_root)
    # Containing directory relative to the git root (for reconstructing paths later)
    containing_dir_rel = Path.dirname(file_path_from_root)

    case System.cmd("git", [
           "log",
           "--follow",        # Track renames
           "--name-status",   # Show status (R for rename)
           "--pretty=format:\"\"", # Suppress commit info, only show status lines
           "--",
           filename # Use only the filename as the path argument
         ],
         cd: containing_dir_abs, # Execute in the file's containing directory
         stderr_to_stdout: true) do
      {output, 0} ->
        output
        |> String.split("\n", trim: true)
        |> Enum.reduce([], fn line, acc ->
             # Match lines starting with R<numbers>\t<old_path>\t<new_path>
             case Regex.run(~r/^R\d*\t([^\t]+)\t([^\t]+)/, line) do
               [_, old_path_relative_to_cd, _new_path_relative_to_cd] ->
                 # Reconstruct the full path relative to the main repo root
                 # Handle case where the file was originally in the root directory
                 full_old_path =
                   if containing_dir_rel == "." do
                     old_path_relative_to_cd
                    else
                      Path.join(containing_dir_rel, old_path_relative_to_cd)
                    end

                  # Strip the leading "vault/" prefix if it exists
                  path_relative_to_vault =
                    if String.starts_with?(full_old_path, "vault/") do
                      String.trim_leading(full_old_path, "vault/")
                    else
                      # Should not happen if logic is correct, but handle defensively
                       full_old_path
                     end

                   # Ensure the path starts with a leading slash for URL consistency
                   final_path = "/" <> path_relative_to_vault

                   [final_path | acc] # Add the final path with leading slash
                 _ ->
                   # Ignore other lines (M, A, D, etc.)
                   acc
             end
           end)
        # The list is built with the most recent rename first

      {error_output, status} ->
        IO.puts(
          "Warning: 'git log --follow' failed for '#{filename}' in directory '#{containing_dir_abs}' (status: #{status}): #{error_output}"
        )
        [] # Return empty list on error
    end
  end

  # Helper to find the git root directory
  defp find_git_root() do
    case System.cmd("git", ["rev-parse", "--show-toplevel"]) do
      {path, 0} -> String.trim(path)
      _ ->
        IO.puts("Warning: Could not determine git root directory. Defaulting to '.'")
        "."
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
