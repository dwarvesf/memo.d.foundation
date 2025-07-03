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

  @doc """
  Exports DuckDB data.

  ## Parameters

  - vaultpath: The path to the vault directory.
  - format: The export format (e.g., "parquet", "csv").

  ## Examples

      iex> Memo.Application.export_duckdb("vault", "parquet")
  """
  def export_duckdb(vaultpath, format, pattern \\ nil, opts \\ []) do
    Memo.ExportDuckDB.run(vaultpath, format, pattern, opts)
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
