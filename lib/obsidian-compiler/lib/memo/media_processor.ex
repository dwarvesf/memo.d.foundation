defmodule Memo.MediaProcessor do
  @moduledoc """
  Batch processes images in the vault:
    - Compresses images to WebP using Mogrify
    - Renames images with AI (if API key present) or slugifies
    - Updates markdown references to new filenames
    - Maintains a .media_cache.json for incremental processing
  """

  alias Memo.Common.{Slugify, AIUtils}
  require Logger

  @cache_file ".media_cache.json"
  @image_exts ~w(.jpg .jpeg .png .bmp .gif .tiff .webp)
  @default_quality 80

  def process(opts) do
    vault = Keyword.fetch!(opts, :vault)
    quality = Keyword.get(opts, :quality, @default_quality)

    cache = load_cache(vault)
    images = find_images(vault)
    changed = filter_changed(images, cache)

    Logger.info("Found #{length(images)} images, #{length(changed)} to process.")

    {renamed, new_cache} =
      Enum.map_reduce(changed, cache, fn img, acc_cache ->
        case process_image(img, vault, quality, acc_cache) do
          {:ok, entry, new_name} ->
            { {img, new_name}, Map.put(acc_cache, img, entry) }
          {:skip, entry} ->
            { nil, Map.put(acc_cache, img, entry) }
        end
      end)

    renamed = Enum.filter(renamed, & &1)
    update_markdown_refs(vault, renamed)
    save_cache(new_cache, vault)
    cleanup_cache(new_cache, images, vault)
    :ok
  end

  defp load_cache(vault) do
    path = Path.join(vault, @cache_file)
    if File.exists?(path) do
      case File.read(path) do
        {:ok, content} ->
          Jason.decode!(content)
        _ ->
          %{}
      end
    else
      %{}
    end
  end

  defp save_cache(cache, vault) do
    path = Path.join(vault, @cache_file)
    File.write!(path, Jason.encode!(cache, pretty: true))
  end

  defp cleanup_cache(cache, images, vault) do
    # Remove cache entries for deleted images
    valid = Map.take(cache, images)
    save_cache(valid, vault)
  end

  defp find_images(vault) do
    vault
    |> Path.expand()
    |> Path.join("**/*")
    |> Path.wildcard()
    |> Enum.filter(&is_image?/1)
  end

  defp is_image?(path) do
    ext = Path.extname(path) |> String.downcase()
    ext in @image_exts and File.regular?(path)
  end

  defp filter_changed(images, cache) do
    Enum.filter(images, fn img ->
      case Map.get(cache, img) do
        nil -> true
        %{"mtime" => mtime, "hash" => hash} ->
          stat = File.stat!(img, time: :posix)
          mtime != stat.mtime or hash != file_hash(img)
        _ -> true
      end
    end)
  end

  defp file_hash(path) do
    case File.read(path) do
      {:ok, content} ->
        :crypto.hash(:md5, content) |> Base.encode16(case: :lower)
      {:error, _} ->
        # Fallback: hash of path and current time
        :crypto.hash(:md5, "#{path}-#{:os.system_time(:millisecond)}")
        |> Base.encode16(case: :lower)
    end
  end

  defp process_image(img, vault, quality, cache) do
    stat = File.stat!(img, time: :posix)
    hash = file_hash(img)
    old_entry = Map.get(cache, img)

    # Gather markdown context for this image
    context = find_markdown_context_for_image(img, vault)

    # Skip if unchanged
    if old_entry && old_entry["mtime"] == stat.mtime && old_entry["hash"] == hash do
      Logger.debug("Unchanged (skipping): #{img}")
      {:skip, old_entry}
    else
      ext = Path.extname(img) |> String.downcase()
      if ext == ".webp" do
        # Only rename and update references, do not re-encode
        # Remove all extensions for slugification
        base =
          img
          |> Path.basename()
          |> remove_all_extensions()

        new_name =
          case AIUtils.describe_filename(base, context) do
            {:ok, desc} -> Slugify.slugify_filename(desc) <> ".webp"
            _ -> Slugify.slugify_filename(base) <> ".webp"
          end

        final_path = unique_name(Path.dirname(img), new_name)

        if Path.basename(img) != final_path do
          Logger.info("Renamed WebP: #{img} -> #{final_path}")
          File.rename!(img, Path.join(Path.dirname(img), final_path))
        else
          Logger.debug("WebP already named: #{img}")
        end

        entry = %{
          "mtime" => stat.mtime,
          "hash" => hash,
          "new_name" => final_path
        }

        {:ok, entry, final_path}
      else
        # Compress to WebP
        new_path = Path.rootname(img) <> ".webp"
        Logger.info("Converting to WebP: #{img} -> #{new_path}")
        Mogrify.open(img)
        |> Mogrify.format("webp")
        |> Mogrify.quality(quality)
        |> Mogrify.save(path: new_path)

        # Remove all extensions for slugification
        base =
          img
          |> Path.basename()
          |> remove_all_extensions()

        # AI or slugify rename
        new_name =
          case AIUtils.describe_filename(base, context) do
            {:ok, desc} -> Slugify.slugify_filename(desc) <> ".webp"
            _ -> Slugify.slugify_filename(base) <> ".webp"
          end

        # Ensure no conflict
        final_path = unique_name(Path.dirname(new_path), new_name)

        if Path.basename(new_path) != final_path do
          Logger.info("Renaming WebP: #{new_path} -> #{final_path}")
        end

        File.rename!(new_path, Path.join(Path.dirname(img), final_path))
        if File.exists?(img), do: File.rm!(img)

        entry = %{
          "mtime" => stat.mtime,
          "hash" => hash,
          "new_name" => final_path
        }

        {:ok, entry, final_path}
      end
    end
  end

  # Find all markdown references to an image and extract context (file, alt text, section)
  defp find_markdown_context_for_image(img, vault) do
    img_bases = [
      Path.basename(img),
      Path.basename(img, Path.extname(img))
    ] |> Enum.uniq()

    md_files =
      vault
      |> Path.expand()
      |> Path.join("**/*.md")
      |> Path.wildcard()

    Enum.flat_map(md_files, fn md ->
      content = File.read!(md)
      # Find all image references in the markdown
      Regex.scan(~r/!\[([^\]]*)\]\(([^)]+)\)/, content)
      |> Enum.filter(fn [_full, _alt, path] ->
        base = Path.basename(path)
        base in img_bases
      end)
      |> Enum.map(fn [full, alt, _path] ->
        # Try to find the nearest preceding header
        header =
          content
          |> String.split(full)
          |> List.first()
          |> (fn before ->
            Regex.scan(~r/^#+\s+(.+)$/m, before)
            |> List.last()
            |> case do
              [_, h] -> h
              _ -> nil
            end
          end).()

        # Get a snippet of surrounding text
        snippet =
          content
          |> String.split(full)
          |> List.first()
          |> String.split("\n")
          |> Enum.take(-3)
          |> Enum.join(" ")

        %{
          markdown_file: md,
          alt: alt,
          header: header,
          snippet: snippet
        }
      end)
    end)
    |> List.first() # Use the first reference found for now
  end

  defp unique_name(dir, name, n \\ 0) do
    candidate =
      if n == 0, do: name, else: Path.rootname(name) <> "-#{n}" <> Path.extname(name)
    path = Path.join(dir, candidate)
    if File.exists?(path), do: unique_name(dir, name, n + 1), else: candidate
  end

  defp remove_all_extensions(filename) do
    base = Path.rootname(filename)
    ext = Path.extname(base)
    if ext != "" do
      remove_all_extensions(base)
    else
      base
    end
  end

  defp update_markdown_refs(vault, renamed) do
    # Map of old basename => new basename
    rename_map =
      Enum.into(renamed, %{}, fn {old, new} ->
        {Path.basename(old), new}
      end)

    md_files =
      vault
      |> Path.expand()
      |> Path.join("**/*.md")
      |> Path.wildcard()

    Enum.each(md_files, fn md ->
      content = File.read!(md)
      new_content =
        Regex.replace(~r/!\[([^\]]*)\]\(([^)]+)\)/, content, fn _, alt, path ->
          base = Path.basename(path)
          if Map.has_key?(rename_map, base) do
            Logger.info("Updating markdown reference in #{md}: #{base} -> #{rename_map[base]}")
            "![#{alt}](#{String.replace(path, base, rename_map[base])})"
          else
            "![#{alt}](#{path})"
          end
        end)
      if new_content != content do
        Logger.info("Updated markdown file: #{md}")
        File.write!(md, new_content)
      end
    end)
  end
end
