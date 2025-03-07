defmodule Memo.SyncHashnode do
  @moduledoc """
  A module to sync markdown files with Hashnode API.
  This module includes functionality to transform local links and images
  before sending content to Hashnode.
  """

  alias Memo.Common.{FileUtils, Frontmatter, Slugify, LinkTransformer, GitUtils}
  require Logger

  @hashnode_api_url "https://gql.hashnode.com/"
  @debug_mode false

  @doc """
  Runs the sync process for the given vault path.
  """
  def run(vaultpath) do
    load_env()
    vaultpath = Path.expand(vaultpath || "vault")
    ignored_patterns = FileUtils.read_export_ignore_file(Path.join(vaultpath, ".export-ignore"))

    vaultpath
    |> FileUtils.list_files_recursive()
    |> Stream.filter(&(not FileUtils.ignored?(&1, ignored_patterns, vaultpath)))
    |> Stream.filter(&File.regular?/1)
    |> Stream.filter(&has_hashnode_sync?/1)
    |> Enum.each(&process_file(&1, vaultpath))
  end

  defp load_env do
    if File.exists?(".env"), do: DotenvParser.load_file(".env")
  end

  defp has_hashnode_sync?(file) do
    case Frontmatter.parse_frontmatter(File.read!(file)) do
      {:ok, frontmatter} -> Map.get(frontmatter, "sync") == "hashnode"
      _ -> false
    end
  end

  defp process_file(file, vaultpath) do
    with {:ok, content} <- File.read(file),
         {:ok, frontmatter} <- Frontmatter.parse_frontmatter(content),
         true <- Frontmatter.contains_required_frontmatter_keys?(file) do
      content_without_frontmatter = Frontmatter.strip_frontmatter(content)

      transformed_content =
        LinkTransformer.transform_local_links(content_without_frontmatter, file, vaultpath)

      if @debug_mode do
        IO.puts("Original content:")
        IO.puts(content_without_frontmatter)
        IO.puts("\nTransformed content:")
        IO.puts(transformed_content)
      else
        sync_with_hashnode(file, frontmatter, transformed_content, vaultpath)
      end
    else
      _ -> Logger.error("Error processing file: #{file}")
    end
  end

  defp sync_with_hashnode(file, frontmatter, content, vaultpath) do
    case Map.get(frontmatter, "hashnode_meta") do
      nil -> publish_post(file, frontmatter, content, vaultpath)
      meta -> update_post(file, frontmatter, content, meta, vaultpath)
    end
  end

  defp publish_post(file, frontmatter, content, vaultpath) do
    mutation = """
    mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) {
        post {
          id
          slug
          title
          coverImage {
            url
          }
        }
      }
    }
    """

    variables = %{
      input: build_post_input(frontmatter, content, file, vaultpath, :publish)
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

  defp update_post(file, frontmatter, content, hashnode_meta, vaultpath) do
    modified_files = GitUtils.get_modified_files(vaultpath)
    relative_file_path = Path.relative_to(file, vaultpath)

    if relative_file_path in modified_files do
      mutation = """
      mutation UpdatePost($input: UpdatePostInput!) {
        updatePost(input: $input) {
          post {
            id
            slug
            title
            coverImage {
              url
            }
          }
        }
      }
      """

      variables = %{
        input:
          build_post_input(frontmatter, content, file, vaultpath, :update)
          |> Map.put(:id, hashnode_meta["id"])
      }

      case execute_query(mutation, variables) do
        {:ok, %Neuron.Response{body: %{"data" => %{"updatePost" => %{"post" => post}}}}} ->
          update_frontmatter(file, frontmatter, post, hashnode_meta)
          Logger.info("Updated post: #{file}")

        {:error, error} ->
          Logger.error("Error updating post #{file}: #{inspect(error)}")

        unexpected ->
          Logger.error("Unexpected response for #{file}: #{inspect(unexpected)}")
      end
    else
      Logger.info("Skipping update for #{file} as it has not been modified recently")
    end
  end

  defp build_post_input(frontmatter, content, file, vaultpath, operation) do
    cover_image_url = extract_first_image_url(content)
    original_article_url = generate_original_article_url(file, vaultpath)

    base_input = %{
      title: Map.get(frontmatter, "title", "Untitled"),
      contentMarkdown: content,
      tags: format_tags(Map.get(frontmatter, "tags", [])),
      publicationId: System.get_env("HASHNODE_PUBLICATION_ID"),
      coverImageOptions: %{
        coverImageURL: cover_image_url
      },
      originalArticleURL: original_article_url
    }

    case operation do
      :publish ->
        Map.put(base_input, :settings, %{
          enableTableOfContent: true
        })

      :update ->
        Map.put(base_input, :settings, %{
          isTableOfContentEnabled: true
        })
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

  defp update_frontmatter(file, frontmatter, post, existing_hashnode_meta \\ %{}) do
    updated_hashnode_meta =
      existing_hashnode_meta
      |> Map.merge(%{
        "id" => post["id"],
        "slug" => post["slug"],
        "coverImageOptions" => %{
          "coverImageURL" =>
            get_in(post, ["coverImage", "url"]) ||
              get_in(existing_hashnode_meta, ["coverImageOptions", "coverImageURL"])
        }
      })
      |> Frontmatter.remove_nil_and_empty_values()

    updated_frontmatter = Map.put(frontmatter, "hashnode_meta", updated_hashnode_meta)

    updated_content =
      "---\n" <>
        Frontmatter.dump_frontmatter(updated_frontmatter) <>
        "\n---\n" <>
        String.trim(Frontmatter.strip_frontmatter(File.read!(file)))

    File.write!(file, updated_content)
  end

  defp format_tags(tags) do
    Enum.map(tags, fn tag ->
      %{
        slug: Slugify.slugify(tag),
        name: tag
      }
    end)
  end

  defp extract_first_image_url(content) do
    case Regex.run(~r/!\[.*?\]\((.*?)\)/, content) do
      [_, url] -> url
      _ -> nil
    end
  end

  defp generate_original_article_url(file, vaultpath) do
    file
    |> Path.relative_to(vaultpath)
    |> Path.split()
    |> Enum.map(&Slugify.slugify_filename/1)
    |> Path.join()
    |> (&"https://memo.d.foundation/#{&1}").()
  end
end
