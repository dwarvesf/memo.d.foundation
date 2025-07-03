defmodule Mix.Tasks.Duckdb.ExportPattern do
  use Mix.Task

  @shortdoc "Exports vault data to DuckDB matching a pattern"

  @moduledoc """
  Exports the vault data to DuckDB, filtering by a specified pattern. This is the primary export task for incremental processing.

  Usage:
    mix duckdb.export_pattern --pattern PATTERN [--vault ../../vault] [--format parquet]

  Options:
    --pattern   Pattern to match (required)
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

    pattern = opts[:pattern]

    unless pattern do
      Mix.raise("You must specify --pattern PATTERN")
    end

    vault = opts[:vault] || "../../vault"
    format = opts[:format] || "parquet"

    ignore_filter = opts[:ignore_filter] || false
    ignore_embeddings_check = opts[:ignore_embeddings_check] || false

    Memo.Application.export_duckdb(
      vault,
      format,
      pattern,
      ignore_filter: ignore_filter,
      ignore_embeddings_check: ignore_embeddings_check
    )
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [
          pattern: :string,
          vault: :string,
          format: :string,
          ignore_filter: :boolean,
          ignore_embeddings_check: :boolean
        ],
        aliases: [p: :pattern, v: :vault, f: :format]
      )

    opts
  end
end
