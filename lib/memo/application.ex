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
  def update_git_settings(), do: Memo.UpdateGitSettings.run()
  def watch_run(vaultpath, exportpath), do: Memo.WatchRun.run(vaultpath, exportpath)

  def export_duckdb(vaultpath, format), do: Memo.ExportDuckDB.run(vaultpath, format, false, :infinity)
  def export_duckdb(vaultpath, format, all, limit), do: Memo.ExportDuckDB.run(vaultpath, format, all, limit)
end
