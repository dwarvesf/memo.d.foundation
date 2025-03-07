defmodule Memo.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Starts a worker by calling: Memo.Worker.start_link(arg)
      # {Memo.Worker, arg}
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Memo.Supervisor]
    Supervisor.start_link(children, opts)
  end

  def combine_vtt(args), do: Memo.CombineVTT.run(args)
  def export_markdown(vaultpath, exportpath), do: Memo.ExportMarkdown.run(vaultpath, exportpath)
  def export_media(vaultpath), do: Memo.ExportMedia.run(vaultpath)

  def update_git_settings(),
    do:
      Memo.Common.GitUtils.handle_git_setting(
        "remote.origin",
        "fetch",
        "^refs/heads/gh-pages",
        "Excluding gh-pages from git fetch"
      )

  def watch_run(vaultpath, exportpath), do: Memo.WatchRun.run(vaultpath, exportpath)

  @doc """
  Exports DuckDB data.

  ## Parameters

  - vaultpath: The path to the vault directory.
  - format: The export format (e.g., "parquet", "csv").
  - commits_back: Specifies how many commits back to look for changes.
    Can be :all to process all files, "HEAD~n" where n is a number to look back n commits,
    or any other value will default to "HEAD^" (the previous commit).

  ## Examples

      iex> Memo.Application.export_duckdb("vault", "parquet", "HEAD~2")
      iex> Memo.Application.export_duckdb("vault", "parquet", :all)
  """
  def export_duckdb(vaultpath, format, commits_back \\ "HEAD^", pattern \\ nil) do
    Memo.ExportDuckDB.run(vaultpath, format, commits_back, pattern)
  end

  @doc """
  Syncs markdown files with Hashnode API.

  ## Parameters

  - vaultpath: The path to the vault directory.

  ## Example

      iex> Memo.Application.sync_hashnode("vault")
  """
  def sync_hashnode(vaultpath), do: Memo.SyncHashnode.run(vaultpath)
end
