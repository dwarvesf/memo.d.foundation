defmodule Mix.Tasks.ExportMarkdown do
  use Mix.Task

  @shortdoc "Exports markdown from the vault to the public content directory (was part of Makefile build/run targets)"

  @moduledoc """
  Exports markdown from the vault to the public content directory.

  Usage:
    mix export_markdown [--vault ../../vault] [--output ../../public/content]

  Options:
    --vault     Path to the vault (default: ../../vault)
    --output    Output directory (default: ../../public/content)
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
    output = opts[:output] || "../../public/content"

    Memo.ExportMarkdown.run(vault, output)
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [vault: :string, output: :string],
        aliases: [v: :vault, o: :output]
      )

    opts
  end
end
