defmodule Memo.Common.LinkTransformer do
  @moduledoc """
  A module for transforming local links in markdown content to be compatible with Hashnode.
  """

  alias Memo.Common.{Slugify, LinkUtils}

  def transform_local_links(content, file, vaultpath) do
    content
    |> String.split("\n")
    |> Enum.map(&transform_line(&1, file, vaultpath))
    |> Enum.join("\n")
  end

  defp transform_line(line, file, vaultpath) do
    cond do
      String.contains?(line, "![") and String.contains?(line, "](") ->
        transform_image_link(line, file, vaultpath)

      String.contains?(line, "[") and String.contains?(line, "](") ->
        transform_markdown_link(line, file, vaultpath)

      true ->
        line
    end
  end

  defp transform_image_link(line, file, vaultpath) do
    Regex.replace(~r/!\[([^\]]*)\]\(([^)]+)\)/, line, fn _, alt, link ->
      transformed_link = transform_link(link, file, vaultpath)
      "![#{alt}](#{transformed_link})"
    end)
  end

  defp transform_markdown_link(line, file, vaultpath) do
    Regex.replace(~r/\[([^\]]+)\]\(([^)]+)\)/, line, fn _, text, link ->
      transformed_link = transform_link(link, file, vaultpath)
      "[#{text}](#{transformed_link})"
    end)
  end

  defp transform_link(link, file, vaultpath) do
    if LinkUtils.is_url?(link) do
      link
    else
      file_dir = Path.dirname(file)
      absolute_path = Path.expand(link, file_dir)
      relative_to_vault = Path.relative_to(absolute_path, vaultpath)

      if String.starts_with?(relative_to_vault, "..") do
        # The link points outside the vault, don't transform it
        link
      else
        path_parts = Path.split(relative_to_vault)
        filename = List.last(path_parts)
        directory = path_parts |> Enum.drop(-1) |> Enum.map(&Slugify.slugify/1)

        slugified_path =
          (directory ++ [Slugify.slugify_filename(filename)])
          |> Path.join()

        "https://memo.d.foundation/#{slugified_path}"
      end
    end
  end
end
