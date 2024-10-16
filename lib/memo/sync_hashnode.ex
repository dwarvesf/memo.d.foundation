defmodule Memo.SyncHashnode do
  @moduledoc """
  A module to sync markdown files with Hashnode API.
  This module now includes functionality to transform local links and images
  before sending content to Hashnode.
  """

  alias Memo.Common.{FileUtils, Frontmatter, Slugify, LinkTransformer}
  require Logger

  @hashnode_api_url "https://gql.hashnode.com/"
  @debug_mode true

  def run(vaultpath) do
    if File.exists?(".env") do
      DotenvParser.load_file(".env")
    end

    vaultpath = Path.expand(vaultpath || "vault")
    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))

    FileUtils.list_files_recursive(vaultpath)
    |> Enum.filter(&(not FileUtils.ignored?(&1, ignored_patterns, vaultpath)))
    |> Enum.filter(&File.regular?/1)
    |> Enum.filter(&has_hashnode_sync?/1)
    |> Enum.each(&process_file(&1, vaultpath))
  end

  defp has_hashnode_sync?(file) do
    case Frontmatter.parse_frontmatter(File.read!(file)) do
      {:ok, frontmatter} ->
        Map.get(frontmatter, "sync") == "hashnode"

      _ ->
        false
    end
  end

  defp process_file(file, vaultpath) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- Frontmatter.parse_frontmatter(content),
         true <- Frontmatter.contains_required_frontmatter_keys?(file) do
      hashnode_meta = Map.get(frontmatter, "hashnode_meta")
      content_without_frontmatter = Frontmatter.strip_frontmatter(content)
      transformed_content = LinkTransformer.transform_local_links(content_without_frontmatter, file, vaultpath)

      if @debug_mode do
        IO.puts("Original content:")
        IO.puts(content_without_frontmatter)
        IO.puts("\nTransformed content:")
        IO.puts(transformed_content)
      end

      unless @debug_mode do
        if is_nil(hashnode_meta) do
          publish_post(file, frontmatter, transformed_content)
        else
          update_post(file, frontmatter, transformed_content, hashnode_meta)
        end
      end
    else
      _ ->
        Logger.error("Error processing file: #{file}")
    end
  end

  defp publish_post(file, frontmatter, content) do
    mutation = """
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          slug
          title
        }
      }
    }
    """

    variables = %{
      input: %{
        title: Map.get(frontmatter, "title", "Untitled"),
        contentMarkdown: content,
        tags: format_tags(Map.get(frontmatter, "tags", [])),
        publicationId: System.get_env("HASHNODE_PUBLICATION_ID")
      }
    }

    case execute_query(mutation, variables) do
      {:ok, %Neuron.Response{body: %{"data" => %{"publishPost" => %{"post" => post}}}}} ->
        update_frontmatter(file, frontmatter, post)
        Logger.info("Published post: #{file}")

      {:error, error} ->
        Logger.error("Error publishing post #{file}: #{inspect(error)}")

      unexpected ->
        Logger.error("Unexpected response for #{file}: #{inspect(unexpected)}")
    end
  end

  defp update_post(file, frontmatter, content, hashnode_meta) do
    mutation = """
    mutation UpdatePost($input: UpdatePostInput!) {
      updatePost(input: $input) {
        post {
          id
          slug
          title
        }
      }
    }
    """

    variables = %{
      input: %{
        id: hashnode_meta["id"],
        title: Map.get(frontmatter, "title", "Untitled"),
        contentMarkdown: content,
        tags: format_tags(Map.get(frontmatter, "tags", []))
      }
    }

    case execute_query(mutation, variables) do
      {:ok, %Neuron.Response{body: %{"data" => %{"updatePost" => %{"post" => post}}}}} ->
        update_frontmatter(file, frontmatter, post)
        Logger.info("Updated post: #{file}")

      {:error, error} ->
        Logger.error("Error updating post #{file}: #{inspect(error)}")

      unexpected ->
        Logger.error("Unexpected response for #{file}: #{inspect(unexpected)}")
    end
  end

  defp execute_query(query, variables) do
    headers = [
      content_type: "application/json",
      authorization: System.get_env("HASHNODE_PAT")
    ]

    Neuron.Config.set(url: @hashnode_api_url)
    Neuron.query(query, variables, headers: headers)
  end

  defp update_frontmatter(file, frontmatter, post) do
    updated_frontmatter =
      frontmatter
      |> Map.put("hashnode_meta", %{
        "id" => post["id"],
        "slug" => post["slug"]
      })

    updated_content =
      "---\n#{Frontmatter.dump_frontmatter(updated_frontmatter)}\n---\n#{String.trim(Frontmatter.strip_frontmatter(File.read!(file)))}"

    File.write!(file, updated_content)
  end

  defp format_tags(tags) do
    Enum.map(tags, fn tag ->
      %{
        slug: slugify(tag),
        name: tag
      }
    end)
  end

  defp slugify(text) do
    text
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/[\s-]+/, "-")
    |> String.trim("-")
  end
end
