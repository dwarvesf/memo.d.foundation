defmodule Memo.WatchRun do
  use GenServer
  require Logger

  # delay in milliseconds
  @unlock_delay 2000

  def run(vaultpath, exportpath) do
    vaultpath = vaultpath || "vault"
    exportpath = exportpath || "content"

    # Start the FileWatcher and keep the main process alive
    {:ok, _pid} = start_link(vaultpath, exportpath)

    # Keep the script running
    Process.sleep(:infinity)
  end

  def start_link(vaultpath, exportpath) do
    GenServer.start_link(__MODULE__, {vaultpath, exportpath}, name: __MODULE__)
  end

  def init({vaultpath, exportpath}) do
    # Set up ETS table for locks
    :ets.new(:file_locks, [:named_table, :public, :set])

    # Run the scripts to build the site
    run_scripts(vaultpath, exportpath)

    # Start the file watcher
    {:ok, watcher_pid} = FileSystem.start_link(dirs: [vaultpath])
    FileSystem.subscribe(watcher_pid)

    state = %{watcher_pid: watcher_pid, vaultpath: vaultpath, exportpath: exportpath}
    {:ok, state}
  end

  def handle_info({:file_event, watcher_pid, {path, events}}, state)
      when watcher_pid === state.watcher_pid do
    relative_path = get_relative_path(path, state.vaultpath)

    if (:modified in events or :created in events) and not locked?(relative_path) do
      Logger.info("File changed: #{relative_path}. Running scripts...")
      lock(relative_path)
      run_scripts(relative_path, state.exportpath)
      schedule_unlock(relative_path)
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

  defp get_relative_path(full_path, vaultpath) do
    case String.split(full_path, vaultpath) do
      [_, relative] ->
        relative
        |> String.trim_leading("/")
        |> (&Path.join(Path.basename(vaultpath), &1)).()

      _ ->
        full_path
    end
  end

  defp run_scripts(vaultpath, exportpath) do
    # If vaultpath is a specific file, process just that file
    # Otherwise, process the entire directory
    if is_binary(vaultpath) and String.contains?(vaultpath, ".md") and File.exists?(vaultpath) do
      # Process a single file
      IO.puts("Processing single file: #{vaultpath}")
      Memo.Application.export_markdown(vaultpath, exportpath)
    else
      # Process the entire directory
      IO.puts("Processing directory: #{vaultpath}")

      # Run export_markdown and export_duckdb in parallel
      markdown_task =
        Task.async(fn ->
          IO.puts("Starting markdown export...")
          Memo.Application.export_markdown(vaultpath, exportpath)
          IO.puts("Markdown export completed")
        end)

      duckdb_task =
        Task.async(fn ->
          IO.puts("Starting DuckDB export...")
          Memo.Application.export_duckdb(vaultpath, "parquet", "HEAD~2")
          IO.puts("DuckDB export completed")
        end)

      # Wait for both tasks to complete
      Task.await_many([markdown_task, duckdb_task])

      # After both exports are complete, run npm run dev
      IO.puts("Both exports completed. Starting npm run dev...")

      case System.cmd("pnpm", ["run", "dev"], cd: "../..", into: IO.stream(:stdio, :line)) do
        {_, 0} -> IO.puts("npm run dev started successfully")
        {error, code} -> IO.puts("npm run dev failed with code #{code}: #{inspect(error)}")
      end
    end
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
