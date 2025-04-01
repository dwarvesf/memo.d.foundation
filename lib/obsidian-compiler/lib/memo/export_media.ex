defmodule Memo.ExportMedia do
  @moduledoc """
  A module to convert images and videos in Obsidian markdown files.
  """

  use Flow
  alias Memo.Common.{FileUtils, Frontmatter, LinkUtils}

  @assets_dir "assets"

  @doc """
  Entry point for the script.
  """
  def run(vaultpath) do
    System.put_env("LC_ALL", "en_US.UTF-8")
    System.cmd("locale", [])

    vaultpath = vaultpath || "vault"

    {vault_dir, mode} =
      if File.dir?(vaultpath) do
        {vaultpath, :directory}
      else
        {Path.dirname(vaultpath), :file}
      end

    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vault_dir, ".export-ignore"))
    all_files = FileUtils.list_files_recursive(vault_dir)

    all_valid_files =
      all_files
      |> Enum.filter(&(not FileUtils.ignored?(&1, ignored_patterns, vault_dir)))

    # Create assets directory if it doesn't exist
    File.mkdir_p!(Path.join(vault_dir, @assets_dir))

    if mode == :file do
      process_single_file(vaultpath, vault_dir, all_valid_files)
    else
      all_valid_files
      |> Flow.from_enumerable()
      |> Flow.filter(&Frontmatter.contains_required_frontmatter_keys?/1)
      |> Flow.map(&process_file(&1, vault_dir))
      |> Flow.run()
    end
  end

  defp process_single_file(vaultpath, vault_dir, all_valid_files) do
    normalized_vaultpath = FileUtils.normalize_path(vaultpath)

    if Enum.member?(all_valid_files, normalized_vaultpath) and
         Frontmatter.contains_required_frontmatter_keys?(normalized_vaultpath) do
      process_file(normalized_vaultpath, vault_dir)
    else
      IO.puts(
        "File #{inspect(vaultpath)} does not exist, is ignored, or does not contain required frontmatter keys."
      )
    end
  end

  defp process_file(file, vaultpath) do
    content = File.read!(file)
    links = extract_links(content)

    resolved_links =
      links
      |> Flow.from_enumerable()
      |> Flow.map(fn link ->
        new_link = handle_media_link(FileUtils.normalize_path(link), vaultpath)
        {link, new_link}
      end)
      |> Enum.into(%{})

    converted_content = convert_links(content, resolved_links, file, vaultpath)

    File.write!(file, converted_content)
    IO.puts("Processed: #{inspect(file)}")
  end

  defp handle_media_link(link, vaultpath) do
    cond do
      already_converted?(link, vaultpath) ->
        link

      LinkUtils.is_url?(link) ->
        if url_points_to_media?(link) do
          link
        else
          link
        end

      true ->
        link
    end
  end

  defp url_points_to_media?(url) do
    uri = URI.parse(url)
    path = uri.path || ""

    # Check if the URL path ends with a known media file extension
    Regex.match?(~r/\.(png|jpg|jpeg|gif|svg|mp4|mov|avi)$/i, path)
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

  defp convert_links(content, resolved_links, file, vaultpath) do
    link_patterns = [
      {~r/!\[\[([^\|\]]+)\|([^\]]+)\]\]/, fn src, alias -> {src, alias} end},
      {~r/!\[\[([^\]]+)\]\]/, fn link -> {link, nil} end},
      {~r/!\[([^\]]*)\]\(([^)]+)\)/, fn alt_text, link -> {link, alt_text} end}
    ]

    Enum.reduce(link_patterns, content, fn {pattern, extractor}, acc ->
      Regex.replace(pattern, acc, fn _, capture1, capture2 ->
        {src, alt} =
          case extractor do
            f when is_function(f, 2) -> f.(capture1, capture2)
            f when is_function(f, 1) -> f.(capture1)
          end

        resolved_path = Map.get(resolved_links, src, src)

        if is_nil(resolved_path) do
          "![#{alt || ""}](#{src})"
        else
          if LinkUtils.is_url?(resolved_path) and not url_points_to_media?(resolved_path) do
            "![#{alt || ""}](#{resolved_path})"
          else
            "![#{alt || ""}](#{resolve_asset_path(resolved_path, file, vaultpath)})"
          end
        end
      end)
    end)
  end

  defp resolve_asset_path(resolved_path, file_path, vaultpath) do
    file_dir = Path.dirname(file_path)

    cond do
      String.starts_with?(resolved_path, @assets_dir) ->
        resolved_path

      File.exists?(Path.join(file_dir, resolved_path)) ->
        resolved_path

      true ->
        find_file_in_vault(vaultpath, Path.basename(resolved_path))
        |> case do
          {:ok, found_path} -> Path.relative_to(found_path, file_dir)
          :error -> Path.join(@assets_dir, Path.basename(resolved_path))
        end
    end
  end

  defp find_file_in_vault(vaultpath, filename) do
    pattern = "**/" <> String.replace(filename, ~r/[()]/, "?")

    vaultpath
    |> Path.join(pattern)
    |> Path.wildcard()
    |> Enum.sort_by(&String.jaro_distance(Path.basename(&1), filename), &>=/2)
    |> case do
      [] -> :error
      [path | _] -> {:ok, path}
    end
  end
end
