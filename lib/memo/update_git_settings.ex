defmodule Memo.UpdateGitSettings do
  defp check_git_config_setting(section, key) do
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

  defp add_git_config_setting(section, key, value) do
    System.cmd("git", ["config", "--add", "#{section}.#{key}", value])
  end

  defp handle_git_setting(section, key, value, message) do
    settings = check_git_config_setting(section, key)

    if value not in settings do
      IO.puts("#{message} Setting #{section}.#{key} to #{value}...")
      add_git_config_setting(section, key, value)
    else
      IO.puts("Setting already applied. Skipping #{message} for #{section}.#{key}")
    end
  end

  def run do
    handle_git_setting(
      "remote.origin",
      "fetch",
      "^refs/heads/gh-pages",
      "Excluding gh-pages from git fetch"
    )

    handle_git_setting("submodule", "fetchJobs", "10", "Setting submodule fetch jobs")
  end
end
