#!/usr/bin/env elixir

Mix.install([
  {:file_system, "~> 1.0"}
])

defmodule FileWatcher do
  use GenServer
  require Logger

  # delay in milliseconds
  @unlock_delay 2000

  def main(args) do
    {opts, _, _} = OptionParser.parse(args, switches: [vaultpath: :string])
    vaultpath = opts[:vaultpath] || "vault"

    # Start the FileWatcher and keep the main process alive
    {:ok, _pid} = start_link(vaultpath)

    # Keep the script running
    Process.sleep(:infinity)
  end

  def start_link(vaultpath) do
    GenServer.start_link(__MODULE__, vaultpath, name: __MODULE__)
  end

  def init(vaultpath) do
    # Set up ETS table for locks
    :ets.new(:file_locks, [:named_table, :public, :set])

    # Run the scripts to build the site
    run_scripts(vaultpath)

    # Start the Hugo server
    Task.start(fn -> start_hugo_server() end)

    # Start the file watcher
    {:ok, watcher_pid} = FileSystem.start_link(dirs: [vaultpath])
    FileSystem.subscribe(watcher_pid)

    state = %{watcher_pid: watcher_pid, vaultpath: vaultpath}
    {:ok, state}
  end

  def handle_info({:file_event, watcher_pid, {path, events}}, state)
      when watcher_pid === state.watcher_pid do
    if (:modified in events or :created in events) and not locked?(path) do
      Logger.info("File changed: #{path}. Running scripts...")
      lock(path)
      run_scripts(path)
      schedule_unlock(path)
    end

    {:noreply, state}
  end

  def handle_info({:unlock, path}, state) do
    unlock(path)
    {:noreply, state}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end

  defp start_hugo_server() do
    System.cmd("hugo", ["-DEF", "--poll", "2s", "--logLevel", "error", "server"],
      into: IO.stream(:stdio, :line)
    )
  end

  defp run_scripts(file_path) do
    System.cmd("elixir", ["scripts/export_media.exs", "--vaultpath", file_path],
      into: IO.stream(:stdio, :line)
    )

    System.cmd("elixir", ["scripts/export_markdown.exs", "--vaultpath", file_path],
      into: IO.stream(:stdio, :line)
    )
  end

  defp lock(file_path) do
    :ets.insert(:file_locks, {file_path, :locked})
  end

  defp unlock(file_path) do
    :ets.delete(:file_locks, file_path)
  end

  defp locked?(file_path) do
    case :ets.lookup(:file_locks, file_path) do
      [{^file_path, :locked}] -> true
      _ -> false
    end
  end

  defp schedule_unlock(file_path) do
    Process.send_after(self(), {:unlock, file_path}, @unlock_delay)
  end
end

# Start the main function with command-line arguments
FileWatcher.main(System.argv())
