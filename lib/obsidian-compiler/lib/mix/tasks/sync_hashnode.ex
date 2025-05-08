defmodule Mix.Tasks.SyncHashnode do
  use Mix.Task

  @shortdoc "Syncs Hashnode with the vault (was part of Makefile sync-hashnode target)"

  @moduledoc """
  Syncs Hashnode with the vault.

  Usage:
    mix sync_hashnode [--vault ../../vault]

  Options:
    --vault     Path to the vault (default: ../../vault)
  """

  @impl true
  def run(args) do
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

    opts = parse_args(args)
    vault = opts[:vault] || "../../vault"

    Memo.Application.sync_hashnode(vault)
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [vault: :string],
        aliases: [v: :vault]
      )

    opts
  end
end
