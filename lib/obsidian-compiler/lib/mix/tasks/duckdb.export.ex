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

    ignore_filter = opts[:ignore_filter] || false
    ignore_embeddings_check = opts[:ignore_embeddings_check] || false

    Memo.Application.export_duckdb(
      vault,
      format,
      nil,
      ignore_filter: ignore_filter,
      ignore_embeddings_check: ignore_embeddings_check
    )
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [
          vault: :string,
          format: :string,
          ignore_filter: :boolean,
          ignore_embeddings_check: :boolean
        ],
        aliases: [v: :vault, f: :format]
      )

    opts
  end
end
