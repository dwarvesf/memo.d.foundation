defmodule Mix.Tasks.Fetch do
  use Mix.Task

  @shortdoc "Updates git settings for Memo (was part of Makefile fetch target)"

  @moduledoc """
  Updates git settings for Memo.

  Usage:
    mix fetch
  """

  @impl true
  def run(_args) do
    # Load .env file if present
    if File.exists?(".env") do
      case DotenvParser.load_file(".env") do
        vars when is_list(vars) or is_map(vars) ->
          Enum.each(vars, fn {k, v} -> System.put_env(k, v) end)
        _ ->
          :ok
      end
    end

    Mix.Task.run("app.start")
    Memo.UpdateGitSettings.run()
  end
end
