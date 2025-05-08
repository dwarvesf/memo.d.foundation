defmodule Mix.Tasks.Duckdb.Export do
  use Mix.Task

  @shortdoc "Exports vault to DuckDB (was part of Makefile duckdb-export target)"

  @moduledoc """
  Exports the vault to DuckDB.

  Usage:
    mix duckdb.export [--vault ../../vault] [--format parquet]

  Options:
    --vault     Path to the vault (default: ../../vault)
    --format    Export format (default: parquet)
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
    format = opts[:format] || "parquet"

    Memo.Application.export_duckdb(vault, format)
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [vault: :string, format: :string],
        aliases: [v: :vault, f: :format]
      )

    opts
  end
end
