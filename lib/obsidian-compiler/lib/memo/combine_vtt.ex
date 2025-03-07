defmodule Memo.CombineVTT do
  @moduledoc """
  Module to combine multiple VTT transcripts with parallel processing.
  """

  use Flow

  def parse_vtt(file) do
    {:ok, content} = File.read(file)
    speaker = Path.basename(file, ".vtt")

    content
    |> String.split("\n")
    |> extract_timestamped_lines(speaker, [])
  end

  def extract_timestamped_lines([], _speaker, acc), do: acc

  def extract_timestamped_lines([line | rest], speaker, acc) do
    if match_timestamp_line(line) and length(rest) > 0 do
      text = hd(rest)
      start_time = line |> String.split("-->") |> hd() |> parse_timestamp()

      extract_timestamped_lines(tl(rest), speaker, [
        {start_time, speaker, String.trim(text)} | acc
      ])
    else
      extract_timestamped_lines(rest, speaker, acc)
    end
  end

  defp match_timestamp_line(line), do: String.contains?(line, "-->")

  def parse_timestamp(timestamp) do
    [hours, minutes, seconds_millis] =
      String.split(String.trim(timestamp), ":")
      |> handle_timestamp_parts()

    {seconds, millis} = parse_seconds_millis(seconds_millis)
    build_datetime(hours, minutes, seconds, millis)
  end

  defp handle_timestamp_parts([minutes, seconds_millis]), do: ["00", minutes, seconds_millis]
  defp handle_timestamp_parts(parts), do: parts

  defp parse_seconds_millis(seconds_millis) do
    [seconds, millis] = String.split(seconds_millis, ".")
    {String.to_integer(seconds), pad(millis, 3)}
  end

  defp build_datetime(hours, minutes, seconds, millis) do
    datetime_string =
      "1970-01-01T#{pad(hours)}:#{pad(minutes)}:#{pad(seconds)}.#{pad(millis, 3)}Z"

    case DateTime.from_iso8601(datetime_string) do
      {:ok, dt, _} -> dt
      _ -> raise "Invalid timestamp: #{datetime_string}"
    end
  end

  defp pad(value, length \\ 2) do
    value = if is_binary(value), do: value, else: Integer.to_string(value)
    String.pad_leading(value, length, "0")
  end

  def combine_transcripts(files) do
    files
    |> Flow.from_enumerable()
    |> Flow.flat_map(&parse_vtt/1)
    |> Enum.to_list()
    |> Enum.sort_by(&DateTime.to_unix(elem(&1, 0)))
    |> Enum.map(fn {timestamp, speaker, text} ->
      "#{DateTime.to_time(timestamp)}: #{speaker}: #{text}\n"
    end)
    |> Enum.join()
  end

  def run(args) do
    {files, output} = parse_args(args)

    combined_content = combine_transcripts(files)
    IO.puts(combined_content)

    if output do
      File.write!(output, combined_content)
    end
  end

  def parse_args(args) do
    {opts, files, _} =
      OptionParser.parse(args, switches: [output: :string], aliases: [o: :output])

    {files, Keyword.get(opts, :output)}
  end
end
