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
        process_file(vaultpath, vault_dir, all_valid_files)
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

    resolved_links =
      links
      |> Enum.map(fn link ->
        new_link = handle_media_link(link, vaultpath)
        {link, new_link}
      end)
      |> Enum.into(%{})

    converted_content = convert_links(content, resolved_links, file, vaultpath)

    File.write!(file, converted_content)
    IO.puts("Processed: #{file}")
  end

  defp handle_media_link(link, vaultpath) do
    cond do
      already_converted?(link, vaultpath) ->
        # If the link is already converted, just return the link
        link

      is_url?(link) ->
        # If the link is a URL, download, convert, and compress
        download_path = download_file(link, Path.join(vaultpath, @assets_dir, Path.basename(link)))
        convert_and_compress_media(download_path, vaultpath)

      true ->
        # If the link is a local file that isn't converted, convert and compress
        convert_and_compress_media(link, vaultpath)
    end
  end

  defp extract_links(content) do
    wikilink_pattern =
      ~r/!\[\[([^\|\]]+\.(?:png|jpg|jpeg|gif|svg|mp4|mov|avi))(?:\|([^\]]+))?\]\]/i

    markdown_pattern =
      ~r/!\[([^\]]*)\]\(([^\)]+\.(?:png|jpg|jpeg|gif|svg|mp4|mov|avi))\)/i

    wikilinks =
      Regex.scan(wikilink_pattern, content)
      |> Enum.flat_map(fn
        [_, src, _] -> [src]
      end)

    markdown_links =
      Regex.scan(markdown_pattern, content)
      |> Enum.flat_map(fn
        [_, _, src] -> [src]
      end)

    wikilinks ++ markdown_links
  end

  defp already_converted?(link, vaultpath) do
    full_path = Path.join(vaultpath, link)
    String.ends_with?(link, [".webp", "_compressed.mp4"]) and File.exists?(full_path)
  end

  defp convert_and_compress_media(link, vaultpath) do
    full_path = Path.join(vaultpath, link)

    cond do
      String.match?(link, ~r/\.(png|jpg|jpeg)$/i) ->
        compress_image(full_path)

      String.match?(link, ~r/\.(mp4|mov|avi)$/i) ->
        compress_video(full_path)

      true ->
        link
    end
  end

  defp handle_media_link(link, vaultpath) do
    if is_url?(link) do
      download_path = download_file(link, Path.join(vaultpath, @assets_dir, Path.basename(link)))
      convert_and_compress_media(download_path, vaultpath)
    else
      if already_converted?(link, vaultpath) do
        link
      else
        convert_and_compress_media(link, vaultpath)
      end
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
      |> add_file_option(option_codec("libx264"))
      |> add_file_option(option_crf(28))
      |> execute()

      new_path
    end
  end

  defp convert_links(content, resolved_links, file, vaultpath) do
    file_dir = Path.dirname(file)

    resolve_asset_path = fn resolved_path ->
      asset_path = Path.relative_to(Path.join(vaultpath, resolved_path), file_dir)
      Path.join(@assets_dir, Path.basename(asset_path))
    end

    # Handle links with aliases
    content =
      Regex.replace(~r/!\[\[([^\|\]]+)\|([^\]]+)\]\]/, content, fn _, src, alias ->
        resolved_path = Map.get(resolved_links, src,src)
        "![#{alias}](#{resolve_asset_path.(resolved_path)})"
      end)

    # Handle links without aliases
    content =
      Regex.replace(~r/!\[\[([^\]]+)\]\]/, content, fn _, link ->
        resolved_path = Map.get(resolved_links, link, link)
        "![](#{resolve_asset_path.(resolved_path)})"
      end)

    # Handle markdown links
    content =
      Regex.replace(~r/!\[([^\]]+)\]\(([^)]+)\)/, content, fn _, alt_text, link ->
        resolved_path = Map.get(resolved_links, link, link)
        "![#{alt_text}](#{resolve_asset_path.(resolved_path)})"
      end)

    content
  end
end

MediaConverter.main(System.argv())
