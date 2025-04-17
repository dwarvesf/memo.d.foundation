defmodule Mix.Tasks.Media.Process do
  use Mix.Task

  @shortdoc "Batch compresses and renames images in the vault, updating markdown references."

  @moduledoc """
  Batch compresses and renames images in the vault, updating markdown references.

  Usage:
    mix media.process --vault path/to/vault [--quality 80]

  Options:
    --vault    Path to the Obsidian vault (required)
    --quality  WebP quality (default: 80)
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

    api_key = System.get_env("OPENAI_API_KEY")
    IO.puts("OPENAI_API_KEY: #{inspect(api_key)} (length: #{if api_key, do: String.length(api_key), else: 0})")

    unless opts[:vault] do
      Mix.raise("You must specify --vault path/to/vault")
    end

    Memo.MediaProcessor.process(opts)
  end

  defp parse_args(args) do
    {opts, _, _} =
      OptionParser.parse(args,
        switches: [vault: :string, quality: :integer],
        aliases: [v: :vault, q: :quality]
      )

    opts
  end
end
