#!/usr/bin/env elixir

Mix.install([
  {:flow, "~> 1.2"},
  {:mogrify, "~> 0.9"},
  {:ffmpex, "~> 0.10"},
  {:httpoison, "~> 1.8"}
])

defmodule MediaConverter do
  @moduledoc """
  A module to convert images and videos in Obsidian markdown files.
  """

  use Flow
  import FFmpex
  use FFmpex.Options

  @assets_dir "assets"

  @doc """
  Entry point for the script.
  """
  def main(args) do
    {opts, _, _} = OptionParser.parse(args, strict: [vaultpath: :string])

    vaultpath = opts[:vaultpath] || "vault"

    {vault_dir, mode} =
      if File.dir?(vaultpath) do
        {vaultpath, :directory}
      else
        {Path.dirname(vaultpath), :file}
      end

    ignored_patterns = read_export_ignore_file(Path.join(vault_dir, ".export-ignore"))
    all_files = list_files_recursive(vault_dir)

    all_valid_files =
      all_files
      |> Enum.filter(&(not ignored?(&1, ignored_patterns, vault_dir)))

    # Create assets directory if it doesn't exist
    File.mkdir_p!(Path.join(vault_dir, @assets_dir))

    if mode == :file do
      if Enum.member?(all_valid_files, vaultpath) do
        process_single_file(vaultpath, all_valid_files, vault_dir)
      else
        IO.puts("File #{vaultpath} does not exist or is ignored.")
      end
    else
      all_valid_files
      |> Flow.from_enumerable()
      |> Flow.filter(&contains_required_frontmatter_keys?(&1))
      |> Flow.map(&process_file(&1, vault_dir, all_valid_files))
      |> Flow.run()
    end
  end

  defp list_files_recursive(path) do
    File.ls!(path)
    |> Enum.flat_map(fn file ->
      full_path = Path.join(path, file)

      if File.dir?(full_path) do
        list_files_recursive(full_path)
      else
        [full_path]
      end
    end)
  end

  defp read_export_ignore_file(ignore_file) do
    if File.exists?(ignore_file) do
      File.read!(ignore_file)
      |> String.split("\n", trim: true)
      |> Enum.filter(&(&1 != "" and not String.starts_with?(&1, "#")))
    else
      []
    end
  end

  defp ignored?(file, patterns, vaultpath) do
    relative_path = Path.relative_to(file, vaultpath)
    Enum.any?(patterns, &match_pattern?(relative_path, &1))
  end

  defp match_pattern?(path, pattern) do
    cond do
      String.ends_with?(pattern, "/") ->
        String.starts_with?(path, pattern) or String.contains?(path, "/#{pattern}")

      String.starts_with?(pattern, "*") ->
        String.ends_with?(path, String.trim_leading(pattern, "*"))

      String.ends_with?(pattern, "*") ->
        String.starts_with?(path, String.trim_trailing(pattern, "*"))

      true ->
        path == pattern or String.contains?(path, pattern)
    end
  end

  defp contains_required_frontmatter_keys?(file) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- parse_frontmatter(content) do
      Map.has_key?(frontmatter, "title") and Map.has_key?(frontmatter, "description")
    else
      _ -> false
    end
  end

  defp parse_frontmatter(content) do
    with [frontmatter_str] <- Regex.run(~r/^---\n(.*?)\n---/s, content, capture: :all_but_first) do
      frontmatter_str
      |> String.split("\n")
      |> Enum.map(&String.split(&1, ": ", parts: 2))
      |> Enum.filter(&match?([_, _], &1))
      |> Enum.into(%{}, fn [key, value] -> {key, String.trim(value)} end)
      |> (&{:ok, &1}).()
    else
      _ -> :error
    end
  end

  defp process_file(file, vaultpath, all_files) do
    content = File.read!(file)
    links = extract_links(content)
    resolved_links = resolve_links(links, all_files, vaultpath)
    converted_content = convert_links(content, resolved_links)

    File.write!(file, converted_content)
    IO.puts("Processed: #{file}")
  end

  defp process_single_file(file, all_files, vaultpath) do
    content = File.read!(file)
    links = extract_links(content)
    resolved_links = resolve_links(links, all_files, vaultpath)
    converted_content = convert_links(content, resolved_links)

    File.write!(file, converted_content)
    IO.puts("Processed: #{file}")
  end

  defp extract_links(content) do
    pattern =
      ~r/!\[\[((?:[^\]]|\.png|\.jpg|\.gif|\.svg|\.mp4|\.mov|\.avi)+)\]\]|\!\[([^\]]+)\]\(([^)]+)\)/

    Regex.scan(pattern, content)
    |> Enum.flat_map(fn
      [_, image] when not is_nil(image) -> [image]
      [_, _, url] when not is_nil(url) -> [url]
      _ -> []
    end)
  end

  defp resolve_links(links, all_files, vaultpath) do
    links
    |> Flow.from_enumerable()
    |> Flow.flat_map(&find_link_paths(&1, all_files, vaultpath))
    |> Flow.map(&handle_media_file(&1, vaultpath))
    |> Enum.into(%{})
  end

  defp find_link_paths(link, all_files, vaultpath) do
    downcased_link = String.downcase(link)

    for path <- all_files,
        basename = Path.basename(path),
        downcased_basename = String.downcase(basename),
        String.contains?(basename, link) or String.contains?(downcased_basename, downcased_link),
        into: %{} do
      {link, Path.relative_to(path, vaultpath)}
    end
  end

  defp is_url?(link) do
    Regex.match?(~r/^https?:\/\//, link)
  end

  defp download_file(url, target_path) do
    case HTTPoison.get(url) do
      {:ok, %HTTPoison.Response{body: body}} ->
        File.write!(target_path, body)
        target_path

      _ ->
        raise "Failed to download #{url}"
    end
  end

  defp handle_media_file({link, relative_path}, vaultpath) do
    if is_url?(link) do
      file_name = Path.basename(link)
      download_path = Path.join([vaultpath, @assets_dir, file_name])

      # Download the file only if it does not exist
      unless File.exists?(download_path) do
        download_file(link, download_path)
      end

      {link, Path.join(@assets_dir, file_name)}
    else
      full_path = Path.join(vaultpath, relative_path)

      cond do
        String.ends_with?(full_path, ~w(.png .jpg .gif .svg)) ->
          new_path = compress_image(full_path)
          {link, Path.relative_to(new_path, vaultpath)}

        String.ends_with?(full_path, ~w(.mp4 .mov .avi)) ->
          new_path = compress_video(full_path)
          {link, Path.relative_to(new_path, vaultpath)}

        true ->
          {link, Path.relative_to(relative_path, vaultpath)}
      end
    end
  end

  defp compress_image(image_path) do
    new_path = Path.rootname(image_path) <> ".webp"

    Mogrify.open(image_path)
    |> Mogrify.format("webp")
    |> Mogrify.save(path: new_path)

    new_path
  end

  defp compress_video(video_path) do
    new_path = Path.rootname(video_path) <> "_compressed" <> Path.extname(video_path)

    if String.ends_with?(video_path, "_compressed" <> Path.extname(video_path)) do
      video_path
    else
      FFmpex.new_command()
      |> add_global_option(option_y())
      |> add_input_file(video_path)
      |> add_output_file(new_path)
      |> add_file_option(option_codec("libx265"))
      |> add_file_option(option_crf(28))
      |> execute()

      new_path
    end
  end

  defp convert_links(content, resolved_links) do
    # Handle image links with alt text
    content =
      Regex.replace(~r/!\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(resolved_links, link, link)
        "![](#{resolved_path})"
      end)

    content =
      Regex.replace(~r/!\[([^\]]+)\]\(([^)]+)\)/, content, fn _, alt_text, link ->
        resolved_path = Map.get(resolved_links, link, link)
        "![#{alt_text}](#{resolved_path})"
      end)

    content
  end
end

MediaConverter.main(System.argv())
