defmodule Memo.Common.DuckDBUtils do
  @moduledoc """
  Utility functions for DuckDB operations.
  """

  @doc """
  Executes a DuckDB query.
  """
  def execute_query(query) do
    duckdb_cmd(query)
  end

  @doc """
  Executes a DuckDB query.
  """
  def execute_query_temp(query) do
    duckdb_cmd_temp(query)
  end

  @doc """
  Converts query result to a markdown table.
  """
  def result_to_markdown_table(result, query) when is_list(result) and length(result) > 0 do
    headers = extract_headers_from_query(query)

    available_headers =
      case result do
        [%{} | _] -> Map.keys(hd(result))
        _ -> []
      end

    headers =
      if Enum.empty?(headers),
        do: available_headers,
        else: Enum.filter(headers, &(&1 in available_headers))

    headers = if Enum.empty?(headers), do: Map.keys(hd(result)), else: headers

    if Enum.empty?(headers) do
      "No headers found in the result."
    else
      header_row = "| #{Enum.join(headers, " | ")} |"
      separator_row = "|#{String.duplicate("---|", length(headers))}"

      rows =
        Enum.map(result, fn row ->
          "| #{Enum.map(headers, &(get_value(row, &1) |> to_string |> String.trim())) |> Enum.join(" | ")} |"
        end)

      [header_row, separator_row | rows]
      |> Enum.join("\n")
    end
  end

  def result_to_markdown_table(result, _) when is_binary(result), do: result
  def result_to_markdown_table(_, _), do: "No results or invalid data format."

  @doc """
  Converts query result to a markdown list.
  """
  def result_to_markdown_list(result, query) when is_list(result) and length(result) > 0 do
    headers = extract_headers_from_query(query)

    available_headers =
      case result do
        [%{} | _] -> Map.keys(hd(result))
        _ -> []
      end

    headers =
      if Enum.empty?(headers),
        do: available_headers,
        else: Enum.filter(headers, &(&1 in available_headers))

    Enum.map(result, fn row ->
      value =
        if Enum.empty?(headers) do
          format_item(row)
        else
          headers
          |> Enum.map(&get_value(row, &1))
          |> Enum.map(&format_item/1)
          |> Enum.join(": ")
        end

      "- #{value}"
    end)
    |> Enum.join("\n")
  end

  def result_to_markdown_list(result, _) when is_binary(result), do: "- #{result}"
  def result_to_markdown_list(_, _), do: "No results or invalid data format."

  defp duckdb_cmd_temp(query) do
    {result, exit_code} =
      System.cmd("duckdb", [
        "-json",
        "-cmd",
        "IMPORT DATABASE 'db'",
        "-cmd",
        "CREATE OR REPLACE TEMP MACRO markdown_link(title, file_path) AS '[' || COALESCE(title, '/' || REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(^/+)|-+', '')) || '](/' || REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(^/+)|-+', '') || ')'",
        "-c",
        query
      ])

    cond do
      exit_code != 0 ->
        {:error, result}

      result == "" ->
        {:ok, []}

      true ->
        case Jason.decode(result) do
          {:ok, json} -> {:ok, json}
          {:error, _} -> {:ok, result}
        end
    end
  end

  defp duckdb_cmd(query) do
    {result, exit_code} =
      System.cmd("duckdb", [
        "vault.duckdb",
        "-json",
        "-c",
        query
      ])

    cond do
      exit_code != 0 ->
        {:error, result}

      result == "" ->
        {:ok, []}

      true ->
        case Jason.decode(result) do
          {:ok, json} -> {:ok, json}
          {:error, _} -> {:ok, result}
        end
    end
  end

  defp extract_headers_from_query(query) do
    case Regex.run(~r/SELECT\s+(.+?)\s+FROM/is, query) do
      [_, columns] ->
        columns
        |> String.split(",")
        |> Enum.map(&extract_column_name/1)
        |> Enum.filter(&(&1 != nil))

      nil ->
        []
    end
  end

  defp extract_column_name(column) do
    column = String.trim(column)

    cond do
      String.match?(column, ~r/\sAS\s+'([^']+)'/i) ->
        Regex.run(~r/\sAS\s+'([^']+)'/i, column)
        |> List.last()
        |> clean_name()

      String.match?(column, ~r/\sAS\s+"([^"]+)"/i) ->
        Regex.run(~r/\sAS\s+"([^"]+)"/i, column)
        |> List.last()
        |> clean_name()

      String.match?(column, ~r/\sAS\s/i) ->
        [_, alias] = Regex.split(~r/\sAS\s/i, column, parts: 2)
        clean_name(alias)

      String.match?(column, ~r/^[\w\d_]+\(.*\)\s+\w+$/) ->
        Regex.run(~r/^.*\)\s+(\w+)$/, column)
        |> List.last()
        |> clean_name()

      String.match?(column, ~r/^[\w\d_]+\(.*\)\s+AS\s+\w+$/i) ->
        Regex.run(~r/^.*\)\s+AS\s+(\w+)$/i, column)
        |> List.last()
        |> clean_name()

      true ->
        clean_name(column)
    end
  end

  defp clean_name(name) do
    name
    |> String.replace(~r/["\[\]`()]/, "")
    |> String.trim()
  end

  defp get_value(row, key) when is_map(row) do
    cond do
      Map.has_key?(row, key) -> row[key]
      Map.has_key?(row, String.downcase(key)) -> row[String.downcase(key)]
      Map.has_key?(row, String.upcase(key)) -> row[String.upcase(key)]
      true -> nil
    end
  end

  defp get_value(row, _key), do: row

  defp format_item(item) when is_binary(item), do: String.trim(item)

  defp format_item(item) when is_map(item) do
    case Map.values(item) do
      [single_value] -> format_item(single_value)
      _ -> Enum.map_join(item, ", ", fn {k, v} -> "#{k}: #{v}" end)
    end
  end

  defp format_item(item), do: to_string(item)
end
