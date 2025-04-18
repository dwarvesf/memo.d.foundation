defmodule Mix.Tasks.Duckdb.ExportAll do
  use Mix.Task

  @shortdoc "Exports all vault data to DuckDB (was part of Makefile duckdb-export-all target)"

  @moduledoc """
  Exports all vault data to DuckDB.

  Usage:
    mix duckdb.export_all [--vault ../../vault] [--format parquet]

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

    Memo.Application.export_duckdb(vault, format, :all)
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
